import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Trash2,
  Check,
  ArrowUpDown,
  ArrowRight,
  Plus,
  Loader2,
  AlertTriangle,
  Wallet,
} from 'lucide-react';
import { Transaction, TransactionType, Category, Account } from '../types/finance';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  EWALLET_PRESETS,
  EWalletPreset,
} from '../data/defaultData';
import { CategoryIcon } from './CategoryIcon';
import {
  formatRupiah,
  formatRibuan,
  getTodayDateString,
  getCurrentTimeString,
  terbilang,
} from '../utils/formatters';
import { calculateAccountBalances } from '../utils/accountBalances';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tx: Omit<Transaction, 'id' | 'createdAt'> & { id?: string }) => void;
  onDelete?: (id: string) => void;
  editingTransaction?: Transaction | null;
  defaultDate?: string;
  defaultType?: TransactionType;
  accounts: Account[];
  transactions?: Transaction[];
  onQuickCreateAccount?: (account: Account) => Promise<Account | void>;
}

const ACCOUNT_TYPE_LABELS: Record<Account['type'], string> = {
  cash: 'Tunai',
  bank: 'Bank',
  ewallet: 'E-Wallet',
};

const ADMIN_FEE_PRESETS = [
  { label: 'Gratis', value: 0 },
  { label: 'Rp 1.000', value: 1000 },
  { label: 'Rp 2.500', value: 2500 },
  { label: 'Rp 6.500', value: 6500 },
];

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editingTransaction,
  defaultDate,
  defaultType = 'expense',
  accounts,
  transactions = [],
  onQuickCreateAccount,
}) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amountStr, setAmountStr] = useState<string>('');
  const [adminFeeStr, setAdminFeeStr] = useState<string>('');
  const [category, setCategory] = useState<string>('Makanan & Minuman');
  const [accountId, setAccountId] = useState<string>('cash');
  const [toAccountId, setToAccountId] = useState<string>('ewallet');
  const [date, setDate] = useState<string>(getTodayDateString());
  const [time, setTime] = useState<string>(getCurrentTimeString());
  const [note, setNote] = useState<string>('');
  const [customCategoryInput, setCustomCategoryInput] = useState<string>('');
  const [isCustomCategory, setIsCustomCategory] = useState<boolean>(false);

  const [showCustomEwallet, setShowCustomEwallet] = useState<boolean>(false);
  const [customEwalletName, setCustomEwalletName] = useState<string>('');
  const [creatingWalletId, setCreatingWalletId] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

  const prevInitKeyRef = useRef<string | null>(null);

  // Initialize form only when modal opens or the target transaction/defaultType changes
  // (avoids resetting user input if `accounts` updates while modal is open after quick-creating a wallet)
  useEffect(() => {
    if (!isOpen) {
      prevInitKeyRef.current = null;
      return;
    }

    const initKey = editingTransaction
      ? `edit:${editingTransaction.id}`
      : `new:${defaultType}:${defaultDate || ''}`;

    if (prevInitKeyRef.current === initKey) {
      return;
    }
    prevInitKeyRef.current = initKey;

    setShowCustomEwallet(false);
    setCustomEwalletName('');
    setWalletError(null);
    setCreatingWalletId(null);
    setConfirmDelete(false);

    if (editingTransaction) {
      const initialSource = editingTransaction.accountId || accounts[0]?.id || 'cash';
      const fallbackDest =
        accounts.find((a) => a.id !== initialSource)?.id || accounts[0]?.id || 'ewallet';
      setType(editingTransaction.type);
      setAmountStr(editingTransaction.amount.toString());
      setAdminFeeStr(
        editingTransaction.adminFee && editingTransaction.adminFee > 0
          ? String(editingTransaction.adminFee)
          : ''
      );
      setCategory(editingTransaction.category);
      setAccountId(initialSource);
      setToAccountId(editingTransaction.toAccountId || fallbackDest);
      setDate(editingTransaction.date);
      setTime(editingTransaction.time || getCurrentTimeString());
      setNote(editingTransaction.note || '');
      setIsCustomCategory(false);
      setCustomCategoryInput('');
    } else {
      const initialType = defaultType || 'expense';
      const defaultSource =
        initialType === 'transfer'
          ? accounts.find((a) => a.type === 'bank')?.id || accounts[0]?.id || 'cash'
          : accounts[0]?.id || 'cash';
      const defaultDest =
        accounts.find((a) => a.id !== defaultSource && a.type === 'ewallet')?.id ||
        accounts.find((a) => a.id !== defaultSource)?.id ||
        defaultSource;

      setType(initialType);
      setAmountStr('');
      setAdminFeeStr('');
      setCategory(
        initialType === 'income'
          ? INCOME_CATEGORIES[0].name
          : initialType === 'transfer'
          ? 'Transfer Saldo'
          : EXPENSE_CATEGORIES[0].name
      );
      setAccountId(defaultSource);
      setToAccountId(defaultDest);
      setDate(defaultDate || getTodayDateString());
      setTime(getCurrentTimeString());
      setNote('');
      setIsCustomCategory(false);
      setCustomCategoryInput('');
    }
  }, [isOpen, editingTransaction, defaultDate, defaultType, accounts]);

  // Compute current balances per account, reversing the edited transaction's prior impact so live preview is exact
  const baseAccountBalances = useMemo(() => {
    const balances = calculateAccountBalances(accounts, transactions);
    if (editingTransaction) {
      if (editingTransaction.type === 'income') {
        if (balances[editingTransaction.accountId] !== undefined) {
          balances[editingTransaction.accountId] -= editingTransaction.amount;
        }
      } else if (editingTransaction.type === 'expense') {
        if (balances[editingTransaction.accountId] !== undefined) {
          balances[editingTransaction.accountId] += editingTransaction.amount;
        }
      } else if (editingTransaction.type === 'transfer') {
        const oldFee = Math.max(0, editingTransaction.adminFee || 0);
        if (balances[editingTransaction.accountId] !== undefined) {
          balances[editingTransaction.accountId] += editingTransaction.amount + oldFee;
        }
        if (
          editingTransaction.toAccountId &&
          balances[editingTransaction.toAccountId] !== undefined
        ) {
          balances[editingTransaction.toAccountId] -= editingTransaction.amount;
        }
      }
    }
    return balances;
  }, [accounts, transactions, editingTransaction]);

  // When type changes, switch default category and ensure valid transfer pairs
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    if (newType === 'expense') {
      setCategory(EXPENSE_CATEGORIES[0].name);
      setAdminFeeStr('');
    } else if (newType === 'income') {
      setCategory(INCOME_CATEGORIES[0].name);
      setAdminFeeStr('');
    } else {
      setCategory('Transfer Saldo');
      if (accountId === toAccountId && accounts.length >= 2) {
        const alt = accounts.find((a) => a.id !== accountId);
        if (alt) setToAccountId(alt.id);
      }
    }
    setIsCustomCategory(false);
  };

  const handleQuickAdd = (addedAmount: number) => {
    const current = parseInt(amountStr || '0', 10) || 0;
    setAmountStr(String(current + addedAmount));
  };

  const currentNumericAmount = parseInt(amountStr || '0', 10) || 0;
  const currentNumericAdminFee =
    type === 'transfer' ? parseInt(adminFeeStr || '0', 10) || 0 : 0;

  const handleAmountInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    const clean = raw.replace(/^0+(?=\d)/, '');
    setAmountStr(clean);
  };

  const handleAdminFeeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    const clean = raw.replace(/^0+(?=\d)/, '');
    setAdminFeeStr(clean);
  };

  const handleSelectSourceAccount = (nextSourceId: string) => {
    if (nextSourceId === toAccountId && accounts.length >= 2) {
      setToAccountId(accountId);
    }
    setAccountId(nextSourceId);
  };

  const handleSelectDestAccount = (nextDestId: string) => {
    if (nextDestId === accountId && accounts.length >= 2) {
      const fallbackSource = accounts.find((a) => a.id !== nextDestId);
      if (fallbackSource) {
        setAccountId(fallbackSource.id);
      }
    }
    setToAccountId(nextDestId);
  };

  const handleSwapTransferDirection = () => {
    const prevSource = accountId;
    const prevDest = toAccountId;
    setAccountId(prevDest);
    setToAccountId(prevSource);
  };

  const findMatchingPresetAccount = (preset: EWalletPreset): Account | undefined => {
    const targetLower = preset.name.toLowerCase();
    return accounts.find(
      (acc) => acc.id === preset.id || acc.name.trim().toLowerCase() === targetLower
    );
  };

  const handleSelectEWalletPreset = async (preset: EWalletPreset) => {
    setWalletError(null);
    const existing = findMatchingPresetAccount(preset);
    if (existing) {
      handleSelectDestAccount(existing.id);
      return;
    }

    if (!onQuickCreateAccount) return;

    setCreatingWalletId(preset.id);
    try {
      const newAcc: Account = {
        id: preset.id,
        name: preset.name,
        type: 'ewallet',
        initialBalance: 0,
        color: preset.color,
      };
      const created = await onQuickCreateAccount(newAcc);
      const targetId = created ? created.id : newAcc.id;
      handleSelectDestAccount(targetId);
    } catch {
      setWalletError(`Gagal menambahkan dompet ${preset.name}.`);
    } finally {
      setCreatingWalletId(null);
    }
  };

  const handleCreateCustomEWallet = async () => {
    const trimmed = customEwalletName.trim();
    if (!trimmed) {
      setWalletError('Masukkan nama dompet digital terlebih dahulu.');
      return;
    }

    const existing = accounts.find(
      (acc) => acc.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      handleSelectDestAccount(existing.id);
      setShowCustomEwallet(false);
      setCustomEwalletName('');
      setWalletError(null);
      return;
    }

    if (!onQuickCreateAccount) return;

    setWalletError(null);
    setCreatingWalletId('custom');
    try {
      const newAcc: Account = {
        id: `acc_${Date.now()}`,
        name: trimmed.slice(0, 60),
        type: 'ewallet',
        initialBalance: 0,
        color: '#0891b2',
      };
      const created = await onQuickCreateAccount(newAcc);
      const targetId = created ? created.id : newAcc.id;
      handleSelectDestAccount(targetId);
      setShowCustomEwallet(false);
      setCustomEwalletName('');
    } catch {
      setWalletError('Gagal menambahkan dompet digital baru.');
    } finally {
      setCreatingWalletId(null);
    }
  };

  const formattedAmountDisplay = amountStr ? formatRibuan(amountStr) : '';
  const formattedAdminFeeDisplay = adminFeeStr ? formatRibuan(adminFeeStr) : '';

  const isSameTransferAccount = type === 'transfer' && accountId === toAccountId;

  const sourceAccount = accounts.find((a) => a.id === accountId);
  const destAccount = accounts.find((a) => a.id === toAccountId);
  const sourceCurrentBalance = baseAccountBalances[accountId] ?? 0;
  const destCurrentBalance = baseAccountBalances[toAccountId] ?? 0;
  const totalDeductedFromSource = currentNumericAmount + currentNumericAdminFee;
  const projectedSourceBalance = sourceCurrentBalance - totalDeductedFromSource;
  const projectedDestBalance = destCurrentBalance + currentNumericAmount;
  const isInsufficientBalance =
    type === 'transfer' &&
    currentNumericAmount > 0 &&
    sourceCurrentBalance < totalDeductedFromSource;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentNumericAmount <= 0) {
      return;
    }
    if (type === 'transfer' && (!toAccountId || accountId === toAccountId)) {
      return;
    }

    const finalCategory =
      isCustomCategory && customCategoryInput.trim()
        ? customCategoryInput.trim()
        : category;

    onSave({
      id: editingTransaction ? editingTransaction.id : undefined,
      type,
      amount: currentNumericAmount,
      category: type === 'transfer' ? 'Transfer Saldo' : finalCategory,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      adminFee:
        type === 'transfer' && currentNumericAdminFee > 0
          ? currentNumericAdminFee
          : undefined,
      date,
      time,
      note,
    });
    onClose();
  };

  if (!isOpen) return null;

  const currentCategories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <div
      className={`sheet ${isOpen ? 'open' : ''}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="panel animate-in fade-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#e1e7e4] dark:border-[#22302d]">
          <h2 className="text-lg font-bold text-[#17211d] dark:text-[#edf3f1]">
            {editingTransaction
              ? 'Edit Transaksi'
              : type === 'transfer'
              ? 'Transfer Saldo'
              : 'Catat Transaksi'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[#6b7872] dark:text-[#95a5a0] transition cursor-pointer"
            aria-label="Tutup"
          >
            <X size={20} />
          </button>
        </div>

        {/* Type Selector (Pengeluaran / Pemasukan / Transfer) */}
        <div className="flex rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] p-1 mb-4 gap-1 border border-[#e1e7e4] dark:border-[#273733]">
          <button
            type="button"
            onClick={() => handleTypeChange('expense')}
            className={`flex-1 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              type === 'expense'
                ? 'bg-[#dc2626] text-white shadow-sm'
                : 'text-[#6b7872] dark:text-[#95a5a0] hover:text-[#17211d] dark:hover:text-[#edf3f1]'
            }`}
          >
            Pengeluaran
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('income')}
            className={`flex-1 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              type === 'income'
                ? 'bg-[#15803d] text-white shadow-sm'
                : 'text-[#6b7872] dark:text-[#95a5a0] hover:text-[#17211d] dark:hover:text-[#edf3f1]'
            }`}
          >
            Pemasukan
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('transfer')}
            className={`flex-1 py-2 text-xs md:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              type === 'transfer'
                ? 'bg-[#0f766e] text-white shadow-sm'
                : 'text-[#6b7872] dark:text-[#95a5a0] hover:text-[#17211d] dark:hover:text-[#edf3f1]'
            }`}
          >
            Transfer
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Amount Input with big display */}
          <div>
            <label className="block text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0] uppercase tracking-wider mb-1">
              {type === 'transfer' ? 'Nominal Transfer' : 'Nominal (Jumlah)'}
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                inputMode="numeric"
                required
                placeholder="0"
                value={formattedAmountDisplay}
                onChange={handleAmountInputChange}
                className="w-full pl-4 pr-10 py-3 text-2xl font-bold tracking-tight text-[#17211d] dark:text-[#edf3f1] bg-white dark:bg-[#1b2623] border-2 border-[#e1e7e4] dark:border-[#273733] rounded-xl focus:border-[#0f766e] dark:focus:border-[#14b8a6] focus:ring-4 focus:ring-[#0f766e]/15 outline-none tabular-nums transition-all"
                autoFocus={!editingTransaction}
              />
              {amountStr && (
                <button
                  type="button"
                  onClick={() => setAmountStr('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-[#6b7872] dark:text-[#95a5a0] hover:text-[#dc2626] dark:hover:text-rose-400 hover:bg-[#fee2e2] dark:hover:bg-rose-950/50 transition z-10 cursor-pointer"
                  aria-label="Kosongkan nominal"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            {currentNumericAmount > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-xs px-1">
                <span className="text-[#0f766e] dark:text-[#2dd4bf] font-bold tabular-nums">
                  {formatRupiah(currentNumericAmount)}
                </span>
                <span className="text-[#6b7872] dark:text-[#95a5a0] italic text-[11px]">
                  {terbilang(currentNumericAmount)} rupiah
                </span>
              </div>
            )}

            {/* Quick Amount Buttons */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[
                { label: '+10.000', val: 10000 },
                { label: '+20.000', val: 20000 },
                { label: '+50.000', val: 50000 },
                { label: '+100.000', val: 100000 },
                { label: '+500.000', val: 500000 },
              ].map((btn) => (
                <button
                  key={btn.label}
                  type="button"
                  onClick={() => handleQuickAdd(btn.val)}
                  className="px-2.5 py-1 text-xs font-semibold bg-[#f4f6f5] dark:bg-[#1b2623] hover:bg-[#e1e7e4] dark:hover:bg-[#22302d] text-[#17211d] dark:text-[#edf3f1] rounded-lg border border-[#e1e7e4] dark:border-[#273733] transition active:scale-95 cursor-pointer"
                >
                  {btn.label}
                </button>
              ))}
              {currentNumericAmount > 0 && (
                <button
                  type="button"
                  onClick={() => setAmountStr('')}
                  className="px-2.5 py-1 text-xs font-semibold text-[#dc2626] dark:text-rose-400 bg-[#fee2e2] dark:bg-rose-950/50 hover:bg-[#fecaca] dark:hover:bg-rose-900/50 rounded-lg transition active:scale-95 cursor-pointer"
                >
                  Hapus
                </button>
              )}
            </div>
          </div>

          {/* Transfer Account Selectors & E-Wallet Presets */}
          {type === 'transfer' ? (
            <div className="space-y-3">
              <div className="p-3 bg-[#f4f6f5] dark:bg-[#1b2623] rounded-xl border border-[#e1e7e4] dark:border-[#273733] space-y-2.5">
                {/* Source Account */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0] uppercase tracking-wider">
                      Dari Akun / Dompet Asal
                    </label>
                    {sourceAccount && (
                      <span className="text-[11px] font-semibold text-[#0f766e] dark:text-[#2dd4bf] tabular-nums">
                        Saldo: {formatRupiah(sourceCurrentBalance)}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-0.5">
                    {accounts.map((acc) => {
                      const isSelected = accountId === acc.id;
                      const bal = baseAccountBalances[acc.id] ?? 0;
                      return (
                        <button
                          key={`src-${acc.id}`}
                          type="button"
                          onClick={() => handleSelectSourceAccount(acc.id)}
                          className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                            isSelected
                              ? 'border-[#0f766e] dark:border-[#2dd4bf] bg-white dark:bg-[#131c1a] ring-1 ring-[#0f766e] dark:ring-[#2dd4bf] shadow-xs'
                              : 'border-[#e1e7e4] dark:border-[#273733] bg-white/80 dark:bg-[#131c1a]/75 hover:bg-white dark:hover:bg-[#131c1a]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: acc.color }}
                            />
                            <span
                              className={`text-xs font-semibold truncate ${
                                isSelected ? 'text-[#0f766e] dark:text-[#2dd4bf]' : 'text-[#17211d] dark:text-[#edf3f1]'
                              }`}
                            >
                              {acc.name}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-1 text-[10px]">
                            <span className="text-[#6b7872] dark:text-[#95a5a0]">
                              {ACCOUNT_TYPE_LABELS[acc.type]}
                            </span>
                            <span
                              className={`font-bold tabular-nums truncate ${
                                bal < 0 ? 'text-[#dc2626] dark:text-rose-400' : 'text-[#17211d] dark:text-[#edf3f1]'
                              }`}
                            >
                              {formatRupiah(bal)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Swap Direction Button */}
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={handleSwapTransferDirection}
                    aria-label="Tukar arah akun sumber dan tujuan"
                    className="px-3 min-h-[36px] rounded-full bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733] hover:border-[#0f766e] dark:hover:border-[#2dd4bf] hover:bg-[#ccfbf1]/30 dark:hover:bg-[#102825] text-[#0f766e] dark:text-[#2dd4bf] text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95"
                  >
                    <ArrowUpDown size={14} />
                    Tukar Arah
                  </button>
                </div>

                {/* Destination Account */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0] uppercase tracking-wider">
                      Ke Akun / Dompet Tujuan
                    </label>
                    {destAccount && (
                      <span className="text-[11px] font-semibold text-[#0284c7] dark:text-sky-400 tabular-nums">
                        Saldo: {formatRupiah(destCurrentBalance)}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-0.5">
                    {accounts.map((acc) => {
                      const isSelected = toAccountId === acc.id;
                      const isSameAsSource = accountId === acc.id;
                      const bal = baseAccountBalances[acc.id] ?? 0;
                      return (
                        <button
                          key={`dst-${acc.id}`}
                          type="button"
                          onClick={() => handleSelectDestAccount(acc.id)}
                          className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                            isSelected
                              ? 'border-[#0284c7] dark:border-sky-400 bg-white dark:bg-[#131c1a] ring-1 ring-[#0284c7] dark:ring-sky-400 shadow-xs'
                              : isSameAsSource
                              ? 'border-[#e1e7e4] dark:border-[#273733] bg-white/40 dark:bg-[#131c1a]/40 opacity-60 hover:opacity-100'
                              : 'border-[#e1e7e4] dark:border-[#273733] bg-white/80 dark:bg-[#131c1a]/75 hover:bg-white dark:hover:bg-[#131c1a]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: acc.color }}
                            />
                            <span
                              className={`text-xs font-semibold truncate ${
                                isSelected ? 'text-[#0284c7] dark:text-sky-400' : 'text-[#17211d] dark:text-[#edf3f1]'
                              }`}
                            >
                              {acc.name}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-1 text-[10px]">
                            <span className="text-[#6b7872] dark:text-[#95a5a0]">
                              {isSameAsSource ? 'Sumber' : ACCOUNT_TYPE_LABELS[acc.type]}
                            </span>
                            <span
                              className={`font-bold tabular-nums truncate ${
                                bal < 0 ? 'text-[#dc2626] dark:text-rose-400' : 'text-[#17211d] dark:text-[#edf3f1]'
                              }`}
                            >
                              {formatRupiah(bal)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Digital Wallet Presets & Quick Add */}
                <div className="pt-2 border-t border-[#e1e7e4]/80 dark:border-[#273733] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-[#17211d] dark:text-[#edf3f1] flex items-center gap-1">
                      <Wallet size={13} className="text-[#0f766e] dark:text-[#2dd4bf]" />
                      Dompet Digital Tujuan Cepat
                    </span>
                    <span className="text-[10px] text-[#6b7872] dark:text-[#95a5a0]">Klik untuk pilih / tambah</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {EWALLET_PRESETS.map((preset) => {
                      const matched = findMatchingPresetAccount(preset);
                      const isSelected = matched ? toAccountId === matched.id : false;
                      const isBusy = creatingWalletId === preset.id;

                      return (
                        <button
                          key={preset.id}
                          type="button"
                          disabled={Boolean(creatingWalletId)}
                          onClick={() => handleSelectEWalletPreset(preset)}
                          className={`px-2.5 min-h-[34px] rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60 ${
                            isSelected
                              ? 'border-[#0284c7] dark:border-sky-400 bg-[#e0f2fe] dark:bg-sky-950/50 text-[#0369a1] dark:text-sky-300'
                              : matched
                              ? 'border-[#e1e7e4] dark:border-[#273733] bg-white dark:bg-[#131c1a] text-[#17211d] dark:text-[#edf3f1] hover:bg-[#f4f6f5] dark:hover:bg-[#1d2a27]'
                              : 'border-dashed border-[#0f766e]/40 dark:border-[#2dd4bf]/40 bg-white dark:bg-[#131c1a] text-[#0f766e] dark:text-[#2dd4bf] hover:bg-[#ccfbf1]/35 dark:hover:bg-[#102825]'
                          }`}
                        >
                          {isBusy ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: preset.color }}
                            />
                          )}
                          <span>{matched ? preset.name : `+ ${preset.name}`}</span>
                        </button>
                      );
                    })}

                    {onQuickCreateAccount && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomEwallet(!showCustomEwallet);
                          setWalletError(null);
                        }}
                        className={`px-2.5 min-h-[34px] rounded-xl border text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer ${
                          showCustomEwallet
                            ? 'border-[#0f766e] dark:border-[#2dd4bf] bg-[#ccfbf1]/40 dark:bg-[#102825] text-[#0f766e] dark:text-[#2dd4bf]'
                            : 'border-[#e1e7e4] dark:border-[#273733] bg-white dark:bg-[#131c1a] text-[#6b7872] dark:text-[#95a5a0] hover:text-[#17211d] dark:hover:text-[#edf3f1]'
                        }`}
                      >
                        <Plus size={13} />
                        Dompet Lain
                      </button>
                    )}
                  </div>

                  {showCustomEwallet && (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Nama dompet (mis. Sakuku, i.saku)"
                        value={customEwalletName}
                        onChange={(e) => setCustomEwalletName(e.target.value)}
                        className="bg-white dark:bg-[#131c1a] text-[#17211d] dark:text-[#edf3f1] border-[#e1e7e4] dark:border-[#273733] text-xs !py-2"
                        maxLength={60}
                      />
                      <button
                        type="button"
                        disabled={creatingWalletId === 'custom'}
                        onClick={handleCreateCustomEWallet}
                        className="px-3 min-h-[40px] rounded-xl bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold shrink-0 transition cursor-pointer disabled:opacity-60 whitespace-nowrap"
                      >
                        {creatingWalletId === 'custom' ? 'Menambah...' : 'Tambah'}
                      </button>
                    </div>
                  )}

                  {walletError && (
                    <p className="text-[11px] text-[#dc2626] dark:text-rose-400 font-medium">{walletError}</p>
                  )}
                </div>
              </div>

              {/* Optional Admin Fee */}
              <div className="p-3 bg-white dark:bg-[#1b2623] rounded-xl border border-[#e1e7e4] dark:border-[#273733] space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0]">
                    Biaya Admin Transfer / Top-Up (Opsional)
                  </label>
                  {currentNumericAdminFee > 0 && (
                    <span className="text-xs font-bold text-[#dc2626] dark:text-rose-400 tabular-nums">
                      +{formatRupiah(currentNumericAdminFee)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 px-3 min-h-[42px] rounded-xl border border-[#e1e7e4] dark:border-[#273733] bg-[#f4f6f5] dark:bg-[#131c1a] focus-within:bg-white dark:focus-within:bg-[#0f1715] focus-within:border-[#0f766e] dark:focus-within:border-[#14b8a6] focus-within:ring-3 focus-within:ring-[#0f766e]/15 transition">
                  <span className="text-xs font-bold text-[#6b7872] dark:text-[#95a5a0] shrink-0">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0 (Gratis)"
                    value={formattedAdminFeeDisplay}
                    onChange={handleAdminFeeInputChange}
                    aria-label="Biaya admin transfer"
                    className="flex-1 !w-auto !p-0 !border-0 !bg-transparent !shadow-none focus:!ring-0 text-sm font-semibold text-[#17211d] dark:text-[#edf3f1] tabular-nums"
                  />
                  {adminFeeStr && (
                    <button
                      type="button"
                      onClick={() => setAdminFeeStr('')}
                      aria-label="Hapus biaya admin"
                      className="p-1 rounded-md text-[#6b7872] dark:text-[#95a5a0] hover:text-[#dc2626] dark:hover:text-rose-400 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {ADMIN_FEE_PRESETS.map((feeOpt) => {
                    const isActive = currentNumericAdminFee === feeOpt.value;
                    return (
                      <button
                        key={feeOpt.label}
                        type="button"
                        onClick={() => setAdminFeeStr(feeOpt.value > 0 ? String(feeOpt.value) : '')}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                          isActive
                            ? 'border-[#0f766e] dark:border-[#2dd4bf] bg-[#ccfbf1]/50 dark:bg-[#102825] text-[#0f766e] dark:text-[#2dd4bf]'
                            : 'border-[#e1e7e4] dark:border-[#273733] bg-[#f4f6f5] dark:bg-[#131c1a] text-[#6b7872] dark:text-[#95a5a0] hover:text-[#17211d] dark:hover:text-[#edf3f1]'
                        }`}
                      >
                        {feeOpt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Validation & Live Direction + Balance Preview */}
              {isSameTransferAccount ? (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-xs text-[#dc2626] dark:text-rose-300 font-medium flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0" />
                  Akun sumber dan tujuan tidak boleh sama. Pilih akun lain.
                </div>
              ) : (
                sourceAccount &&
                destAccount && (
                  <div className="p-3 rounded-xl bg-[#f0fdfa] dark:bg-[#102825] border border-[#99f6e4] dark:border-[#1e4e47] space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2 font-semibold text-[#0f766e] dark:text-[#2dd4bf]">
                      <span className="flex items-center gap-1.5 min-w-0 truncate">
                        <span className="truncate">{sourceAccount.name}</span>
                        <ArrowRight size={13} className="shrink-0" />
                        <span className="truncate">{destAccount.name}</span>
                      </span>
                      {currentNumericAmount > 0 && (
                        <span className="tabular-nums shrink-0">
                          {formatRupiah(currentNumericAmount)}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-[#99f6e4]/60 dark:border-[#1e4e47]">
                      <div className="min-w-0">
                        <div className="text-[10px] text-[#6b7872] dark:text-[#95a5a0] truncate">
                          Saldo {sourceAccount.name}
                        </div>
                        <div className="font-bold tabular-nums text-[#17211d] dark:text-[#edf3f1] mt-0.5 truncate">
                          {formatRupiah(sourceCurrentBalance)}
                          {currentNumericAmount > 0 && (
                            <span
                              className={`block text-[11px] ${
                                projectedSourceBalance < 0 ? 'text-[#dc2626] dark:text-rose-400' : 'text-[#0f766e] dark:text-[#2dd4bf]'
                              }`}
                            >
                              → {formatRupiah(projectedSourceBalance)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="min-w-0 text-right">
                        <div className="text-[10px] text-[#6b7872] dark:text-[#95a5a0] truncate">
                          Saldo {destAccount.name}
                        </div>
                        <div className="font-bold tabular-nums text-[#17211d] dark:text-[#edf3f1] mt-0.5 truncate">
                          {formatRupiah(destCurrentBalance)}
                          {currentNumericAmount > 0 && (
                            <span className="block text-[11px] text-[#0284c7] dark:text-sky-400">
                              → {formatRupiah(projectedDestBalance)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {currentNumericAdminFee > 0 && currentNumericAmount > 0 && (
                      <div className="pt-1.5 border-t border-[#99f6e4]/60 dark:border-[#1e4e47] flex items-center justify-between text-[11px] text-[#17211d] dark:text-[#edf3f1]">
                        <span>Total terpotong (Nominal + Admin)</span>
                        <strong className="tabular-nums text-[#dc2626] dark:text-rose-400">
                          -{formatRupiah(totalDeductedFromSource)}
                        </strong>
                      </div>
                    )}

                    {isInsufficientBalance && (
                      <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300 text-[11px] flex items-start gap-1.5">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <span>
                          Saldo <strong>{sourceAccount.name}</strong> lebih kecil dari total
                          transfer. Saldo akun akan tercatat minus setelah disimpan.
                        </span>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          ) : (
            <>
              {/* Category Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0] uppercase tracking-wider">
                    Kategori
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomCategory(!isCustomCategory)}
                    className="text-xs text-[#0f766e] dark:text-[#2dd4bf] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {isCustomCategory ? 'Pilih dari daftar' : '+ Kategori kustom'}
                  </button>
                </div>

                {isCustomCategory ? (
                  <input
                    type="text"
                    placeholder="Nama kategori kustom (contoh: Servis AC)"
                    value={customCategoryInput}
                    onChange={(e) => setCustomCategoryInput(e.target.value)}
                    className="bg-white dark:bg-[#1b2623] text-[#17211d] dark:text-[#edf3f1]"
                    required
                  />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                    {currentCategories.map((cat: Category) => {
                      const isSelected = category === cat.name;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategory(cat.name)}
                          className={`flex items-center gap-2 p-2 rounded-xl border text-left transition cursor-pointer ${
                            isSelected
                              ? 'border-[#0f766e] dark:border-[#2dd4bf] bg-[#ccfbf1]/50 dark:bg-[#102825] text-[#0f766e] dark:text-[#2dd4bf] font-semibold ring-1 ring-[#0f766e] dark:ring-[#2dd4bf]'
                              : 'border-[#e1e7e4] dark:border-[#273733] bg-white dark:bg-[#1b2623] text-[#17211d] dark:text-[#edf3f1] hover:bg-[#f4f6f5] dark:hover:bg-[#22302d]'
                          }`}
                        >
                          <CategoryIcon
                            name={cat.icon}
                            categoryName={cat.name}
                            type={type}
                            color={cat.color}
                            size={14}
                          />
                          <span className="text-xs truncate">{cat.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Account Selection */}
              <div>
                <label className="block text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0] uppercase tracking-wider mb-1">
                  Simpan ke Dompet / Akun
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {accounts.map((acc) => {
                    const isSelected = accountId === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setAccountId(acc.id)}
                        className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                          isSelected
                            ? 'border-[#0f766e] dark:border-[#2dd4bf] bg-[#ccfbf1]/40 dark:bg-[#102825] text-[#0f766e] dark:text-[#2dd4bf] font-semibold'
                            : 'border-[#e1e7e4] dark:border-[#273733] bg-white dark:bg-[#1b2623] text-[#6b7872] dark:text-[#95a5a0] hover:bg-[#f4f6f5] dark:hover:bg-[#22302d]'
                        }`}
                      >
                        <div className="text-xs font-semibold truncate">{acc.name}</div>
                        <div className="text-[10px] text-[#6b7872] dark:text-[#95a5a0] capitalize mt-0.5">
                          {ACCOUNT_TYPE_LABELS[acc.type]}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* Date & Time */}
          <div className="row">
            <div>
              <label className="block text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0] mb-1">Tanggal</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-white dark:bg-[#1b2623] text-[#17211d] dark:text-[#edf3f1]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0] mb-1">Jam</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="bg-white dark:bg-[#1b2623] text-[#17211d] dark:text-[#edf3f1]"
              />
            </div>
          </div>

          {/* Note / Description */}
          <div>
            <label className="block text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0] mb-1">
              Catatan / Keterangan (Opsional)
            </label>
            <input
              type="text"
              placeholder={
                type === 'transfer'
                  ? 'Contoh: Top up saldo GoPay untuk transport'
                  : 'Contoh: Makan siang bersama rekan kerja'
              }
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-white dark:bg-[#1b2623] text-[#17211d] dark:text-[#edf3f1]"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={currentNumericAmount <= 0 || isSameTransferAccount}
              className="btn disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={18} />
              {editingTransaction
                ? 'Perbarui Transaksi'
                : type === 'transfer'
                ? 'Simpan Transfer Saldo'
                : 'Simpan Transaksi'}
            </button>

            {editingTransaction && onDelete && (
              confirmDelete ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="btn btn-secondary flex-1"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(editingTransaction.id);
                      onClose();
                    }}
                    className="btn btn-danger flex-1"
                  >
                    <Trash2 size={16} />
                    Ya, Hapus
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="btn btn-danger"
                >
                  <Trash2 size={16} />
                  Hapus Transaksi Ini
                </button>
              )
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
