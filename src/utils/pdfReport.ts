import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Account, BudgetConfig, Transaction, UserProfile } from '../types/finance';
import { formatMonthYear, formatRupiah } from './formatters';

export interface MonthlyPdfParams {
  selectedMonth: string; // YYYY-MM
  transactions: Transaction[];
  accounts: Account[];
  budget: BudgetConfig;
  userProfile?: UserProfile | null;
}

export interface PdfActionResult {
  ok: boolean;
  fileName: string;
  message: string;
}

type DocWithAutoTable = jsPDF & {
  lastAutoTable?: { finalY: number };
};

function getTypeLabel(type: Transaction['type']): string {
  if (type === 'income') return 'Pemasukan';
  if (type === 'transfer') return 'Transfer';
  return 'Pengeluaran';
}

function buildMonthlyPdfDocument({
  selectedMonth,
  transactions,
  accounts,
  budget,
  userProfile,
}: MonthlyPdfParams): { doc: jsPDF; fileName: string } {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as DocWithAutoTable;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  const monthLabel = formatMonthYear(selectedMonth);
  const fileName = `laporan_keuangan_${selectedMonth}.pdf`;

  const accountMap = new Map<string, string>();
  accounts.forEach((acc) => accountMap.set(acc.id, acc.name));

  const monthTransactions = transactions
    .filter((tx) => tx.date.startsWith(selectedMonth))
    .sort((a, b) => {
      const keyA = `${a.date}T${a.time || '00:00'}`;
      const keyB = `${b.date}T${b.time || '00:00'}`;
      return keyB.localeCompare(keyA);
    });

  const totalIncome = monthTransactions
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalExpense = monthTransactions.reduce((sum, tx) => {
    if (tx.type === 'expense') return sum + tx.amount;
    if (tx.type === 'transfer' && tx.adminFee) return sum + tx.adminFee;
    return sum;
  }, 0);

  const netSavings = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.round((netSavings / totalIncome) * 100) : 0;
  const budgetLimit = Math.max(0, budget.monthlyLimit || 0);
  const budgetUsedPct = budgetLimit > 0 ? Math.round((totalExpense / budgetLimit) * 100) : 0;

  // Header Banner
  doc.setFillColor(15, 118, 110); // #0f766e
  doc.rect(0, 0, pageWidth, 34, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('LAPORAN KEUANGAN BULANAN', margin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Periode: ${monthLabel}  •  ${monthTransactions.length} Transaksi`, margin, 22);

  if (userProfile?.displayName || userProfile?.email) {
    const ownerText = [userProfile.displayName, userProfile.email].filter(Boolean).join(' • ');
    doc.setFontSize(8.5);
    doc.setTextColor(204, 251, 241);
    doc.text(ownerText, margin, 28.5);
  }

  const printedDate = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  doc.setFontSize(8.5);
  doc.setTextColor(204, 251, 241);
  doc.text(`Dicetak: ${printedDate}`, pageWidth - margin, 22, { align: 'right' });

  // KPI Summary Cards (2x2 grid)
  let cursorY = 42;
  const cardGap = 4;
  const cardW = (contentWidth - cardGap) / 2;
  const cardH = 18;

  const kpiCards = [
    {
      label: 'Total Pemasukan',
      value: formatRupiah(totalIncome),
      bg: [240, 253, 244] as [number, number, number],
      border: [187, 247, 208] as [number, number, number],
      text: [21, 128, 61] as [number, number, number],
    },
    {
      label: 'Total Pengeluaran',
      value: formatRupiah(totalExpense),
      bg: [254, 242, 242] as [number, number, number],
      border: [254, 202, 202] as [number, number, number],
      text: [220, 38, 38] as [number, number, number],
    },
    {
      label: 'Sisa Arus Kas / Tabungan',
      value: `${netSavings >= 0 ? '+' : ''}${formatRupiah(netSavings)} (${savingsRate}%)`,
      bg: [248, 250, 252] as [number, number, number],
      border: [226, 232, 240] as [number, number, number],
      text: netSavings >= 0 ? ([15, 118, 110] as [number, number, number]) : ([220, 38, 38] as [number, number, number]),
    },
    {
      label: 'Realisasi Anggaran Bulanan',
      value: budgetLimit > 0 ? `${budgetUsedPct}% dari ${formatRupiah(budgetLimit)}` : 'Belum diatur',
      bg: [248, 250, 252] as [number, number, number],
      border: [226, 232, 240] as [number, number, number],
      text:
        budgetUsedPct > 100
          ? ([220, 38, 38] as [number, number, number])
          : budgetUsedPct >= 80
          ? ([217, 119, 6] as [number, number, number])
          : ([23, 33, 29] as [number, number, number]),
    },
  ];

  kpiCards.forEach((card, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = margin + col * (cardW + cardGap);
    const y = cursorY + row * (cardH + cardGap);

    doc.setFillColor(...card.bg);
    doc.setDrawColor(...card.border);
    doc.roundedRect(x, y, cardW, cardH, 2.5, 2.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 120, 114);
    doc.text(card.label, x + 4, y + 6.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...card.text);
    doc.text(card.value, x + 4, y + 13.5);
  });

  cursorY += cardH * 2 + cardGap + 8;

  // Category Breakdown: Expenses (including transfer admin fees)
  const expenseMap = new Map<string, { amount: number; count: number }>();
  monthTransactions.forEach((tx) => {
    if (tx.type === 'expense') {
      const prev = expenseMap.get(tx.category) || { amount: 0, count: 0 };
      expenseMap.set(tx.category, { amount: prev.amount + tx.amount, count: prev.count + 1 });
    } else if (tx.type === 'transfer' && tx.adminFee && tx.adminFee > 0) {
      const prev = expenseMap.get('Biaya Admin Transfer') || { amount: 0, count: 0 };
      expenseMap.set('Biaya Admin Transfer', {
        amount: prev.amount + tx.adminFee,
        count: prev.count + 1,
      });
    }
  });

  const expenseRows = Array.from(expenseMap.entries())
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([category, info]) => [
      category,
      `${info.count}x`,
      formatRupiah(info.amount),
      `${totalExpense > 0 ? Math.round((info.amount / totalExpense) * 100) : 0}%`,
    ]);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(23, 33, 29);
  doc.text('Pengeluaran per Kategori', margin, cursorY);
  cursorY += 3;

  if (expenseRows.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      head: [['Kategori', 'Frekuensi', 'Total Nominal', 'Porsi']],
      body: expenseRows,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8.5, textColor: [23, 33, 29] },
      alternateRowStyles: { fillColor: [248, 250, 249] },
      columnStyles: {
        1: { halign: 'center', cellWidth: 24 },
        2: { halign: 'right', cellWidth: 42 },
        3: { halign: 'right', cellWidth: 20 },
      },
    });
    cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 8;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 120, 114);
    doc.text('Tidak ada pengeluaran pada periode ini.', margin, cursorY + 5);
    cursorY += 12;
  }

  // Category Breakdown: Income (if any)
  const incomeMap = new Map<string, { amount: number; count: number }>();
  monthTransactions
    .filter((tx) => tx.type === 'income')
    .forEach((tx) => {
      const prev = incomeMap.get(tx.category) || { amount: 0, count: 0 };
      incomeMap.set(tx.category, { amount: prev.amount + tx.amount, count: prev.count + 1 });
    });

  if (incomeMap.size > 0) {
    if (cursorY > pageHeight - 50) {
      doc.addPage();
      cursorY = 18;
    }

    const incomeRows = Array.from(incomeMap.entries())
      .sort((a, b) => b[1].amount - a[1].amount)
      .map(([category, info]) => [
        category,
        `${info.count}x`,
        formatRupiah(info.amount),
        `${totalIncome > 0 ? Math.round((info.amount / totalIncome) * 100) : 0}%`,
      ]);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(23, 33, 29);
    doc.text('Pemasukan per Kategori', margin, cursorY);
    cursorY += 3;

    autoTable(doc, {
      startY: cursorY,
      head: [['Kategori', 'Frekuensi', 'Total Nominal', 'Porsi']],
      body: incomeRows,
      margin: { left: margin, right: margin },
      theme: 'grid',
      headStyles: { fillColor: [21, 128, 61], textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8.5, textColor: [23, 33, 29] },
      alternateRowStyles: { fillColor: [248, 250, 249] },
      columnStyles: {
        1: { halign: 'center', cellWidth: 24 },
        2: { halign: 'right', cellWidth: 42 },
        3: { halign: 'right', cellWidth: 20 },
      },
    });
    cursorY = (doc.lastAutoTable?.finalY ?? cursorY) + 8;
  }

  // Transaction Detail Table
  if (cursorY > pageHeight - 55) {
    doc.addPage();
    cursorY = 18;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(23, 33, 29);
  doc.text(`Rincian Transaksi (${monthLabel})`, margin, cursorY);
  cursorY += 3;

  if (monthTransactions.length > 0) {
    const txRows = monthTransactions.map((tx) => {
      const sourceAcc = accountMap.get(tx.accountId) || tx.accountId;
      const destAcc = tx.toAccountId ? accountMap.get(tx.toAccountId) || tx.toAccountId : '';
      const accountDisplay =
        tx.type === 'transfer' && destAcc ? `${sourceAcc} -> ${destAcc}` : sourceAcc;
      const signedAmount =
        tx.type === 'income'
          ? `+${formatRupiah(tx.amount)}`
          : tx.type === 'expense'
          ? `-${formatRupiah(tx.amount)}`
          : tx.adminFee && tx.adminFee > 0
          ? `${formatRupiah(tx.amount)} (+Adm ${formatRupiah(tx.adminFee)})`
          : formatRupiah(tx.amount);

      return [
        `${tx.date} ${tx.time || ''}`.trim(),
        getTypeLabel(tx.type),
        tx.category,
        accountDisplay,
        tx.note || '-',
        signedAmount,
      ];
    });

    autoTable(doc, {
      startY: cursorY,
      head: [['Tanggal', 'Tipe', 'Kategori', 'Akun', 'Catatan', 'Nominal']],
      body: txRows,
      margin: { left: margin, right: margin },
      theme: 'striped',
      headStyles: { fillColor: [23, 33, 29], textColor: 255, fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 7.8, textColor: [23, 33, 29], cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 27 },
        1: { cellWidth: 22 },
        2: { cellWidth: 30 },
        3: { cellWidth: 28 },
        5: { halign: 'right', cellWidth: 32, fontStyle: 'bold' },
      },
      didParseCell: (hookData) => {
        if (hookData.section === 'body' && hookData.column.index === 5) {
          const val = String(hookData.cell.raw || '');
          if (val.startsWith('+')) {
            hookData.cell.styles.textColor = [21, 128, 61];
          } else if (val.startsWith('-')) {
            hookData.cell.styles.textColor = [220, 38, 38];
          } else {
            hookData.cell.styles.textColor = [2, 132, 199];
          }
        }
      },
    });
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 120, 114);
    doc.text('Belum ada transaksi yang tercatat pada periode ini.', margin, cursorY + 5);
  }

  // Page Footer
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(107, 120, 114);
    doc.text(
      `Catatan Keuangan • Ringkasan Laporan ${monthLabel}`,
      margin,
      pageHeight - 8
    );
    doc.text(
      `Halaman ${p} dari ${totalPages}`,
      pageWidth - margin,
      pageHeight - 8,
      { align: 'right' }
    );
  }

  return { doc, fileName };
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1500);
}

export async function downloadMonthlyReportPdf(
  params: MonthlyPdfParams
): Promise<PdfActionResult> {
  const { doc, fileName } = buildMonthlyPdfDocument(params);
  const blob = doc.output('blob');
  triggerBlobDownload(blob, fileName);
  return {
    ok: true,
    fileName,
    message: `Laporan PDF periode ${formatMonthYear(params.selectedMonth)} berhasil diunduh (${fileName}).`,
  };
}

export async function shareMonthlyReportPdf(
  params: MonthlyPdfParams
): Promise<PdfActionResult> {
  const { doc, fileName } = buildMonthlyPdfDocument(params);
  const blob = doc.output('blob');
  const monthLabel = formatMonthYear(params.selectedMonth);
  const pdfFile = new File([blob], fileName, { type: 'application/pdf' });

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [pdfFile] })
  ) {
    try {
      await navigator.share({
        title: `Laporan Keuangan ${monthLabel}`,
        text: `Ringkasan laporan keuangan bulanan periode ${monthLabel} dari Catatan Keuangan.`,
        files: [pdfFile],
      });
      return {
        ok: true,
        fileName,
        message: `Laporan PDF periode ${monthLabel} berhasil dibagikan.`,
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return {
          ok: false,
          fileName,
          message: 'Proses berbagi PDF dibatalkan.',
        };
      }
      // Fall through to local download fallback when share fails (e.g. iframe restriction)
    }
  }

  triggerBlobDownload(blob, fileName);
  return {
    ok: true,
    fileName,
    message: `Perangkat/pratinjau ini tidak mendukung berbagi file langsung; file ${fileName} telah diunduh agar siap Anda bagikan secara manual.`,
  };
}
