import React, { useEffect, useState, useCallback } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  ArrowRightLeft,
  Tags,
  Wallet,
  Sparkles,
  Moon,
  Sun,
  Check,
  Plus,
} from 'lucide-react';
import { TabType } from './Navbar';
import { TransactionType } from '../types/finance';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, EWALLET_PRESETS } from '../data/defaultData';

interface OnboardingTourProps {
  isOpen: boolean;
  activeTab: TabType;
  onNavigateTab: (tab: TabType) => void;
  onClose: (markCompleted?: boolean) => void;
  onTryAction: (type: TransactionType) => void;
  isDark: boolean;
  onToggleDarkQuick: () => void;
}

interface TourStep {
  id: string;
  tab: TabType;
  targetSelector?: string;
  title: string;
  subtitle: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    tab: 'beranda',
    targetSelector: '[data-tour="hero-balance"]',
    title: 'Selamat Datang di Catatan Keuangan',
    subtitle:
      'Semua saldo dompet, arus kas bulanan, batas anggaran, dan progres target tabungan Anda terangkum otomatis di Beranda.',
  },
  {
    id: 'categories',
    tab: 'beranda',
    targetSelector: '[data-tour="fab-add"]',
    title: 'Menggunakan Kategori Transaksi',
    subtitle:
      'Ketuk tombol + kapan saja untuk mencatat Pengeluaran atau Pemasukan. Pilih kategori bawaan atau buat kategori kustom agar grafik statistik lebih akurat.',
  },
  {
    id: 'transfer-entry',
    tab: 'transaksi',
    targetSelector: '[data-tour="transfer-button"]',
    title: 'Fitur Transfer Saldo Antar Akun',
    subtitle:
      'Di tab Transaksi, gunakan tombol Transfer Saldo saat memindahkan uang antar Tunai, Rekening Bank, dan Dompet Digital tanpa mengacaukan total pengeluaran Anda.',
  },
  {
    id: 'transfer-ewallet',
    tab: 'transaksi',
    targetSelector: '[data-tour="transfer-button"]',
    title: 'Dompet Digital, Tukar Arah & Biaya Admin',
    subtitle:
      'Hubungkan dompet digital dalam satu ketukan, pantau sisa saldo sebelum & sesudah transfer, balik arah transfer, dan catat biaya admin opsional.',
  },
  {
    id: 'finish',
    tab: 'beranda',
    targetSelector: '[data-tour="header-actions"]',
    title: 'Nyaman di Siang & Malam (Mode Gelap)',
    subtitle:
      'Aktifkan Mode Gelap lewat ikon bulan di Beranda atau menu Pengaturan. Anda juga dapat membuka ulang panduan ini kapan saja melalui tombol ?.',
  },
];

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen,
  activeTab,
  onNavigateTab,
  onClose,
  onTryAction,
  isDark,
  onToggleDarkQuick,
}) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [previewCategoryTab, setPreviewCategoryTab] = useState<'expense' | 'income'>('expense');
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);

  const currentStep = TOUR_STEPS[stepIndex] || TOUR_STEPS[0];

  // Reset to step 0 when opened
  useEffect(() => {
    if (isOpen) {
      setStepIndex(0);
      setPreviewCategoryTab('expense');
    } else {
      setSpotlightRect(null);
    }
  }, [isOpen]);

  // Ensure the tour's target tab is active
  useEffect(() => {
    if (!isOpen) return;
    if (activeTab !== currentStep.tab) {
      onNavigateTab(currentStep.tab);
    }
  }, [isOpen, currentStep.tab, activeTab, onNavigateTab]);

  const measureTarget = useCallback(() => {
    if (!isOpen || !currentStep.targetSelector) {
      setSpotlightRect(null);
      return;
    }
    const el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
    if (!el) {
      setSpotlightRect(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setSpotlightRect(null);
      return;
    }
    const padding = 6;
    setSpotlightRect({
      top: Math.max(4, rect.top - padding),
      left: Math.max(4, rect.left - padding),
      width: Math.min(window.innerWidth - 8, rect.width + padding * 2),
      height: rect.height + padding * 2,
    });
  }, [isOpen, currentStep.targetSelector]);

  useEffect(() => {
    if (!isOpen) return;

    const scrollAndMeasure = () => {
      if (currentStep.targetSelector) {
        const el = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      measureTarget();
    };

    const t1 = window.setTimeout(scrollAndMeasure, 80);
    const t2 = window.setTimeout(measureTarget, 340);

    window.addEventListener('resize', measureTarget);
    window.addEventListener('scroll', measureTarget, true);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', measureTarget);
      window.removeEventListener('scroll', measureTarget, true);
    };
  }, [isOpen, stepIndex, activeTab, currentStep.targetSelector, measureTarget]);

  // Keyboard support
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose(true);
      } else if (e.key === 'ArrowRight') {
        if (stepIndex < TOUR_STEPS.length - 1) {
          setStepIndex((i) => i + 1);
        } else {
          onClose(true);
        }
      } else if (e.key === 'ArrowLeft' && stepIndex > 0) {
        setStepIndex((i) => i - 1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, stepIndex, onClose]);

  if (!isOpen) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const progressPct = Math.round(((stepIndex + 1) / TOUR_STEPS.length) * 100);

  // Place card opposite the highlighted element so the spotlight remains visible
  const placeCardAtTop = Boolean(
    spotlightRect &&
      spotlightRect.top + spotlightRect.height / 2 > window.innerHeight * 0.52
  );

  const previewCategories =
    previewCategoryTab === 'expense'
      ? EXPENSE_CATEGORIES.slice(0, 4)
      : INCOME_CATEGORIES.slice(0, 4);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Panduan Interaktif Catatan Keuangan"
      className="fixed inset-0 z-50 pointer-events-auto"
    >
      {/* Backdrop / Spotlight Cutout */}
      {spotlightRect ? (
        <div
          aria-hidden="true"
          onClick={() => onClose(true)}
          className="fixed rounded-2xl transition-all duration-200 pointer-events-auto"
          style={{
            top: spotlightRect.top,
            left: spotlightRect.left,
            width: spotlightRect.width,
            height: spotlightRect.height,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.62)',
            border: '2px solid #2dd4bf',
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          onClick={() => onClose(true)}
          className="fixed inset-0 bg-black/62 backdrop-blur-[1px]"
        />
      )}

      {/* Anchored Tour Card */}
      <div
        className={`fixed left-0 right-0 z-50 px-3 pointer-events-none flex justify-center ${
          placeCardAtTop ? 'top-3 sm:top-5' : 'bottom-3 sm:bottom-6'
        }`}
      >
        <div className="w-full max-w-[520px] max-h-[calc(100dvh-28px)] overflow-y-auto rounded-2xl bg-white dark:bg-[#131c1a] text-[#17211d] dark:text-[#edf3f1] border border-[#e1e7e4] dark:border-[#22302d] shadow-2xl p-4 space-y-3 pointer-events-auto">
          {/* Top Progress & Skip */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-[#0f766e] dark:text-[#2dd4bf] flex items-center gap-1.5 tabular-nums">
                <Sparkles size={14} className="shrink-0" />
                <span>
                  Panduan · Langkah {stepIndex + 1} dari {TOUR_STEPS.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onClose(true)}
                aria-label="Lewati panduan"
                className="px-2.5 min-h-[34px] rounded-xl text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0] hover:bg-[#f4f6f5] dark:hover:bg-[#1d2a27] hover:text-[#17211d] dark:hover:text-[#edf3f1] inline-flex items-center gap-1 transition cursor-pointer"
              >
                <span>Lewati</span>
                <X size={14} />
              </button>
            </div>

            <div className="w-full h-1.5 rounded-full bg-[#f4f6f5] dark:bg-[#1d2a27] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#0f766e] dark:bg-[#14b8a6] transition-all duration-200"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Step Title & Body */}
          <div className="space-y-1.5">
            <h2 className="text-base font-bold text-[#17211d] dark:text-[#edf3f1] m-0 leading-snug">
              {currentStep.title}
            </h2>
            <p className="text-xs text-[#6b7872] dark:text-[#95a5a0] leading-relaxed m-0">
              {currentStep.subtitle}
            </p>
          </div>

          {/* Step-specific Interactive Visual / Demo Block */}
          {currentStep.id === 'welcome' && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] border border-[#e1e7e4] dark:border-[#273733] space-y-1">
                <div className="font-bold text-[#0f766e] dark:text-[#2dd4bf] flex items-center gap-1.5">
                  <Tags size={14} />
                  Kategori Jelas
                </div>
                <p className="text-[11px] text-[#6b7872] dark:text-[#95a5a0] m-0 leading-snug">
                  Kelompokkan transaksi agar grafik donat & anggaran akurat.
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] border border-[#e1e7e4] dark:border-[#273733] space-y-1">
                <div className="font-bold text-[#0284c7] dark:text-[#38bdf8] flex items-center gap-1.5">
                  <ArrowRightLeft size={14} />
                  Transfer Dompet
                </div>
                <p className="text-[11px] text-[#6b7872] dark:text-[#95a5a0] m-0 leading-snug">
                  Pindahkan dana antar Bank & E-Wallet lengkap dengan biaya admin.
                </p>
              </div>
            </div>
          )}

          {currentStep.id === 'categories' && (
            <div className="p-3 rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] border border-[#e1e7e4] dark:border-[#273733] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-[#17211d] dark:text-[#edf3f1]">
                  Pratinjau Pilihan Kategori:
                </span>
                <div className="flex gap-1 p-0.5 rounded-lg bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733]">
                  <button
                    type="button"
                    onClick={() => setPreviewCategoryTab('expense')}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                      previewCategoryTab === 'expense'
                        ? 'bg-[#dc2626] text-white'
                        : 'text-[#6b7872] dark:text-[#95a5a0]'
                    }`}
                  >
                    Pengeluaran
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewCategoryTab('income')}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer ${
                      previewCategoryTab === 'income'
                        ? 'bg-[#15803d] text-white'
                        : 'text-[#6b7872] dark:text-[#95a5a0]'
                    }`}
                  >
                    Pemasukan
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {previewCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733] text-[11px] font-semibold text-[#17211d] dark:text-[#edf3f1] flex items-center gap-1.5 truncate"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="truncate">{cat.name}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px] text-[#6b7872] dark:text-[#95a5a0]">
                <span className="inline-flex items-center gap-1">
                  <Plus size={12} className="text-[#0f766e] dark:text-[#2dd4bf]" />
                  Bisa tambah <strong>+ Kategori kustom</strong>
                </span>
                <button
                  type="button"
                  onClick={() => onTryAction('expense')}
                  className="text-[#0f766e] dark:text-[#2dd4bf] font-bold hover:underline cursor-pointer shrink-0"
                >
                  Coba Catat Sekarang →
                </button>
              </div>
            </div>
          )}

          {currentStep.id === 'transfer-entry' && (
            <div className="p-3 rounded-xl bg-[#f0fdfa] dark:bg-[#102825] border border-[#99f6e4] dark:border-[#1e4e47] text-xs space-y-1.5">
              <div className="font-bold text-[#0f766e] dark:text-[#2dd4bf] flex items-center gap-1.5">
                <ArrowRightLeft size={14} />
                Kenapa Memakai Transfer Saldo?
              </div>
              <p className="text-[11px] text-[#17211d] dark:text-[#d5e3df] m-0 leading-relaxed">
                Misalnya Anda top-up <strong>GoPay Rp 200.000</strong> dari{' '}
                <strong>Rekening Bank</strong>. Saldo Bank berkurang dan saldo GoPay bertambah secara otomatis tanpa dihitung sebagai pemborosan.
              </p>
            </div>
          )}

          {currentStep.id === 'transfer-ewallet' && (
            <div className="p-3 rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] border border-[#e1e7e4] dark:border-[#273733] space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-[#17211d] dark:text-[#edf3f1] flex items-center gap-1">
                  <Wallet size={13} className="text-[#0f766e] dark:text-[#2dd4bf]" />
                  Preset Dompet Digital Siap Pakai:
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {EWALLET_PRESETS.map((preset) => (
                  <span
                    key={preset.id}
                    className="px-2 py-1 rounded-lg bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733] font-semibold text-[#17211d] dark:text-[#edf3f1] inline-flex items-center gap-1.5"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: preset.color }}
                    />
                    {preset.name}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2 pt-0.5 text-[11px] text-[#6b7872] dark:text-[#95a5a0]">
                <span>Termasuk kolom Biaya Admin & Tukar Arah</span>
                <button
                  type="button"
                  onClick={() => onTryAction('transfer')}
                  className="text-[#0f766e] dark:text-[#2dd4bf] font-bold hover:underline cursor-pointer shrink-0"
                >
                  Coba Transfer Sekarang →
                </button>
              </div>
            </div>
          )}

          {currentStep.id === 'finish' && (
            <div className="p-3 rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] border border-[#e1e7e4] dark:border-[#273733] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733] text-[#0f766e] dark:text-[#2dd4bf] shrink-0">
                  {isDark ? <Moon size={16} /> : <Sun size={16} />}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#17211d] dark:text-[#edf3f1]">
                    {isDark ? 'Mode Gelap Aktif' : 'Mode Terang Aktif'}
                  </div>
                  <div className="text-[11px] text-[#6b7872] dark:text-[#95a5a0]">
                    Coba ganti tampilan aplikasi langsung
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleDarkQuick}
                className="px-3 min-h-[38px] rounded-xl bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#2c3d39] text-xs font-semibold text-[#0f766e] dark:text-[#2dd4bf] hover:bg-[#ccfbf1]/40 dark:hover:bg-[#1d2e2b] transition cursor-pointer shrink-0 whitespace-nowrap"
              >
                {isDark ? 'Mode Terang' : 'Mode Gelap'}
              </button>
            </div>
          )}

          {/* Footer Navigation Controls */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
              disabled={isFirst}
              className="px-3 min-h-[44px] rounded-xl border border-[#e1e7e4] dark:border-[#273733] bg-[#f4f6f5] dark:bg-[#1b2623] text-[#17211d] dark:text-[#edf3f1] text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer disabled:opacity-40 disabled:cursor-default whitespace-nowrap"
            >
              <ChevronLeft size={15} />
              Kembali
            </button>

            {isLast ? (
              <div className="flex items-center gap-2 flex-1 justify-end">
                <button
                  type="button"
                  onClick={() => onTryAction('transfer')}
                  className="px-3 min-h-[44px] rounded-xl border border-[#0f766e]/40 dark:border-[#2dd4bf]/40 text-[#0f766e] dark:text-[#2dd4bf] text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-[#ccfbf1]/30 dark:hover:bg-[#102825] transition cursor-pointer whitespace-nowrap"
                >
                  <ArrowRightLeft size={14} />
                  Coba Transfer
                </button>
                <button
                  type="button"
                  onClick={() => onClose(true)}
                  className="px-4 min-h-[44px] rounded-xl bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
                >
                  <Check size={15} />
                  Selesai
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.min(TOUR_STEPS.length - 1, i + 1))}
                className="px-4 min-h-[44px] rounded-xl bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <span>{isFirst ? 'Mulai Panduan' : 'Lanjut'}</span>
                <ChevronRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
