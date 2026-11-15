import React, { useState } from 'react';
import {
  Wallet,
  Plus,
  Edit2,
  Check,
  AlertCircle,
  ShieldCheck,
  DollarSign,
  CreditCard,
  Banknote,
  Bell,
  BellOff,
  Target,
  PiggyBank,
  Trash2,
  Calendar,
  Calculator,
} from 'lucide-react';
import { Account, BudgetConfig, SavingsGoal, Transaction } from '../types/finance';
import { SAVINGS_GOAL_CATEGORIES } from '../data/defaultData';
import { formatRupiah, formatRibuan } from '../utils/formatters';
import { calculateAccountBalances, getTransactionExpenseImpact } from '../utils/accountBalances';
import { simulateByDeadline, simulateByMonths } from '../utils/goalSimulation';
import { GoalSimulatorCard, SimulatorInitialValues } from './GoalSimulatorCard';

interface BudgetAccountsViewProps {
  accounts: Account[];
  budget: BudgetConfig;
  transactions: Transaction[];
  goals: SavingsGoal[];
  onUpdateBudget: (newBudget: BudgetConfig) => void;
  onUpdateAccounts: (accounts: Account[]) => void;
  onSaveGoal: (goal: Omit<SavingsGoal, 'id' | 'createdAt'> & { id?: string }) => Promise<void> | void;
  onContributeGoal: (goalId: string, nextCurrentAmount: number) => Promise<void> | void;
  onDeleteGoal: (goalId: string) => Promise<void> | void;
}

