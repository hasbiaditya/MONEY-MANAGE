import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from 'lucide-react';
import { Transaction, Account } from '../types/finance';
import {
  formatRupiah,
  formatDateFull,
  formatMonthYear,
  getTodayDateString,
} from '../utils/formatters';
import { CategoryIcon } from './CategoryIcon';
import { getTransactionExpenseImpact } from '../utils/accountBalances';

interface TransactionCalendarProps {
  transactions: Transaction[];
  accounts: Account[];
  currentMonth: string; // YYYY-MM
  selectedDate: string; // YYYY-MM-DD
  onChangeMonth: (nextMonth: string) => void;
  onSelectDate: (date: string) => void;
  onSelectTransaction: (tx: Transaction) => void;
  onAddTransactionOnDate: (date: string) => void;
}

const WEEKDAY_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

function formatCompactRupiah(amount: number): string {
  if (amount <= 0) return '0';
  if (amount < 1000) return String(Math.round(amount));
  if (amount < 1_000_000) {
    const thousands = amount / 1000;
    const rounded = thousands >= 10 ? Math.round(thousands) : Math.round(thousands * 10) / 10;
    return `${String(rounded).replace('.', ',')}rb`;
  }
  if (amount < 1_000_000_000) {
    const millions = amount / 1_000_000;
    const rounded = millions >= 10 ? Math.round(millions) : Math.round(millions * 10) / 10;
    return `${String(rounded).replace('.', ',')}jt`;
  }
  const billions = amount / 1_000_000_000;
  const rounded = Math.round(billions * 10) / 10;
  return `${String(rounded).replace('.', ',')}M`;
}

function shiftMonth(yearMonth: string, delta: number): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  return `${nextYear}-${nextMonth}`;
}

