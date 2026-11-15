/**
 * Utility functions for Indonesian Rupiah and dates formatting using Intl.NumberFormat
 */

export const idrNumberFormat = new Intl.NumberFormat('id-ID', {
  style: 'decimal',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

export function formatRupiah(amount: number, withPrefix = true): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return withPrefix ? 'Rp 0' : '0';
  }
  const isNegative = amount < 0;
  const absAmount = Math.abs(Math.round(amount));
  const formatted = idrNumberFormat.format(absAmount);

  if (!withPrefix) {
    return isNegative ? `-${formatted}` : formatted;
  }
  return isNegative ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

export function formatRibuan(value: number | string): string {
  if (typeof value === 'string') {
    const digits = value.replace(/[^0-9]/g, '');
    if (!digits) return '';
    return idrNumberFormat.format(parseInt(digits, 10));
  }
  return idrNumberFormat.format(Math.round(value || 0));
}

export function parseNumberFromRupiah(input: string): number {
  const clean = input.replace(/[^0-9]/g, '');
  return clean ? parseInt(clean, 10) : 0;
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentTimeString(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function formatDateRelative(dateStr: string): string {
  const today = getTodayDateString();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().split('T')[0];

  if (dateStr === today) {
    return 'Hari Ini';
  }
  if (dateStr === yesterday) {
    return 'Kemarin';
  }

  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    }).format(date);
  } catch {
    return dateStr;
  }
}

export function formatDateFull(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return dateStr;
  }
}

export function formatMonthYear(yearMonthStr: string): string {
  try {
    const [year, month] = yearMonthStr.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return new Intl.DateTimeFormat('id-ID', {
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return yearMonthStr;
  }
}

export function terbilang(n: number): string {
  if (n <= 0) return '';
  const angka = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  if (n < 12) return angka[n];
  if (n < 20) return `${terbilang(n - 10)} Belas`;
  if (n < 100) return `${terbilang(Math.floor(n / 10))} Puluh ${terbilang(n % 10)}`.trim();
  if (n < 200) return `Seratus ${terbilang(n - 100)}`.trim();
  if (n < 1000) return `${terbilang(Math.floor(n / 100))} Ratus ${terbilang(n % 100)}`.trim();
  if (n < 2000) return `Seribu ${terbilang(n - 1000)}`.trim();
  if (n < 1000000) return `${terbilang(Math.floor(n / 1000))} Ribu ${terbilang(n % 1000)}`.trim();
  if (n < 1000000000) return `${terbilang(Math.floor(n / 1000000))} Juta ${terbilang(n % 1000000)}`.trim();
  if (n < 1000000000000) return `${terbilang(Math.floor(n / 1000000000))} Miliar ${terbilang(n % 1000000000)}`.trim();
  return `${terbilang(Math.floor(n / 1000000000000))} Triliun ${terbilang(n % 1000000000000)}`.trim();
}

