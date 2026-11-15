import { Account, Category, Transaction, BudgetConfig } from '../types/finance';
import { getTodayDateString } from '../utils/formatters';

export const DEFAULT_ACCOUNTS: Account[] = [
  {
    id: 'cash',
    name: 'Dompet Tunai',
    type: 'cash',
    initialBalance: 0,
    color: '#059669',
  },
  {
    id: 'bank',
    name: 'Rekening Bank',
    type: 'bank',
    initialBalance: 0,
    color: '#2563eb',
  },
  {
    id: 'ewallet',
    name: 'E-Wallet (GoPay/Dana)',
    type: 'ewallet',
    initialBalance: 0,
    color: '#0891b2',
  },
];

export interface EWalletPreset {
  id: string;
  name: string;
  color: string;
}

export const EWALLET_PRESETS: EWalletPreset[] = [
  { id: 'ewallet_gopay', name: 'GoPay', color: '#00AA13' },
  { id: 'ewallet_ovo', name: 'OVO', color: '#4C3494' },
  { id: 'ewallet_dana', name: 'DANA', color: '#118EEA' },
  { id: 'ewallet_shopeepay', name: 'ShopeePay', color: '#EE4D2D' },
  { id: 'ewallet_linkaja', name: 'LinkAja', color: '#E82529' },
];

export const EXPENSE_CATEGORIES: Category[] = [
  { id: 'cat_food', name: 'Makanan & Minuman', icon: 'Utensils', type: 'expense', color: '#ea580c' },
  { id: 'cat_transport', name: 'Transportasi & Bensin', icon: 'Car', type: 'expense', color: '#0284c7' },
  { id: 'cat_groceries', name: 'Belanja Harian', icon: 'ShoppingCart', type: 'expense', color: '#16a34a' },
  { id: 'cat_bills', name: 'Tagihan & Pulsa', icon: 'Zap', type: 'expense', color: '#eab308' },
  { id: 'cat_cafe', name: 'Kafe & Hiburan', icon: 'Coffee', type: 'expense', color: '#9333ea' },
  { id: 'cat_health', name: 'Kesehatan & Obat', icon: 'HeartPulse', type: 'expense', color: '#e11d48' },
  { id: 'cat_edu', name: 'Pendidikan & Buku', icon: 'BookOpen', type: 'expense', color: '#2563eb' },
  { id: 'cat_charity', name: 'Sedekah & Donasi', icon: 'HeartHandshake', type: 'expense', color: '#059669' },
  { id: 'cat_lifestyle', name: 'Pakaian & Belanja', icon: 'Shirt', type: 'expense', color: '#db2777' },
  { id: 'cat_other_exp', name: 'Lain-lain', icon: 'MoreHorizontal', type: 'expense', color: '#64748b' },
];

export const INCOME_CATEGORIES: Category[] = [
  { id: 'cat_salary', name: 'Gaji Bulanan', icon: 'Briefcase', type: 'income', color: '#15803d' },
  { id: 'cat_bonus', name: 'Bonus & THR', icon: 'Gift', type: 'income', color: '#0891b2' },
  { id: 'cat_business', name: 'Usaha & Jualan', icon: 'Store', type: 'income', color: '#d97706' },
  { id: 'cat_freelance', name: 'Freelance & Proyek', icon: 'Laptop', type: 'income', color: '#7c3aed' },
  { id: 'cat_investment', name: 'Investasi & Bunga', icon: 'TrendingUp', type: 'income', color: '#2563eb' },
  { id: 'cat_pocket', name: 'Hadiah / Uang Saku', icon: 'Wallet', type: 'income', color: '#db2777' },
  { id: 'cat_other_inc', name: 'Pemasukan Lain', icon: 'PlusCircle', type: 'income', color: '#475569' },
];

export const ALL_CATEGORIES: Category[] = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export const DEFAULT_BUDGET: BudgetConfig = {
  monthlyLimit: 4500000,
  dailyLimit: 0,
  alertsEnabled: true,
};

export interface SavingsGoalCategoryOption {
  name: string;
  color: string;
}

