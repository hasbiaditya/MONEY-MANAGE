export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  accountId: string;
  toAccountId?: string; // used when type === 'transfer'
  adminFee?: number; // optional transfer administration fee deducted from source account
  note: string;
  createdAt: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  type: 'expense' | 'income';
  color: string;
}

export interface Account {
  id: string;
  name: string;
  type: 'cash' | 'bank' | 'ewallet';
  initialBalance: number;
  color: string;
}

export interface BudgetConfig {
  monthlyLimit: number;
  dailyLimit?: number;
  alertsEnabled: boolean;
}

export type ThemePreference = 'light' | 'dark' | 'system';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  monthlyLimit: number;
  dailyLimit?: number;
  alertsEnabled: boolean;
  appLockEnabled?: boolean;
  appLockType?: 'pin' | 'password';
  appLockHash?: string;
  appLockSalt?: string;
  biometricEnabled?: boolean;
  themePreference?: ThemePreference;
  onboardingCompleted?: boolean;
}

export interface SavingsGoal {
  id: string;
  name: string;
  category: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string; // YYYY-MM-DD or ''
  color: string;
  createdAt?: number;
}
