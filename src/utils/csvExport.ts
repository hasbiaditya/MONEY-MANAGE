import { Account, Transaction } from '../types/finance';
import { formatRupiah, getTodayDateString } from './formatters';

function escapeCsvCell(value: string | number): string {
  const str = String(value ?? '');
  // Neutralize spreadsheet formula injection on leading =, +, -, @
  const safeStr = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safeStr.replace(/"/g, '""')}"`;
}

function getTransactionTypeLabel(type: Transaction['type']): string {
  if (type === 'income') return 'Pemasukan';
  if (type === 'transfer') return 'Transfer';
  return 'Pengeluaran';
}

export interface CsvExportResult {
  ok: boolean;
  count: number;
  fileName?: string;
  message: string;
}

export function exportTransactionsToCsv(
  transactions: Transaction[],
  accounts: Account[]
): CsvExportResult {
  if (!transactions || transactions.length === 0) {
    return {
      ok: false,
      count: 0,
      message: 'Belum ada data transaksi untuk diekspor ke CSV.',
    };
  }

  const accountNameMap = new Map<string, string>();
  accounts.forEach((acc) => {
    accountNameMap.set(acc.id, acc.name);
  });

  const sorted = [...transactions].sort((a, b) => {
    const keyA = `${a.date}T${a.time || '00:00'}`;
    const keyB = `${b.date}T${b.time || '00:00'}`;
    return keyB.localeCompare(keyA);
  });

  const headers = [
    'ID',
    'Tanggal',
    'Jam',
    'Tipe',
    'Kategori',
    'Nominal (IDR)',
    'Nominal Terformat',
    'Biaya Admin (IDR)',
    'Akun / Dompet',
    'Tujuan Transfer',
    'Catatan',
  ];

  const rows = sorted.map((tx) => {
    const sourceAccount = accountNameMap.get(tx.accountId) || tx.accountId;
    const destAccount =
      tx.type === 'transfer' && tx.toAccountId
        ? accountNameMap.get(tx.toAccountId) || tx.toAccountId
        : '';
    const adminFee = tx.type === 'transfer' && tx.adminFee ? tx.adminFee : 0;

    return [
      escapeCsvCell(tx.id),
      escapeCsvCell(tx.date),
      escapeCsvCell(tx.time || ''),
      escapeCsvCell(getTransactionTypeLabel(tx.type)),
      escapeCsvCell(tx.category),
      String(tx.amount),
      escapeCsvCell(formatRupiah(tx.amount)),
      String(adminFee),
      escapeCsvCell(sourceAccount),
      escapeCsvCell(destAccount),
      escapeCsvCell(tx.note || ''),
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const fileName = `catatan_keuangan_backup_${getTodayDateString()}.csv`;

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);

  return {
    ok: true,
    count: sorted.length,
    fileName,
    message: `Seluruh ${sorted.length} transaksi berhasil diekspor ke ${fileName}.`,
  };
}
