import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, Clock, Calendar, ArrowRight, X, Sparkles } from 'lucide-react';
import {
  formatRupiah,
  formatRibuan,
  formatDateFull,
  getTodayDateString,
} from '../utils/formatters';
import {
  simulateByMonths,
  simulateByDeadline,
  simulateBySavingCapacity,
} from '../utils/goalSimulation';

export interface SimulatorInitialValues {
  name?: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
}

interface GoalSimulatorCardProps {
  initialValues?: SimulatorInitialValues | null;
  onClose?: () => void;
  onApplyToNewGoal: (values: {
    name?: string;
    targetAmount: number;
    currentAmount: number;
    deadline: string;
  }) => void;
}

const TARGET_PRESETS = [5_000_000, 10_000_000, 25_000_000, 50_000_000, 100_000_000];
const MONTH_PRESETS = [3, 6, 12, 24, 36];

export const GoalSimulatorCard: React.FC<GoalSimulatorCardProps> = ({
  initialValues,
  onClose,
  onApplyToNewGoal,
}) => {
  const [simMode, setSimMode] = useState<'byTime' | 'byCapacity'>('byTime');
  const [timeBasis, setTimeBasis] = useState<'months' | 'date'>('months');

  const [targetInput, setTargetInput] = useState<string>(
    String(initialValues?.targetAmount || 10_000_000)
  );
  const [currentInput, setCurrentInput] = useState<string>(
    String(initialValues?.currentAmount || 0)
  );
  const [durationMonths, setDurationMonths] = useState<number>(12);
  const [customDate, setCustomDate] = useState<string>(initialValues?.deadline || '');

  const [capacityInput, setCapacityInput] = useState<string>('500000');
  const [capacityFrequency, setCapacityFrequency] = useState<'daily' | 'weekly' | 'monthly'>(
    'monthly'
  );

  // Sync if user clicks "Simulasi" on a specific goal card
  useEffect(() => {
    if (!initialValues) return;
    setTargetInput(String(initialValues.targetAmount));
    setCurrentInput(String(initialValues.currentAmount));
    if (initialValues.deadline) {
      setTimeBasis('date');
      setCustomDate(initialValues.deadline);
    } else {
      setTimeBasis('months');
      setCustomDate('');
    }
  }, [initialValues]);

  const targetAmount = parseInt(targetInput || '0', 10) || 0;
  const currentAmount = parseInt(currentInput || '0', 10) || 0;
  const remaining = Math.max(0, targetAmount - currentAmount);
  const savingCapacity = parseInt(capacityInput || '0', 10) || 0;

  const timeSimulation = useMemo(() => {
    if (targetAmount <= 0) return null;
    if (timeBasis === 'date' && customDate) {
      return simulateByDeadline(targetAmount, currentAmount, customDate);
    }
    return simulateByMonths(targetAmount, currentAmount, durationMonths);
  }, [targetAmount, currentAmount, timeBasis, customDate, durationMonths]);

  const quickComparisons = useMemo(() => {
    if (targetAmount <= 0) return [];
    return [3, 6, 12, 24].map((m) => simulateByMonths(targetAmount, currentAmount, m));
  }, [targetAmount, currentAmount]);

  const capacitySimulation = useMemo(() => {
    if (targetAmount <= 0 || savingCapacity <= 0) return null;
    return simulateBySavingCapacity(
      targetAmount,
      currentAmount,
      savingCapacity,
      capacityFrequency
    );
  }, [targetAmount, currentAmount, savingCapacity, capacityFrequency]);

  const suggestedDeadline =
    simMode === 'byTime'
      ? timeSimulation?.targetDateStr || ''
      : capacitySimulation?.estimatedDateStr || '';

  return (
    <div className="card !mb-0 !p-4 border-[#0f766e]/30 dark:border-[#2dd4bf]/25 bg-white dark:bg-[#131c1a] space-y-3.5">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#17211d] dark:text-[#edf3f1] flex items-center gap-1.5">
            <Calculator size={16} className="text-[#0f766e] dark:text-[#2dd4bf] shrink-0" />
            <span className="truncate">
              {initialValues?.name
                ? `Simulasi: ${initialValues.name}`
                : 'Simulasi Target Tabungan'}
            </span>
          </h3>
          <p className="text-xs text-[#6b7872] dark:text-[#95a5a0] mt-0.5">
            Hitung kebutuhan tabungan harian, mingguan, atau bulanan sesuai nominal target Anda.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup simulasi"
            className="p-2 min-w-[36px] min-h-[36px] rounded-xl text-[#6b7872] dark:text-[#95a5a0] hover:bg-[#f4f6f5] dark:hover:bg-[#1d2a27] hover:text-[#17211d] dark:hover:text-[#edf3f1] flex items-center justify-center cursor-pointer"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Mode Switcher */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] border border-[#e1e7e4] dark:border-[#273733]">
        <button
          type="button"
          onClick={() => setSimMode('byTime')}
          className={`min-h-[38px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
            simMode === 'byTime'
              ? 'bg-white dark:bg-[#131c1a] text-[#0f766e] dark:text-[#2dd4bf] shadow-xs'
              : 'text-[#6b7872] dark:text-[#95a5a0] hover:text-[#17211d] dark:hover:text-[#edf3f1]'
          }`}
        >
          <Calendar size={14} />
          Hitung Setoran
        </button>
        <button
          type="button"
          onClick={() => setSimMode('byCapacity')}
          className={`min-h-[38px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer whitespace-nowrap ${
            simMode === 'byCapacity'
              ? 'bg-white dark:bg-[#131c1a] text-[#0f766e] dark:text-[#2dd4bf] shadow-xs'
              : 'text-[#6b7872] dark:text-[#95a5a0] hover:text-[#17211d] dark:hover:text-[#edf3f1]'
          }`}
        >
          <Clock size={14} />
          Hitung Durasi
        </button>
      </div>

      {/* Target & Current Inputs */}
      <div className="space-y-2.5">
        <div>
          <label className="block text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0] mb-1">
            Nominal Target yang Diinginkan (Rp)
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-[#0f766e] dark:text-[#2dd4bf] pointer-events-none select-none">
              Rp
            </span>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Contoh: 10.000.000"
              value={targetInput ? formatRibuan(targetInput) : ''}
              onChange={(e) => {
                const clean = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
                setTargetInput(clean);
              }}
              className="w-full pl-10 pr-3 py-2 bg-white dark:bg-[#1b2623] text-[#17211d] dark:text-[#edf3f1] text-base font-bold tabular-nums border border-[#e1e7e4] dark:border-[#273733] rounded-xl focus:border-[#0f766e] dark:focus:border-[#14b8a6]"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {TARGET_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTargetInput(String(preset))}
                className={`px-2.5 py-1 text-[11px] rounded-lg border font-medium transition cursor-pointer tabular-nums ${
                  targetAmount === preset
                    ? 'border-[#0f766e] dark:border-[#2dd4bf] bg-[#ccfbf1]/50 dark:bg-[#102825] text-[#0f766e] dark:text-[#2dd4bf] font-semibold'
                    : 'border-[#e1e7e4] dark:border-[#273733] bg-[#f4f6f5] dark:bg-[#1b2623] text-[#17211d] dark:text-[#edf3f1] hover:bg-[#e8eeec] dark:hover:bg-[#22302d]'
                }`}
              >
                {formatRupiah(preset)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0] mb-1">
              Sudah Terkumpul (Rp)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#0f766e] dark:text-[#2dd4bf] pointer-events-none select-none">
                Rp
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0"
                value={currentInput && currentInput !== '0' ? formatRibuan(currentInput) : ''}
                onChange={(e) => {
                  const clean = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
                  setCurrentInput(clean || '0');
                }}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#1b2623] text-[#17211d] dark:text-[#edf3f1] text-sm font-bold tabular-nums border border-[#e1e7e4] dark:border-[#273733] rounded-xl focus:border-[#0f766e] dark:focus:border-[#14b8a6]"
              />
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] border border-[#e1e7e4] dark:border-[#273733] flex flex-col justify-center">
            <span className="text-[11px] text-[#6b7872] dark:text-[#95a5a0]">Sisa yang Perlu Ditabung</span>
            <strong className="text-sm font-bold text-[#17211d] dark:text-[#edf3f1] tabular-nums">
              {formatRupiah(remaining)}
            </strong>
          </div>
        </div>
      </div>

      {/* Mode 1: By Time / Deadline */}
      {simMode === 'byTime' ? (
        <div className="space-y-3 pt-1 border-t border-[#e1e7e4] dark:border-[#22302d]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#17211d] dark:text-[#edf3f1]">Pilih Jangka Waktu</span>
            <div className="flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => setTimeBasis('months')}
                className={`px-2 py-1 rounded-lg font-semibold cursor-pointer transition ${
                  timeBasis === 'months'
                    ? 'bg-[#0f766e] text-white'
                    : 'bg-[#f4f6f5] dark:bg-[#1b2623] text-[#6b7872] dark:text-[#95a5a0]'
                }`}
              >
                Durasi Bulan
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimeBasis('date');
                  if (!customDate && timeSimulation?.targetDateStr) {
                    setCustomDate(timeSimulation.targetDateStr);
                  }
                }}
                className={`px-2 py-1 rounded-lg font-semibold cursor-pointer transition ${
                  timeBasis === 'date'
                    ? 'bg-[#0f766e] text-white'
                    : 'bg-[#f4f6f5] dark:bg-[#1b2623] text-[#6b7872] dark:text-[#95a5a0]'
                }`}
              >
                Tanggal Target
              </button>
            </div>
          </div>

          {timeBasis === 'months' ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {MONTH_PRESETS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDurationMonths(m)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer tabular-nums ${
                      durationMonths === m
                        ? 'bg-[#0f766e] border-[#0f766e] text-white'
                        : 'bg-white dark:bg-[#1b2623] border-[#e1e7e4] dark:border-[#273733] text-[#17211d] dark:text-[#edf3f1] hover:bg-[#f4f6f5] dark:hover:bg-[#22302d]'
                    }`}
                  >
                    {m} Bln
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={60}
                  value={durationMonths}
                  onChange={(e) => setDurationMonths(Number(e.target.value))}
                  aria-label="Durasi target tabungan dalam bulan"
                  className="flex-1 accent-[#0f766e] dark:accent-[#2dd4bf] !p-0 !border-0 !bg-transparent cursor-pointer"
                />
                <span className="text-xs font-bold text-[#0f766e] dark:text-[#2dd4bf] tabular-nums shrink-0 min-w-[64px] text-right">
                  {durationMonths} bulan
                </span>
              </div>
            </div>
          ) : (
            <div>
              <input
                type="date"
                min={getTodayDateString()}
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="bg-white dark:bg-[#1b2623] text-[#17211d] dark:text-[#edf3f1] text-sm"
              />
            </div>
          )}

          {/* Simulation Result Breakdown */}
          {targetAmount <= 0 ? (
            <div className="p-3 rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] text-xs text-[#6b7872] dark:text-[#95a5a0] text-center">
              Masukkan nominal target tabungan untuk melihat hasil simulasi.
            </div>
          ) : remaining === 0 ? (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
              Saldo terkumpul Anda sudah memenuhi atau melebihi nominal target!
            </div>
          ) : timeSimulation ? (
            <div className="space-y-2.5">
              {timeSimulation.isDeadlinePassed && (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-300">
                  Tanggal target sudah lewat atau hari ini. Pilih tanggal di masa depan untuk estimasi bertahap.
                </div>
              )}

              <div className="p-3 rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] border border-[#e1e7e4] dark:border-[#273733] space-y-2">
                <div className="flex items-center justify-between text-xs text-[#6b7872] dark:text-[#95a5a0]">
                  <span>Estimasi Setoran Wajib</span>
                  <span className="tabular-nums font-semibold text-[#17211d] dark:text-[#edf3f1]">
                    {timeSimulation.days} hari · target {formatDateFull(timeSimulation.targetDateStr)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733] text-center">
                    <div className="text-[11px] text-[#6b7872] dark:text-[#95a5a0]">Per Hari</div>
                    <div className="text-xs sm:text-sm font-bold text-[#0f766e] dark:text-[#2dd4bf] tabular-nums mt-0.5 truncate">
                      {formatRupiah(timeSimulation.perDay)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#131c1a] border border-[#e1e7e4] dark:border-[#273733] text-center">
                    <div className="text-[11px] text-[#6b7872] dark:text-[#95a5a0]">Per Minggu</div>
                    <div className="text-xs sm:text-sm font-bold text-[#0f766e] dark:text-[#2dd4bf] tabular-nums mt-0.5 truncate">
                      {formatRupiah(timeSimulation.perWeek)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-[#131c1a] border border-[#0f766e]/40 dark:border-[#2dd4bf]/40 text-center">
                    <div className="text-[11px] text-[#6b7872] dark:text-[#95a5a0]">Per Bulan</div>
                    <div className="text-xs sm:text-sm font-bold text-[#17211d] dark:text-[#edf3f1] tabular-nums mt-0.5 truncate">
                      {formatRupiah(timeSimulation.perMonth)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Duration Comparison Table */}
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-[#6b7872] dark:text-[#95a5a0]">
                  Perbandingan Opsi Durasi untuk {formatRupiah(targetAmount)}
                </div>
                <div className="rounded-xl border border-[#e1e7e4] dark:border-[#273733] divide-y divide-[#e1e7e4] dark:divide-[#273733] overflow-hidden bg-white dark:bg-[#1b2623]">
                  {quickComparisons.map((item) => (
                    <button
                      key={item.months}
                      type="button"
                      onClick={() => {
                        setTimeBasis('months');
                        setDurationMonths(item.months);
                      }}
                      className={`w-full px-3 py-2 flex items-center justify-between text-xs transition cursor-pointer hover:bg-[#f4f6f5] dark:hover:bg-[#22302d] ${
                        timeBasis === 'months' && durationMonths === item.months
                          ? 'bg-[#ccfbf1]/35 dark:bg-[#102825] font-semibold'
                          : ''
                      }`}
                    >
                      <span className="text-[#17211d] dark:text-[#edf3f1] tabular-nums">{item.months} Bulan</span>
                      <span className="text-[#6b7872] dark:text-[#95a5a0] tabular-nums">
                        {formatRupiah(item.perDay)}/hari
                      </span>
                      <span className="text-[#0f766e] dark:text-[#2dd4bf] font-bold tabular-nums">
                        {formatRupiah(item.perMonth)}/bln
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        /* Mode 2: By Saving Capacity */
        <div className="space-y-3 pt-1 border-t border-[#e1e7e4] dark:border-[#22302d]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0] mb-1">
                Kemampuan Menabung (Rp)
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#0f766e] dark:text-[#2dd4bf] pointer-events-none select-none">
                  Rp
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="500.000"
                  value={capacityInput ? formatRibuan(capacityInput) : ''}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
                    setCapacityInput(clean);
                  }}
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#1b2623] text-[#17211d] dark:text-[#edf3f1] text-sm font-bold tabular-nums border border-[#e1e7e4] dark:border-[#273733] rounded-xl focus:border-[#0f766e] dark:focus:border-[#14b8a6]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6b7872] dark:text-[#95a5a0] mb-1">
                Frekuensi Setoran
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-[#f4f6f5] dark:bg-[#1b2623] rounded-xl border border-[#e1e7e4] dark:border-[#273733]">
                {[
                  { id: 'daily', label: 'Hari' },
                  { id: 'weekly', label: 'Minggu' },
                  { id: 'monthly', label: 'Bulan' },
                ].map((freq) => (
                  <button
                    key={freq.id}
                    type="button"
                    onClick={() =>
                      setCapacityFrequency(freq.id as 'daily' | 'weekly' | 'monthly')
                    }
                    className={`py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      capacityFrequency === freq.id
                        ? 'bg-white dark:bg-[#131c1a] text-[#0f766e] dark:text-[#2dd4bf] shadow-xs'
                        : 'text-[#6b7872] dark:text-[#95a5a0]'
                    }`}
                  >
                    {freq.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {capacitySimulation ? (
            remaining === 0 ? (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                Target tabungan sudah tercapai!
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] border border-[#e1e7e4] dark:border-[#273733] space-y-1.5">
                <div className="text-xs text-[#6b7872] dark:text-[#95a5a0]">
                  Dengan menabung{' '}
                  <strong className="text-[#17211d] dark:text-[#edf3f1] tabular-nums">
                    {formatRupiah(savingCapacity)}
                  </strong>{' '}
                  per{' '}
                  {capacityFrequency === 'daily'
                    ? 'hari'
                    : capacityFrequency === 'weekly'
                    ? 'minggu'
                    : 'bulan'}
                  :
                </div>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-base font-bold text-[#0f766e] dark:text-[#2dd4bf] tabular-nums">
                    {capacitySimulation.periodsNeeded.toLocaleString('id-ID')}{' '}
                    {capacityFrequency === 'daily'
                      ? 'hari'
                      : capacityFrequency === 'weekly'
                      ? 'minggu'
                      : 'bulan'}
                    {capacityFrequency !== 'monthly' &&
                      capacitySimulation.estimatedMonths >= 1 && (
                        <span className="text-xs font-medium text-[#6b7872] dark:text-[#95a5a0] ml-1.5">
                          (±{capacitySimulation.estimatedMonths.toLocaleString('id-ID')} bulan)
                        </span>
                      )}
                  </div>
                  <div className="text-xs font-semibold text-[#17211d] dark:text-[#edf3f1]">
                    {capacitySimulation.isHorizonTooLong || !capacitySimulation.estimatedDateStr
                      ? 'Lebih dari 100 tahun — naikkan nominal setoran'
                      : `Tercapai: ${formatDateFull(capacitySimulation.estimatedDateStr)}`}
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="p-3 rounded-xl bg-[#f4f6f5] dark:bg-[#1b2623] text-xs text-[#6b7872] dark:text-[#95a5a0] text-center">
              Masukkan nominal target dan kemampuan menabung untuk melihat estimasi waktu.
            </div>
          )}
        </div>
      )}

      {/* Apply to New Goal Button */}
      {targetAmount > 0 && (
        <button
          type="button"
          onClick={() =>
            onApplyToNewGoal({
              name: initialValues?.name,
              targetAmount,
              currentAmount,
              deadline: suggestedDeadline,
            })
          }
          className="w-full py-2.5 px-3 rounded-xl bg-[#0f766e] hover:bg-[#115e59] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
        >
          <Sparkles size={14} />
          Jadikan Target Tabungan
          <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
};
