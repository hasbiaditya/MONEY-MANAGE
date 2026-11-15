import React, { useState, useMemo } from 'react';
import { ArrowUpRight, ArrowDownLeft, Info, RotateCcw, FileText, Share2, Download, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Account, BudgetConfig, Transaction, UserProfile } from '../types/finance';
import { EXPENSE_CATEGORIES } from '../data/defaultData';
import { formatRupiah, formatMonthYear } from '../utils/formatters';
import { getTransactionExpenseImpact } from '../utils/accountBalances';
import { downloadMonthlyReportPdf, shareMonthlyReportPdf } from '../utils/pdfReport';
import { CategoryIcon } from './CategoryIcon';

interface StatisticsViewProps {
  transactions: Transaction[];
  accounts: Account[];
  budget: BudgetConfig;
  userProfile?: UserProfile | null;
}

interface ExpenseCategoryItem {
  category: string;
  amount: number;
  percentage: number;
  color: string;
}

interface TooltipPayloadEntry {
  payload?: ExpenseCategoryItem;
}

interface CustomExpenseTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
}

const FALLBACK_COLORS = [
  '#0f766e',
  '#2563eb',
  '#ea580c',
  '#9333ea',
  '#16a34a',
  '#e11d48',
  '#eab308',
  '#0891b2',
  '#db2777',
  '#64748b',
];

const CATEGORY_COLOR_MAP: Record<string, string> = EXPENSE_CATEGORIES.reduce(
  (acc, cat) => {
    acc[cat.name] = cat.color;
    return acc;
  },
  {} as Record<string, string>
);

const CustomExpenseTooltip: React.FC<CustomExpenseTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  return (
    <div className="bg-white/95 dark:bg-[#131c1a]/95 backdrop-blur-sm border border-[#e1e7e4] dark:border-[#273733] rounded-xl px-3 py-2 shadow-md text-xs pointer-events-none">
      <div className="flex items-center gap-2 font-semibold text-[#17211d] dark:text-[#edf3f1]">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: item.color }}
        />
        <span>{item.category}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3 tabular-nums">
        <span className="font-bold text-[#17211d] dark:text-[#edf3f1]">{formatRupiah(item.amount)}</span>
        <span className="text-[#6b7872] dark:text-[#95a5a0] font-medium">{item.percentage}%</span>
      </div>
    </div>
  );
};

