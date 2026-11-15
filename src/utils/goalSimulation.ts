import { getTodayDateString } from './formatters';

export interface SavingsSimulationResult {
  remaining: number;
  days: number;
  weeks: number;
  months: number;
  perDay: number;
  perWeek: number;
  perMonth: number;
  targetDateStr: string;
  isDeadlinePassed: boolean;
}

const MAX_SIMULATION_DAYS = 36500; // ~100 years

export function parseLocalDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const match = /^(\d{4,6})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(year, month - 1, day);
  if (isNaN(dt.getTime())) return null;
  return dt;
}

function getLocalToday(): { today: Date; todayStr: string } {
  const todayStr = getTodayDateString();
  const parsed = parseLocalDate(todayStr);
  if (parsed) return { today: parsed, todayStr };
  const now = new Date();
  const fallback = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { today: fallback, todayStr };
}

export function addMonthsToDateString(baseDateStr: string, monthsToAdd: number): string {
  const base = parseLocalDate(baseDateStr) || getLocalToday().today;
  const safeMonths = Math.min(1200, Math.max(0, Math.round(monthsToAdd)));
  const target = new Date(base.getFullYear(), base.getMonth() + safeMonths, base.getDate());
  if (isNaN(target.getTime())) return '';
  const y = String(target.getFullYear()).padStart(4, '0');
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysToDateString(baseDateStr: string, daysToAdd: number): string {
  const base = parseLocalDate(baseDateStr) || getLocalToday().today;
  const safeDays = Math.min(MAX_SIMULATION_DAYS, Math.max(0, Math.round(daysToAdd)));
  const target = new Date(base.getFullYear(), base.getMonth(), base.getDate() + safeDays);
  if (isNaN(target.getTime())) return '';
  const y = String(target.getFullYear()).padStart(4, '0');
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function simulateByMonths(
  targetAmount: number,
  currentAmount: number,
  durationMonths: number
): SavingsSimulationResult {
  const remaining = Math.max(0, targetAmount - Math.max(0, currentAmount));
  const safeMonths = Math.min(1200, Math.max(1, Math.round(durationMonths)));
  const { today, todayStr } = getLocalToday();
  const targetDateStr = addMonthsToDateString(todayStr, safeMonths);

  const end = parseLocalDate(targetDateStr);
  const days = end
    ? Math.max(1, Math.round((end.getTime() - today.getTime()) / 86400000))
    : Math.max(1, Math.round(safeMonths * 30.4375));
  const weeks = Math.max(1, days / 7);

  return {
    remaining,
    days,
    weeks: Math.round(weeks * 10) / 10,
    months: safeMonths,
    perDay: remaining === 0 ? 0 : Math.ceil(remaining / days),
    perWeek: remaining === 0 ? 0 : Math.ceil(remaining / weeks),
    perMonth: remaining === 0 ? 0 : Math.ceil(remaining / safeMonths),
    targetDateStr,
    isDeadlinePassed: false,
  };
}

export function simulateByDeadline(
  targetAmount: number,
  currentAmount: number,
  deadlineStr: string
): SavingsSimulationResult | null {
  const end = parseLocalDate(deadlineStr);
  if (!end) return null;

  const { today } = getLocalToday();
  const rawDiffDays = Math.round((end.getTime() - today.getTime()) / 86400000);
  const isDeadlinePassed = rawDiffDays <= 0;
  const days = Math.max(1, rawDiffDays);
  const weeks = days <= 7 ? 1 : days / 7;
  const months = days <= 30 ? 1 : days / 30.4375;

  const remaining = Math.max(0, targetAmount - Math.max(0, currentAmount));

  return {
    remaining,
    days,
    weeks: Math.round(weeks * 10) / 10,
    months: Math.max(1, Math.round(months * 10) / 10),
    perDay: remaining === 0 ? 0 : Math.ceil(remaining / days),
    perWeek: remaining === 0 ? 0 : Math.ceil(remaining / weeks),
    perMonth: remaining === 0 ? 0 : Math.ceil(remaining / months),
    targetDateStr: deadlineStr,
    isDeadlinePassed,
  };
}

export interface CapacitySimulationResult {
  remaining: number;
  periodsNeeded: number;
  totalDays: number;
  estimatedMonths: number;
  estimatedDateStr: string;
  isHorizonTooLong: boolean;
}

export function simulateBySavingCapacity(
  targetAmount: number,
  currentAmount: number,
  savingPerPeriod: number,
  frequency: 'daily' | 'weekly' | 'monthly'
): CapacitySimulationResult | null {
  if (savingPerPeriod <= 0) return null;
  const remaining = Math.max(0, targetAmount - Math.max(0, currentAmount));
  const { today, todayStr } = getLocalToday();

  if (remaining === 0) {
    return {
      remaining: 0,
      periodsNeeded: 0,
      totalDays: 0,
      estimatedMonths: 0,
      estimatedDateStr: todayStr,
      isHorizonTooLong: false,
    };
  }

  const periodsNeeded = Math.ceil(remaining / savingPerPeriod);
  const approxDays =
    frequency === 'daily'
      ? periodsNeeded
      : frequency === 'weekly'
      ? periodsNeeded * 7
      : Math.round(periodsNeeded * 30.4375);

  if (approxDays > MAX_SIMULATION_DAYS) {
    return {
      remaining,
      periodsNeeded,
      totalDays: approxDays,
      estimatedMonths: Math.round((approxDays / 30.4375) * 10) / 10,
      estimatedDateStr: '',
      isHorizonTooLong: true,
    };
  }

  let totalDays = approxDays;
  let estimatedDateStr = '';

  if (frequency === 'daily') {
    totalDays = periodsNeeded;
    estimatedDateStr = addDaysToDateString(todayStr, totalDays);
  } else if (frequency === 'weekly') {
    totalDays = periodsNeeded * 7;
    estimatedDateStr = addDaysToDateString(todayStr, totalDays);
  } else {
    estimatedDateStr = addMonthsToDateString(todayStr, periodsNeeded);
    const end = parseLocalDate(estimatedDateStr);
    if (end) {
      totalDays = Math.max(1, Math.round((end.getTime() - today.getTime()) / 86400000));
    }
  }

  return {
    remaining,
    periodsNeeded,
    totalDays,
    estimatedMonths: Math.round((totalDays / 30.4375) * 10) / 10,
    estimatedDateStr,
    isHorizonTooLong: false,
  };
}
