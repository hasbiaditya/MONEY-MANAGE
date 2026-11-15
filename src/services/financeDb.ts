import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  WriteBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  Account,
  BudgetConfig,
  SavingsGoal,
  ThemePreference,
  Transaction,
  UserProfile,
} from '../types/finance';
import {
  DEFAULT_ACCOUNTS,
  DEFAULT_BUDGET,
} from '../data/defaultData';
import { getCurrentTimeString, getTodayDateString } from '../utils/formatters';

const LOCAL_STORAGE_KEYS = {
  TRANSACTIONS: 'keuangan_transaksi_v1',
  ACCOUNTS: 'keuangan_akun_v1',
  BUDGET: 'keuangan_anggaran_v1',
};

function sanitizeId(raw: string | undefined, prefix: string): string {
  const cleaned = (raw || '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  if (cleaned && /^[a-zA-Z0-9_-]+$/.test(cleaned)) {
    return cleaned;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function sanitizeDate(dateStr: string | undefined): string {
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  return getTodayDateString();
}

function sanitizeTime(timeStr: string | undefined): string {
  if (timeStr && /^\d{2}:\d{2}$/.test(timeStr)) {
    return timeStr;
  }
  return getCurrentTimeString();
}

function sanitizeAmount(amount: number): number {
  const rounded = Math.round(Number(amount) || 0);
  return Math.max(1, Math.min(100_000_000_000, rounded));
}

function sanitizeInitialBalance(amount: number): number {
  const rounded = Math.round(Number(amount) || 0);
  return Math.max(-100_000_000_000, Math.min(100_000_000_000, rounded));
}

function sanitizeBudgetLimit(limit: number): number {
  const rounded = Math.round(Number(limit) || 0);
  return Math.max(0, Math.min(100_000_000_000, rounded));
}

function sanitizeAccountPayload(uid: string, acc: Account) {
  const id = sanitizeId(acc.id, 'acc');
  const type = acc.type === 'cash' || acc.type === 'bank' || acc.type === 'ewallet' ? acc.type : 'bank';
  const name = (acc.name || 'Dompet').trim().slice(0, 60) || 'Dompet';
  const color = (acc.color && acc.color.length >= 4 ? acc.color : '#059669').slice(0, 20);
  return {
    id,
    ownerId: uid,
    name,
    type,
    initialBalance: sanitizeInitialBalance(acc.initialBalance),
    color,
  };
}

interface SanitizedTransactionPayload {
  id: string;
  ownerId: string;
  type: Transaction['type'];
  amount: number;
  category: string;
  date: string;
  time: string;
  accountId: string;
  toAccountId?: string;
  adminFee?: number;
  note: string;
}

function sanitizeAdminFee(fee: number | undefined): number {
  const rounded = Math.round(Number(fee) || 0);
  return Math.max(0, Math.min(1_000_000_000, rounded));
}

function sanitizeTransactionPayload(
  uid: string,
  tx: Omit<Transaction, 'id' | 'createdAt'> & { id?: string }
): SanitizedTransactionPayload {
  const id = sanitizeId(tx.id, 'tx');
  const type = tx.type === 'income' || tx.type === 'transfer' || tx.type === 'expense' ? tx.type : 'expense';
  const category =
    type === 'transfer'
      ? 'Transfer Saldo'
      : (tx.category || 'Lain-lain').trim().slice(0, 60) || 'Lain-lain';

  const base: SanitizedTransactionPayload = {
    id,
    ownerId: uid,
    type,
    amount: sanitizeAmount(tx.amount),
    category,
    date: sanitizeDate(tx.date),
    time: sanitizeTime(tx.time),
    accountId: sanitizeId(tx.accountId, 'cash'),
    note: (tx.note || '').slice(0, 300),
  };

  if (type === 'transfer') {
    const cleanFee = sanitizeAdminFee(tx.adminFee);
    const result: SanitizedTransactionPayload = {
      ...base,
      toAccountId: sanitizeId(tx.toAccountId || 'ewallet', 'ewallet'),
    };
    if (cleanFee > 0) {
      result.adminFee = cleanFee;
    }
    return result;
  }
  return base;
}

async function commitInChunks(operations: Array<(batch: WriteBatch) => void>, pathContext: string) {
  const CHUNK_SIZE = 400;
  for (let i = 0; i < operations.length; i += CHUNK_SIZE) {
    const chunk = operations.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((op) => op(batch));
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, pathContext);
    }
  }
}