export const SAVINGS_GOAL_CATEGORIES: SavingsGoalCategoryOption[] = [
  { name: 'Dana Darurat', color: '#0f766e' },
  { name: 'Liburan & Perjalanan', color: '#0284c7' },
  { name: 'Pendidikan', color: '#2563eb' },
  { name: 'Investasi & Aset', color: '#16a34a' },
  { name: 'Gadget & Elektronik', color: '#9333ea' },
  { name: 'Kendaraan', color: '#ea580c' },
  { name: 'Kesehatan', color: '#e11d48' },
  { name: 'Ibadah', color: '#059669' },
  { name: 'Lainnya', color: '#64748b' },
];

export function generateDefaultTransactions(): Transaction[] {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = today.getDate();

  // Create date helper
  const dateFromDay = (d: number) => {
    const validDay = Math.min(d, day);
    return `${year}-${month}-${String(Math.max(1, validDay)).padStart(2, '0')}`;
  };

  return [
    {
      id: 'tx_1',
      type: 'income',
      amount: 6500000,
      category: 'Gaji Bulanan',
      date: `${year}-${month}-01`,
      time: '09:00',
      accountId: 'bank',
      note: 'Gaji masuk awal bulan',
      createdAt: Date.now() - 86400000 * 10,
    },
    {
      id: 'tx_2',
      type: 'expense',
      amount: 45000,
      category: 'Makanan & Minuman',
      date: dateFromDay(day),
      time: '12:30',
      accountId: 'cash',
      note: 'Makan siang nasi padang + es teh',
      createdAt: Date.now() - 3600000 * 3,
    },
    {
      id: 'tx_3',
      type: 'expense',
      amount: 25000,
      category: 'Transportasi & Bensin',
      date: dateFromDay(day),
      time: '08:15',
      accountId: 'cash',
      note: 'Isi bensin pertalite motor',
      createdAt: Date.now() - 3600000 * 7,
    },
    {
      id: 'tx_4',
      type: 'expense',
      amount: 185000,
      category: 'Belanja Harian',
      date: dateFromDay(Math.max(1, day - 1)),
      time: '19:40',
      accountId: 'ewallet',
      note: 'Belanja mingguan minimarket',
      createdAt: Date.now() - 86400000 * 1,
    },
    {
      id: 'tx_5',
      type: 'expense',
      amount: 150000,
      category: 'Tagihan & Pulsa',
      date: dateFromDay(Math.max(1, day - 2)),
      time: '14:20',
      accountId: 'bank',
      note: 'Token listrik PLN & paket data',
      createdAt: Date.now() - 86400000 * 2,
    },
    {
      id: 'tx_6',
      type: 'expense',
      amount: 38000,
      category: 'Kafe & Hiburan',
      date: dateFromDay(Math.max(1, day - 3)),
      time: '16:15',
      accountId: 'ewallet',
      note: 'Kopi susu gula aren santai',
      createdAt: Date.now() - 86400000 * 3,
    },
    {
      id: 'tx_7',
      type: 'income',
      amount: 450000,
      category: 'Freelance & Proyek',
      date: dateFromDay(Math.max(1, day - 4)),
      time: '11:00',
      accountId: 'bank',
      note: 'Pembayaran jasa desain banner',
      createdAt: Date.now() - 86400000 * 4,
    },
    {
      id: 'tx_8',
      type: 'expense',
      amount: 50000,
      category: 'Sedekah & Donasi',
      date: dateFromDay(Math.max(1, day - 5)),
      time: '12:00',
      accountId: 'cash',
      note: 'Sedekah Jumat berkah',
      createdAt: Date.now() - 86400000 * 5,
    },
    {
      id: 'tx_9',
      type: 'transfer',
      amount: 200000,
      category: 'Transfer Saldo',
      date: dateFromDay(Math.max(1, day - 2)),
      time: '10:00',
      accountId: 'bank',
      toAccountId: 'ewallet',
      note: 'Top up saldo GoPay',
      createdAt: Date.now() - 86400000 * 2 - 1000,
    },
  ];
}
