import React, { useCallback, useEffect, useState } from 'react';
import { reauthenticateWithPopup, User } from 'firebase/auth';
import {
  AlertCircle,
  Delete,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  RotateCcw,
} from 'lucide-react';
import { googleProvider } from '../firebase';
import { UserProfile } from '../types/finance';
import {
  authenticateWithBiometric,
  hasRegisteredBiometric,
  isBiometricSupported,
  verifySecret,
} from '../utils/appSecurity';

interface AppLockScreenProps {
  firebaseUser: User;
  userProfile: UserProfile;
  onUnlock: () => void;
  onResetLockViaGoogle: () => Promise<void>;
  onLogout: () => Promise<void>;
}

const PIN_LENGTH = 6;
const MAX_FAILED_ATTEMPTS = 5;
const COOLDOWN_SECONDS = 15;

export const AppLockScreen: React.FC<AppLockScreenProps> = ({
  firebaseUser,
  userProfile,
  onUnlock,
  onResetLockViaGoogle,
  onLogout,
}) => {
  const lockType = userProfile.appLockType === 'password' ? 'password' : 'pin';
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [verifying, setVerifying] = useState(false);
  const [bioChecking, setBioChecking] = useState(false);
  const [reauthing, setReauthing] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [failedCount, setFailedCount] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const biometricReady =
    Boolean(userProfile.biometricEnabled) &&
    hasRegisteredBiometric(userProfile.uid) &&
    biometricAvailable;

  useEffect(() => {
    let active = true;
    isBiometricSupported().then((supported) => {
      if (active) setBiometricAvailable(supported);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownRemaining((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownRemaining]);

  const registerFailure = useCallback((baseMessage: string) => {
    setFailedCount((prev) => {
      const next = prev + 1;
      if (next >= MAX_FAILED_ATTEMPTS) {
        setCooldownRemaining(COOLDOWN_SECONDS);
        setErrorMsg(
          `Terlalu banyak percobaan gagal. Silakan tunggu ${COOLDOWN_SECONDS} detik atau gunakan sidik jari / verifikasi Google.`
        );
        return 0;
      }
      setErrorMsg(`${baseMessage} (${next}/${MAX_FAILED_ATTEMPTS})`);
      return next;
    });
  }, []);

  const verifyPinOrPassword = useCallback(
    async (secret: string) => {
      if (cooldownRemaining > 0 || verifying) return;
      if (!secret) {
        setErrorMsg(lockType === 'pin' ? 'Masukkan 6 digit PIN Anda.' : 'Masukkan password Anda.');
        return;
      }

      setVerifying(true);
      setErrorMsg(null);
      try {
        const isMatch = await verifySecret(
          secret,
          userProfile.appLockSalt || '',
          userProfile.appLockHash || ''
        );

        if (isMatch) {
          setPin('');
          setPassword('');
          setFailedCount(0);
          onUnlock();
        } else {
          if (lockType === 'pin') {
            setPin('');
          }
          registerFailure(lockType === 'pin' ? 'PIN salah. Coba lagi.' : 'Password salah. Coba lagi.');
        }
      } catch {
        setErrorMsg('Gagal memverifikasi kunci aplikasi.');
      } finally {
        setVerifying(false);
      }
    },
    [
      cooldownRemaining,
      lockType,
      onUnlock,
      registerFailure,
      userProfile.appLockHash,
      userProfile.appLockSalt,
      verifying,
    ]
  );

  const handleDigitPress = useCallback(
    (digit: string) => {
      if (lockType !== 'pin' || cooldownRemaining > 0 || verifying) return;
      setErrorMsg(null);
      setPin((prev) => {
        if (prev.length >= PIN_LENGTH) return prev;
        const next = prev + digit;
        if (next.length === PIN_LENGTH) {
          window.setTimeout(() => {
            verifyPinOrPassword(next);
          }, 80);
        }
        return next;
      });
    },
    [cooldownRemaining, lockType, verifyPinOrPassword, verifying]
  );

  const handleBackspace = useCallback(() => {
    if (lockType !== 'pin' || verifying) return;
    setErrorMsg(null);
    setPin((prev) => prev.slice(0, -1));
  }, [lockType, verifying]);

  const handleClearPin = useCallback(() => {
    if (lockType !== 'pin' || verifying) return;
    setErrorMsg(null);
    setPin('');
  }, [lockType, verifying]);

  // Keyboard support for PIN entry
  useEffect(() => {
    if (lockType !== 'pin') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        handleDigitPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Escape') {
        handleClearPin();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleBackspace, handleClearPin, handleDigitPress, lockType]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyPinOrPassword(password);
  };

  const handleBiometricUnlock = async () => {
    if (bioChecking || verifying) return;
    setBioChecking(true);
    setErrorMsg(null);
    try {
      const result = await authenticateWithBiometric(userProfile.uid);
      if (result.ok) {
        setPin('');
        setPassword('');
        setFailedCount(0);
        setCooldownRemaining(0);
        onUnlock();
      } else {
        setErrorMsg(result.errorMessage || 'Autentikasi sidik jari gagal.');
      }
    } finally {
      setBioChecking(false);
    }
  };

  const handleGoogleRecovery = async () => {
    if (reauthing) return;
    setReauthing(true);
    setErrorMsg(null);
    try {
      const cred = await reauthenticateWithPopup(firebaseUser, googleProvider);
      if (cred.user.uid !== userProfile.uid) {
        setErrorMsg('Akun Google yang dipilih tidak cocok dengan akun yang sedang masuk.');
        return;
      }
      await onResetLockViaGoogle();
      setShowResetConfirm(false);
    } catch {
      setErrorMsg('Verifikasi Google dibatalkan atau gagal. Silakan coba lagi.');
    } finally {
      setReauthing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center px-4 py-6">
      <div className="w-full max-w-[400px] space-y-5">
        {/* User & Lock Header */}
        <div className="text-center space-y-2.5">
          <div className="relative inline-flex items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-[#ccfbf1] dark:bg-[#102825] border-2 border-white dark:border-[#22302d] shadow-sm overflow-hidden flex items-center justify-center">
              {userProfile.photoURL ? (
                <img
                  src={userProfile.photoURL}
                  alt={userProfile.displayName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl font-bold text-[#0f766e] dark:text-[#2dd4bf]">
                  {userProfile.displayName.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-xl bg-[#0f766e] text-white flex items-center justify-center shadow-sm border-2 border-[var(--bg)]">
              <Lock size={13} />
            </div>
          </div>

          <div>
            <h1 className="text-lg font-bold text-[#17211d] dark:text-[#edf3f1] m-0">
              {lockType === 'pin' ? 'Masukkan PIN Aplikasi' : 'Masukkan Password Aplikasi'}
            </h1>
            <p className="text-xs text-[#6b7872] dark:text-[#95a5a0] mt-0.5 truncate">
              {userProfile.displayName} • {userProfile.email}
            </p>
          </div>
        </div>

        {/* Main Unlock Card */}
        <div className="card !p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {cooldownRemaining > 0 && (
            <div className="text-center text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl py-2 px-3 tabular-nums">
              Tunggu {cooldownRemaining} detik sebelum mencoba PIN/Password lagi
            </div>
          )}

          {lockType === 'pin' ? (
            <div className="space-y-5">
              {/* 6-Dot PIN Indicator */}
              <div className="flex items-center justify-center gap-3.5 py-2" aria-label="Indikator 6 digit PIN">
                {Array.from({ length: PIN_LENGTH }).map((_, index) => {
                  const isFilled = index < pin.length;
                  return (
                    <div
                      key={index}
                      className={`w-4 h-4 rounded-full transition-all duration-150 ${
                        isFilled
                          ? 'bg-[#0f766e] dark:bg-[#2dd4bf] scale-110 shadow-xs'
                          : 'bg-[#f4f6f5] dark:bg-[#1b2623] border-2 border-[#cbd5d1] dark:border-[#2c3d39]'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2.5 max-w-[280px] mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleDigitPress(digit)}
                    disabled={cooldownRemaining > 0 || verifying}
                    className="h-14 rounded-2xl bg-[#f4f6f5] dark:bg-[#1b2623] hover:bg-[#e8eeec] dark:hover:bg-[#22302d] active:scale-95 text-lg font-bold text-[#17211d] dark:text-[#edf3f1] tabular-nums transition flex items-center justify-center cursor-pointer disabled:opacity-50"
                  >
                    {digit}
                  </button>
                ))}

                {/* Bottom Left: Fingerprint shortcut or Clear */}
                {biometricReady ? (
                  <button
                    type="button"
                    onClick={handleBiometricUnlock}
                    disabled={bioChecking || verifying}
                    title="Buka dengan Sidik Jari"
                    aria-label="Buka dengan Sidik Jari"
                    className="h-14 rounded-2xl bg-[#ccfbf1]/70 dark:bg-[#102825] hover:bg-[#ccfbf1] dark:hover:bg-[#163834] active:scale-95 text-[#0f766e] dark:text-[#2dd4bf] transition flex items-center justify-center cursor-pointer disabled:opacity-50"
                  >
                    {bioChecking ? <Loader2 size={22} className="animate-spin" /> : <Fingerprint size={24} />}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleClearPin}
                    disabled={pin.length === 0 || verifying}
                    title="Bersihkan PIN"
                    aria-label="Bersihkan PIN"
                    className="h-14 rounded-2xl bg-[#f4f6f5] dark:bg-[#1b2623] hover:bg-[#e8eeec] dark:hover:bg-[#22302d] active:scale-95 text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0] transition flex items-center justify-center cursor-pointer disabled:opacity-40"
                  >
                    Hapus
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleDigitPress('0')}
                  disabled={cooldownRemaining > 0 || verifying}
                  className="h-14 rounded-2xl bg-[#f4f6f5] dark:bg-[#1b2623] hover:bg-[#e8eeec] dark:hover:bg-[#22302d] active:scale-95 text-lg font-bold text-[#17211d] dark:text-[#edf3f1] tabular-nums transition flex items-center justify-center cursor-pointer disabled:opacity-50"
                >
                  0
                </button>

                <button
                  type="button"
                  onClick={handleBackspace}
                  disabled={pin.length === 0 || verifying}
                  title="Hapus satu digit"
                  aria-label="Hapus satu digit"
                  className="h-14 rounded-2xl bg-[#f4f6f5] dark:bg-[#1b2623] hover:bg-[#e8eeec] dark:hover:bg-[#22302d] active:scale-95 text-[#6b7872] dark:text-[#95a5a0] transition flex items-center justify-center cursor-pointer disabled:opacity-40"
                >
                  <Delete size={20} />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0] block mb-1.5">
                  Password Aplikasi
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7872] dark:text-[#95a5a0]">
                    <KeyRound size={16} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMsg(null);
                    }}
                    placeholder="Masukkan password Anda..."
                    autoFocus
                    disabled={cooldownRemaining > 0 || verifying}
                    className="w-full pl-10 pr-11 py-3 rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] border border-[#e1e7e4] dark:border-[#273733] text-sm font-medium text-[#17211d] dark:text-[#edf3f1] focus:outline-none focus:border-[#0f766e] dark:focus:border-[#14b8a6]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#6b7872] dark:text-[#95a5a0] hover:text-[#17211d] dark:hover:text-[#edf3f1] cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={!password || cooldownRemaining > 0 || verifying}
                className="w-full py-3.5 px-4 min-h-[46px] rounded-xl bg-[#0f766e] hover:bg-[#115e59] text-white text-sm font-semibold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
              >
                {verifying ? (
                  <>
                    <Loader2 size={17} className="animate-spin" />
                    Memverifikasi...
                  </>
                ) : (
                  'Buka Aplikasi'
                )}
              </button>
            </form>
          )}

          {/* Prominent Fingerprint Action Button when enabled */}
          {biometricReady && (
            <button
              type="button"
              onClick={handleBiometricUnlock}
              disabled={bioChecking || verifying}
              className="w-full py-3 px-4 min-h-[44px] rounded-xl bg-teal-50 dark:bg-[#102825] hover:bg-[#ccfbf1] dark:hover:bg-[#163834] border border-[#0f766e]/25 dark:border-[#2dd4bf]/30 text-[#0f766e] dark:text-[#2dd4bf] text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
            >
              {bioChecking ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Menunggu sensor sidik jari...
                </>
              ) : (
                <>
                  <Fingerprint size={18} />
                  Buka dengan Sidik Jari (Fingerprint)
                </>
              )}
            </button>
          )}

          {userProfile.biometricEnabled && !hasRegisteredBiometric(userProfile.uid) && (
            <p className="text-[11px] text-[#6b7872] dark:text-[#95a5a0] text-center leading-relaxed m-0">
              Sidik jari belum terdaftar di browser/perangkat ini. Buka dengan {lockType === 'pin' ? 'PIN' : 'Password'} lalu aktifkan ulang di Pengaturan.
            </p>
          )}
        </div>

        {/* Recovery & Logout Actions */}
        <div className="space-y-2.5 text-center">
          {!showResetConfirm ? (
            <div className="flex items-center justify-center gap-4 text-xs">
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="text-[#0f766e] dark:text-[#2dd4bf] font-semibold hover:underline inline-flex items-center gap-1 py-2 cursor-pointer"
              >
                <RotateCcw size={13} />
                Lupa {lockType === 'pin' ? 'PIN' : 'Password'}?
              </button>
              <span className="text-[#cbd5d1] dark:text-[#2c3d39]">•</span>
              <button
                type="button"
                onClick={onLogout}
                className="text-[#6b7872] dark:text-[#95a5a0] hover:text-rose-700 dark:hover:text-rose-400 font-semibold inline-flex items-center gap-1 py-2 cursor-pointer"
              >
                <LogOut size={13} />
                Keluar Akun
              </button>
            </div>
          ) : (
            <div className="card !p-3.5 text-left space-y-2.5 border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/40">
              <p className="text-xs text-[#17211d] dark:text-[#edf3f1] font-medium m-0 leading-relaxed">
                Verifikasi ulang akun Google Anda ({userProfile.email}) untuk membuka aplikasi dan menonaktifkan kunci sementara.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGoogleRecovery}
                  disabled={reauthing}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#0f766e] text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {reauthing ? <Loader2 size={14} className="animate-spin" /> : null}
                  {reauthing ? 'Memverifikasi...' : 'Verifikasi Google'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(false)}
                  disabled={reauthing}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733] text-[#17211d] dark:text-[#edf3f1] text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
