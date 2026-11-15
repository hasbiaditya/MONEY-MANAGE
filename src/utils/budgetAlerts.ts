import { BudgetConfig, Transaction } from '../types/finance';
import { formatRupiah } from './formatters';
import { getTransactionExpenseImpact } from './accountBalances';

export type BudgetAlertLevel = 'none' | 'warning80' | 'critical90' | 'exceeded';

export interface BudgetAlertStatus {
  level: BudgetAlertLevel;
  usedAmount: number;
  limitAmount: number;
  remainingAmount: number;
  rawPercent: number;
  displayPercent: number;
  yearMonth: string;
  title: string;
  message: string;
}

export interface DailyBudgetAlertStatus {
  level: 'none' | 'exceeded';
  usedAmount: number;
  limitAmount: number;
  overByAmount: number;
  rawPercent: number;
  displayPercent: number;
  dateString: string;
  title: string;
  message: string;
}

export function getCurrentYearMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function getLocalDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

export function evaluateBudgetAlert(
  transactions: Transaction[],
  budget: BudgetConfig,
  now = new Date()
): BudgetAlertStatus {
  const yearMonth = getCurrentYearMonth(now);
  const usedAmount = transactions
    .filter((tx) => tx.date.startsWith(yearMonth))
    .reduce((sum, tx) => sum + getTransactionExpenseImpact(tx), 0);

  const limitAmount = Math.max(0, budget.monthlyLimit || 0);
  const remainingAmount = Math.max(0, limitAmount - usedAmount);

  if (limitAmount <= 0) {
    return {
      level: 'none',
      usedAmount,
      limitAmount,
      remainingAmount: 0,
      rawPercent: 0,
      displayPercent: 0,
      yearMonth,
      title: '',
      message: '',
    };
  }

  const rawPercent = (usedAmount / limitAmount) * 100;
  const displayPercent = Math.round(rawPercent);

  if (!budget.alertsEnabled) {
    return {
      level: 'none',
      usedAmount,
      limitAmount,
      remainingAmount,
      rawPercent,
      displayPercent,
      yearMonth,
      title: '',
      message: '',
    };
  }

  if (rawPercent >= 100) {
    const overBy = usedAmount - limitAmount;
    return {
      level: 'exceeded',
      usedAmount,
      limitAmount,
      remainingAmount: 0,
      rawPercent,
      displayPercent,
      yearMonth,
      title: `Anggaran Bulan Ini Terlampaui (${displayPercent}%)`,
      message: `Pengeluaran bulan ini mencapai ${formatRupiah(usedAmount)}, melebihi batas ${formatRupiah(limitAmount)} sebesar ${formatRupiah(overBy)}.`,
    };
  }

  if (rawPercent >= 90) {
    return {
      level: 'critical90',
      usedAmount,
      limitAmount,
      remainingAmount,
      rawPercent,
      displayPercent,
      yearMonth,
      title: `Peringatan 90% Anggaran Terpakai (${displayPercent}%)`,
      message: `Pengeluaran bulan ini sudah ${formatRupiah(usedAmount)} dari batas ${formatRupiah(limitAmount)}. Sisa anggaran tinggal ${formatRupiah(remainingAmount)}.`,
    };
  }

  if (rawPercent >= 80) {
    return {
      level: 'warning80',
      usedAmount,
      limitAmount,
      remainingAmount,
      rawPercent,
      displayPercent,
      yearMonth,
      title: `Peringatan 80% Anggaran Terpakai (${displayPercent}%)`,
      message: `Pengeluaran bulan ini sudah ${formatRupiah(usedAmount)} dari batas ${formatRupiah(limitAmount)}. Sisa anggaran Anda ${formatRupiah(remainingAmount)}.`,
    };
  }

  return {
    level: 'none',
    usedAmount,
    limitAmount,
    remainingAmount,
    rawPercent,
    displayPercent,
    yearMonth,
    title: '',
    message: '',
  };
}

export function evaluateDailyBudgetAlert(
  transactions: Transaction[],
  budget: BudgetConfig,
  now = new Date()
): DailyBudgetAlertStatus {
  const dateString = getLocalDateKey(now);
  const usedAmount = transactions
    .filter((tx) => tx.date === dateString)
    .reduce((sum, tx) => sum + getTransactionExpenseImpact(tx), 0);

  const limitAmount = Math.max(0, budget.dailyLimit || 0);

  if (limitAmount <= 0) {
    return {
      level: 'none',
      usedAmount,
      limitAmount: 0,
      overByAmount: 0,
      rawPercent: 0,
      displayPercent: 0,
      dateString,
      title: '',
      message: '',
    };
  }

  const rawPercent = (usedAmount / limitAmount) * 100;
  const displayPercent = Math.round(rawPercent);
  const overByAmount = Math.max(0, usedAmount - limitAmount);

  if (!budget.alertsEnabled || usedAmount <= limitAmount) {
    return {
      level: 'none',
      usedAmount,
      limitAmount,
      overByAmount,
      rawPercent,
      displayPercent,
      dateString,
      title: '',
      message: '',
    };
  }

  return {
    level: 'exceeded',
    usedAmount,
    limitAmount,
    overByAmount,
    rawPercent,
    displayPercent,
    dateString,
    title: `Pengeluaran Harian Melebihi Batas (${displayPercent}%)`,
    message: `Pengeluaran hari ini mencapai ${formatRupiah(usedAmount)}, melampaui target harian ${formatRupiah(limitAmount)} sebesar ${formatRupiah(overByAmount)}.`,
  };
}
