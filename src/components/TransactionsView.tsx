import React, { useState, useMemo } from 'react';
import {
  Search,
  X,
  Plus,
  Download,
  CheckCircle2,
  AlertCircle,
  List,
  CalendarDays,
  ArrowRightLeft,
} from 'lucide-react';
import { Transaction, Account, TransactionType } from '../types/finance';
import { formatRupiah, formatDateRelative, getTodayDateString } from '../utils/formatters';
import { getTransactionExpenseImpact } from '../utils/accountBalances';
import { exportTransactionsToCsv } from '../utils/csvExport';
import { CategoryIcon } from './CategoryIcon';
import { TransactionCalendar } from './TransactionCalendar';

interface TransactionsViewProps {
  transactions: Transaction[];
  accounts: Account[];
  onSelectTransaction: (tx: Transaction) => void;
  onOpenAddModal: (initialDate?: string) => void;
  onOpenTransferModal?: (initialDate?: string) => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  transactions,
  accounts,
  onSelectTransaction,
  onOpenAddModal,
  onOpenTransferModal,
}) => {
  const todayDate = getTodayDateString();
  const todayMonth = todayDate.substring(0, 7);

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarMonth, setCalendarMonth] = useState<string>(todayMonth);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(todayDate);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | TransactionType>('all');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest'>('newest');
  const [exportFeedback, setExportFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleExportAllCsv = () => {
    const result = exportTransactionsToCsv(transactions, accounts);
    setExportFeedback({
      type: result.ok ? 'success' : 'error',
      text: result.message,
    });
  };

  // Extract available months from transactions
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.date) {
        set.add(tx.date.substring(0, 7)); // YYYY-MM
      }
    });
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const accountNameMap = useMemo(() => {
    const map = new Map<string, string>();
    accounts.forEach((acc) => {
      map.set(acc.id, acc.name.toLowerCase());
    });
    return map;
  }, [accounts]);

  // Base transactions filtered by search, type, and account (used for Calendar mode)
  const baseFilteredTransactions = useMemo(() => {
    const tokens = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);

    return transactions.filter((tx) => {
      if (tokens.length > 0) {
        const categoryText = tx.category.toLowerCase();
        const noteText = (tx.note || '').toLowerCase();
        const accText = accountNameMap.get(tx.accountId) || '';
        const toAccText = tx.toAccountId ? accountNameMap.get(tx.toAccountId) || '' : '';
        const amountText = String(tx.amount);
        const combined = `${categoryText} ${noteText} ${accText} ${toAccText} ${amountText}`;

        const allMatch = tokens.every((token) => combined.includes(token));
        if (!allMatch) return false;
      }

      if (selectedType !== 'all' && tx.type !== selectedType) {
        return false;
      }

      if (selectedAccount !== 'all') {
        if (tx.accountId !== selectedAccount && tx.toAccountId !== selectedAccount) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, searchQuery, selectedType, selectedAccount, accountNameMap]);

  // Filtered & sorted transactions for List mode
  const filteredTransactions = useMemo(() => {
    return baseFilteredTransactions
      .filter((tx) => {
        if (selectedMonth !== 'all' && !tx.date.startsWith(selectedMonth)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'highest') {
          return b.amount - a.amount;
        }
        const timeA = `${a.date}T${a.time || '00:00'}`;
        const timeB = `${b.date}T${b.time || '00:00'}`;
        if (sortBy === 'oldest') {
          return timeA.localeCompare(timeB);
        }
        return timeB.localeCompare(timeA);
      });
  }, [baseFilteredTransactions, selectedMonth, sortBy]);

  const handleSwitchViewMode = (mode: 'list' | 'calendar') => {
    setViewMode(mode);
    if (mode === 'calendar') {
      const targetMonth = selectedMonth !== 'all' ? selectedMonth : calendarMonth;
      setCalendarMonth(targetMonth);
      if (!selectedCalendarDate.startsWith(targetMonth)) {
        if (targetMonth === todayMonth) {
          setSelectedCalendarDate(todayDate);
        } else {
          setSelectedCalendarDate(`${targetMonth}-01`);
        }
      }
    }
  };

  const handleChangeCalendarMonth = (nextMonth: string) => {
    setCalendarMonth(nextMonth);
    if (nextMonth === todayMonth) {
      setSelectedCalendarDate(todayDate);
      return;
    }
    const firstTxInMonth = baseFilteredTransactions
      .filter((tx) => tx.date.startsWith(nextMonth))
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    setSelectedCalendarDate(firstTxInMonth ? firstTxInMonth.date : `${nextMonth}-01`);
  };

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: { date: string; displayDate: string; items: Transaction[] }[] = [];
    const map = new Map<string, Transaction[]>();

    filteredTransactions.forEach((tx) => {
      const list = map.get(tx.date) || [];
      list.push(tx);
      map.set(tx.date, list);
    });

    map.forEach((items, date) => {
      groups.push({
        date,
        displayDate: formatDateRelative(date),
        items,
      });
    });

    return groups;
  }, [filteredTransactions]);

  // Totals for filtered transactions
  const totalFilteredExpense = filteredTransactions.reduce(
    (sum, tx) => sum + getTransactionExpenseImpact(tx),
    0
  );

  const totalFilteredIncome = filteredTransactions
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const trimmedQuery = searchQuery.trim();

  const renderHighlighted = (text: string) => {
    if (!trimmedQuery) return text;
    const escaped = trimmedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'ig');
    const parts = text.split(regex);
    if (parts.length <= 1) return text;
    return parts.map((part, idx) =>
      idx % 2 === 1 ? (
        <mark key={idx} className="bg-[#ccfbf1] dark:bg-[#134e4a] text-[#0f766e] dark:text-[#5eead4] rounded-xs px-0.5">
          {part}
        </mark>
      ) : (
        <React.Fragment key={idx}>{part}</React.Fragment>
      )
    );
  };

  return (
    <div className="space-y-3">
      {/* Page Title & Quick Actions */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-[#17211d] dark:text-[#edf3f1] m-0">Riwayat Transaksi</h1>
          <button
            type="button"
            onClick={handleExportAllCsv}
            disabled={transactions.length === 0}
            title="Ekspor seluruh transaksi ke file CSV"
            className="px-2.5 py-1.5 min-h-[38px] bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#22302d] text-[#0f766e] dark:text-[#2dd4bf] text-xs font-semibold rounded-xl hover:bg-[#ccfbf1]/40 dark:hover:bg-[#1b2623] transition flex items-center gap-1 shadow-xs cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Download size={14} />
            Ekspor CSV
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            data-tour="transfer-button"
            onClick={() =>
              onOpenTransferModal
                ? onOpenTransferModal(viewMode === 'calendar' ? selectedCalendarDate : undefined)
                : onOpenAddModal(viewMode === 'calendar' ? selectedCalendarDate : undefined)
            }
            className="px-3 py-2 min-h-[44px] bg-white dark:bg-[#131c1a] border border-[#0f766e]/30 dark:border-[#2dd4bf]/35 text-[#0f766e] dark:text-[#2dd4bf] text-xs font-semibold rounded-xl hover:bg-[#ccfbf1]/40 dark:hover:bg-[#1b2623] transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
          >
            <ArrowRightLeft size={15} />
            Transfer Saldo
          </button>
          <button
            type="button"
            data-tour="add-tx-button"
            onClick={() => onOpenAddModal(viewMode === 'calendar' ? selectedCalendarDate : undefined)}
            className="px-3 py-2 min-h-[44px] bg-[#0f766e] text-white text-xs font-semibold rounded-xl hover:bg-[#115e59] transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Plus size={16} />
            Catat Baru
          </button>
        </div>
      </div>

      {/* View Mode Segmented Switcher */}
      <div
        role="tablist"
        aria-label="Tampilan transaksi"
        className="grid grid-cols-2 gap-1 p-1 bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#22302d] rounded-xl"
      >
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'list'}
          onClick={() => handleSwitchViewMode('list')}
          className={`min-h-[40px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
            viewMode === 'list'
              ? 'bg-[#0f766e] text-white shadow-xs'
              : 'text-[#6b7872] dark:text-[#95a5a0] hover:text-[#17211d] dark:hover:text-[#edf3f1] hover:bg-[#f4f6f5] dark:hover:bg-[#1b2623]'
          }`}
        >
          <List size={15} />
          Daftar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={viewMode === 'calendar'}
          onClick={() => handleSwitchViewMode('calendar')}
          className={`min-h-[40px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
            viewMode === 'calendar'
              ? 'bg-[#0f766e] text-white shadow-xs'
              : 'text-[#6b7872] dark:text-[#95a5a0] hover:text-[#17211d] dark:hover:text-[#edf3f1] hover:bg-[#f4f6f5] dark:hover:bg-[#1b2623]'
          }`}
        >
          <CalendarDays size={15} />
          Kalender
        </button>
      </div>

      {exportFeedback && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
            exportFeedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {exportFeedback.type === 'success' ? (
              <CheckCircle2 size={15} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle size={15} className="shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span className="leading-snug">{exportFeedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportFeedback(null)}
            aria-label="Tutup pesan"
            className="p-1 text-current/70 hover:text-current cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="space-y-1">
        <div className="flex items-center gap-2.5 bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#22302d] rounded-xl px-3.5 min-h-[44px] focus-within:border-[#0f766e] dark:focus-within:border-[#14b8a6] focus-within:ring-3 focus-within:ring-[#0f766e]/15 transition">
          <Search className="text-[#6b7872] dark:text-[#95a5a0] shrink-0" size={16} aria-hidden="true" />
          <input
            type="search"
            inputMode="search"
            aria-label="Cari transaksi berdasarkan nama atau deskripsi"
            placeholder="Cari nama kategori, deskripsi catatan, atau dompet..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 !w-auto !p-0 !border-0 !bg-transparent !shadow-none focus:!ring-0 text-sm text-[#17211d] dark:text-[#edf3f1] placeholder:text-[#6b7872] dark:placeholder:text-[#95a5a0]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Hapus kata kunci pencarian"
              className="p-1.5 -mr-1 rounded-lg text-[#6b7872] dark:text-[#95a5a0] hover:text-[#17211d] dark:hover:text-[#edf3f1] hover:bg-[#f4f6f5] dark:hover:bg-[#1b2623] transition cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>
        {trimmedQuery && (
          <div className="text-[11px] text-[#6b7872] dark:text-[#95a5a0] px-1 flex items-center justify-between gap-2">
            <span className="truncate">
              Pencarian: <strong className="text-[#17211d] dark:text-[#edf3f1]">"{trimmedQuery}"</strong>
            </span>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-[#0f766e] dark:text-[#2dd4bf] font-semibold hover:underline shrink-0 cursor-pointer"
            >
              Bersihkan
            </button>
          </div>
        )}
      </div>

      {/* Type Filter Chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        {[
          { id: 'all', label: 'Semua' },
          { id: 'expense', label: 'Pengeluaran' },
          { id: 'income', label: 'Pemasukan' },
          { id: 'transfer', label: 'Transfer' },
        ].map((tab) => {
          const isActive = selectedType === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedType(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition cursor-pointer ${
                isActive
                  ? 'bg-[#0f766e] text-white shadow-xs'
                  : 'bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#22302d] text-[#6b7872] dark:text-[#95a5a0] hover:bg-[#f4f6f5] dark:hover:bg-[#1b2623]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {viewMode === 'calendar' ? (
        <TransactionCalendar
          transactions={baseFilteredTransactions}
          accounts={accounts}
          currentMonth={calendarMonth}
          selectedDate={selectedCalendarDate}
          onChangeMonth={handleChangeCalendarMonth}
          onSelectDate={setSelectedCalendarDate}
          onSelectTransaction={onSelectTransaction}
          onAddTransactionOnDate={(date) => onOpenAddModal(date)}
        />
      ) : (
        <>
          {/* Secondary Filters (Month & Sort) */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white dark:bg-[#131c1a] py-1.5 px-2.5 text-xs border-[#e1e7e4] dark:border-[#22302d] text-[#17211d] dark:text-[#edf3f1]"
            >
              <option value="all">Semua Waktu</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  Periode: {m}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white dark:bg-[#131c1a] py-1.5 px-2.5 text-xs border-[#e1e7e4] dark:border-[#22302d] text-[#17211d] dark:text-[#edf3f1]"
            >
              <option value="newest">Urutkan: Terbaru</option>
              <option value="oldest">Urutkan: Terlama</option>
              <option value="highest">Urutkan: Nominal Terbesar</option>
            </select>
          </div>

          {/* Summary Box */}
          <div className="card !p-3 flex justify-between items-center text-xs">
            <div>
              <span className="text-[#6b7872] dark:text-[#95a5a0]">Ditemukan: </span>
              <strong className="text-[#17211d] dark:text-[#edf3f1] tabular-nums">
                {filteredTransactions.length} transaksi
              </strong>
            </div>
            <div className="flex gap-3">
              {totalFilteredIncome > 0 && (
                <span className="text-[#15803d] dark:text-[#4ade80] font-semibold tabular-nums">
                  +{formatRupiah(totalFilteredIncome)}
                </span>
              )}
              {totalFilteredExpense > 0 && (
                <span className="text-[#dc2626] dark:text-[#f87171] font-semibold tabular-nums">
                  -{formatRupiah(totalFilteredExpense)}
                </span>
              )}
            </div>
          </div>

          {/* Transaction List Grouped by Date */}
          {filteredTransactions.length === 0 ? (
            <div className="card text-center py-10 px-4 text-[#6b7872] dark:text-[#95a5a0] space-y-2.5">
              <p className="text-sm font-medium text-[#17211d] dark:text-[#edf3f1]">
                Tidak ada transaksi yang cocok.
              </p>
              <p className="text-xs">
                Coba ubah kata kunci pencarian nama/deskripsi atau atur ulang filter.
              </p>
              {(trimmedQuery || selectedType !== 'all' || selectedMonth !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedType('all');
                    setSelectedMonth('all');
                  }}
                  className="px-3.5 py-2 min-h-[40px] rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] hover:bg-[#e1e7e4] dark:hover:bg-[#273733] text-[#0f766e] dark:text-[#2dd4bf] text-xs font-semibold transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <X size={14} />
                  Reset Pencarian & Filter
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {groupedTransactions.map((group) => (
                <div key={group.date} className="space-y-1">
                  <div className="text-xs font-bold text-[#6b7872] dark:text-[#95a5a0] px-1 flex items-center justify-between">
                    <span>{group.displayDate}</span>
                    <span className="text-[10px] font-normal tabular-nums">{group.date}</span>
                  </div>

                  <div className="card !p-0 overflow-hidden divide-y divide-[#e1e7e4] dark:divide-[#22302d]">
                    {group.items.map((tx) => {
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
                                {renderHighlighted(tx.category)}
                              </div>
                              <div className="text-xs text-[#6b7872] dark:text-[#95a5a0] flex items-center gap-1.5 truncate mt-0.5">
                                <span className="capitalize">
                                  {tx.type === 'transfer'
                                    ? `${account?.name || 'Akun'} → ${toAccount?.name || 'Tujuan'}`
                                    : account?.name || 'Akun'}
                                </span>
                                {tx.note && (
                                  <>
                                    <span>•</span>
                                    <span className="italic truncate">
                                      {renderHighlighted(tx.note)}
                                    </span>
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
                            <div className="text-[10px] text-[#6b7872] dark:text-[#95a5a0] tabular-nums mt-0.5">
                              {tx.type === 'transfer' && tx.adminFee && tx.adminFee > 0
                                ? `Adm ${formatRupiah(tx.adminFee)} · ${tx.time}`
                                : tx.time}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
