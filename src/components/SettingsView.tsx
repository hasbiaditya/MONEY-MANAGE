import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Upload,
  RefreshCw,
  Trash2,
  Smartphone,
  Shield,
  LogOut,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Lock,
  Fingerprint,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  FileText,
  Share2,
  CalendarClock,
  Bell,
  BellOff,
  Check,
  Edit2,
  Sun,
  Moon,
  Monitor,
  HelpCircle,
  Sparkles,
  Palette,
} from 'lucide-react';
import { Transaction, Account, BudgetConfig, UserProfile, ThemePreference } from '../types/finance';
import { generateDefaultTransactions, DEFAULT_ACCOUNTS, DEFAULT_BUDGET } from '../data/defaultData';
import { AppLockUpdatePayload } from '../services/financeDb';
import {
  generateSaltHex,
  hashSecret,
  hasRegisteredBiometric,
  isBiometricSupported,
  registerBiometricCredential,
  removeBiometricCredential,
  verifySecret,
} from '../utils/appSecurity';
import { exportTransactionsToCsv } from '../utils/csvExport';
import { formatMonthYear, formatRibuan, formatRupiah } from '../utils/formatters';
import { evaluateDailyBudgetAlert } from '../utils/budgetAlerts';
import { downloadMonthlyReportPdf, shareMonthlyReportPdf } from '../utils/pdfReport';