export const TransactionCalendar: React.FC<TransactionCalendarProps> = ({
  transactions,
  accounts,
  currentMonth,
  selectedDate,
  onChangeMonth,
  onSelectDate,
  onSelectTransaction,
  onAddTransactionOnDate,
}) => {
  const todayStr = getTodayDateString();
  const todayMonth = todayStr.substring(0, 7);

  // Aggregate daily summaries across the visible month
  const dailyMap = useMemo(() => {
    const map = new Map<
      string,
      {
        income: number;
        expense: number;
        transferCount: number;
        items: Transaction[];
      }
    >();

    transactions.forEach((tx) => {
      if (!tx.date || !tx.date.startsWith(currentMonth)) return;
      const existing = map.get(tx.date) || {
        income: 0,
        expense: 0,
        transferCount: 0,
        items: [],
      };
      const expenseImpact = getTransactionExpenseImpact(tx);
      if (tx.type === 'income') {
        existing.income += tx.amount;
      } else if (tx.type === 'expense') {
        existing.expense += tx.amount;
      } else {
        existing.transferCount += 1;
        if (expenseImpact > 0) {
          existing.expense += expenseImpact;
        }
      }
      existing.items.push(tx);
      map.set(tx.date, existing);
    });

    // Sort items per day newest time first
    map.forEach((entry) => {
      entry.items.sort((a, b) => (b.time || '00:00').localeCompare(a.time || '00:00'));
    });

    return map;
  }, [transactions, currentMonth]);

  // Monthly totals
  const monthTotals = useMemo(() => {
    let income = 0;
    let expense = 0;
    let count = 0;
    dailyMap.forEach((day) => {
      income += day.income;
      expense += day.expense;
      count += day.items.length;
    });
    return {
      income,
      expense,
      net: income - expense,
      count,
    };
  }, [dailyMap]);

  // Build Monday-first calendar cells for currentMonth
  const calendarCells = useMemo(() => {
    const [year, month] = currentMonth.split('-').map(Number);
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    // Convert JS Sunday=0..Saturday=6 to Monday=0..Sunday=6
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;

    const cells: Array<{
      dateStr: string | null;
      dayNum: number | null;
      isSunday: boolean;
    }> = [];

    for (let i = 0; i < startOffset; i++) {
      cells.push({ dateStr: null, dayNum: null, isSunday: i % 7 === 6 });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
      const colIndex = (startOffset + day - 1) % 7;
      cells.push({
        dateStr,
        dayNum: day,
        isSunday: colIndex === 6,
      });
    }

    while (cells.length % 7 !== 0) {
      const colIndex = cells.length % 7;
      cells.push({ dateStr: null, dayNum: null, isSunday: colIndex === 6 });
    }

    return cells;
  }, [currentMonth]);

  // Selected date transactions & summary
  const selectedDayData = useMemo(() => {
    const exactDayTransactions = transactions
      .filter((tx) => tx.date === selectedDate)
      .sort((a, b) => (b.time || '00:00').localeCompare(a.time || '00:00'));

    const income = exactDayTransactions
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const expense = exactDayTransactions.reduce(
      (sum, tx) => sum + getTransactionExpenseImpact(tx),
      0
    );

    return {
      items: exactDayTransactions,
      income,
      expense,
    };
  }, [transactions, selectedDate]);

  const handleJumpToday = () => {
    onChangeMonth(todayMonth);
    onSelectDate(todayStr);
  };

  return (
    <div className="space-y-3">
      {/* Calendar Card */}
      <div className="card !p-3.5">
        {/* Month Navigation Header */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#e1e7e4] dark:border-[#22302d]">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onChangeMonth(shiftMonth(currentMonth, -1))}
              aria-label="Bulan sebelumnya"
              className="min-w-[44px] min-h-[44px] rounded-xl border border-[#e1e7e4] dark:border-[#22302d] bg-white dark:bg-[#1b2623] hover:bg-[#f4f6f5] dark:hover:bg-[#23322e] text-[#17211d] dark:text-[#edf3f1] flex items-center justify-center transition cursor-pointer"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => onChangeMonth(shiftMonth(currentMonth, 1))}
              aria-label="Bulan berikutnya"
              className="min-w-[44px] min-h-[44px] rounded-xl border border-[#e1e7e4] dark:border-[#22302d] bg-white dark:bg-[#1b2623] hover:bg-[#f4f6f5] dark:hover:bg-[#23322e] text-[#17211d] dark:text-[#edf3f1] flex items-center justify-center transition cursor-pointer"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <h2 className="text-sm sm:text-base font-bold text-[#17211d] dark:text-[#edf3f1] capitalize text-center">
            {formatMonthYear(currentMonth)}
          </h2>

          <button
            type="button"
            onClick={handleJumpToday}
            disabled={currentMonth === todayMonth && selectedDate === todayStr}
            className="px-3 min-h-[40px] rounded-xl border border-[#e1e7e4] dark:border-[#22302d] bg-[#f4f6f5] dark:bg-[#1b2623] hover:bg-[#ccfbf1]/50 dark:hover:bg-[#133530] text-[#0f766e] dark:text-[#2dd4bf] text-xs font-semibold transition cursor-pointer disabled:opacity-45 disabled:cursor-default whitespace-nowrap shrink-0"
          >
            Hari Ini
          </button>
        </div>

        {/* Monthly Totals Strip */}
        <div className="grid grid-cols-3 gap-2 py-2.5 border-b border-[#e1e7e4] dark:border-[#22302d] text-center">
          <div className="min-w-0">
            <div className="text-[11px] text-[#6b7872] dark:text-[#95a5a0]">Pemasukan</div>
            <div className="text-xs sm:text-sm font-bold text-[#15803d] dark:text-[#4ade80] tabular-nums truncate">
              +{formatRupiah(monthTotals.income)}
            </div>
          </div>
          <div className="min-w-0 border-x border-[#e1e7e4] dark:border-[#22302d] px-1">
            <div className="text-[11px] text-[#6b7872] dark:text-[#95a5a0]">Pengeluaran</div>
            <div className="text-xs sm:text-sm font-bold text-[#dc2626] dark:text-[#f87171] tabular-nums truncate">
              -{formatRupiah(monthTotals.expense)}
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-[#6b7872] dark:text-[#95a5a0]">Selisih</div>
            <div
              className={`text-xs sm:text-sm font-bold tabular-nums truncate ${
                monthTotals.net >= 0
                  ? 'text-[#0f766e] dark:text-[#2dd4bf]'
                  : 'text-[#dc2626] dark:text-[#f87171]'
              }`}
            >
              {monthTotals.net > 0 ? '+' : ''}
              {formatRupiah(monthTotals.net)}
            </div>
          </div>
        </div>

        {/* Weekday Header */}
        <div className="grid grid-cols-7 gap-1 pt-2.5 pb-1 text-center">
          {WEEKDAY_LABELS.map((label, idx) => (
            <div
              key={label}
              className={`text-[11px] font-semibold ${
                idx === 6
                  ? 'text-[#dc2626]/80 dark:text-[#f87171]/80'
                  : 'text-[#6b7872] dark:text-[#95a5a0]'
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarCells.map((cell, idx) => {
            if (!cell.dateStr || cell.dayNum === null) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[54px] rounded-xl bg-[#f4f6f5]/40 dark:bg-[#1b2623]/30"
                />
              );
            }

            const dateStr = cell.dateStr;
            const summary = dailyMap.get(dateStr);
            const isSelected = selectedDate === dateStr;
            const isToday = todayStr === dateStr;
            const hasActivity = Boolean(summary && summary.items.length > 0);

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => onSelectDate(dateStr)}
                aria-label={`Tanggal ${dateStr}${hasActivity ? `, ${summary?.items.length} transaksi` : ''}`}
                aria-pressed={isSelected}
                className={`min-h-[54px] sm:min-h-[60px] p-1 rounded-xl border flex flex-col items-center justify-between text-center transition cursor-pointer overflow-hidden ${
                  isSelected
                    ? 'border-[#0f766e] dark:border-[#14b8a6] bg-[#ccfbf1]/45 dark:bg-[#133530] ring-1 ring-[#0f766e] dark:ring-[#14b8a6]'
                    : isToday
                    ? 'border-[#14b8a6] bg-[#f4f6f5] dark:bg-[#1b2623]'
                    : hasActivity
                    ? 'border-[#e1e7e4] dark:border-[#22302d] bg-white dark:bg-[#131c1a] hover:bg-[#f4f6f5] dark:hover:bg-[#1b2623]'
                    : 'border-transparent bg-white dark:bg-[#131c1a] hover:bg-[#f4f6f5]/80 dark:hover:bg-[#1b2623]'
                }`}
              >
                <span
                  className={`text-xs font-bold tabular-nums leading-none mt-0.5 px-1.5 py-0.5 rounded-md ${
                    isSelected
                      ? 'bg-[#0f766e] text-white'
                      : isToday
                      ? 'text-[#0f766e] dark:text-[#2dd4bf] underline underline-offset-2'
                      : cell.isSunday
                      ? 'text-[#dc2626] dark:text-[#f87171]'
                      : 'text-[#17211d] dark:text-[#edf3f1]'
                  }`}
                >
                  {cell.dayNum}
                </span>

                <div className="w-full flex flex-col items-center justify-end gap-0.5 min-h-[22px] overflow-hidden">
                  {summary && summary.income > 0 && (
                    <span className="w-full text-[9px] font-bold text-[#15803d] dark:text-[#4ade80] tabular-nums leading-tight truncate">
                      +{formatCompactRupiah(summary.income)}
                    </span>
                  )}
                  {summary && summary.expense > 0 && (
                    <span className="w-full text-[9px] font-bold text-[#dc2626] dark:text-[#f87171] tabular-nums leading-tight truncate">
                      -{formatCompactRupiah(summary.expense)}
                    </span>
                  )}
                  {summary &&
                    summary.income === 0 &&
                    summary.expense === 0 &&
                    summary.transferCount > 0 && (
                      <span className="w-full text-[9px] font-semibold text-[#0284c7] dark:text-[#38bdf8] tabular-nums leading-tight truncate">
                        {summary.transferCount} trf
                      </span>
                    )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Date Transactions Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[#17211d] dark:text-[#edf3f1] truncate">
              {formatDateFull(selectedDate)}
            </h3>
            <div className="text-xs text-[#6b7872] dark:text-[#95a5a0] flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
              <span className="tabular-nums">{selectedDayData.items.length} transaksi</span>
              {selectedDayData.income > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#15803d] dark:text-[#4ade80] font-semibold tabular-nums">
                    +{formatRupiah(selectedDayData.income)}
                  </span>
                </>
              )}
              {selectedDayData.expense > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#dc2626] dark:text-[#f87171] font-semibold tabular-nums">
                    -{formatRupiah(selectedDayData.expense)}
                  </span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onAddTransactionOnDate(selectedDate)}
            className="px-3 min-h-[40px] rounded-xl bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold flex items-center gap-1 shrink-0 transition cursor-pointer whitespace-nowrap"
          >
            <Plus size={14} />
            Catat
          </button>
        </div>

        {selectedDayData.items.length === 0 ? (
          <div className="card text-center py-8 px-4 text-[#6b7872] dark:text-[#95a5a0]">
            <CalendarIcon size={24} className="mx-auto mb-2 text-[#6b7872]/60 dark:text-[#95a5a0]/60" />
            <p className="text-sm font-medium text-[#17211d] dark:text-[#edf3f1]">
              Belum ada transaksi pada tanggal ini
            </p>
            <p className="text-xs mt-1">
              Pilih tanggal lain di kalender atau catat transaksi baru untuk hari ini.
            </p>
          </div>
        ) : (
          <div className="card !p-0 overflow-hidden divide-y divide-[#e1e7e4] dark:divide-[#22302d]">
            {selectedDayData.items.map((tx) => {
              const account = accounts.find((a) => a.id === tx.accountId);
              const toAccount = accounts.find((a) => a.id === tx.toAccountId);

              return (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => onSelectTransaction(tx)}
                  className="w-full text-left px-3.5 py-3 hover:bg-[#f4f6f5] dark:hover:bg-[#1a2623] transition cursor-pointer flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CategoryIcon
                      name=""
                      categoryName={tx.category}
                      type={tx.type}
                      size={18}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#17211d] dark:text-[#edf3f1] truncate">
                        {tx.category}
                      </div>
                      <div className="text-xs text-[#6b7872] dark:text-[#95a5a0] flex items-center gap-1.5 truncate mt-0.5">
                        <span className="capitalize">
                          {tx.type === 'transfer'
                            ? `${account?.name || 'Akun'} → ${toAccount?.name || 'Tujuan'}`
                            : account?.name || 'Akun'}
                        </span>
                        {tx.note && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="italic truncate">{tx.note}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`amt text-sm tabular-nums ${
                        tx.type === 'income'
                          ? 'text-[#15803d] dark:text-[#4ade80]'
                          : tx.type === 'transfer'
                          ? 'text-[#0284c7] dark:text-[#38bdf8]'
                          : 'text-[#dc2626] dark:text-[#f87171]'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : ''}
                      {formatRupiah(tx.amount)}
                    </div>
                    <div className="text-[11px] text-[#6b7872] dark:text-[#95a5a0] tabular-nums mt-0.5">
                      {tx.type === 'transfer' && tx.adminFee && tx.adminFee > 0
                        ? `Adm ${formatRupiah(tx.adminFee)} · ${tx.time}`
                        : tx.time}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