function readLocalSeedData(): {
  transactions: Transaction[];
  accounts: Account[];
  budget: BudgetConfig;
} {
  try {
    const savedTx = localStorage.getItem(LOCAL_STORAGE_KEYS.TRANSACTIONS);
    const savedAcc = localStorage.getItem(LOCAL_STORAGE_KEYS.ACCOUNTS);
    const savedBudget = localStorage.getItem(LOCAL_STORAGE_KEYS.BUDGET);

    const transactions: Transaction[] = savedTx ? JSON.parse(savedTx) : [];
    const accounts: Account[] = savedAcc ? JSON.parse(savedAcc) : DEFAULT_ACCOUNTS;
    const budget: BudgetConfig = savedBudget ? JSON.parse(savedBudget) : DEFAULT_BUDGET;

    return {
      transactions: Array.isArray(transactions) ? transactions : [],
      accounts: Array.isArray(accounts) && accounts.length > 0 ? accounts : DEFAULT_ACCOUNTS,
      budget: budget && typeof budget.monthlyLimit === 'number' ? budget : DEFAULT_BUDGET,
    };
  } catch {
    return {
      transactions: [],
      accounts: DEFAULT_ACCOUNTS,
      budget: DEFAULT_BUDGET,
    };
  }
}

/**
 * Ensures the signed-in Google user profile is saved in Firestore `/users/{uid}`
 * and seeds initial accounts/transactions on their first sign-in.
 */