export const BudgetAccountsView: React.FC<BudgetAccountsViewProps> = ({
  accounts,
  budget,
  transactions,
  goals,
  onUpdateBudget,
  onUpdateAccounts,
  onSaveGoal,
  onContributeGoal,
  onDeleteGoal,
}) => {
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetLimitInput, setBudgetLimitInput] = useState(budget.monthlyLimit.toString());

  // Savings Goal Modal & Quick Deposit State
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [goalName, setGoalName] = useState('');
  const [goalCategory, setGoalCategory] = useState(SAVINGS_GOAL_CATEGORIES[0].name);
  const [goalTargetInput, setGoalTargetInput] = useState('');
  const [goalCurrentInput, setGoalCurrentInput] = useState('0');
  const [goalDeadline, setGoalDeadline] = useState('');
  const [goalBusy, setGoalBusy] = useState(false);

  const [contributingGoalId, setContributingGoalId] = useState<string | null>(null);
  const [depositInput, setDepositInput] = useState('');
  const [confirmDeleteGoalId, setConfirmDeleteGoalId] = useState<string | null>(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simulatorInitial, setSimulatorInitial] = useState<SimulatorInitialValues | null>(null);

  // Adding/Editing Account Modal State
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState<'cash' | 'bank' | 'ewallet'>('bank');
  const [accountInitialBalance, setAccountInitialBalance] = useState('0');

  // Calculate current balances per account (including transfer admin fees)
  const accountBalances = calculateAccountBalances(accounts, transactions);

  // Current month expense
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const totalMonthExpense = transactions
    .filter((tx) => tx.date.startsWith(currentYearMonth))
    .reduce((sum, tx) => sum + getTransactionExpenseImpact(tx), 0);

  const budgetLimit = budget.monthlyLimit || 1;
  const rawPercent = Math.round((totalMonthExpense / budgetLimit) * 100);
  const usedPercent = Math.min(100, rawPercent);
  const remaining = Math.max(0, budgetLimit - totalMonthExpense);
  const isOver = totalMonthExpense > budgetLimit;
  const isCritical90 = !isOver && rawPercent >= 90;
  const isWarning80 = !isOver && rawPercent >= 80 && rawPercent < 90;

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(budgetLimitInput, 10) || 0;
    if (val > 0) {
      onUpdateBudget({
        ...budget,
        monthlyLimit: val,
      });
      setIsEditingBudget(false);
    }
  };

  const openAddAccount = () => {
    setEditingAccountId(null);
    setAccountName('');
    setAccountType('bank');
    setAccountInitialBalance('0');
    setIsAccountModalOpen(true);
  };

  const openEditAccount = (acc: Account) => {
    setEditingAccountId(acc.id);
    setAccountName(acc.name);
    setAccountType(acc.type);
    setAccountInitialBalance(acc.initialBalance.toString());
    setIsAccountModalOpen(true);
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName.trim()) return;

    const initial = parseInt(accountInitialBalance, 10) || 0;

    if (editingAccountId) {
      onUpdateAccounts(
        accounts.map((a) =>
          a.id === editingAccountId
            ? { ...a, name: accountName.trim(), type: accountType, initialBalance: initial }
            : a
        )
      );
    } else {
      const newAcc: Account = {
        id: `acc_${Date.now()}`,
        name: accountName.trim(),
        type: accountType,
        initialBalance: initial,
        color: accountType === 'cash' ? '#059669' : accountType === 'bank' ? '#2563eb' : '#0891b2',
      };
      onUpdateAccounts([...accounts, newAcc]);
    }

    setIsAccountModalOpen(false);
  };

  const handleDeleteAccount = (id: string) => {
    if (accounts.length <= 1) {
      alert('Minimal harus ada 1 akun aktif.');
      return;
    }
    if (confirm('Hapus akun ini? Riwayat transaksi lama akan tetap tersimpan.')) {
      onUpdateAccounts(accounts.filter((a) => a.id !== id));
      setIsAccountModalOpen(false);
    }
  };

  const openAddGoal = () => {
    setEditingGoalId(null);
    setGoalName('');
    setGoalCategory(SAVINGS_GOAL_CATEGORIES[0].name);
    setGoalTargetInput('');
    setGoalCurrentInput('0');
    setGoalDeadline('');
    setIsGoalModalOpen(true);
  };

  const openEditGoal = (goal: SavingsGoal) => {
    setEditingGoalId(goal.id);
    setGoalName(goal.name);
    setGoalCategory(goal.category);
    setGoalTargetInput(String(goal.targetAmount));
    setGoalCurrentInput(String(goal.currentAmount));
    setGoalDeadline(goal.deadline || '');
    setIsGoalModalOpen(true);
  };

  const handleSaveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (goalBusy) return;
    const targetAmt = parseInt(goalTargetInput, 10) || 0;
    const currentAmt = parseInt(goalCurrentInput, 10) || 0;
    if (!goalName.trim() || targetAmt <= 0) return;

    const categoryMeta =
      SAVINGS_GOAL_CATEGORIES.find((c) => c.name === goalCategory) ||
      SAVINGS_GOAL_CATEGORIES[SAVINGS_GOAL_CATEGORIES.length - 1];

    setGoalBusy(true);
    try {
      await onSaveGoal({
        id: editingGoalId || undefined,
        name: goalName.trim(),
        category: goalCategory,
        targetAmount: targetAmt,
        currentAmount: Math.max(0, currentAmt),
        deadline: goalDeadline || '',
        color: categoryMeta.color,
      });
      setIsGoalModalOpen(false);
    } finally {
      setGoalBusy(false);
    }
  };

  const handleDepositGoal = async (goal: SavingsGoal, amountToAdd: number) => {
    if (amountToAdd <= 0 || goalBusy) return;
    setGoalBusy(true);
    try {
      await onContributeGoal(goal.id, goal.currentAmount + amountToAdd);
      setContributingGoalId(null);
      setDepositInput('');
    } finally {
      setGoalBusy(false);
    }
  };

  const handleConfirmDeleteGoal = async (goalId: string) => {
    if (goalBusy) return;
    setGoalBusy(true);
    try {
      await onDeleteGoal(goalId);
      setConfirmDeleteGoalId(null);
    } finally {
      setGoalBusy(false);
    }
  };

  const totalGoalsSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalGoalsTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'cash':
        return <Banknote size={20} className="text-emerald-600" />;
      case 'bank':
        return <CreditCard size={20} className="text-blue-600" />;
      case 'ewallet':
        return <Wallet size={20} className="text-cyan-600" />;
      default:
        return <DollarSign size={20} className="text-[#0f766e]" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Title */}
      <div className="pt-1">
        <h1 className="text-xl font-bold text-[#17211d] dark:text-[#edf3f1] m-0">Anggaran & Dompet</h1>
        <p className="text-xs text-[#6b7872] dark:text-[#95a5a0] mt-0.5">
          Kontrol limit pengeluaran bulanan dan kelola saldo dompet/rekening.
        </p>
      </div>

      {/* Monthly Budget Card */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-[#6b7872] dark:text-[#95a5a0]">
              Target Anggaran Bulanan
            </div>
            <div className="text-lg font-bold text-[#17211d] dark:text-[#edf3f1] mt-0.5">
              {formatRupiah(budget.monthlyLimit)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setBudgetLimitInput(budget.monthlyLimit.toString());
              setIsEditingBudget(!isEditingBudget);
            }}
            className="px-3 py-1.5 rounded-xl border border-[#e1e7e4] dark:border-[#273733] text-xs font-semibold text-[#0f766e] dark:text-[#2dd4bf] hover:bg-[#ccfbf1]/30 dark:hover:bg-[#102825] transition flex items-center gap-1 cursor-pointer"
          >
            <Edit2 size={13} />
            {isEditingBudget ? 'Batal' : 'Ubah Limit'}
          </button>
        </div>

        {isEditingBudget && (
          <form onSubmit={handleSaveBudget} className="p-3 bg-[#f4f6f5] dark:bg-[#1b2623] rounded-xl space-y-2 border border-[#e1e7e4] dark:border-[#273733]">
            <label className="block text-xs font-semibold text-[#17211d] dark:text-[#edf3f1]">
              Atur Batas Pengeluaran per Bulan (Rp)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#0f766e] dark:text-[#2dd4bf] pointer-events-none select-none">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                required
                placeholder="0"
                value={budgetLimitInput ? formatRibuan(budgetLimitInput) : ''}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
                  setBudgetLimitInput(clean);
                }}
                className="w-full pl-10 pr-3 py-2 bg-white dark:bg-[#131c1a] text-[#17211d] dark:text-[#edf3f1] text-base font-bold tabular-nums border border-[#e1e7e4] dark:border-[#273733] rounded-xl focus:border-[#0f766e] dark:focus:border-[#14b8a6]"
              />
            </div>
            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[3000000, 5000000, 7500000, 10000000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setBudgetLimitInput(val.toString())}
                  className="px-2 py-1 text-xs rounded-lg bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733] text-[#17211d] dark:text-[#edf3f1] hover:bg-[#e1e7e4] dark:hover:bg-[#22302d] transition cursor-pointer"
                >
                  {formatRupiah(val)}
                </button>
              ))}
            </div>
            <div className="pt-2">
              <button type="submit" className="btn py-2 text-xs font-bold">
                <Check size={16} />
                Simpan Limit Baru
              </button>
            </div>
          </form>
        )}

        {/* Visual Progress Bar */}
        <div className="space-y-1.5 pt-1">
          <div className="flex justify-between text-xs text-[#6b7872] dark:text-[#95a5a0]">
            <span>Status Pengeluaran Bulan Ini</span>
            <span className="font-semibold text-[#17211d] dark:text-[#edf3f1]">{usedPercent}%</span>
          </div>

          <div className="w-full bg-[#f4f6f5] dark:bg-[#1b2623] h-3 rounded-full overflow-hidden border border-[#e1e7e4] dark:border-[#273733]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isOver
                  ? 'bg-[#dc2626]'
                  : isCritical90
                  ? 'bg-orange-500'
                  : isWarning80
                  ? 'bg-amber-500'
                  : 'bg-[#0f766e] dark:bg-[#14b8a6]'
              }`}
              style={{ width: `${Math.min(100, usedPercent)}%` }}
            />
          </div>

          <div className="flex justify-between text-xs pt-0.5">
            <div>
              <span className="text-[#6b7872] dark:text-[#95a5a0]">Terpakai: </span>
              <strong className="text-[#dc2626] dark:text-[#f87171] tabular-nums">{formatRupiah(totalMonthExpense)}</strong>
            </div>
            <div>
              <span className="text-[#6b7872] dark:text-[#95a5a0]">Sisa: </span>
              <strong className="text-[#15803d] dark:text-[#4ade80] tabular-nums">{formatRupiah(remaining)}</strong>
            </div>
          </div>
        </div>

        {/* Warning if over, >= 90%, or >= 80% */}
        {isOver ? (
          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
            <span>Pengeluaran Anda telah melebihi batas anggaran bulanan ({rawPercent}%)!</span>
          </div>
        ) : isCritical90 ? (
          <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/60 text-xs text-orange-900 dark:text-orange-300 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-orange-600 dark:text-orange-400" />
            <span>Peringatan Kritis! Pengeluaran bulan ini sudah mencapai {rawPercent}% (≥ 90% batas anggaran).</span>
          </div>
        ) : isWarning80 ? (
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Waspada! Pengeluaran bulan ini sudah mencapai {rawPercent}% (≥ 80% batas anggaran).</span>
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <ShieldCheck size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>Keuangan Anda terkontrol dengan baik di bawah batas 80% anggaran.</span>
          </div>
        )}

        {/* Alert Notification Toggle */}
        <div className="pt-2 border-t border-[#e1e7e4] dark:border-[#22302d] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                budget.alertsEnabled
                  ? 'bg-[#ccfbf1] dark:bg-[#102825] text-[#0f766e] dark:text-[#2dd4bf]'
                  : 'bg-[#f4f6f5] dark:bg-[#1b2623] text-[#6b7872] dark:text-[#95a5a0]'
              }`}
            >
              {budget.alertsEnabled ? <Bell size={16} /> : <BellOff size={16} />}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#17211d] dark:text-[#edf3f1]">
                Notifikasi Peringatan Anggaran (80% & 90%)
              </div>
              <div className="text-[11px] text-[#6b7872] dark:text-[#95a5a0]">
                {budget.alertsEnabled
                  ? 'Aktif: tampilkan peringatan saat pengeluaran mencapai 80% atau 90%'
                  : 'Nonaktif: peringatan otomatis disembunyikan'}
              </div>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={budget.alertsEnabled}
            aria-label="Aktifkan notifikasi peringatan anggaran 80% dan 90%"
            onClick={() =>
              onUpdateBudget({
                ...budget,
                alertsEnabled: !budget.alertsEnabled,
              })
            }
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
              budget.alertsEnabled ? 'bg-[#0f766e] dark:bg-[#14b8a6]' : 'bg-[#cbd5d1] dark:bg-[#2c3d39]'
            }`}
          >
            <span
              className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-xs transition-transform ${
                budget.alertsEnabled ? 'translate-x-5.5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Target Tabungan (Goal Tracking) Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[#17211d] dark:text-[#edf3f1] flex items-center gap-1.5">
              <Target size={16} className="text-[#0f766e] dark:text-[#2dd4bf] shrink-0" />
              Target Tabungan (Goal Tracking)
            </h2>
            <p className="text-xs text-[#6b7872] dark:text-[#95a5a0]">
              {goals.length > 0
                ? `Terkumpul ${formatRupiah(totalGoalsSaved)} dari ${formatRupiah(totalGoalsTarget)}`
                : 'Tetapkan target tabungan per kategori dan simulasikan setorannya'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (isSimulatorOpen) {
                  setIsSimulatorOpen(false);
                } else {
                  setSimulatorInitial(null);
                  setIsSimulatorOpen(true);
                }
              }}
              className={`px-2.5 py-1.5 min-h-[36px] rounded-xl border text-xs font-semibold transition flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                isSimulatorOpen
                  ? 'bg-[#ccfbf1]/60 dark:bg-[#102825] border-[#0f766e] dark:border-[#2dd4bf] text-[#0f766e] dark:text-[#2dd4bf]'
                  : 'bg-white dark:bg-[#131c1a] border-[#e1e7e4] dark:border-[#273733] text-[#0f766e] dark:text-[#2dd4bf] hover:bg-[#ccfbf1]/30 dark:hover:bg-[#102825]'
              }`}
            >
              <Calculator size={14} />
              Simulasi
            </button>
            <button
              type="button"
              onClick={openAddGoal}
              className="px-3 py-1.5 min-h-[36px] rounded-xl bg-[#0f766e] text-white text-xs font-semibold hover:bg-[#115e59] transition flex items-center gap-1 shadow-xs cursor-pointer whitespace-nowrap"
            >
              <Plus size={14} />
              Target Baru
            </button>
          </div>
        </div>

        {isSimulatorOpen && (
          <GoalSimulatorCard
            initialValues={simulatorInitial}
            onClose={() => setIsSimulatorOpen(false)}
            onApplyToNewGoal={(values) => {
              setEditingGoalId(null);
              setGoalName(values.name || '');
              setGoalCategory(SAVINGS_GOAL_CATEGORIES[0].name);
              setGoalTargetInput(String(values.targetAmount));
              setGoalCurrentInput(String(values.currentAmount));
              setGoalDeadline(values.deadline || '');
              setIsGoalModalOpen(true);
            }}
          />
        )}

        {goals.length === 0 ? (
          <div className="card !mb-0 text-center py-6 space-y-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#ccfbf1] dark:bg-[#102825] text-[#0f766e] dark:text-[#2dd4bf] flex items-center justify-center mx-auto">
              <PiggyBank size={20} />
            </div>
            <div>
              <div className="text-xs font-bold text-[#17211d] dark:text-[#edf3f1]">
                Belum Ada Target Tabungan
              </div>
              <p className="text-[11px] text-[#6b7872] dark:text-[#95a5a0] mt-0.5 max-w-[260px] mx-auto">
                Buat target seperti Dana Darurat, Liburan, atau Pendidikan agar progresnya tampil di Beranda.
              </p>
            </div>
            <button
              type="button"
              onClick={openAddGoal}
              className="px-3.5 py-2 rounded-xl bg-[#0f766e] text-white text-xs font-semibold hover:bg-[#115e59] transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={14} />
              Buat Target Pertama
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {goals.map((goal) => {
              const rawPct =
                goal.targetAmount > 0
                  ? Math.round((goal.currentAmount / goal.targetAmount) * 100)
                  : 0;
              const barPct = Math.min(100, rawPct);
              const isCompleted = goal.currentAmount >= goal.targetAmount;
              const remainingGoal = Math.max(0, goal.targetAmount - goal.currentAmount);
              const isContributing = contributingGoalId === goal.id;
              const isDeleting = confirmDeleteGoalId === goal.id;

              return (
                <div key={goal.id} className="card !mb-0 !p-3.5 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                          style={{ backgroundColor: goal.color || '#0f766e' }}
                        >
                          {goal.category}
                        </span>
                        {goal.deadline && (
                          <span className="text-[10px] text-[#6b7872] dark:text-[#95a5a0] inline-flex items-center gap-1">
                            <Calendar size={10} />
                            {goal.deadline}
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-bold text-[#17211d] dark:text-[#edf3f1] truncate">
                        {goal.name}
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full tabular-nums shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                          : 'bg-[#f4f6f5] dark:bg-[#1b2623] text-[#17211d] dark:text-[#edf3f1]'
                      }`}
                    >
                      {isCompleted ? 'Tercapai! 100%' : `${rawPct}%`}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-[#f4f6f5] dark:bg-[#1b2623] h-2.5 rounded-full overflow-hidden border border-[#e1e7e4] dark:border-[#273733]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${barPct}%`,
                        backgroundColor: isCompleted ? '#15803d' : goal.color || '#0f766e',
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs tabular-nums">
                    <span className="text-[#6b7872] dark:text-[#95a5a0]">
                      Terkumpul:{' '}
                      <strong className="text-[#17211d] dark:text-[#edf3f1]">{formatRupiah(goal.currentAmount)}</strong>
                    </span>
                    <span className="text-[#6b7872] dark:text-[#95a5a0]">
                      Target:{' '}
                      <strong className="text-[#17211d] dark:text-[#edf3f1]">{formatRupiah(goal.targetAmount)}</strong>
                    </span>
                  </div>

                  {!isCompleted && (
                    <div className="space-y-1">
                      <div className="text-[11px] text-[#6b7872] dark:text-[#95a5a0] tabular-nums">
                        Kurang <strong className="text-[#0f766e] dark:text-[#2dd4bf]">{formatRupiah(remainingGoal)}</strong> lagi untuk mencapai target.
                      </div>
                      {goal.deadline && (() => {
                        const sim = simulateByDeadline(
                          goal.targetAmount,
                          goal.currentAmount,
                          goal.deadline
                        );
                        if (!sim) return null;
                        return (
                          <div className="text-[11px] text-[#17211d] dark:text-[#edf3f1] bg-[#f4f6f5] dark:bg-[#1b2623] rounded-lg px-2.5 py-1.5 border border-[#e1e7e4] dark:border-[#273733] tabular-nums">
                            {sim.isDeadlinePassed ? (
                              <span className="text-amber-700 dark:text-amber-300 font-medium">
                                Target tanggal ({goal.deadline}) telah terlewati — sisa{' '}
                                <strong>{formatRupiah(remainingGoal)}</strong>.
                              </span>
                            ) : (
                              <span>
                                Estimasi nabung:{' '}
                                <strong className="text-[#0f766e] dark:text-[#2dd4bf]">
                                  {formatRupiah(sim.perDay)}/hari
                                </strong>{' '}
                                ·{' '}
                                <strong className="text-[#0f766e] dark:text-[#2dd4bf]">
                                  {formatRupiah(sim.perMonth)}/bln
                                </strong>{' '}
                                ({sim.days} hari lagi)
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Quick Actions */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#e1e7e4]/70 dark:border-[#22302d]">
                    <button
                      type="button"
                      onClick={() => {
                        setContributingGoalId(isContributing ? null : goal.id);
                        setConfirmDeleteGoalId(null);
                        setDepositInput('');
                      }}
                      className="flex-1 py-2 px-2.5 min-h-[36px] rounded-xl bg-teal-50 dark:bg-[#102825] hover:bg-[#ccfbf1] dark:hover:bg-[#163834] text-[#0f766e] dark:text-[#2dd4bf] text-xs font-semibold inline-flex items-center justify-center gap-1 transition cursor-pointer whitespace-nowrap"
                    >
                      <Plus size={13} />
                      Tambah Tabungan
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSimulatorInitial({
                          name: goal.name,
                          targetAmount: goal.targetAmount,
                          currentAmount: goal.currentAmount,
                          deadline: goal.deadline || undefined,
                        });
                        setIsSimulatorOpen(true);
                      }}
                      className="py-2 px-2.5 min-h-[36px] rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] hover:bg-[#ccfbf1]/40 dark:hover:bg-[#102825] text-[#0f766e] dark:text-[#2dd4bf] text-xs font-semibold inline-flex items-center justify-center gap-1 transition cursor-pointer whitespace-nowrap"
                      title="Simulasi Setoran Target"
                    >
                      <Calculator size={13} />
                      Simulasi
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditGoal(goal)}
                      className="py-2 px-2.5 min-h-[36px] rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] hover:bg-[#e8eeec] dark:hover:bg-[#22302d] text-[#17211d] dark:text-[#edf3f1] text-xs font-semibold inline-flex items-center justify-center gap-1 transition cursor-pointer whitespace-nowrap"
                      title="Ubah Target"
                    >
                      <Edit2 size={13} />
                      Ubah
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeleteGoalId(isDeleting ? null : goal.id);
                        setContributingGoalId(null);
                      }}
                      className="p-2 min-h-[36px] min-w-[36px] rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition inline-flex items-center justify-center cursor-pointer"
                      title="Hapus Target"
                      aria-label={`Hapus target ${goal.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {/* Quick Deposit Inline Form */}
                  {isContributing && (
                    <div className="p-2.5 rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] border border-[#e1e7e4] dark:border-[#273733] space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {[50000, 100000, 250000, 500000].map((amt) => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setDepositInput(String(amt))}
                            className="px-2 py-1 text-[11px] rounded-lg bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733] text-[#17211d] dark:text-[#edf3f1] hover:bg-[#e8eeec] dark:hover:bg-[#22302d] font-medium cursor-pointer tabular-nums"
                          >
                            +{formatRupiah(amt)}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#0f766e] dark:text-[#2dd4bf]">
                            Rp
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="Nominal setor"
                            value={depositInput ? formatRibuan(depositInput) : ''}
                            onChange={(e) => {
                              const clean = e.target.value
                                .replace(/[^0-9]/g, '')
                                .replace(/^0+(?=\d)/, '');
                              setDepositInput(clean);
                            }}
                            className="w-full pl-8 pr-2.5 py-2 rounded-xl bg-white dark:bg-[#131c1a] text-[#17211d] dark:text-[#edf3f1] border border-[#e1e7e4] dark:border-[#273733] text-xs font-bold tabular-nums focus:outline-none focus:border-[#0f766e] dark:focus:border-[#14b8a6]"
                          />
                        </div>
                        <button
                          type="button"
                          disabled={goalBusy || !(parseInt(depositInput, 10) > 0)}
                          onClick={() =>
                            handleDepositGoal(goal, parseInt(depositInput, 10) || 0)
                          }
                          className="px-3 py-2 rounded-xl bg-[#0f766e] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                        >
                          Simpan
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Inline Delete Confirmation */}
                  {isDeleting && (
                    <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-2 text-xs">
                      <p className="text-rose-900 dark:text-rose-300 font-medium m-0">
                        Hapus target tabungan "{goal.name}"?
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleConfirmDeleteGoal(goal.id)}
                          disabled={goalBusy}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-[#dc2626] text-white font-semibold cursor-pointer"
                        >
                          Ya, Hapus
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteGoalId(null)}
                          disabled={goalBusy}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733] text-[#17211d] dark:text-[#edf3f1] font-semibold cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Wallets & Accounts Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#17211d] dark:text-[#edf3f1]">Dompet & Rekening Bank</h2>
            <p className="text-xs text-[#6b7872] dark:text-[#95a5a0]">Daftar sumber dana yang Anda miliki</p>
          </div>
          <button
            type="button"
            onClick={openAddAccount}
            className="px-3 py-1.5 rounded-xl bg-[#0f766e] text-white text-xs font-semibold hover:bg-[#115e59] transition flex items-center gap-1 shadow-xs cursor-pointer"
          >
            <Plus size={14} />
            + Tambah
          </button>
        </div>

        <div className="grid gap-2">
          {accounts.map((acc) => {
            const balance = accountBalances[acc.id] ?? 0;
            return (
              <div
                key={acc.id}
                className="card !mb-0 p-3 flex items-center justify-between hover:border-[#0f766e]/40 dark:hover:border-[#2dd4bf]/40 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] border border-[#e1e7e4] dark:border-[#273733]">
                    {getAccountIcon(acc.type)}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#17211d] dark:text-[#edf3f1]">{acc.name}</div>
                    <div className="text-xs text-[#6b7872] dark:text-[#95a5a0] capitalize">
                      {acc.type === 'cash' ? 'Uang Tunai' : acc.type === 'bank' ? 'Rekening Bank' : 'Dompet Digital'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#17211d] dark:text-[#edf3f1]">
                      {formatRupiah(balance)}
                    </div>
                    <div className="text-[10px] text-[#6b7872] dark:text-[#95a5a0]">
                      Saldo Awal: {formatRupiah(acc.initialBalance)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openEditAccount(acc)}
                    className="p-1.5 rounded-lg text-[#6b7872] dark:text-[#95a5a0] hover:text-[#0f766e] dark:hover:text-[#2dd4bf] hover:bg-[#f4f6f5] dark:hover:bg-[#1d2a27] transition cursor-pointer"
                    title="Ubah Akun"
                  >
                    <Edit2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Account Edit/Add Modal */}
      {isAccountModalOpen && (
        <div
          className="sheet open"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAccountModalOpen(false);
          }}
        >
          <div className="panel animate-in fade-in slide-in-from-bottom">
            <h3 className="text-base font-bold text-[#17211d] dark:text-[#edf3f1] mb-3">
              {editingAccountId ? 'Ubah Akun / Dompet' : 'Tambah Akun Baru'}
            </h3>

            <form onSubmit={handleSaveAccount} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0] mb-1">
                  Nama Dompet / Bank
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Rekening BCA, GoPay, Dompet Saku"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  className="bg-white dark:bg-[#1b2623] text-[#17211d] dark:text-[#edf3f1]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0] mb-1">
                  Jenis Akun
                </label>
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value as any)}
                  className="bg-white dark:bg-[#1b2623] text-[#17211d] dark:text-[#edf3f1]"
                >
                  <option value="cash">Uang Tunai (Cash)</option>
                  <option value="bank">Rekening Bank (BCA, Mandiri, BRI, dll)</option>
                  <option value="ewallet">E-Wallet (GoPay, OVO, Dana, ShopeePay)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0] mb-1">
                  Saldo Awal Saat Mulai Menggunakan (Rp)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#0f766e] dark:text-[#2dd4bf] pointer-events-none select-none">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={accountInitialBalance ? formatRibuan(accountInitialBalance) : ''}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
                      setAccountInitialBalance(clean);
                    }}
                    className="w-full pl-10 pr-3 py-2 bg-white dark:bg-[#1b2623] text-[#17211d] dark:text-[#edf3f1] text-base font-bold tabular-nums border border-[#e1e7e4] dark:border-[#273733] rounded-xl focus:border-[#0f766e] dark:focus:border-[#14b8a6]"
                  />
                </div>
                <p className="text-[11px] text-[#6b7872] dark:text-[#95a5a0] mt-1">
                  Saldo saat ini akan dihitung otomatis dari saldo awal ditambah/dikurangi transaksi.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button type="submit" className="btn">
                  <Check size={16} />
                  Simpan Akun
                </button>
                {editingAccountId && (
                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(editingAccountId)}
                    className="btn btn-danger"
                  >
                    Hapus Akun
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Savings Goal Add/Edit Modal */}
      {isGoalModalOpen && (
        <div
          className="sheet open"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsGoalModalOpen(false);
          }}
        >
          <div className="panel animate-in fade-in slide-in-from-bottom">
            <h3 className="text-base font-bold text-[#17211d] dark:text-[#edf3f1] mb-3">
              {editingGoalId ? 'Ubah Target Tabungan' : 'Tambah Target Tabungan'}
            </h3>

            <form onSubmit={handleSaveGoal} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0] mb-1">
                  Nama Target Tabungan
                </label>
                <input
                  type="text"
                  required
                  maxLength={80}
                  placeholder="Contoh: Dana Darurat 6 Bulan, Liburan Keluarga"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  className="bg-white dark:bg-[#1b2623] text-[#17211d] dark:text-[#edf3f1]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0] mb-1">
                  Kategori Tabungan
                </label>
                <select
                  value={goalCategory}
                  onChange={(e) => setGoalCategory(e.target.value)}
                  className="bg-white dark:bg-[#1b2623] text-[#17211d] dark:text-[#edf3f1]"
                >
                  {SAVINGS_GOAL_CATEGORIES.map((cat) => (
                    <option key={cat.name} value={cat.name}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0] mb-1">
                  Jumlah Target (Rp)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#0f766e] dark:text-[#2dd4bf] pointer-events-none select-none">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    placeholder="0"
                    value={goalTargetInput ? formatRibuan(goalTargetInput) : ''}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
                      setGoalTargetInput(clean);
                    }}
                    className="w-full pl-10 pr-3 py-2 bg-white dark:bg-[#1b2623] text-[#17211d] dark:text-[#edf3f1] text-base font-bold tabular-nums border border-[#e1e7e4] dark:border-[#273733] rounded-xl focus:border-[#0f766e] dark:focus:border-[#14b8a6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0] mb-1">
                  Saldo Terkumpul Saat Ini (Rp)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#0f766e] dark:text-[#2dd4bf] pointer-events-none select-none">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={goalCurrentInput ? formatRibuan(goalCurrentInput) : ''}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
                      setGoalCurrentInput(clean);
                    }}
                    className="w-full pl-10 pr-3 py-2 bg-white dark:bg-[#1b2623] text-[#17211d] dark:text-[#edf3f1] text-base font-bold tabular-nums border border-[#e1e7e4] dark:border-[#273733] rounded-xl focus:border-[#0f766e] dark:focus:border-[#14b8a6]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0] mb-1">
                  Target Tanggal Tercapai (Opsional)
                </label>
                <input
                  type="date"
                  value={goalDeadline}
                  onChange={(e) => setGoalDeadline(e.target.value)}
                  className="bg-white dark:bg-[#1b2623] text-[#17211d] dark:text-[#edf3f1]"
                />
              </div>

              {/* Live Savings Simulation Preview inside Add/Edit Modal */}
              {(() => {
                const parsedTarget = parseInt(goalTargetInput || '0', 10) || 0;
                const parsedCurrent = parseInt(goalCurrentInput || '0', 10) || 0;
                const needed = Math.max(0, parsedTarget - parsedCurrent);
                if (parsedTarget <= 0 || needed <= 0) return null;

                if (goalDeadline) {
                  const deadlineSim = simulateByDeadline(
                    parsedTarget,
                    parsedCurrent,
                    goalDeadline
                  );
                  if (!deadlineSim) return null;
                  return (
                    <div className="p-3 rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] border border-[#e1e7e4] dark:border-[#273733] space-y-1.5">
                      <div className="text-xs font-semibold text-[#17211d] dark:text-[#edf3f1] flex items-center gap-1.5">
                        <Calculator size={13} className="text-[#0f766e] dark:text-[#2dd4bf]" />
                        Simulasi Setoran ({deadlineSim.days} hari lagi)
                      </div>
                      {deadlineSim.isDeadlinePassed ? (
                        <div className="text-[11px] text-amber-700 dark:text-amber-300">
                          Tanggal target sudah lewat/hari ini. Sisa yang harus disiapkan:{' '}
                          <strong className="tabular-nums">{formatRupiah(needed)}</strong>.
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-1.5 text-center">
                          <div className="p-2 rounded-lg bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733]">
                            <div className="text-[10px] text-[#6b7872] dark:text-[#95a5a0]">Per Hari</div>
                            <div className="text-xs font-bold text-[#0f766e] dark:text-[#2dd4bf] tabular-nums truncate">
                              {formatRupiah(deadlineSim.perDay)}
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733]">
                            <div className="text-[10px] text-[#6b7872] dark:text-[#95a5a0]">Per Minggu</div>
                            <div className="text-xs font-bold text-[#0f766e] dark:text-[#2dd4bf] tabular-nums truncate">
                              {formatRupiah(deadlineSim.perWeek)}
                            </div>
                          </div>
                          <div className="p-2 rounded-lg bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733]">
                            <div className="text-[10px] text-[#6b7872] dark:text-[#95a5a0]">Per Bulan</div>
                            <div className="text-xs font-bold text-[#17211d] dark:text-[#edf3f1] tabular-nums truncate">
                              {formatRupiah(deadlineSim.perMonth)}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }

                const presets = [6, 12, 24].map((m) =>
                  simulateByMonths(parsedTarget, parsedCurrent, m)
                );
                return (
                  <div className="p-3 rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] border border-[#e1e7e4] dark:border-[#273733] space-y-1.5">
                    <div className="text-xs font-semibold text-[#17211d] dark:text-[#edf3f1] flex items-center gap-1.5">
                      <Calculator size={13} className="text-[#0f766e] dark:text-[#2dd4bf]" />
                      Simulasi Nabung untuk Sisa {formatRupiah(needed)}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      {presets.map((p) => (
                        <button
                          key={p.months}
                          type="button"
                          onClick={() => setGoalDeadline(p.targetDateStr)}
                          className="p-2 rounded-lg bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733] hover:border-[#0f766e] dark:hover:border-[#2dd4bf] transition cursor-pointer"
                          title={`Pilih target ${p.months} bulan (${p.targetDateStr})`}
                        >
                          <div className="text-[10px] text-[#6b7872] dark:text-[#95a5a0]">{p.months} Bulan</div>
                          <div className="text-xs font-bold text-[#0f766e] dark:text-[#2dd4bf] tabular-nums truncate">
                            {formatRupiah(p.perMonth)}/bln
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="pt-2 flex flex-col gap-2">
                <button type="submit" disabled={goalBusy} className="btn">
                  <Check size={16} />
                  {goalBusy ? 'Menyimpan...' : 'Simpan Target Tabungan'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(false)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
