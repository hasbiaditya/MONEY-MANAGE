import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { Wallet, ShieldCheck, Cloud, Loader2, AlertCircle, Moon, Sun } from 'lucide-react';
import { auth, googleProvider } from '../firebase';

interface LoginViewProps {
  externalError?: string | null;
  isDark?: boolean;
  onToggleDark?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  externalError,
  isDark = false,
  onToggleDark,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: unknown) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: string }).code)
          : '';

      if (code === 'auth/popup-closed-by-user') {
        setErrorMessage('Jendela login Google ditutup sebelum selesai. Silakan coba lagi.');
      } else if (code === 'auth/popup-blocked') {
        setErrorMessage('Pop-up login diblokir oleh browser. Izinkan pop-up lalu coba kembali.');
      } else if (code === 'auth/network-request-failed') {
        setErrorMessage('Koneksi internet terputus. Periksa jaringan Anda lalu coba lagi.');
      } else {
        setErrorMessage('Gagal masuk dengan akun Google. Silakan coba beberapa saat lagi.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const displayedError = errorMessage || externalError;

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--tx)] flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-[440px] space-y-4">
        {/* Hero Brand Card */}
        <div className="card hero shadow-md text-center !py-8 !px-6 relative overflow-hidden">
          {onToggleDark && (
            <button
              type="button"
              onClick={onToggleDark}
              aria-label={isDark ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
              title={isDark ? 'Mode Terang' : 'Mode Gelap'}
              className="absolute top-3.5 right-3.5 w-9 h-9 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white flex items-center justify-center transition cursor-pointer z-10"
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          )}
          <div className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full bg-white/5 pointer-events-none" />
          <div className="mx-auto w-14 h-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center mb-4">
            <Wallet size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white m-0 tracking-tight">Catatan Keuangan</h1>
          <p className="text-sm text-teal-100 mt-1.5 leading-relaxed">
            Catat pemasukan, pantau pengeluaran, dan kelola dompet Anda secara aman.
          </p>
        </div>

        {/* Sign-in Action Card */}
        <div className="card !p-6 space-y-5">
          <div className="space-y-1.5 text-center">
            <h2 className="text-base font-bold text-[#17211d] dark:text-[#edf3f1]">Masuk ke Akun Anda</h2>
            <p className="text-xs text-[#6b7872] dark:text-[#95a5a0] leading-relaxed">
              Gunakan akun Google Anda agar profil, dompet, anggaran, dan riwayat transaksi tersimpan aman di database aplikasi.
            </p>
          </div>

          {displayedError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
              <span>{displayedError}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-white dark:bg-[#1b2623] border-2 border-[#e1e7e4] dark:border-[#273733] hover:border-[#0f766e] dark:hover:border-[#2dd4bf] hover:bg-[#f4f6f5] dark:hover:bg-[#22302d] text-[#17211d] dark:text-[#edf3f1] font-semibold text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-xs"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin text-[#0f766e] dark:text-[#2dd4bf]" />
                <span>Menghubungkan ke Google...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Masuk dengan Google</span>
              </>
            )}
          </button>

          <div className="pt-3 border-t border-[#e1e7e4] dark:border-[#22302d] space-y-2 text-xs text-[#6b7872] dark:text-[#95a5a0]">
            <div className="flex items-start gap-2">
              <Cloud size={15} className="text-[#0f766e] dark:text-[#2dd4bf] shrink-0 mt-0.5" />
              <span>Data transaksi dan dompet tersinkronisasi otomatis ke database cloud.</span>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck size={15} className="text-[#0f766e] dark:text-[#2dd4bf] shrink-0 mt-0.5" />
              <span>Akses data terisolasi penuh — hanya akun Anda yang dapat melihat catatan Anda.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