interface SettingsViewProps {
  transactions: Transaction[];
  accounts: Account[];
  budget: BudgetConfig;
  userProfile: UserProfile | null;
  themePreference?: ThemePreference;
  onChangeTheme?: (pref: ThemePreference) => void;
  onStartTour?: () => void;
  onUpdateBudget: (newBudget: BudgetConfig) => Promise<void> | void;
  onRestoreData: (data: { transactions: Transaction[]; accounts: Account[]; budget: BudgetConfig }) => Promise<void> | void;
  onResetAll: () => Promise<void> | void;
  onSaveAppLock: (payload: AppLockUpdatePayload) => Promise<void>;
  onLockNow: () => void;
  onLogout: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  transactions,
  accounts,
  budget,
  userProfile,
  themePreference = 'system',
  onChangeTheme,
  onStartTour,
  onUpdateBudget,
  onRestoreData,
  onResetAll,
  onSaveAppLock,
  onLockNow,
  onLogout,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<'logout' | 'sample' | 'reset' | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // App lock state
  const [lockFormMode, setLockFormMode] = useState<'setup' | 'disable' | null>(null);
  const [selectedLockType, setSelectedLockType] = useState<'pin' | 'password'>('pin');
  const [currentSecret, setCurrentSecret] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [confirmSecret, setConfirmSecret] = useState('');
  const [showSecrets, setShowSecrets] = useState(false);
  const [lockFormError, setLockFormError] = useState<string | null>(null);
  const [lockBusy, setLockBusy] = useState(false);

  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricRegistered, setBiometricRegistered] = useState(false);
  const [biometricFeedback, setBiometricFeedback] = useState<string | null>(null);

  const defaultMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [pdfMonth, setPdfMonth] = useState(defaultMonth);

  // Daily budget limit state
  const [isEditingDailyLimit, setIsEditingDailyLimit] = useState(false);
  const [dailyLimitInput, setDailyLimitInput] = useState(
    budget.dailyLimit && budget.dailyLimit > 0 ? String(budget.dailyLimit) : ''
  );
  const [dailyLimitBusy, setDailyLimitBusy] = useState(false);

  const dailyAlertSummary = useMemo(
    () => evaluateDailyBudgetAlert(transactions, { ...budget, alertsEnabled: true }),
    [transactions, budget]
  );

  const availablePdfMonths = useMemo(() => {
    const set = new Set<string>([defaultMonth]);
    transactions.forEach((tx) => {
      if (tx.date) set.add(tx.date.substring(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [transactions, defaultMonth]);

  useEffect(() => {
    let active = true;
    isBiometricSupported().then((supported) => {
      if (active) setBiometricSupported(supported);
    });
    if (userProfile?.uid) {
      setBiometricRegistered(hasRegisteredBiometric(userProfile.uid));
    }
    return () => {
      active = false;
    };
  }, [userProfile?.uid]);

  const resetLockForm = () => {
    setLockFormMode(null);
    setCurrentSecret('');
    setNewSecret('');
    setConfirmSecret('');
    setShowSecrets(false);
    setLockFormError(null);
  };

  const handleOpenSetupLock = () => {
    setSelectedLockType(userProfile?.appLockType === 'password' ? 'password' : 'pin');
    setCurrentSecret('');
    setNewSecret('');
    setConfirmSecret('');
    setShowSecrets(false);
    setLockFormError(null);
    setBiometricFeedback(null);
    setLockFormMode('setup');
  };

  const handleSubmitAppLock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || lockBusy) return;
    setLockFormError(null);

    if (userProfile.appLockEnabled) {
      const ok = await verifySecret(
        currentSecret,
        userProfile.appLockSalt || '',
        userProfile.appLockHash || ''
      );
      if (!ok) {
        setLockFormError(
          userProfile.appLockType === 'password'
            ? 'Password saat ini tidak sesuai.'
            : 'PIN saat ini tidak sesuai.'
        );
        return;
      }
    }

    if (selectedLockType === 'pin') {
      if (!/^\d{6}$/.test(newSecret)) {
        setLockFormError('PIN harus terdiri dari tepat 6 digit angka.');
        return;
      }
    } else if (newSecret.trim().length < 4) {
      setLockFormError('Password minimal terdiri dari 4 karakter.');
      return;
    }

    if (newSecret !== confirmSecret) {
      setLockFormError(
        selectedLockType === 'pin'
          ? 'Konfirmasi PIN tidak cocok.'
          : 'Konfirmasi password tidak cocok.'
      );
      return;
    }

    setLockBusy(true);
    try {
      const salt = generateSaltHex();
      const hash = await hashSecret(newSecret, salt);
      await onSaveAppLock({
        appLockEnabled: true,
        appLockType: selectedLockType,
        appLockHash: hash,
        appLockSalt: salt,
        biometricEnabled: Boolean(userProfile.biometricEnabled && biometricRegistered),
      });
      resetLockForm();
      setStatusMessage({
        type: 'success',
        text:
          selectedLockType === 'pin'
            ? 'Kunci aplikasi dengan PIN 6 digit berhasil disimpan.'
            : 'Kunci aplikasi dengan Password berhasil disimpan.',
      });
    } catch {
      setLockFormError('Gagal menyimpan pengaturan kunci ke database.');
    } finally {
      setLockBusy(false);
    }
  };

  const handleDisableAppLock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || lockBusy) return;
    setLockFormError(null);

    const ok = await verifySecret(
      currentSecret,
      userProfile.appLockSalt || '',
      userProfile.appLockHash || ''
    );
    if (!ok) {
      setLockFormError(
        userProfile.appLockType === 'password'
          ? 'Password saat ini tidak sesuai.'
          : 'PIN saat ini tidak sesuai.'
      );
      return;
    }

    setLockBusy(true);
    try {
      removeBiometricCredential(userProfile.uid);
      setBiometricRegistered(false);
      await onSaveAppLock({
        appLockEnabled: false,
        appLockType: 'pin',
        appLockHash: '',
        appLockSalt: '',
        biometricEnabled: false,
      });
      resetLockForm();
      setBiometricFeedback(null);
      setStatusMessage({ type: 'success', text: 'Kunci aplikasi telah dinonaktifkan.' });
    } catch {
      setLockFormError('Gagal menonaktifkan kunci aplikasi.');
    } finally {
      setLockBusy(false);
    }
  };

  const handleToggleBiometric = async () => {
    if (!userProfile || !userProfile.appLockEnabled || lockBusy) return;
    setBiometricFeedback(null);
    setStatusMessage(null);

    const currentlyActive = Boolean(userProfile.biometricEnabled) && biometricRegistered;

    if (currentlyActive) {
      setLockBusy(true);
      try {
        removeBiometricCredential(userProfile.uid);
        setBiometricRegistered(false);
        await onSaveAppLock({
          appLockEnabled: true,
          appLockType: userProfile.appLockType === 'password' ? 'password' : 'pin',
          appLockHash: userProfile.appLockHash || '',
          appLockSalt: userProfile.appLockSalt || '',
          biometricEnabled: false,
        });
        setStatusMessage({ type: 'success', text: 'Buka dengan sidik jari dinonaktifkan.' });
      } catch {
        setBiometricFeedback('Gagal memperbarui pengaturan sidik jari.');
      } finally {
        setLockBusy(false);
      }
      return;
    }

    setLockBusy(true);
    try {
      const regResult = await registerBiometricCredential(
        userProfile.uid,
        userProfile.email,
        userProfile.displayName
      );
      if (!regResult.ok) {
        setBiometricFeedback(regResult.errorMessage || 'Gagal mendaftarkan sidik jari.');
        return;
      }

      setBiometricRegistered(true);
      await onSaveAppLock({
        appLockEnabled: true,
        appLockType: userProfile.appLockType === 'password' ? 'password' : 'pin',
        appLockHash: userProfile.appLockHash || '',
        appLockSalt: userProfile.appLockSalt || '',
        biometricEnabled: true,
      });
      setStatusMessage({
        type: 'success',
        text: 'Sidik jari berhasil didaftarkan untuk membuka aplikasi.',
      });
    } catch {
      setBiometricFeedback('Gagal menyimpan status sidik jari ke database.');
    } finally {
      setLockBusy(false);
    }
  };

  // Daily budget limit handlers
  const handleSaveDailyLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dailyLimitBusy) return;
    const val = parseInt(dailyLimitInput, 10) || 0;
    if (val <= 0) {
      setStatusMessage({
        type: 'error',
        text: 'Masukkan nominal batas anggaran harian lebih dari Rp 0, atau klik Nonaktifkan.',
      });
      return;
    }
    setDailyLimitBusy(true);
    try {
      await onUpdateBudget({
        ...budget,
        dailyLimit: val,
      });
      setIsEditingDailyLimit(false);
      setStatusMessage({
        type: 'success',
        text: `Batas anggaran harian diatur ke ${formatRupiah(val)}/hari.`,
      });
    } catch {
      setStatusMessage({ type: 'error', text: 'Gagal menyimpan batas anggaran harian.' });
    } finally {
      setDailyLimitBusy(false);
    }
  };

  const handleDisableDailyLimit = async () => {
    if (dailyLimitBusy) return;
    setDailyLimitBusy(true);
    try {
      await onUpdateBudget({
        ...budget,
        dailyLimit: 0,
      });
      setDailyLimitInput('');
      setIsEditingDailyLimit(false);
      setStatusMessage({
        type: 'success',
        text: 'Batas anggaran harian telah dinonaktifkan.',
      });
    } catch {
      setStatusMessage({ type: 'error', text: 'Gagal menonaktifkan batas anggaran harian.' });
    } finally {
      setDailyLimitBusy(false);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const result = exportTransactionsToCsv(transactions, accounts);
    setStatusMessage({
      type: result.ok ? 'success' : 'error',
      text: result.message,
    });
  };

  // Export / Share Monthly PDF
  const handleExportMonthlyPdf = async (mode: 'download' | 'share') => {
    setIsBusy(true);
    try {
      const params = {
        selectedMonth: pdfMonth,
        transactions,
        accounts,
        budget,
        userProfile,
      };
      const result =
        mode === 'share'
          ? await shareMonthlyReportPdf(params)
          : await downloadMonthlyReportPdf(params);
      setStatusMessage({
        type: result.ok ? 'success' : 'error',
        text: result.message,
      });
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Gagal membuat file laporan PDF bulanan.',
      });
    } finally {
      setIsBusy(false);
    }
  };

  // Export JSON Backup
  const handleBackupJSON = () => {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      transactions,
      accounts,
      budget,
    };

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`;
    const link = document.createElement('a');
    link.href = jsonString;
    link.setAttribute('download', `backup_keuangan_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatusMessage({ type: 'success', text: 'File cadangan JSON berhasil diunduh.' });
  };

  // Import JSON Backup
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed.transactions) && Array.isArray(parsed.accounts)) {
          setIsBusy(true);
          await onRestoreData({
            transactions: parsed.transactions,
            accounts: parsed.accounts,
            budget: parsed.budget || DEFAULT_BUDGET,
          });
          setStatusMessage({ type: 'success', text: 'Data berhasil dipulihkan ke database aplikasi.' });
        } else {
          setStatusMessage({ type: 'error', text: 'Format file cadangan tidak valid.' });
        }
      } catch {
        setStatusMessage({ type: 'error', text: 'Gagal membaca atau memulihkan file JSON.' });
      } finally {
        setIsBusy(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    setIsBusy(true);
    setStatusMessage(null);
    try {
      if (confirmAction === 'sample') {
        await onRestoreData({
          transactions: generateDefaultTransactions(),
          accounts: DEFAULT_ACCOUNTS,
          budget: DEFAULT_BUDGET,
        });
        setStatusMessage({ type: 'success', text: 'Data contoh berhasil dimuat ke database.' });
      } else if (confirmAction === 'reset') {
        await onResetAll();
        setStatusMessage({ type: 'success', text: 'Semua data transaksi berhasil dikosongkan.' });
      } else if (confirmAction === 'logout') {
        await onLogout();
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Terjadi kesalahan saat memproses permintaan.' });
    } finally {
      setIsBusy(false);
      setConfirmAction(null);
    }
  };

  const isAppLockActive = Boolean(userProfile?.appLockEnabled && userProfile?.appLockHash);
  const isBiometricActive = isAppLockActive && Boolean(userProfile?.biometricEnabled) && biometricRegistered;

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="pt-1">
        <h1 className="text-xl font-bold text-[#17211d] dark:text-[#edf3f1] m-0">Pengaturan & Akun</h1>
        <p className="text-xs text-[#6b7872] dark:text-[#95a5a0] mt-0.5">
          Kelola akun Google yang terhubung, tampilan mode gelap, panduan, keamanan, dan cadangan data Anda.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Akun Google Tersimpan di Database */}
      {userProfile && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#17211d] dark:text-[#edf3f1]">Akun Google Terhubung</h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0f766e] dark:text-[#2dd4bf]">
              <Cloud size={13} /> Tersimpan di Database
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-[#ccfbf1] dark:bg-[#102825] border border-[#e1e7e4] dark:border-[#273733] overflow-hidden flex items-center justify-center shrink-0">
                {userProfile.photoURL ? (
                  <img
                    src={userProfile.photoURL}
                    alt={userProfile.displayName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-base font-bold text-[#0f766e] dark:text-[#2dd4bf]">
                    {userProfile.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#17211d] dark:text-[#edf3f1] truncate">
                  {userProfile.displayName}
                </div>
                <div className="text-xs text-[#6b7872] dark:text-[#95a5a0] truncate">{userProfile.email}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setConfirmAction('logout')}
              disabled={isBusy}
              className="px-3 py-2 min-h-[40px] rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-950/70 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer"
            >
              <LogOut size={14} />
              Keluar
            </button>
          </div>

          {confirmAction === 'logout' && (
            <div className="p-3 rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] border border-[#e1e7e4] dark:border-[#273733] space-y-2 text-xs">
              <p className="text-[#17211d] dark:text-[#edf3f1] font-medium m-0">
                Keluar dari akun Google ini? Data Anda tetap aman tersimpan di database saat Anda masuk kembali.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={executeConfirmAction}
                  disabled={isBusy}
                  className="flex-1 py-2 px-3 rounded-lg bg-[#dc2626] text-white font-semibold cursor-pointer"
                >
                  Ya, Keluar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  disabled={isBusy}
                  className="flex-1 py-2 px-3 rounded-lg bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733] text-[#17211d] dark:text-[#edf3f1] font-semibold cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tampilan (Mode Gelap) & Panduan Interaktif */}
      <div className="card space-y-3.5">
        <div className="flex items-center gap-2">
          <Palette size={16} className="text-[#0f766e] dark:text-[#2dd4bf] shrink-0" />
          <h2 className="text-sm font-bold text-[#17211d] dark:text-[#edf3f1] m-0">
            Tampilan & Panduan Penggunaan
          </h2>
        </div>

        {/* Theme Mode Picker */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-[#6b7872] dark:text-[#95a5a0]">
            Tema Aplikasi (Dark Mode)
          </div>
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] border border-[#e1e7e4] dark:border-[#273733]">
            {(
              [
                { id: 'light', label: 'Terang', icon: Sun },
                { id: 'dark', label: 'Gelap', icon: Moon },
                { id: 'system', label: 'Sistem', icon: Monitor },
              ] as const
            ).map((opt) => {
              const Icon = opt.icon;
              const isSelected = themePreference === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeTheme?.(opt.id)}
                  aria-pressed={isSelected}
                  className={`min-h-[40px] px-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-[#0f766e] text-white shadow-xs'
                      : 'text-[#6b7872] dark:text-[#95a5a0] hover:text-[#17211d] dark:hover:text-[#edf3f1]'
                  }`}
                >
                  <Icon size={14} />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Replay Interactive Onboarding Tour */}
        {onStartTour && (
          <div className="pt-2.5 border-t border-[#e1e7e4] dark:border-[#22302d] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-2 rounded-xl bg-[#ccfbf1] dark:bg-[#102825] text-[#0f766e] dark:text-[#2dd4bf] shrink-0">
                <HelpCircle size={17} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#17211d] dark:text-[#edf3f1]">
                  Panduan Interaktif Fitur
                </div>
                <div className="text-[11px] text-[#6b7872] dark:text-[#95a5a0]">
                  Pelajari cara Transfer Saldo antar dompet & Kategori Transaksi
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onStartTour}
              className="px-3 min-h-[38px] rounded-xl bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition shrink-0 cursor-pointer whitespace-nowrap"
            >
              <Sparkles size={13} />
              Mulai Panduan
            </button>
          </div>
        )}
      </div>

      {/* Target Anggaran Harian */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarClock size={16} className="text-[#0f766e] dark:text-[#2dd4bf] shrink-0" />
            <h2 className="text-sm font-bold text-[#17211d] dark:text-[#edf3f1] m-0 truncate">
              Batas Anggaran Harian
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              setDailyLimitInput(
                budget.dailyLimit && budget.dailyLimit > 0 ? String(budget.dailyLimit) : ''
              );
              setIsEditingDailyLimit((prev) => !prev);
            }}
            className="px-3 py-1.5 rounded-xl border border-[#e1e7e4] dark:border-[#273733] text-xs font-semibold text-[#0f766e] dark:text-[#2dd4bf] hover:bg-[#ccfbf1]/30 dark:hover:bg-[#102825] transition inline-flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Edit2 size={13} />
            {isEditingDailyLimit
              ? 'Batal'
              : (budget.dailyLimit ?? 0) > 0
              ? 'Ubah Batas'
              : 'Atur Batas'}
          </button>
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <div>
            <div className="text-[11px] text-[#6b7872] dark:text-[#95a5a0]">Target Maksimal Pengeluaran per Hari</div>
            <div className="text-lg font-bold text-[#17211d] dark:text-[#edf3f1] tabular-nums mt-0.5">
              {(budget.dailyLimit ?? 0) > 0
                ? formatRupiah(budget.dailyLimit || 0)
                : 'Belum Ditetapkan'}
            </div>
          </div>
          {(budget.dailyLimit ?? 0) > 0 && (
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full tabular-nums ${
                dailyAlertSummary.usedAmount > (budget.dailyLimit || 0)
                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
              }`}
            >
              {dailyAlertSummary.usedAmount > (budget.dailyLimit || 0)
                ? 'Melebihi Target'
                : 'Terkontrol'}
            </span>
          )}
        </div>

        {(budget.dailyLimit ?? 0) > 0 && (
          <div className="space-y-1.5">
            <div className="w-full bg-[#f4f6f5] dark:bg-[#1b2623] h-2.5 rounded-full overflow-hidden border border-[#e1e7e4] dark:border-[#273733]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  dailyAlertSummary.usedAmount > (budget.dailyLimit || 0)
                    ? 'bg-[#dc2626]'
                    : dailyAlertSummary.displayPercent >= 80
                    ? 'bg-amber-500'
                    : 'bg-[#0f766e] dark:bg-[#14b8a6]'
                }`}
                style={{ width: `${Math.min(100, dailyAlertSummary.displayPercent)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-[#6b7872] dark:text-[#95a5a0] tabular-nums">
              <span>
                Hari ini: <strong className="text-[#17211d] dark:text-[#edf3f1]">{formatRupiah(dailyAlertSummary.usedAmount)}</strong> ({dailyAlertSummary.displayPercent}%)
              </span>
              <span>
                {dailyAlertSummary.usedAmount > (budget.dailyLimit || 0)
                  ? `Lebih ${formatRupiah(dailyAlertSummary.overByAmount)}`
                  : `Sisa ${formatRupiah(Math.max(0, (budget.dailyLimit || 0) - dailyAlertSummary.usedAmount))}`}
              </span>
            </div>
          </div>
        )}

        {isEditingDailyLimit && (
          <form
            onSubmit={handleSaveDailyLimit}
            className="p-3 bg-[#f4f6f5] dark:bg-[#1b2623] rounded-xl space-y-2.5 border border-[#e1e7e4] dark:border-[#273733]"
          >
            <label className="block text-xs font-semibold text-[#17211d] dark:text-[#edf3f1]">
              Atur Batas Pengeluaran Harian (IDR)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#0f766e] dark:text-[#2dd4bf] pointer-events-none select-none">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Contoh: 150.000"
                value={dailyLimitInput ? formatRibuan(dailyLimitInput) : ''}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
                  setDailyLimitInput(clean);
                }}
                className="w-full pl-10 pr-3 py-2 bg-white dark:bg-[#131c1a] text-[#17211d] dark:text-[#edf3f1] text-base font-bold tabular-nums border border-[#e1e7e4] dark:border-[#273733] rounded-xl focus:border-[#0f766e] dark:focus:border-[#14b8a6]"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[50000, 100000, 150000, 250000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setDailyLimitInput(String(val))}
                  className="px-2 py-1 text-xs rounded-lg bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733] text-[#17211d] dark:text-[#edf3f1] hover:bg-[#e8eeec] dark:hover:bg-[#22302d] transition cursor-pointer tabular-nums"
                >
                  {formatRupiah(val)}
                </button>
              ))}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={dailyLimitBusy}
                className="flex-1 py-2.5 px-3 rounded-xl bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                <Check size={15} />
                {dailyLimitBusy ? 'Menyimpan...' : 'Simpan Batas Harian'}
              </button>
              {(budget.dailyLimit ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={handleDisableDailyLimit}
                  disabled={dailyLimitBusy}
                  className="py-2.5 px-3 rounded-xl bg-white dark:bg-[#131c1a] border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer disabled:opacity-60"
                >
                  Nonaktifkan
                </button>
              )}
            </div>
          </form>
        )}

        {/* Alert notification toggle synced with monthly & daily limits */}
        <div className="pt-2 border-t border-[#e1e7e4] dark:border-[#22302d] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                budget.alertsEnabled
                  ? 'bg-[#ccfbf1] dark:bg-[#102825] text-[#0f766e] dark:text-[#2dd4bf]'
                  : 'bg-[#f4f6f5] dark:bg-[#1b2623] text-[#6b7872] dark:text-[#95a5a0]'
              }`}
            >
              {budget.alertsEnabled ? <Bell size={15} /> : <BellOff size={15} />}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#17211d] dark:text-[#edf3f1]">
                Notifikasi Batas Harian & Bulanan
              </div>
              <div className="text-[11px] text-[#6b7872] dark:text-[#95a5a0]">
                {budget.alertsEnabled
                  ? 'Aktif saat pengeluaran harian melebihi target atau bulanan ≥ 80%'
                  : 'Nonaktif: peringatan anggaran disembunyikan'}
              </div>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={budget.alertsEnabled}
            aria-label="Aktifkan notifikasi batas anggaran harian dan bulanan"
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

      {/* Keamanan & Kunci Aplikasi (PIN / Password / Fingerprint) */}
      {userProfile && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Lock size={16} className="text-[#0f766e] dark:text-[#2dd4bf]" />
              <h2 className="text-sm font-bold text-[#17211d] dark:text-[#edf3f1] m-0">Keamanan & Kunci Aplikasi</h2>
            </div>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                isAppLockActive
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                  : 'bg-[#f4f6f5] dark:bg-[#1b2623] text-[#6b7872] dark:text-[#95a5a0]'
              }`}
            >
              {isAppLockActive
                ? userProfile.appLockType === 'password'
                  ? 'Aktif (Password)'
                  : 'Aktif (PIN 6 Digit)'
                : 'Nonaktif'}
            </span>
          </div>

          <p className="text-xs text-[#6b7872] dark:text-[#95a5a0] leading-relaxed m-0">
            Lindungi akses masuk ke catatan keuangan Anda dengan PIN 6 digit atau Password, serta sidik jari perangkat.
          </p>

          {/* Action Buttons */}
          {!lockFormMode && (
            <div className="space-y-2 pt-0.5">
              {!isAppLockActive ? (
                <button
                  type="button"
                  onClick={handleOpenSetupLock}
                  className="w-full py-2.5 px-3.5 min-h-[44px] rounded-xl bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <KeyRound size={15} />
                  Aktifkan Kunci PIN / Password
                </button>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={onLockNow}
                      className="py-2.5 px-3 min-h-[44px] rounded-xl bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Lock size={14} />
                      Kunci Sekarang
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenSetupLock}
                      className="py-2.5 px-3 min-h-[44px] rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] hover:bg-[#e8eeec] dark:hover:bg-[#22302d] border border-[#e1e7e4] dark:border-[#273733] text-[#17211d] dark:text-[#edf3f1] text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <KeyRound size={14} />
                      Ubah PIN / Password
                    </button>
                  </div>

                  {/* Fingerprint / Biometric Toggle */}
                  <div className="p-3 rounded-xl border border-[#e1e7e4] dark:border-[#273733] bg-[#f9fbfa] dark:bg-[#1b2623] space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-2 rounded-xl bg-[#ccfbf1] dark:bg-[#102825] text-[#0f766e] dark:text-[#2dd4bf] shrink-0">
                          <Fingerprint size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#17211d] dark:text-[#edf3f1]">
                            Buka dengan Sidik Jari
                          </div>
                          <div className="text-[11px] text-[#6b7872] dark:text-[#95a5a0]">
                            {isBiometricActive
                              ? 'Sidik jari aktif di perangkat ini'
                              : biometricSupported
                              ? 'Gunakan sensor sidik jari perangkat sebagai alternatif cepat'
                              : 'Perlu sensor biometrik perangkat & konteks aman'}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleToggleBiometric}
                        disabled={lockBusy}
                        className={`px-3 py-2 min-h-[38px] rounded-xl text-xs font-semibold shrink-0 transition cursor-pointer disabled:opacity-50 ${
                          isBiometricActive
                            ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/70'
                            : 'bg-[#0f766e] text-white hover:bg-[#115e59]'
                        }`}
                      >
                        {lockBusy ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : isBiometricActive ? (
                          'Nonaktifkan'
                        ) : (
                          'Aktifkan'
                        )}
                      </button>
                    </div>

                    {biometricFeedback && (
                      <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-[11px] text-amber-900 dark:text-amber-300 leading-relaxed flex items-start gap-2">
                        <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
                        <span>{biometricFeedback}</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentSecret('');
                      setLockFormError(null);
                      setLockFormMode('disable');
                    }}
                    className="w-full py-2 px-3 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                  >
                    Nonaktifkan Kunci Aplikasi
                  </button>
                </>
              )}
            </div>
          )}

          {/* Setup / Change PIN or Password Inline Form */}
          {lockFormMode === 'setup' && (
            <form onSubmit={handleSubmitAppLock} className="p-3.5 rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] border border-[#e1e7e4] dark:border-[#273733] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#17211d] dark:text-[#edf3f1]">
                  {isAppLockActive ? 'Ubah PIN / Password' : 'Atur Kunci Masuk Aplikasi'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowSecrets((prev) => !prev)}
                  className="text-[11px] font-semibold text-[#0f766e] dark:text-[#2dd4bf] inline-flex items-center gap-1 cursor-pointer"
                >
                  {showSecrets ? <EyeOff size={13} /> : <Eye size={13} />}
                  {showSecrets ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </div>

              {/* Type Selector: PIN vs Password */}
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733]">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLockType('pin');
                    setNewSecret('');
                    setConfirmSecret('');
                    setLockFormError(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    selectedLockType === 'pin'
                      ? 'bg-[#0f766e] text-white shadow-xs'
                      : 'text-[#6b7872] dark:text-[#95a5a0] hover:text-[#17211d] dark:hover:text-[#edf3f1]'
                  }`}
                >
                  PIN (6 Digit)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLockType('password');
                    setNewSecret('');
                    setConfirmSecret('');
                    setLockFormError(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    selectedLockType === 'password'
                      ? 'bg-[#0f766e] text-white shadow-xs'
                      : 'text-[#6b7872] dark:text-[#95a5a0] hover:text-[#17211d] dark:hover:text-[#edf3f1]'
                  }`}
                >
                  Password
                </button>
              </div>

              {isAppLockActive && (
                <div>
                  <label className="text-[11px] font-semibold text-[#6b7872] dark:text-[#95a5a0] block mb-1">
                    {userProfile.appLockType === 'password' ? 'Password Saat Ini' : 'PIN Saat Ini'}
                  </label>
                  <input
                    type={showSecrets ? 'text' : 'password'}
                    inputMode={userProfile.appLockType === 'pin' ? 'numeric' : 'text'}
                    maxLength={userProfile.appLockType === 'pin' ? 6 : 64}
                    value={currentSecret}
                    onChange={(e) => {
                      const val =
                        userProfile.appLockType === 'pin'
                          ? e.target.value.replace(/\D/g, '').slice(0, 6)
                          : e.target.value;
                      setCurrentSecret(val);
                    }}
                    placeholder={
                      userProfile.appLockType === 'password'
                        ? 'Masukkan password saat ini'
                        : 'Masukkan 6 digit PIN saat ini'
                    }
                    className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733] text-xs font-medium text-[#17211d] dark:text-[#edf3f1] focus:outline-none focus:border-[#0f766e] dark:focus:border-[#14b8a6]"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-[#6b7872] dark:text-[#95a5a0] block mb-1">
                  {selectedLockType === 'pin' ? 'PIN Baru (6 Digit Angka)' : 'Password Baru (Min. 4 Karakter)'}
                </label>
                <input
                  type={showSecrets ? 'text' : 'password'}
                  inputMode={selectedLockType === 'pin' ? 'numeric' : 'text'}
                  maxLength={selectedLockType === 'pin' ? 6 : 64}
                  value={newSecret}
                  onChange={(e) => {
                    const val =
                      selectedLockType === 'pin'
                        ? e.target.value.replace(/\D/g, '').slice(0, 6)
                        : e.target.value;
                    setNewSecret(val);
                  }}
                  placeholder={selectedLockType === 'pin' ? 'Contoh: 123456' : 'Minimal 4 karakter'}
                  className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733] text-xs font-medium text-[#17211d] dark:text-[#edf3f1] tabular-nums focus:outline-none focus:border-[#0f766e] dark:focus:border-[#14b8a6]"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-[#6b7872] dark:text-[#95a5a0] block mb-1">
                  {selectedLockType === 'pin' ? 'Ulangi PIN Baru' : 'Ulangi Password Baru'}
                </label>
                <input
                  type={showSecrets ? 'text' : 'password'}
                  inputMode={selectedLockType === 'pin' ? 'numeric' : 'text'}
                  maxLength={selectedLockType === 'pin' ? 6 : 64}
                  value={confirmSecret}
                  onChange={(e) => {
                    const val =
                      selectedLockType === 'pin'
                        ? e.target.value.replace(/\D/g, '').slice(0, 6)
                        : e.target.value;
                    setConfirmSecret(val);
                  }}
                  placeholder={selectedLockType === 'pin' ? 'Ketik ulang 6 digit PIN' : 'Ketik ulang password'}
                  className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733] text-xs font-medium text-[#17211d] dark:text-[#edf3f1] tabular-nums focus:outline-none focus:border-[#0f766e] dark:focus:border-[#14b8a6]"
                />
              </div>

              {lockFormError && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-[11px] text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{lockFormError}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={lockBusy}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#0f766e] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {lockBusy ? <Loader2 size={14} className="animate-spin" /> : null}
                  {lockBusy ? 'Menyimpan...' : 'Simpan Kunci'}
                </button>
                <button
                  type="button"
                  onClick={resetLockForm}
                  disabled={lockBusy}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733] text-[#17211d] dark:text-[#edf3f1] text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          {/* Disable App Lock Inline Form */}
          {lockFormMode === 'disable' && (
            <form onSubmit={handleDisableAppLock} className="p-3.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-3">
              <p className="text-xs font-medium text-rose-900 dark:text-rose-300 m-0">
                Masukkan {userProfile.appLockType === 'password' ? 'password' : 'PIN'} saat ini untuk menonaktifkan kunci aplikasi dan sidik jari.
              </p>

              <input
                type="password"
                inputMode={userProfile.appLockType === 'pin' ? 'numeric' : 'text'}
                maxLength={userProfile.appLockType === 'pin' ? 6 : 64}
                value={currentSecret}
                onChange={(e) => {
                  const val =
                    userProfile.appLockType === 'pin'
                      ? e.target.value.replace(/\D/g, '').slice(0, 6)
                      : e.target.value;
                  setCurrentSecret(val);
                }}
                placeholder={
                  userProfile.appLockType === 'password'
                    ? 'Masukkan password saat ini'
                    : 'Masukkan 6 digit PIN saat ini'
                }
                className="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#131c1a] border border-rose-200 dark:border-rose-900/60 text-xs font-medium text-[#17211d] dark:text-[#edf3f1] focus:outline-none focus:border-rose-500"
              />

              {lockFormError && (
                <div className="p-2 rounded-lg bg-white dark:bg-[#131c1a] border border-rose-200 dark:border-rose-900/60 text-[11px] text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{lockFormError}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={lockBusy}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#dc2626] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  {lockBusy ? 'Memproses...' : 'Ya, Nonaktifkan'}
                </button>
                <button
                  type="button"
                  onClick={resetLockForm}
                  disabled={lockBusy}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733] text-[#17211d] dark:text-[#edf3f1] text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Ekspor & Cadangan Data */}
      <div className="card space-y-3">
        <h2 className="text-sm font-bold text-[#17211d] dark:text-[#edf3f1]">Ekspor & Cadangkan Data</h2>

        <div className="space-y-2">
          {/* Monthly PDF Report */}
          <div className="p-3 rounded-xl border border-[#e1e7e4] dark:border-[#273733] space-y-2.5 bg-[#fcfdfd] dark:bg-[#1b2623]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 shrink-0">
                  <FileText size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#17211d] dark:text-[#edf3f1]">
                    Laporan Keuangan Bulanan (PDF)
                  </div>
                  <div className="text-[11px] text-[#6b7872] dark:text-[#95a5a0]">
                    Ringkasan pemasukan, pengeluaran, kategori, dan transaksi
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={pdfMonth}
                onChange={(e) => setPdfMonth(e.target.value)}
                aria-label="Pilih bulan laporan PDF"
                className="flex-1 min-w-[130px] bg-white dark:bg-[#131c1a] py-2 px-2.5 text-xs font-semibold border border-[#e1e7e4] dark:border-[#273733] rounded-xl text-[#17211d] dark:text-[#edf3f1]"
              >
                {availablePdfMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthYear(m)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => handleExportMonthlyPdf('download')}
                disabled={isBusy}
                className="px-3 py-2 min-h-[38px] rounded-xl bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <Download size={14} />
                Unduh PDF
              </button>
              <button
                type="button"
                onClick={() => handleExportMonthlyPdf('share')}
                disabled={isBusy}
                className="px-3 py-2 min-h-[38px] rounded-xl bg-[#f4f6f5] dark:bg-[#131c1a] hover:bg-[#e8eeec] dark:hover:bg-[#22302d] border border-[#e1e7e4] dark:border-[#273733] text-[#17211d] dark:text-[#edf3f1] text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <Share2 size={14} />
                Bagikan
              </button>
            </div>
          </div>

          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-[#e1e7e4] dark:border-[#273733] hover:bg-[#f4f6f5] dark:hover:bg-[#1b2623] transition text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400">
                <Download size={18} />
              </div>
              <div>
                <div className="text-xs font-bold text-[#17211d] dark:text-[#edf3f1]">
                  Ekspor Seluruh Transaksi ke CSV ({transactions.length})
                </div>
                <div className="text-[11px] text-[#6b7872] dark:text-[#95a5a0]">
                  Backup mandiri ke perangkat lokal untuk Excel atau Google Sheets
                </div>
              </div>
            </div>
          </button>

          {/* Backup JSON */}
          <button
            type="button"
            onClick={handleBackupJSON}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-[#e1e7e4] dark:border-[#273733] hover:bg-[#f4f6f5] dark:hover:bg-[#1b2623] transition text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-sky-950/50 text-blue-700 dark:text-sky-400">
                <Download size={18} />
              </div>
              <div>
                <div className="text-xs font-bold text-[#17211d] dark:text-[#edf3f1]">Cadangkan Data (JSON)</div>
                <div className="text-[11px] text-[#6b7872] dark:text-[#95a5a0]">
                  Simpan seluruh riwayat dan akun ke file cadangan
                </div>
              </div>
            </div>
          </button>

          {/* Restore JSON */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-[#e1e7e4] dark:border-[#273733] hover:bg-[#f4f6f5] dark:hover:bg-[#1b2623] transition text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400">
                <Upload size={18} />
              </div>
              <div>
                <div className="text-xs font-bold text-[#17211d] dark:text-[#edf3f1]">Pulihkan Data dari File</div>
                <div className="text-[11px] text-[#6b7872] dark:text-[#95a5a0]">
                  Impor file cadangan JSON yang pernah diunduh
                </div>
              </div>
            </div>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />
        </div>
      </div>

      {/* Manajemen & Reset */}
      <div className="card space-y-3">
        <h2 className="text-sm font-bold text-[#17211d] dark:text-[#edf3f1]">Opsi Data</h2>

        <div className="space-y-2">
          {/* Sample Data */}
          <button
            type="button"
            onClick={() => setConfirmAction('sample')}
            disabled={isBusy}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-[#e1e7e4] dark:border-[#273733] hover:bg-[#f4f6f5] dark:hover:bg-[#1b2623] transition text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-teal-50 dark:bg-[#102825] text-teal-700 dark:text-[#2dd4bf]">
                <RefreshCw size={18} />
              </div>
              <div>
                <div className="text-xs font-bold text-[#17211d] dark:text-[#edf3f1]">Muat Data Contoh Realistis</div>
                <div className="text-[11px] text-[#6b7872] dark:text-[#95a5a0]">
                  Isi data simulasi pemasukan & pengeluaran untuk melihat grafik
                </div>
              </div>
            </div>
          </button>

          {confirmAction === 'sample' && (
            <div className="p-3 rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] border border-[#e1e7e4] dark:border-[#273733] space-y-2 text-xs">
              <p className="text-[#17211d] dark:text-[#edf3f1] font-medium m-0">
                Muat data contoh? Data transaksi saat ini di database akan diganti dengan data simulasi.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={executeConfirmAction}
                  disabled={isBusy}
                  className="flex-1 py-2 px-3 rounded-lg bg-[#0f766e] text-white font-semibold cursor-pointer"
                >
                  Ya, Muat Contoh
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  disabled={isBusy}
                  className="flex-1 py-2 px-3 rounded-lg bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733] text-[#17211d] dark:text-[#edf3f1] font-semibold cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          {/* Reset All */}
          <button
            type="button"
            onClick={() => setConfirmAction('reset')}
            disabled={isBusy}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/30 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
                <Trash2 size={18} />
              </div>
              <div>
                <div className="text-xs font-bold text-rose-700 dark:text-rose-400">Hapus Seluruh Data</div>
                <div className="text-[11px] text-rose-600/80 dark:text-rose-400/80">
                  Kosongkan semua transaksi dan mulai dari nol
                </div>
              </div>
            </div>
          </button>

          {confirmAction === 'reset' && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 space-y-2 text-xs">
              <p className="text-rose-900 dark:text-rose-300 font-medium m-0">
                PERINGATAN: Yakin ingin menghapus seluruh transaksi di database? Tindakan ini tidak dapat dibatalkan.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={executeConfirmAction}
                  disabled={isBusy}
                  className="flex-1 py-2 px-3 rounded-lg bg-[#dc2626] text-white font-semibold cursor-pointer"
                >
                  Ya, Hapus Semua
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  disabled={isBusy}
                  className="flex-1 py-2 px-3 rounded-lg bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733] text-[#17211d] dark:text-[#edf3f1] font-semibold cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Keamanan & PWA Tips */}
      <div className="card space-y-2.5 bg-gradient-to-br from-teal-50/50 to-emerald-50/30 dark:from-[#102825] dark:to-[#131c1a] border-[#0f766e]/20 dark:border-[#2dd4bf]/20">
        <div className="flex items-center gap-2 text-xs font-bold text-[#0f766e] dark:text-[#2dd4bf]">
          <Shield size={16} />
          <span>Privasi & Keamanan Data</span>
        </div>
        <p className="text-xs text-[#6b7872] dark:text-[#95a5a0] leading-relaxed">
          Profil akun Google dan seluruh catatan keuangan Anda disimpan di database Cloud Firestore
          yang terproteksi aturan keamanan. Hanya akun Google Anda sendiri yang terverifikasi yang
          memiliki akses untuk membaca dan mengubah data keuangan Anda.
        </p>

        <div className="pt-2 border-t border-[#e1e7e4]/60 dark:border-[#22302d]">
          <div className="flex items-center gap-2 text-xs font-bold text-[#17211d] dark:text-[#edf3f1] mb-1">
            <Smartphone size={15} />
            <span>Pasang di Layar Utama (PWA)</span>
          </div>
          <p className="text-[11px] text-[#6b7872] dark:text-[#95a5a0] leading-relaxed">
            Untuk menggunakan aplikasi ini seperti aplikasi asli di ponsel Anda:
            buka menu browser (titik tiga di Chrome atau ikon bagikan di Safari iOS), lalu pilih{' '}
            <strong>"Tambahkan ke Layar Utama" (Add to Home Screen)</strong>.
          </p>
        </div>
      </div>
    </div>
  );
};