export async function syncGoogleUserAndSeedIfNeeded(user: User): Promise<void> {
  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);

  let existingSnap;
  try {
    existingSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  const email = (user.email || 'user@example.com').slice(0, 254);
  const displayName =
    (user.displayName || user.email?.split('@')[0] || 'Pengguna').trim().slice(0, 100) || 'Pengguna';
  const photoURL = (user.photoURL || '').slice(0, 1000);

  if (!existingSnap.exists()) {
    const seed = readLocalSeedData();
    const ops: Array<(batch: WriteBatch) => void> = [];

    ops.push((batch) => {
      batch.set(userRef, {
        uid: user.uid,
        email,
        displayName,
        photoURL,
        monthlyLimit: sanitizeBudgetLimit(seed.budget.monthlyLimit),
        dailyLimit: sanitizeBudgetLimit(seed.budget.dailyLimit ?? 0),
        alertsEnabled: Boolean(seed.budget.alertsEnabled ?? true),
        onboardingCompleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
    });

    seed.accounts.forEach((acc) => {
      const payload = sanitizeAccountPayload(user.uid, acc);
      const accRef = doc(db, 'users', user.uid, 'accounts', payload.id);
      ops.push((batch) => {
        batch.set(accRef, {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
    });

    seed.transactions.forEach((tx) => {
      const payload = sanitizeTransactionPayload(user.uid, tx);
      const txRef = doc(db, 'users', user.uid, 'transactions', payload.id);
      ops.push((batch) => {
        batch.set(txRef, {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
    });

    await commitInChunks(ops, userPath);
  } else {
    try {
      await updateDoc(userRef, {
        email,
        displayName,
        photoURL,
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, userPath);
    }
  }
}

export function subscribeToUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void
): () => void {
  const path = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  return onSnapshot(
    userRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      const data = snapshot.data();
      onData({
        uid: String(data.uid || uid),
        email: String(data.email || ''),
        displayName: String(data.displayName || 'Pengguna'),
        photoURL: typeof data.photoURL === 'string' && data.photoURL ? data.photoURL : undefined,
        monthlyLimit: typeof data.monthlyLimit === 'number' ? data.monthlyLimit : DEFAULT_BUDGET.monthlyLimit,
        dailyLimit: typeof data.dailyLimit === 'number' ? data.dailyLimit : 0,
        alertsEnabled: typeof data.alertsEnabled === 'boolean' ? data.alertsEnabled : true,
        appLockEnabled: typeof data.appLockEnabled === 'boolean' ? data.appLockEnabled : false,
        appLockType: data.appLockType === 'password' ? 'password' : 'pin',
        appLockHash: typeof data.appLockHash === 'string' ? data.appLockHash : '',
        appLockSalt: typeof data.appLockSalt === 'string' ? data.appLockSalt : '',
        biometricEnabled: typeof data.biometricEnabled === 'boolean' ? data.biometricEnabled : false,
        themePreference:
          data.themePreference === 'dark' ||
          data.themePreference === 'light' ||
          data.themePreference === 'system'
            ? data.themePreference
            : undefined,
        onboardingCompleted:
          typeof data.onboardingCompleted === 'boolean' ? data.onboardingCompleted : undefined,
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeToAccounts(
  uid: string,
  onData: (accounts: Account[]) => void
): () => void {
  const path = `users/${uid}/accounts`;
  const q = query(collection(db, 'users', uid, 'accounts'), where('ownerId', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Account[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: String(data.id || docSnap.id),
          name: String(data.name || 'Dompet'),
          type: data.type === 'cash' || data.type === 'bank' || data.type === 'ewallet' ? data.type : 'bank',
          initialBalance: typeof data.initialBalance === 'number' ? data.initialBalance : 0,
          color: String(data.color || '#059669'),
        };
      });
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeToTransactions(
  uid: string,
  onData: (transactions: Transaction[]) => void
): () => void {
  const path = `users/${uid}/transactions`;
  const q = query(collection(db, 'users', uid, 'transactions'), where('ownerId', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Transaction[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const createdAtTs = data.createdAt as Timestamp | undefined;
        const createdAtMs =
          createdAtTs && typeof createdAtTs.toMillis === 'function'
            ? createdAtTs.toMillis()
            : Date.now();

        return {
          id: String(data.id || docSnap.id),
          type: data.type === 'income' || data.type === 'transfer' ? data.type : 'expense',
          amount: typeof data.amount === 'number' ? data.amount : 0,
          category: String(data.category || 'Lain-lain'),
          date: String(data.date || getTodayDateString()),
          time: String(data.time || '00:00'),
          accountId: String(data.accountId || 'cash'),
          toAccountId: typeof data.toAccountId === 'string' ? data.toAccountId : undefined,
          adminFee:
            typeof data.adminFee === 'number' && data.adminFee > 0 ? data.adminFee : undefined,
          note: String(data.note || ''),
          createdAt: createdAtMs,
        };
      });
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function saveTransactionToDb(
  uid: string,
  data: Omit<Transaction, 'id' | 'createdAt'> & { id?: string }
): Promise<void> {
  const isUpdate = Boolean(data.id);
  const payload = sanitizeTransactionPayload(uid, data);
  const txPath = `users/${uid}/transactions/${payload.id}`;
  const txRef = doc(db, 'users', uid, 'transactions', payload.id);

  if (isUpdate) {
    try {
      await updateDoc(txRef, {
        type: payload.type,
        amount: payload.amount,
        category: payload.category,
        date: payload.date,
        time: payload.time,
        accountId: payload.accountId,
        toAccountId: payload.type === 'transfer' ? payload.toAccountId : deleteField(),
        adminFee:
          payload.type === 'transfer' && payload.adminFee && payload.adminFee > 0
            ? payload.adminFee
            : deleteField(),
        note: payload.note,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, txPath);
    }
  } else {
    const batch = writeBatch(db);
    batch.set(txRef, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, txPath);
    }
  }
}

export async function deleteTransactionFromDb(uid: string, txId: string): Promise<void> {
  const safeId = sanitizeId(txId, 'tx');
  const txPath = `users/${uid}/transactions/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'transactions', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, txPath);
  }
}

export async function updateBudgetInDb(uid: string, budget: BudgetConfig): Promise<void> {
  const userPath = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      monthlyLimit: sanitizeBudgetLimit(budget.monthlyLimit),
      dailyLimit: sanitizeBudgetLimit(budget.dailyLimit ?? 0),
      alertsEnabled: Boolean(budget.alertsEnabled),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export interface AppLockUpdatePayload {
  appLockEnabled: boolean;
  appLockType: 'pin' | 'password';
  appLockHash: string;
  appLockSalt: string;
  biometricEnabled: boolean;
}

export async function updateAppLockInDb(
  uid: string,
  payload: AppLockUpdatePayload
): Promise<void> {
  const userPath = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      appLockEnabled: Boolean(payload.appLockEnabled),
      appLockType: payload.appLockType === 'password' ? 'password' : 'pin',
      appLockHash: (payload.appLockHash || '').slice(0, 128),
      appLockSalt: (payload.appLockSalt || '').slice(0, 64),
      biometricEnabled: Boolean(payload.biometricEnabled),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function updateUserPreferencesInDb(
  uid: string,
  prefs: { themePreference?: ThemePreference; onboardingCompleted?: boolean }
): Promise<void> {
  const userPath = `users/${uid}`;
  const updates: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (
    prefs.themePreference === 'light' ||
    prefs.themePreference === 'dark' ||
    prefs.themePreference === 'system'
  ) {
    updates.themePreference = prefs.themePreference;
  }
  if (typeof prefs.onboardingCompleted === 'boolean') {
    updates.onboardingCompleted = prefs.onboardingCompleted;
  }

  try {
    await updateDoc(doc(db, 'users', uid), updates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function syncAccountsDiffToDb(
  uid: string,
  _prevAccounts: Account[],
  nextAccounts: Account[]
): Promise<void> {
  const pathContext = `users/${uid}/accounts`;

  let existingSnap;
  try {
    existingSnap = await getDocs(
      query(collection(db, 'users', uid, 'accounts'), where('ownerId', '==', uid))
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, pathContext);
  }

  const existingMap = new Map(existingSnap.docs.map((d) => [d.id, d.data()]));
  const sanitizedNext = nextAccounts.map((acc) => sanitizeAccountPayload(uid, acc));
  const nextIdSet = new Set(sanitizedNext.map((a) => a.id));
  const ops: Array<(batch: WriteBatch) => void> = [];

  // Deletions
  existingSnap.docs.forEach((docSnap) => {
    if (!nextIdSet.has(docSnap.id)) {
      ops.push((batch) => batch.delete(docSnap.ref));
    }
  });

  // Creations and Updates
  sanitizedNext.forEach((payload) => {
    const ref = doc(db, 'users', uid, 'accounts', payload.id);
    const existingData = existingMap.get(payload.id);

    if (!existingData) {
      ops.push((batch) =>
        batch.set(ref, {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    } else if (
      existingData.name !== payload.name ||
      existingData.type !== payload.type ||
      existingData.initialBalance !== payload.initialBalance ||
      existingData.color !== payload.color
    ) {
      ops.push((batch) =>
        batch.update(ref, {
          name: payload.name,
          type: payload.type,
          initialBalance: payload.initialBalance,
          color: payload.color,
          updatedAt: serverTimestamp(),
        })
      );
    }
  });

  if (ops.length > 0) {
    await commitInChunks(ops, pathContext);
  }
}

export async function saveAccountToDb(uid: string, account: Account): Promise<Account> {
  const payload = sanitizeAccountPayload(uid, account);
  const accPath = `users/${uid}/accounts/${payload.id}`;
  const accRef = doc(db, 'users', uid, 'accounts', payload.id);
  const batch = writeBatch(db);
  batch.set(accRef, {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, accPath);
  }
  return {
    id: payload.id,
    name: payload.name,
    type: payload.type,
    initialBalance: payload.initialBalance,
    color: payload.color,
  };
}

export async function restoreUserDataInDb(
  uid: string,
  data: {
    transactions: Transaction[];
    accounts: Account[];
    budget: BudgetConfig;
  }
): Promise<void> {
  const accountsPath = `users/${uid}/accounts`;
  const transactionsPath = `users/${uid}/transactions`;

  let existingAccSnap;
  let existingTxSnap;
  try {
    [existingAccSnap, existingTxSnap] = await Promise.all([
      getDocs(query(collection(db, 'users', uid, 'accounts'), where('ownerId', '==', uid))),
      getDocs(query(collection(db, 'users', uid, 'transactions'), where('ownerId', '==', uid))),
    ]);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, transactionsPath);
  }

  const existingAccIds = new Set(existingAccSnap.docs.map((d) => d.id));
  const existingTxMap = new Map(
    existingTxSnap.docs.map((d) => [d.id, d.data()])
  );

  const accountsToWrite = (data.accounts.length > 0 ? data.accounts : DEFAULT_ACCOUNTS).map((acc) =>
    sanitizeAccountPayload(uid, acc)
  );
  const nextAccIds = new Set(accountsToWrite.map((a) => a.id));

  const txsToWrite = data.transactions.map((tx) => sanitizeTransactionPayload(uid, tx));
  const nextTxIds = new Set(txsToWrite.map((t) => t.id));

  const ops: Array<(batch: WriteBatch) => void> = [];

  // Delete obsolete accounts only
  existingAccSnap.docs.forEach((d) => {
    if (!nextAccIds.has(d.id)) {
      ops.push((batch) => batch.delete(d.ref));
    }
  });

  // Delete obsolete transactions only
  existingTxSnap.docs.forEach((d) => {
    if (!nextTxIds.has(d.id)) {
      ops.push((batch) => batch.delete(d.ref));
    }
  });

  // Upsert accounts (update if existing, create if new)
  accountsToWrite.forEach((payload) => {
    const ref = doc(db, 'users', uid, 'accounts', payload.id);
    if (existingAccIds.has(payload.id)) {
      ops.push((batch) =>
        batch.update(ref, {
          name: payload.name,
          type: payload.type,
          initialBalance: payload.initialBalance,
          color: payload.color,
          updatedAt: serverTimestamp(),
        })
      );
    } else {
      ops.push((batch) =>
        batch.set(ref, {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    }
  });

  // Upsert transactions (update if existing, create if new)
  txsToWrite.forEach((payload) => {
    const ref = doc(db, 'users', uid, 'transactions', payload.id);
    const existingTxData = existingTxMap.get(payload.id);
    if (existingTxData) {
      const updateFields: Record<string, unknown> = {
        type: payload.type,
        amount: payload.amount,
        category: payload.category,
        date: payload.date,
        time: payload.time,
        accountId: payload.accountId,
        note: payload.note,
        updatedAt: serverTimestamp(),
      };
      if (payload.type === 'transfer') {
        updateFields.toAccountId = payload.toAccountId;
        if (payload.adminFee && payload.adminFee > 0) {
          updateFields.adminFee = payload.adminFee;
        } else if ('adminFee' in existingTxData) {
          updateFields.adminFee = deleteField();
        }
      } else {
        if ('toAccountId' in existingTxData) {
          updateFields.toAccountId = deleteField();
        }
        if ('adminFee' in existingTxData) {
          updateFields.adminFee = deleteField();
        }
      }
      ops.push((batch) => batch.update(ref, updateFields));
    } else {
      ops.push((batch) =>
        batch.set(ref, {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    }
  });

  // Update budget
  ops.push((batch) =>
    batch.update(doc(db, 'users', uid), {
      monthlyLimit: sanitizeBudgetLimit(data.budget.monthlyLimit),
      dailyLimit: sanitizeBudgetLimit(data.budget.dailyLimit ?? 0),
      alertsEnabled: Boolean(data.budget.alertsEnabled),
      updatedAt: serverTimestamp(),
    })
  );

  await commitInChunks(ops, accountsPath);
}

export async function resetUserDataInDb(uid: string): Promise<void> {
  await restoreUserDataInDb(uid, {
    transactions: [],
    accounts: DEFAULT_ACCOUNTS,
    budget: DEFAULT_BUDGET,
  });
}

function sanitizeSavingsGoalPayload(
  uid: string,
  goal: Omit<SavingsGoal, 'id' | 'createdAt'> & { id?: string }
) {
  const id = sanitizeId(goal.id, 'goal');
  const name = (goal.name || 'Target Tabungan').trim().slice(0, 80) || 'Target Tabungan';
  const category = (goal.category || 'Lainnya').trim().slice(0, 60) || 'Lainnya';
  const targetAmount = sanitizeAmount(goal.targetAmount);
  const rawCurrent = Math.round(Number(goal.currentAmount) || 0);
  const currentAmount = Math.max(0, Math.min(100_000_000_000, rawCurrent));
  const deadline =
    goal.deadline && /^\d{4}-\d{2}-\d{2}$/.test(goal.deadline) ? goal.deadline : '';
  const color = (goal.color && goal.color.length >= 4 ? goal.color : '#0f766e').slice(0, 20);

  return {
    id,
    ownerId: uid,
    name,
    category,
    targetAmount,
    currentAmount,
    deadline,
    color,
  };
}

export function subscribeToSavingsGoals(
  uid: string,
  onData: (goals: SavingsGoal[]) => void
): () => void {
  const path = `users/${uid}/goals`;
  const q = query(collection(db, 'users', uid, 'goals'), where('ownerId', '==', uid));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: SavingsGoal[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const createdAtTs = data.createdAt as Timestamp | undefined;
        const createdAtMs =
          createdAtTs && typeof createdAtTs.toMillis === 'function'
            ? createdAtTs.toMillis()
            : Date.now();
        return {
          id: String(data.id || docSnap.id),
          name: String(data.name || 'Target Tabungan'),
          category: String(data.category || 'Lainnya'),
          targetAmount: typeof data.targetAmount === 'number' ? data.targetAmount : 0,
          currentAmount: typeof data.currentAmount === 'number' ? data.currentAmount : 0,
          deadline: typeof data.deadline === 'string' ? data.deadline : '',
          color: String(data.color || '#0f766e'),
          createdAt: createdAtMs,
        };
      });
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function saveSavingsGoalToDb(
  uid: string,
  goal: Omit<SavingsGoal, 'id' | 'createdAt'> & { id?: string }
): Promise<void> {
  const isUpdate = Boolean(goal.id);
  const payload = sanitizeSavingsGoalPayload(uid, goal);
  const goalPath = `users/${uid}/goals/${payload.id}`;
  const goalRef = doc(db, 'users', uid, 'goals', payload.id);

  if (isUpdate) {
    try {
      await updateDoc(goalRef, {
        name: payload.name,
        category: payload.category,
        targetAmount: payload.targetAmount,
        currentAmount: payload.currentAmount,
        deadline: payload.deadline,
        color: payload.color,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, goalPath);
    }
  } else {
    const batch = writeBatch(db);
    batch.set(goalRef, {
      ...payload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, goalPath);
    }
  }
}

export async function contributeSavingsGoalInDb(
  uid: string,
  goalId: string,
  nextCurrentAmount: number
): Promise<void> {
  const safeId = sanitizeId(goalId, 'goal');
  const goalPath = `users/${uid}/goals/${safeId}`;
  const clamped = Math.max(0, Math.min(100_000_000_000, Math.round(Number(nextCurrentAmount) || 0)));
  try {
    await updateDoc(doc(db, 'users', uid, 'goals', safeId), {
      currentAmount: clamped,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, goalPath);
  }
}

export async function deleteSavingsGoalFromDb(uid: string, goalId: string): Promise<void> {
  const safeId = sanitizeId(goalId, 'goal');
  const goalPath = `users/${uid}/goals/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'goals', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, goalPath);
  }
}
