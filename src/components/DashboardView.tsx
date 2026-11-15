import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  AlertTriangle,
  Lock,
  Target,
  Sun,
  Moon,
  HelpCircle,
} from 'lucide-react';
import { Transaction, Account, BudgetConfig, SavingsGoal, UserProfile } from '../types/finance';
import { formatRupiah, formatDateRelative, getTodayDateString } from '../utils/formatters';
import { calculateAccountBalances, getTransactionExpenseImpact } from '../utils/accountBalances';
import { CategoryIcon } from './CategoryIcon';

interface DashboardViewProps {
  transactions: Transaction[];
  accounts: Account[];
  budget: BudgetConfig;
  goals?: SavingsGoal[];
  userProfile?: UserProfile | null;
  isDark?: boolean;
  onToggleDark?: () => void;
  onStartTour?: () => void;
  onOpenAddModal: () => void;
  onSelectTransaction: (tx: Transaction) => void;
  onViewAllTransactions: () => void;
  onNavigateToBudget: () => void;
  onOpenSettings?: () => void;
  onLockApp?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  transactions,
  accounts,
  budget,
  goals = [],
  userProfile,
  isDark = false,
  onToggleDark,
  onStartTour,
  onOpenAddModal,
  onSelectTransaction,
  onViewAllTransactions,
  onNavigateToBudget,
  onOpenSettings,
  onLockApp,
}) => {
  const [hideBalance, setHideBalance] = useState(false);

  // Current month filter
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const currentMonthTransactions = transactions.filter((tx) =>
    tx.date.startsWith(currentYearMonth)
  );

  // Calculate totals
  const totalIncome = currentMonthTransactions
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalExpense = currentMonthTransactions.reduce(
    (sum, tx) => sum + getTransactionExpenseImpact(tx),
    0
  );

  // Compute total account balances (including optional transfer admin fees)
  const accountBalances = calculateAccountBalances(accounts, transactions);

  const totalNetBalance = Object.values(accountBalances).reduce((a, b) => a + b, 0);

  // Budget calculations
  const budgetLimit = budget.monthlyLimit || 1;
  const rawBudgetPercent = Math.round((totalExpense / budgetLimit) * 100);
  const budgetPercent = Math.min(100, rawBudgetPercent);
  const remainingBudget = Math.max(0, budgetLimit - totalExpense);
  const isBudgetExceeded = totalExpense > budgetLimit;
  const isBudgetCritical90 = !isBudgetExceeded && rawBudgetPercent >= 90;
  const isBudgetWarning80 = !isBudgetExceeded && rawBudgetPercent >= 80 && rawBudgetPercent < 90;

  // Daily budget calculations
  const todayKey = getTodayDateString();
  const todayExpense = transactions
    .filter((tx) => tx.date === todayKey)
    .reduce((sum, tx) => sum + getTransactionExpenseImpact(tx), 0);
  const dailyLimit = Math.max(0, budget.dailyLimit || 0);
  const hasDailyLimit = dailyLimit > 0;
  const isDailyExceeded = hasDailyLimit && todayExpense > dailyLimit;
  const dailyPercent = hasDailyLimit ? Math.min(100, Math.round((todayExpense / dailyLimit) * 100)) : 0;

  // Recent transactions (last 7)
  const recentTransactions = [...transactions]
    .sort((a, b) => {
      const dateA = `${a.date}T${a.time || '00:00'}`;
      const dateB = `${b.date}T${b.time || '00:00'}`;
      return dateB.localeCompare(dateA);
    })
    .slice(0, 7);

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const currentMonthName = monthNames[now.getMonth()];

  return (
    <div className="space-y-3">
      {/* Header Greeting */}
      <div className="flex items-center justify-between pt-1 gap-2">
        <div className="min-w-0">
          <span className="text-xs uppercase tracking-wider text-[#6b7872] dark:text-[#95a5a0] font-semibold block truncate">
            {currentMonthName} {now.getFullYear()}
            {userProfile?.displayName ? ` · Halo, ${userProfile.displayName.split(' ')[0]}` : ''}
          </span>
          <h1 className="text-xl font-bold text-[#17211d] dark:text-[#edf3f1] m-0 truncate">
            Catatan Keuangan
          </h1>
        </div>
        <div data-tour="header-actions" className="flex items-center gap-1.5 shrink-0">
          {onStartTour && (
            <button
              type="button"
              onClick={onStartTour}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#22302d] text-[#0f766e] dark:text-[#2dd4bf] hover:bg-[#ccfbf1]/40 dark:hover:bg-[#1b2623] transition cursor-pointer"
              title="Panduan Interaktif"
              aria-label="Buka panduan interaktif"
            >
              <HelpCircle size={17} />
            </button>
          )}
          {onToggleDark && (
            <button
              type="button"
              onClick={onToggleDark}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#22302d] text-[#6b7872] dark:text-[#fbbf24] hover:text-[#17211d] dark:hover:text-[#fde68a] transition cursor-pointer"
              title={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
              aria-label={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
            >
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          )}
          <button
            type="button"
            onClick={() => setHideBalance(!hideBalance)}
            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#22302d] text-[#6b7872] dark:text-[#95a5a0] hover:text-[#17211d] dark:hover:text-[#edf3f1] transition cursor-pointer"
            title={hideBalance ? 'Tampilkan Saldo' : 'Sembunyikan Saldo'}
            aria-label={hideBalance ? 'Tampilkan Saldo' : 'Sembunyikan Saldo'}
          >
            {hideBalance ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
          {userProfile?.appLockEnabled && onLockApp && (
            <button
              type="button"
              onClick={onLockApp}
              className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-xl bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#22302d] text-[#0f766e] dark:text-[#2dd4bf] hover:bg-[#ccfbf1]/40 dark:hover:bg-[#1b2623] transition cursor-pointer"
              title="Kunci Aplikasi"
              aria-label="Kunci Aplikasi"
            >
              <Lock size={16} />
            </button>
          )}
          {userProfile && (
            <button
              type="button"
              onClick={onOpenSettings}
              title={`Akun: ${userProfile.email}`}
              aria-label="Pengaturan Akun Google"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#22302d] overflow-hidden flex items-center justify-center hover:border-[#0f766e] dark:hover:border-[#2dd4bf] transition cursor-pointer"
            >
              {userProfile.photoURL ? (
                <img
                  src={userProfile.photoURL}
                  alt={userProfile.displayName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-sm font-bold text-[#0f766e] dark:text-[#2dd4bf]">
                  {userProfile.displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Hero Card: Total Saldo */}
      <div data-tour="hero-balance" className="card hero shadow-md relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
        <div className="flex justify-between items-center text-teal-100 text-xs font-medium mb-1">
          <span>Total Saldo Tersedia</span>
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-[11px] text-white">
            Semua Akun
          </span>
        </div>
        <div className="big tracking-tight">
          {hideBalance ? 'Rp ••••••••' : formatRupiah(totalNetBalance)}
        </div>
        <div className="text-xs text-teal-100/90 mt-1 flex items-center gap-1.5">
          <span>Arus kas bulan ini:</span>
          <span className="font-semibold text-white">
            {totalIncome - totalExpense >= 0 ? '+' : ''}
            {hideBalance ? '••••••' : formatRupiah(totalIncome - totalExpense)}
          </span>
        </div>
      </div>

      {/* Row Pills: Pemasukan & Pengeluaran Bulan Ini */}
      <div className="row">
        <div className="pill in card flex items-center justify-between !mb-0 border-emerald-100 dark:border-emerald-900/50">
          <div>
            <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
              <ArrowDownLeft size={14} />
              Pemasukan
            </div>
            <div className="amt text-base text-emerald-800 dark:text-emerald-300 mt-0.5 tabular-nums">
              {hideBalance ? '••••••' : formatRupiah(totalIncome)}
            </div>
          </div>
        </div>

        <div className="pill out card flex items-center justify-between !mb-0 border-rose-100 dark:border-rose-900/50">
          <div>
            <div className="text-xs text-rose-700 dark:text-rose-400 font-medium flex items-center gap-1">
              <ArrowUpRight size={14} />
              Pengeluaran
            </div>
            <div className="amt text-base text-rose-800 dark:text-rose-300 mt-0.5 tabular-nums">
              {hideBalance ? '••••••' : formatRupiah(totalExpense)}
            </div>
          </div>
        </div>
      </div>

      {/* Budget Summary Card */}
      <div
        onClick={onNavigateToBudget}
        className="card cursor-pointer hover:border-[#0f766e]/50 dark:hover:border-[#2dd4bf]/50 transition group"
      >
        <div className="flex items-center justify-between text-xs mb-1.5">
          <div className="flex items-center gap-1.5 font-semibold text-[#17211d] dark:text-[#edf3f1]">
            <span>Anggaran Bulan Ini</span>
            {isBudgetExceeded ? (
              <span className="text-[10px] px-1.5 py-0.5 bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 font-bold rounded">
                Melebihi Batas
              </span>
            ) : isBudgetCritical90 ? (
              <span className="text-[10px] px-1.5 py-0.5 bg-orange-100 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300 font-bold rounded flex items-center gap-0.5">
                <AlertTriangle size={10} /> 90%+ Kritis
              </span>
            ) : isBudgetWarning80 ? (
              <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 font-bold rounded flex items-center gap-0.5">
                <AlertTriangle size={10} /> 80%+ Waspada
              </span>
            ) : (
              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-semibold rounded">
                Terkontrol
              </span>
            )}
          </div>
          <span className="text-[#6b7872] dark:text-[#95a5a0] group-hover:text-[#0f766e] dark:group-hover:text-[#2dd4bf] flex items-center text-xs">
            Atur <ChevronRight size={14} />
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#f4f6f5] dark:bg-[#1b2623] h-2.5 rounded-full overflow-hidden border border-[#e1e7e4] dark:border-[#273733]">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isBudgetExceeded
                ? 'bg-[#dc2626]'
                : isBudgetCritical90
                ? 'bg-orange-500'
                : isBudgetWarning80
                ? 'bg-amber-500'
                : 'bg-[#0f766e] dark:bg-[#14b8a6]'
            }`}
            style={{ width: `${Math.min(100, budgetPercent)}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-xs text-[#6b7872] dark:text-[#95a5a0] mt-1.5">
          <span>
            Terpakai: <strong className="text-[#17211d] dark:text-[#edf3f1] tabular-nums">{formatRupiah(totalExpense)}</strong> ({rawBudgetPercent}%)
          </span>
          <span>
            Sisa: <strong className="text-[#17211d] dark:text-[#edf3f1] tabular-nums">{formatRupiah(remainingBudget)}</strong>
          </span>
        </div>

        {hasDailyLimit && (
          <div className="mt-2.5 pt-2 border-t border-[#e1e7e4] dark:border-[#22302d] space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#6b7872] dark:text-[#95a5a0] font-medium">
                Batas Harian Hari Ini
              </span>
              <span
                className={`font-bold tabular-nums ${
                  isDailyExceeded ? 'text-[#dc2626] dark:text-[#f87171]' : 'text-[#17211d] dark:text-[#edf3f1]'
                }`}
              >
                {formatRupiah(todayExpense)} / {formatRupiah(dailyLimit)}
              </span>
            </div>
            <div className="w-full bg-[#f4f6f5] dark:bg-[#1b2623] h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isDailyExceeded ? 'bg-[#dc2626]' : 'bg-[#0f766e] dark:bg-[#14b8a6]'
                }`}
                style={{ width: `${dailyPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Quick Account Cards (Tunai, Bank, E-Wallet) */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#6b7872] dark:text-[#95a5a0]">
            Dompet & Akun
          </h2>
          <button
            type="button"
            onClick={onNavigateToBudget}
            className="text-xs text-[#0f766e] dark:text-[#2dd4bf] font-semibold hover:underline cursor-pointer"
          >
            Kelola
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {accounts.map((acc) => {
            const balance = accountBalances[acc.id] ?? 0;
            return (
              <div
                key={acc.id}
                className="bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#22302d] rounded-xl p-2.5 shadow-xs"
              >
                <div className="text-[11px] text-[#6b7872] dark:text-[#95a5a0] truncate font-medium">{acc.name}</div>
                <div className="text-xs font-bold text-[#17211d] dark:text-[#edf3f1] mt-0.5 truncate tabular-nums">
                  {hideBalance ? '••••••' : formatRupiah(balance)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Savings Goal Progress Card */}
      <div className="pt-1">
        <div className="flex justify-between items-center mb-1.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#6b7872] dark:text-[#95a5a0] flex items-center gap-1">
            <Target size={13} className="text-[#0f766e] dark:text-[#2dd4bf]" />
            Target Tabungan
          </h2>
          <button
            type="button"
            onClick={onNavigateToBudget}
            className="text-xs text-[#0f766e] dark:text-[#2dd4bf] font-semibold hover:underline cursor-pointer"
          >
            {goals.length > 0 ? 'Kelola' : 'Tetapkan'}
          </button>
        </div>

        {goals.length === 0 ? (
          <div
            onClick={onNavigateToBudget}
            className="card !mb-0 !p-3 cursor-pointer hover:border-[#0f766e]/40 dark:hover:border-[#2dd4bf]/40 transition flex items-center justify-between gap-3"
          >
            <div className="text-xs text-[#6b7872] dark:text-[#95a5a0]">
              Belum ada target tabungan. Tetapkan target per kategori untuk memantau progresnya di sini.
            </div>
            <ChevronRight size={16} className="text-[#0f766e] dark:text-[#2dd4bf] shrink-0" />
          </div>
        ) : (
          <div className="card !mb-0 !p-3 space-y-3">
            {goals.slice(0, 4).map((goal) => {
              const rawPct =
                goal.targetAmount > 0
                  ? Math.round((goal.currentAmount / goal.targetAmount) * 100)
                  : 0;
              const barPct = Math.min(100, rawPct);
              const isCompleted = goal.currentAmount >= goal.targetAmount;

              return (
                <div
                  key={goal.id}
                  onClick={onNavigateToBudget}
                  className="space-y-1.5 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: goal.color || '#0f766e' }}
                      />
                      <span className="font-semibold text-[#17211d] dark:text-[#edf3f1] truncate">{goal.name}</span>
                      <span className="text-[10px] text-[#6b7872] dark:text-[#95a5a0] bg-[#f4f6f5] dark:bg-[#1b2623] px-1.5 py-0.5 rounded-md shrink-0">
                        {goal.category}
                      </span>
                    </div>
                    <span
                      className={`font-bold tabular-nums shrink-0 ${
                        isCompleted ? 'text-[#15803d] dark:text-[#4ade80]' : 'text-[#0f766e] dark:text-[#2dd4bf]'
                      }`}
                    >
                      {rawPct}%
                    </span>
                  </div>

                  <div className="w-full bg-[#f4f6f5] dark:bg-[#1b2623] h-2 rounded-full overflow-hidden border border-[#e1e7e4]/80 dark:border-[#273733]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${barPct}%`,
                        backgroundColor: isCompleted ? '#15803d' : goal.color || '#0f766e',
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#6b7872] dark:text-[#95a5a0] tabular-nums">
                    <span>
                      {hideBalance ? '••••••' : formatRupiah(goal.currentAmount)}
                    </span>
                    <span>
                      Target: {hideBalance ? '••••••' : formatRupiah(goal.targetAmount)}
                    </span>
                  </div>
                </div>
              );
            })}
            {goals.length > 4 && (
              <button
                type="button"
                onClick={onNavigateToBudget}
                className="w-full pt-1 text-center text-[11px] font-semibold text-[#0f766e] dark:text-[#2dd4bf] hover:underline cursor-pointer"
              >
                Lihat semua {goals.length} target tabungan →
              </button>
            )}
          </div>
        )}
      </div>

      {/* Daftar Transaksi Terkini */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-[#17211d] dark:text-[#edf3f1]">Transaksi Terkini</h2>
          {transactions.length > 0 && (
            <button
              type="button"
              onClick={onViewAllTransactions}
              className="text-xs text-[#0f766e] dark:text-[#2dd4bf] font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              Lihat Semua ({transactions.length})
              <ChevronRight size={14} />
            </button>
          )}
        </div>

        <div className="card !p-0 overflow-hidden divide-y divide-[#e1e7e4] dark:divide-[#22302d]">
          {recentTransactions.length === 0 ? (
            <div className="p-8 text-center text-[#6b7872] dark:text-[#95a5a0]">
              <p className="text-sm">Belum ada transaksi yang dicatat.</p>
              <button
                type="button"
                onClick={onOpenAddModal}
                className="mt-3 px-4 py-2 bg-[#0f766e] text-white text-xs font-semibold rounded-xl hover:bg-[#115e59] transition cursor-pointer"
              >
                + Catat Transaksi Pertama
              </button>
            </div>
          ) : (
            recentTransactions.map((tx) => {
              const account = accounts.find((a) => a.id === tx.accountId);
              const toAccount = accounts.find((a) => a.id === tx.toAccountId);

              return (
                <div
                  key={tx.id}
                  onClick={() => onSelectTransaction(tx)}
                  className="tx px-3.5 py-3 hover:bg-[#f4f6f5] dark:hover:bg-[#1a2623] transition cursor-pointer flex items-center justify-between"
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
                        <span>{formatDateRelative(tx.date)}</span>
                        <span>•</span>
                        <span className="capitalize">
                          {tx.type === 'transfer'
                            ? `${account?.name || 'Akun'} → ${toAccount?.name || 'Tujuan'}`
                            : account?.name || 'Akun'}
                        </span>
                        {tx.note && (
                          <>
                            <span>•</span>
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
                    <div className="text-[10px] text-[#6b7872] dark:text-[#95a5a0] mt-0.5 tabular-nums">
                      {tx.type === 'transfer' && tx.adminFee && tx.adminFee > 0
                        ? `Adm ${formatRupiah(tx.adminFee)} · ${tx.time}`
                        : tx.time}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
