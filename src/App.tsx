import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { Plus, Loader2, AlertCircle, LogOut } from 'lucide-react';
import { auth } from './firebase';
import {
  AppLockUpdatePayload,
  contributeSavingsGoalInDb,
  deleteSavingsGoalFromDb,
  deleteTransactionFromDb,
  resetUserDataInDb,
  restoreUserDataInDb,
  saveAccountToDb,
  saveSavingsGoalToDb,
  saveTransactionToDb,
  subscribeToAccounts,
  subscribeToSavingsGoals,
  subscribeToTransactions,
  subscribeToUserProfile,
  syncAccountsDiffToDb,
  syncGoogleUserAndSeedIfNeeded,
  updateAppLockInDb,
  updateBudgetInDb,
  updateUserPreferencesInDb,
} from './services/financeDb';
import {
  Transaction,
  TransactionType,
  Account,
  BudgetConfig,
  SavingsGoal,
  UserProfile,
  ThemePreference,
} from './types/finance';
import { DEFAULT_ACCOUNTS, DEFAULT_BUDGET } from './data/defaultData';
import { Navbar, TabType } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { TransactionsView } from './components/TransactionsView';
import { StatisticsView } from './components/StatisticsView';
import { BudgetAccountsView } from './components/BudgetAccountsView';
import { SettingsView } from './components/SettingsView';
import { TransactionModal } from './components/TransactionModal';
import { LoginView } from './components/LoginView';
import { AppLockScreen } from './components/AppLockScreen';
import { BudgetAlertBanner } from './components/BudgetAlertBanner';
import { OnboardingTour } from './components/OnboardingTour';
import { removeBiometricCredential } from './utils/appSecurity';
import { evaluateBudgetAlert, evaluateDailyBudgetAlert } from './utils/budgetAlerts';
import {
  applyThemeToDocument,
  getStoredThemePreference,
  resolveIsDark,
  THEME_STORAGE_KEY,
} from './utils/theme';

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [accounts, setAccounts] = useState<Account[]>(DEFAULT_ACCOUNTS);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [budget, setBudget] = useState<BudgetConfig>(DEFAULT_BUDGET);

  const [activeTab, setActiveTab] = useState<TabType>('beranda');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [defaultModalDate, setDefaultModalDate] = useState<string | undefined>(undefined);
  const [defaultModalType, setDefaultModalType] = useState<TransactionType>('expense');
  const [isAppUnlocked, setIsAppUnlocked] = useState(false);
  const [dismissedAlertKey, setDismissedAlertKey] = useState<string | null>(null);
  const [dismissedDailyAlertKey, setDismissedDailyAlertKey] = useState<string | null>(null);

  const [themePreference, setThemePreference] = useState<ThemePreference>(() =>
    getStoredThemePreference()
  );
  const [isDark, setIsDark] = useState<boolean>(() => resolveIsDark(getStoredThemePreference()));
  const [isTourOpen, setIsTourOpen] = useState(false);
  const hasAutoTriggeredTourRef = useRef<string | null>(null);
  const hasSyncedServerThemeRef = useRef<string | null>(null);

  // Apply theme to document & subscribe to OS preference changes when 'system' is selected
  useEffect(() => {
    const resolved = applyThemeToDocument(themePreference);
    setIsDark(resolved);

    if (themePreference !== 'system' || typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = () => {
      const nextDark = applyThemeToDocument('system');
      setIsDark(nextDark);
    };
    mediaQuery.addEventListener('change', handleSystemChange);
    return () => mediaQuery.removeEventListener('change', handleSystemChange);
  }, [themePreference]);

  const budgetAlert = useMemo(
    () => evaluateBudgetAlert(transactions, budget),
    [transactions, budget]
  );

  const dailyAlert = useMemo(
    () => evaluateDailyBudgetAlert(transactions, budget),
    [transactions, budget]
  );

  const activeAlertKey =
    budgetAlert.level !== 'none'
      ? `${budgetAlert.yearMonth}:${budgetAlert.level}`
      : null;

  const activeDailyAlertKey =
    dailyAlert.level !== 'none'
      ? `${dailyAlert.dateString}:${dailyAlert.level}`
      : null;

  useEffect(() => {
    if (!firebaseUser) {
      setDismissedAlertKey(null);
      setDismissedDailyAlertKey(null);
      return;
    }
    try {
      setDismissedAlertKey(localStorage.getItem(`keuangan_alert_dismissed_${firebaseUser.uid}`));
      setDismissedDailyAlertKey(
        localStorage.getItem(`keuangan_daily_alert_dismissed_${firebaseUser.uid}`)
      );
    } catch {
      setDismissedAlertKey(null);
      setDismissedDailyAlertKey(null);
    }
  }, [firebaseUser]);

  const handleDismissBudgetAlert = () => {
    if (!activeAlertKey) return;
    setDismissedAlertKey(activeAlertKey);
    if (firebaseUser) {
      try {
        localStorage.setItem(`keuangan_alert_dismissed_${firebaseUser.uid}`, activeAlertKey);
      } catch {
        // Ignore storage access errors
      }
    }
  };

  const handleDismissDailyAlert = () => {
    if (!activeDailyAlertKey) return;
    setDismissedDailyAlertKey(activeDailyAlertKey);
    if (firebaseUser) {
      try {
        localStorage.setItem(
          `keuangan_daily_alert_dismissed_${firebaseUser.uid}`,
          activeDailyAlertKey
        );
      } catch {
        // Ignore storage access errors
      }
    }
  };

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
      setIsAppUnlocked(false);
      if (!user) {
        setUserProfile(null);
        setTransactions([]);
        setGoals([]);
        setAccounts(DEFAULT_ACCOUNTS);
        setBudget(DEFAULT_BUDGET);
        setSyncError(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Sync user profile to Firestore & attach real-time listeners once authenticated
  useEffect(() => {
    if (!firebaseUser) return;

    if (!firebaseUser.emailVerified) {
      setAuthError('Email akun Google belum terverifikasi.');
      return;
    }

    setAuthError(null);
    setSyncError(null);
    setDataLoading(true);

    let isCancelled = false;
    let unsubProfile: (() => void) | undefined;
    let unsubAccounts: (() => void) | undefined;
    let unsubTransactions: (() => void) | undefined;
    let unsubGoals: (() => void) | undefined;

    const initUserDatabase = async () => {
      try {
        await syncGoogleUserAndSeedIfNeeded(firebaseUser);
        if (isCancelled) return;

        unsubProfile = subscribeToUserProfile(firebaseUser.uid, (profile) => {
          if (profile) {
            setUserProfile(profile);
            setBudget({
              monthlyLimit: profile.monthlyLimit,
              dailyLimit: profile.dailyLimit ?? 0,
              alertsEnabled: profile.alertsEnabled,
            });
            // Sync theme from Firestore profile once on login if local preference wasn't explicitly set
            if (
              profile.themePreference &&
              hasSyncedServerThemeRef.current !== firebaseUser.uid
            ) {
              hasSyncedServerThemeRef.current = firebaseUser.uid;
              let hasLocalOverride = false;
              try {
                const stored = localStorage.getItem(THEME_STORAGE_KEY);
                hasLocalOverride = stored === 'light' || stored === 'dark';
              } catch {
                hasLocalOverride = false;
              }
              if (!hasLocalOverride) {
                setThemePreference(profile.themePreference);
              }
            }
          }
        });

        unsubAccounts = subscribeToAccounts(firebaseUser.uid, (accs) => {
          setAccounts(accs);
        });

        unsubGoals = subscribeToSavingsGoals(firebaseUser.uid, (goalList) => {
          setGoals(goalList);
        });

        unsubTransactions = subscribeToTransactions(firebaseUser.uid, (txs) => {
          setTransactions(txs);
          setDataLoading(false);
        });
      } catch (err) {
        if (!isCancelled) {
          console.error('Database sync error:', err);
          setSyncError('Gagal memuat data dari database aplikasi. Pastikan koneksi internet aktif.');
          setDataLoading(false);
        }
      }
    };

    initUserDatabase();

    return () => {
      isCancelled = true;
      unsubProfile?.();
      unsubAccounts?.();
      unsubTransactions?.();
      unsubGoals?.();
    };
  }, [firebaseUser]);

  // Handlers
  const handleOpenAdd = (initialDate?: string, initialType: TransactionType = 'expense') => {
    setEditingTransaction(null);
    setDefaultModalDate(typeof initialDate === 'string' ? initialDate : undefined);
    setDefaultModalType(initialType);
    setIsModalOpen(true);
  };

  const handleSelectTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
    setDefaultModalDate(undefined);
    setDefaultModalType(tx.type);
    setIsModalOpen(true);
  };

  const handleSaveTransaction = async (
    data: Omit<Transaction, 'id' | 'createdAt'> & { id?: string }
  ) => {
    if (!firebaseUser) return;
    try {
      setSyncError(null);
      await saveTransactionToDb(firebaseUser.uid, data);
      if (data.type === 'expense' || (data.type === 'transfer' && (data.adminFee || 0) > 0)) {
        setDismissedDailyAlertKey(null);
        try {
          localStorage.removeItem(`keuangan_daily_alert_dismissed_${firebaseUser.uid}`);
        } catch {
          // Ignore storage errors
        }
      }
    } catch {
      setSyncError('Gagal menyimpan transaksi ke database.');
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!firebaseUser) return;
    try {
      setSyncError(null);
      await deleteTransactionFromDb(firebaseUser.uid, id);
    } catch {
      setSyncError('Gagal menghapus transaksi dari database.');
    }
  };

  const handleUpdateBudget = async (newBudget: BudgetConfig) => {
    if (!firebaseUser) return;
    try {
      setSyncError(null);
      await updateBudgetInDb(firebaseUser.uid, newBudget);
      // Reset alert dismissals when budget settings are updated so new thresholds evaluate cleanly
      setDismissedAlertKey(null);
      setDismissedDailyAlertKey(null);
      try {
        localStorage.removeItem(`keuangan_alert_dismissed_${firebaseUser.uid}`);
        localStorage.removeItem(`keuangan_daily_alert_dismissed_${firebaseUser.uid}`);
      } catch {
        // Ignore storage errors
      }
    } catch {
      setSyncError('Gagal memperbarui target anggaran di database.');
    }
  };

  const handleUpdateAccounts = async (nextAccounts: Account[]) => {
    if (!firebaseUser) return;
    try {
      setSyncError(null);
      await syncAccountsDiffToDb(firebaseUser.uid, accounts, nextAccounts);
    } catch {
      setSyncError('Gagal memperbarui daftar dompet di database.');
    }
  };

  const handleQuickCreateAccount = async (acc: Account): Promise<Account> => {
    if (!firebaseUser) return acc;
    try {
      setSyncError(null);
      return await saveAccountToDb(firebaseUser.uid, acc);
    } catch (error) {
      setSyncError('Gagal menambahkan dompet digital ke database.');
      throw error;
    }
  };

  const handleSaveGoal = async (
    goal: Omit<SavingsGoal, 'id' | 'createdAt'> & { id?: string }
  ) => {
    if (!firebaseUser) return;
    try {
      setSyncError(null);
      await saveSavingsGoalToDb(firebaseUser.uid, goal);
    } catch {
      setSyncError('Gagal menyimpan target tabungan ke database.');
    }
  };

  const handleContributeGoal = async (goalId: string, nextCurrentAmount: number) => {
    if (!firebaseUser) return;
    try {
      setSyncError(null);
      await contributeSavingsGoalInDb(firebaseUser.uid, goalId, nextCurrentAmount);
    } catch {
      setSyncError('Gagal memperbarui saldo target tabungan di database.');
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!firebaseUser) return;
    try {
      setSyncError(null);
      await deleteSavingsGoalFromDb(firebaseUser.uid, goalId);
    } catch {
      setSyncError('Gagal menghapus target tabungan dari database.');
    }
  };

  const handleRestoreData = async (data: {
    transactions: Transaction[];
    accounts: Account[];
    budget: BudgetConfig;
  }) => {
    if (!firebaseUser) return;
    setSyncError(null);
    await restoreUserDataInDb(firebaseUser.uid, data);
  };

  const handleResetAll = async () => {
    if (!firebaseUser) return;
    setSyncError(null);
    await resetUserDataInDb(firebaseUser.uid);
  };

  const handleSaveAppLock = async (payload: AppLockUpdatePayload) => {
    if (!firebaseUser) return;
    setSyncError(null);
    await updateAppLockInDb(firebaseUser.uid, payload);
    setIsAppUnlocked(true);
  };

  const handleResetLockViaGoogle = async () => {
    if (!firebaseUser) return;
    removeBiometricCredential(firebaseUser.uid);
    await updateAppLockInDb(firebaseUser.uid, {
      appLockEnabled: false,
      appLockType: 'pin',
      appLockHash: '',
      appLockSalt: '',
      biometricEnabled: false,
    });
    setIsAppUnlocked(true);
  };

  const handleLockNow = () => {
    setIsModalOpen(false);
    setEditingTransaction(null);
    setIsAppUnlocked(false);
  };

  const handleChangeTheme = useCallback(
    (nextPref: ThemePreference) => {
      setThemePreference(nextPref);
      const resolved = applyThemeToDocument(nextPref);
      setIsDark(resolved);
      if (firebaseUser) {
        updateUserPreferencesInDb(firebaseUser.uid, { themePreference: nextPref }).catch(() => {
          // Local preference remains saved even if network update fails
        });
      }
    },
    [firebaseUser]
  );

  const handleToggleDarkQuick = useCallback(() => {
    handleChangeTheme(isDark ? 'light' : 'dark');
  }, [handleChangeTheme, isDark]);

  const handleStartTour = useCallback(() => {
    setActiveTab('beranda');
    setIsTourOpen(true);
  }, []);

  const handleCloseTour = useCallback(
    (markCompleted = true) => {
      setIsTourOpen(false);
      if (markCompleted && firebaseUser) {
        try {
          localStorage.setItem(`keuangan_tour_done_${firebaseUser.uid}`, '1');
        } catch {
          // Ignore storage errors
        }
        updateUserPreferencesInDb(firebaseUser.uid, { onboardingCompleted: true }).catch(() => {
          // Local completion flag remains set
        });
      }
    },
    [firebaseUser]
  );

  const handleTourTryAction = useCallback(
    (txType: TransactionType) => {
      handleCloseTour(true);
      if (txType === 'transfer') {
        setActiveTab('transaksi');
      }
      handleOpenAdd(undefined, txType);
    },
    [handleCloseTour]
  );

  const handleLogout = async () => {
    await signOut(auth);
    setIsAppUnlocked(false);
    setIsTourOpen(false);
    hasAutoTriggeredTourRef.current = null;
    hasSyncedServerThemeRef.current = null;
    setActiveTab('beranda');
  };

  // Auto-open interactive onboarding tour for new users once data loads and lock gate is clear
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;
    if (dataLoading || !userProfile) return;
    if (Boolean(userProfile.appLockEnabled) && Boolean(userProfile.appLockHash) && !isAppUnlocked) {
      return;
    }
    if (hasAutoTriggeredTourRef.current === firebaseUser.uid) return;

    let doneLocally = false;
    try {
      doneLocally = localStorage.getItem(`keuangan_tour_done_${firebaseUser.uid}`) === '1';
    } catch {
      doneLocally = false;
    }

    const isNewUser =
      userProfile.onboardingCompleted === false ||
      (userProfile.onboardingCompleted === undefined && transactions.length === 0);

    if (!doneLocally && isNewUser) {
      hasAutoTriggeredTourRef.current = firebaseUser.uid;
      const timer = window.setTimeout(() => {
        setActiveTab('beranda');
        setIsTourOpen(true);
      }, 450);
      return () => window.clearTimeout(timer);
    }

    hasAutoTriggeredTourRef.current = firebaseUser.uid;
  }, [firebaseUser, dataLoading, userProfile, isAppUnlocked, transactions.length]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center p-6 text-center gap-3">
        <Loader2 size={28} className="animate-spin text-[#0f766e] dark:text-[#2dd4bf]" />
        <p className="text-sm font-medium text-[#6b7872] dark:text-[#95a5a0]">Memeriksa sesi akun...</p>
      </div>
    );
  }

  if (!firebaseUser || !firebaseUser.emailVerified) {
    return (
      <LoginView
        externalError={authError}
        isDark={isDark}
        onToggleDark={handleToggleDarkQuick}
      />
    );
  }

  if (dataLoading && !userProfile && !syncError) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center p-6 text-center gap-3">
        <Loader2 size={28} className="animate-spin text-[#0f766e] dark:text-[#2dd4bf]" />
        <p className="text-sm font-medium text-[#6b7872] dark:text-[#95a5a0]">
          Menyinkronkan akun Google dan data keuangan Anda...
        </p>
      </div>
    );
  }

  const effectiveProfile: UserProfile = userProfile || {
    uid: firebaseUser.uid,
    email: firebaseUser.email || '',
    displayName: firebaseUser.displayName || 'Pengguna',
    photoURL: firebaseUser.photoURL || undefined,
    monthlyLimit: budget.monthlyLimit,
    alertsEnabled: budget.alertsEnabled,
  };

  const isLockGateActive =
    Boolean(effectiveProfile.appLockEnabled) &&
    Boolean(effectiveProfile.appLockHash) &&
    !isAppUnlocked;

  if (isLockGateActive) {
    return (
      <AppLockScreen
        firebaseUser={firebaseUser}
        userProfile={effectiveProfile}
        onUnlock={() => setIsAppUnlocked(true)}
        onResetLockViaGoogle={handleResetLockViaGoogle}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--tx)] selection:bg-[#ccfbf1] dark:selection:bg-[#102825] selection:text-[#0f766e] dark:selection:text-[#2dd4bf]">
      <main>
        {activeAlertKey && dismissedAlertKey !== activeAlertKey && (
          <BudgetAlertBanner
            level={budgetAlert.level}
            title={budgetAlert.title}
            message={budgetAlert.message}
            badgeText={
              budgetAlert.level === 'exceeded'
                ? 'Bulanan 100%+'
                : budgetAlert.level === 'critical90'
                ? 'Bulanan 90%+'
                : 'Bulanan 80%+'
            }
            actionLabel="Atur Anggaran Bulanan"
            onDismiss={handleDismissBudgetAlert}
            onAction={() => setActiveTab('anggaran')}
          />
        )}

        {activeDailyAlertKey && dismissedDailyAlertKey !== activeDailyAlertKey && (
          <BudgetAlertBanner
            level={dailyAlert.level}
            title={dailyAlert.title}
            message={dailyAlert.message}
            badgeText="Harian 100%+"
            actionLabel="Atur Batas Harian"
            onDismiss={handleDismissDailyAlert}
            onAction={() => setActiveTab('pengaturan')}
          />
        )}

        {syncError && (
          <div className="mb-3 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
              <span>{syncError}</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#131c1a] border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 font-semibold inline-flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <LogOut size={12} /> Keluar
            </button>
          </div>
        )}

        {activeTab === 'beranda' && (
          <DashboardView
            transactions={transactions}
            accounts={accounts}
            budget={budget}
            goals={goals}
            userProfile={effectiveProfile}
            isDark={isDark}
            onToggleDark={handleToggleDarkQuick}
            onStartTour={handleStartTour}
            onOpenAddModal={handleOpenAdd}
            onSelectTransaction={handleSelectTransaction}
            onViewAllTransactions={() => setActiveTab('transaksi')}
            onNavigateToBudget={() => setActiveTab('anggaran')}
            onOpenSettings={() => setActiveTab('pengaturan')}
            onLockApp={handleLockNow}
          />
        )}

        {activeTab === 'transaksi' && (
          <TransactionsView
            transactions={transactions}
            accounts={accounts}
            onSelectTransaction={handleSelectTransaction}
            onOpenAddModal={(initialDate) => handleOpenAdd(initialDate, 'expense')}
            onOpenTransferModal={(initialDate) => handleOpenAdd(initialDate, 'transfer')}
          />
        )}

        {activeTab === 'statistik' && (
          <StatisticsView
            transactions={transactions}
            accounts={accounts}
            budget={budget}
            userProfile={effectiveProfile}
          />
        )}

        {activeTab === 'anggaran' && (
          <BudgetAccountsView
            accounts={accounts}
            budget={budget}
            transactions={transactions}
            goals={goals}
            onUpdateBudget={handleUpdateBudget}
            onUpdateAccounts={handleUpdateAccounts}
            onSaveGoal={handleSaveGoal}
            onContributeGoal={handleContributeGoal}
            onDeleteGoal={handleDeleteGoal}
          />
        )}

        {activeTab === 'pengaturan' && (
          <SettingsView
            transactions={transactions}
            accounts={accounts}
            budget={budget}
            userProfile={effectiveProfile}
            themePreference={themePreference}
            onChangeTheme={handleChangeTheme}
            onStartTour={handleStartTour}
            onUpdateBudget={handleUpdateBudget}
            onRestoreData={handleRestoreData}
            onResetAll={handleResetAll}
            onSaveAppLock={handleSaveAppLock}
            onLockNow={handleLockNow}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Floating Action Button (FAB) */}
      <button
        type="button"
        data-tour="fab-add"
        onClick={() => handleOpenAdd()}
        className="fab"
        aria-label="Catat Transaksi Baru"
        title="Catat Transaksi"
      >
        <Plus size={32} strokeWidth={2.5} />
      </button>

      {/* Bottom Navigation */}
      <Navbar currentTab={activeTab} onTabChange={setActiveTab} />

      {/* Interactive Onboarding Tour */}
      <OnboardingTour
        isOpen={isTourOpen}
        activeTab={activeTab}
        onNavigateTab={setActiveTab}
        onClose={handleCloseTour}
        onTryAction={handleTourTryAction}
        isDark={isDark}
        onToggleDarkQuick={handleToggleDarkQuick}
      />

      {/* Transaction Modal (Bottom Sheet) */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTransaction(null);
          setDefaultModalDate(undefined);
          setDefaultModalType('expense');
        }}
        onSave={handleSaveTransaction}
        onDelete={handleDeleteTransaction}
        editingTransaction={editingTransaction}
        defaultDate={defaultModalDate}
        defaultType={defaultModalType}
        accounts={accounts}
        transactions={transactions}
        onQuickCreateAccount={handleQuickCreateAccount}
      />
    </div>
  );
}