export const StatisticsView: React.FC<StatisticsViewProps> = ({
  transactions,
  accounts,
  budget,
  userProfile,
}) => {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [pdfFeedback, setPdfFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  // Available months
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.date) {
        set.add(tx.date.substring(0, 7));
      }
    });
    set.add(defaultMonth);
    return Array.from(set).sort().reverse();
  }, [transactions, defaultMonth]);

  // Filter transactions by selected month
  const monthTransactions = useMemo(() => {
    return transactions.filter((tx) => tx.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  // Calculate totals
  const totalExpense = monthTransactions.reduce(
    (sum, tx) => sum + getTransactionExpenseImpact(tx),
    0
  );

  const totalIncome = monthTransactions
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;

  // Category breakdown for expenses with consistent color mapping
  const expenseByCategory: ExpenseCategoryItem[] = useMemo(() => {
    const map: Record<string, number> = {};
    monthTransactions.forEach((tx) => {
      if (tx.type === 'expense') {
        map[tx.category] = (map[tx.category] || 0) + tx.amount;
      } else if (tx.type === 'transfer' && tx.adminFee && tx.adminFee > 0) {
        map['Biaya Admin Transfer'] = (map['Biaya Admin Transfer'] || 0) + tx.adminFee;
      }
    });

    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount], idx) => ({
        category,
        amount,
        percentage: totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0,
        color:
          category === 'Biaya Admin Transfer'
            ? '#0284c7'
            : CATEGORY_COLOR_MAP[category] || FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
      }));
  }, [monthTransactions, totalExpense]);

  // Category breakdown for income
  const incomeByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    monthTransactions
      .filter((tx) => tx.type === 'income')
      .forEach((tx) => {
        map[tx.category] = (map[tx.category] || 0) + tx.amount;
      });

    return Object.entries(map)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalIncome > 0 ? Math.round((amount / totalIncome) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthTransactions, totalIncome]);

  // Daily average
  const daysInMonth = new Date(
    parseInt(selectedMonth.split('-')[0], 10),
    parseInt(selectedMonth.split('-')[1], 10),
    0
  ).getDate();
  const averageDailyExpense = Math.round(totalExpense / (daysInMonth || 30));

  const topExpenseCategory = expenseByCategory[0];
  const activeExpenseItem = useMemo(
    () => expenseByCategory.find((item) => item.category === selectedCategory) || null,
    [expenseByCategory, selectedCategory]
  );

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    setSelectedCategory(null);
    setPdfFeedback(null);
  };

  const handleToggleCategory = (categoryName: string) => {
    setSelectedCategory((prev) => (prev === categoryName ? null : categoryName));
  };

  const handleDownloadPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const result = await downloadMonthlyReportPdf({
        selectedMonth,
        transactions,
        accounts,
        budget,
        userProfile,
      });
      setPdfFeedback({ type: result.ok ? 'success' : 'error', text: result.message });
    } catch {
      setPdfFeedback({ type: 'error', text: 'Gagal membuat laporan PDF. Silakan coba lagi.' });
    } finally {
      setPdfBusy(false);
    }
  };

  const handleSharePdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const result = await shareMonthlyReportPdf({
        selectedMonth,
        transactions,
        accounts,
        budget,
        userProfile,
      });
      setPdfFeedback({ type: result.ok ? 'success' : 'error', text: result.message });
    } catch {
      setPdfFeedback({ type: 'error', text: 'Gagal membagikan laporan PDF.' });
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header with Month Selector */}
      <div className="flex items-center justify-between pt-1">
        <h1 className="text-xl font-bold text-[#17211d] dark:text-[#edf3f1] m-0">Laporan & Statistik</h1>
        <select
          value={selectedMonth}
          onChange={(e) => handleMonthChange(e.target.value)}
          aria-label="Pilih bulan laporan"
          className="bg-white dark:bg-[#131c1a] py-1.5 px-3 text-xs font-semibold border-[#e1e7e4] dark:border-[#22302d] rounded-xl w-auto text-[#0f766e] dark:text-[#2dd4bf]"
        >
          {availableMonths.map((m) => (
            <option key={m} value={m}>
              {formatMonthYear(m)}
            </option>
          ))}
        </select>
      </div>

      {/* Monthly PDF Report Actions */}
      <div className="card !p-3 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 shrink-0">
            <FileText size={17} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-[#17211d] dark:text-[#edf3f1] truncate">
              Laporan Bulanan PDF
            </div>
            <div className="text-[11px] text-[#6b7872] dark:text-[#95a5a0] truncate">
              Ringkasan {formatMonthYear(selectedMonth)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={pdfBusy}
            className="px-2.5 py-2 min-h-[38px] rounded-xl bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <Download size={14} />
            Unduh PDF
          </button>
          <button
            type="button"
            onClick={handleSharePdf}
            disabled={pdfBusy}
            title="Bagikan laporan PDF"
            aria-label="Bagikan laporan PDF"
            className="px-2.5 py-2 min-h-[38px] rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] hover:bg-[#e8eeec] dark:hover:bg-[#22302d] border border-[#e1e7e4] dark:border-[#273733] text-[#17211d] dark:text-[#edf3f1] text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <Share2 size={14} />
            Bagikan
          </button>
        </div>
      </div>

      {pdfFeedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
            pdfFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {pdfFeedback.type === 'success' ? (
              <CheckCircle2 size={15} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle size={15} className="shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span className="leading-snug">{pdfFeedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setPdfFeedback(null)}
            aria-label="Tutup pesan PDF"
            className="p-1 opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Overview stats */}
      <div className="card !p-3.5 space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0]">
          <span>Ringkasan {formatMonthYear(selectedMonth)}</span>
          <span className="text-[#0f766e] dark:text-[#2dd4bf] tabular-nums">{monthTransactions.length} Transaksi</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-[#dcfce7]/60 dark:bg-emerald-950/40 border border-[#bbf7d0] dark:border-emerald-900/60">
            <div className="text-[11px] font-semibold text-[#15803d] dark:text-[#4ade80] flex items-center gap-1">
              <ArrowDownLeft size={13} /> Total Pemasukan
            </div>
            <div className="text-base font-bold text-[#15803d] dark:text-[#4ade80] mt-1 tabular-nums">
              {formatRupiah(totalIncome)}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#fee2e2]/60 dark:bg-rose-950/40 border border-[#fecaca] dark:border-rose-900/60">
            <div className="text-[11px] font-semibold text-[#dc2626] dark:text-[#f87171] flex items-center gap-1">
              <ArrowUpRight size={13} /> Total Pengeluaran
            </div>
            <div className="text-base font-bold text-[#dc2626] dark:text-[#f87171] mt-1 tabular-nums">
              {formatRupiah(totalExpense)}
            </div>
          </div>
        </div>

        {/* Cashflow bar */}
        <div className="pt-1">
          <div className="flex justify-between text-xs text-[#6b7872] dark:text-[#95a5a0] mb-1">
            <span>Sisa Arus Kas / Tabungan</span>
            <span
              className={`font-bold tabular-nums ${
                netSavings >= 0 ? 'text-[#15803d] dark:text-[#4ade80]' : 'text-[#dc2626] dark:text-[#f87171]'
              }`}
            >
              {netSavings >= 0 ? '+' : ''}
              {formatRupiah(netSavings)} ({savingsRate}%)
            </span>
          </div>
          <div className="w-full bg-[#f4f6f5] dark:bg-[#1b2623] h-2.5 rounded-full overflow-hidden flex border border-[#e1e7e4] dark:border-[#273733]">
            {totalIncome + totalExpense > 0 ? (
              <>
                <div
                  className="bg-[#15803d] dark:bg-emerald-500 h-full"
                  style={{
                    width: `${Math.round((totalIncome / (totalIncome + totalExpense)) * 100)}%`,
                  }}
                  title="Pemasukan"
                />
                <div
                  className="bg-[#dc2626] dark:bg-rose-500 h-full"
                  style={{
                    width: `${Math.round((totalExpense / (totalIncome + totalExpense)) * 100)}%`,
                  }}
                  title="Pengeluaran"
                />
              </>
            ) : (
              <div className="w-full bg-gray-200 dark:bg-[#22302d]" />
            )}
          </div>
        </div>
      </div>

      {/* Smart Insight Box */}
      {topExpenseCategory && (
        <div className="p-3 rounded-xl bg-[#ccfbf1]/60 dark:bg-[#102825] border border-[#99f6e4] dark:border-[#1e4e47] text-xs text-[#0f766e] dark:text-[#2dd4bf] flex items-start gap-2.5">
          <Info size={18} className="shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Sorotan Keuangan: </span>
            Pengeluaran terbesar bulan ini adalah untuk{' '}
            <strong>{topExpenseCategory.category}</strong> sebesar{' '}
            <strong className="tabular-nums">{formatRupiah(topExpenseCategory.amount)}</strong> (
            {topExpenseCategory.percentage}% dari total belanja). Rata-rata pengeluaran harian
            sekitar <strong className="tabular-nums">{formatRupiah(averageDailyExpense)}/hari</strong>.
          </div>
        </div>
      )}

      {/* Expense by Category Card: Integrated Donut Chart + Detail List */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[#17211d] dark:text-[#edf3f1]">Pengeluaran per Kategori</h2>
          <div className="flex items-center gap-2">
            {activeExpenseItem && (
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0f766e] dark:text-[#2dd4bf] hover:underline px-1.5 py-0.5 rounded-lg"
              >
                <RotateCcw size={12} />
                Reset
              </button>
            )}
            <span className="text-xs text-[#6b7872] dark:text-[#95a5a0] tabular-nums">
              {expenseByCategory.length} Kategori
            </span>
          </div>
        </div>

        {expenseByCategory.length === 0 ? (
          <div className="text-center py-8 text-[#6b7872] dark:text-[#95a5a0] text-xs">
            Belum ada pengeluaran di bulan ini.
          </div>
        ) : (
          <>
            {/* Donut Chart Visualization */}
            <div className="relative w-full h-[230px] select-none">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={64}
                    outerRadius={94}
                    paddingAngle={expenseByCategory.length > 1 ? 2 : 0}
                    stroke="var(--card)"
                    strokeWidth={2}
                    animationDuration={400}
                    onClick={(_, index) => {
                      const clicked = expenseByCategory[index];
                      if (clicked) {
                        handleToggleCategory(clicked.category);
                      }
                    }}
                    className="cursor-pointer focus:outline-none"
                  >
                    {expenseByCategory.map((entry) => {
                      const isDimmed =
                        activeExpenseItem !== null &&
                        activeExpenseItem.category !== entry.category;
                      return (
                        <Cell
                          key={entry.category}
                          fill={entry.color}
                          fillOpacity={isDimmed ? 0.25 : 1}
                          style={{
                            transition: 'fill-opacity 180ms ease',
                            cursor: 'pointer',
                            outline: 'none',
                          }}
                        />
                      );
                    })}
                  </Pie>
                  <Tooltip
                    content={<CustomExpenseTooltip />}
                    wrapperStyle={{ zIndex: 20, outline: 'none' }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Center Summary Overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-8 text-center">
                {activeExpenseItem ? (
                  <>
                    <span className="text-[11px] font-semibold text-[#6b7872] dark:text-[#95a5a0] max-w-[112px] truncate">
                      {activeExpenseItem.category}
                    </span>
                    <span className="text-sm font-bold text-[#17211d] dark:text-[#edf3f1] tabular-nums leading-tight mt-0.5">
                      {formatRupiah(activeExpenseItem.amount)}
                    </span>
                    <span
                      className="text-[11px] font-semibold tabular-nums mt-0.5"
                      style={{ color: activeExpenseItem.color }}
                    >
                      {activeExpenseItem.percentage}% dari total
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[11px] font-medium text-[#6b7872] dark:text-[#95a5a0]">
                      Total Pengeluaran
                    </span>
                    <span className="text-sm font-bold text-[#17211d] dark:text-[#edf3f1] tabular-nums leading-tight mt-0.5">
                      {formatRupiah(totalExpense)}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="text-[11px] text-center text-[#6b7872] dark:text-[#95a5a0] -mt-1">
              Ketuk irisan diagram atau daftar di bawah untuk menyorot kategori
            </div>

            {/* Interactive Category Breakdown List */}
            <div className="pt-2 border-t border-[#e1e7e4] dark:border-[#22302d] space-y-1.5">
              {expenseByCategory.map((item) => {
                const isSelected = activeExpenseItem?.category === item.category;
                const isDimmed = activeExpenseItem !== null && !isSelected;

                return (
                  <button
                    key={item.category}
                    type="button"
                    onClick={() => handleToggleCategory(item.category)}
                    aria-pressed={isSelected}
                    className={`w-full text-left min-h-[48px] px-2.5 py-2 rounded-xl transition-all duration-150 cursor-pointer space-y-1.5 ${
                      isSelected
                        ? 'bg-[#f4f6f5] dark:bg-[#1b2623] ring-1 ring-[#0f766e]/40 dark:ring-[#2dd4bf]/40 opacity-100'
                        : isDimmed
                        ? 'opacity-40 hover:opacity-80'
                        : 'hover:bg-[#f4f6f5]/70 dark:hover:bg-[#1b2623]/70 opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <CategoryIcon
                          name=""
                          categoryName={item.category}
                          type="expense"
                          color={item.color}
                          size={14}
                        />
                        <span className="font-semibold text-[#17211d] dark:text-[#edf3f1] truncate">
                          {item.category}
                        </span>
                      </div>
                      <div className="text-right shrink-0 tabular-nums">
                        <span className="font-bold text-[#17211d] dark:text-[#edf3f1]">
                          {formatRupiah(item.amount)}
                        </span>
                        <span className="text-[#6b7872] dark:text-[#95a5a0] ml-1.5 font-medium">
                          ({item.percentage}%)
                        </span>
                      </div>
                    </div>

                    {/* Progress track synced with donut slice color */}
                    <div className="w-full bg-[#f4f6f5] dark:bg-[#1b2623] h-2 rounded-full overflow-hidden border border-[#e1e7e4]/70 dark:border-[#273733]">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(4, item.percentage)}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Income by Category Breakdown */}
      {incomeByCategory.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#17211d] dark:text-[#edf3f1]">Pemasukan per Kategori</h2>
            <span className="text-xs text-[#6b7872] dark:text-[#95a5a0] tabular-nums">
              {incomeByCategory.length} Sumber
            </span>
          </div>

          <div className="space-y-3">
            {incomeByCategory.map((item) => (
              <div key={item.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <CategoryIcon
                      name=""
                      categoryName={item.category}
                      type="income"
                      size={14}
                    />
                    <span className="font-semibold text-[#17211d] dark:text-[#edf3f1] truncate">
                      {item.category}
                    </span>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <span className="font-bold text-[#15803d] dark:text-[#4ade80]">
                      +{formatRupiah(item.amount)}
                    </span>
                    <span className="text-[#6b7872] dark:text-[#95a5a0] ml-1.5 font-medium">
                      ({item.percentage}%)
                    </span>
                  </div>
                </div>

                <div className="w-full bg-[#f4f6f5] dark:bg-[#1b2623] h-2 rounded-full overflow-hidden border border-[#e1e7e4]/70 dark:border-[#273733]">
                  <div
                    className="h-full rounded-full bg-[#15803d] dark:bg-emerald-500 transition-all duration-300"
                    style={{ width: `${Math.max(4, item.percentage)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

