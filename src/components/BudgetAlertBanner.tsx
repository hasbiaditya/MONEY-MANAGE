import React from 'react';
import { AlertTriangle, BellRing, ChevronRight, X } from 'lucide-react';
import { BudgetAlertLevel } from '../utils/budgetAlerts';

interface BudgetAlertBannerProps {
  level: BudgetAlertLevel;
  title: string;
  message: string;
  badgeText: string;
  actionLabel?: string;
  onDismiss: () => void;
  onAction: () => void;
}

export const BudgetAlertBanner: React.FC<BudgetAlertBannerProps> = ({
  level,
  title,
  message,
  badgeText,
  actionLabel = 'Atur Batas Anggaran',
  onDismiss,
  onAction,
}) => {
  if (level === 'none') return null;

  const isExceeded = level === 'exceeded';
  const isCritical90 = level === 'critical90';

  const containerStyle = isExceeded
    ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800/70 text-rose-900 dark:text-rose-100'
    : isCritical90
    ? 'bg-orange-50 dark:bg-orange-950/60 border-orange-200 dark:border-orange-800/70 text-orange-900 dark:text-orange-100'
    : 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/70 text-amber-900 dark:text-amber-100';

  const iconBgStyle = isExceeded
    ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
    : isCritical90
    ? 'bg-orange-100 dark:bg-orange-900/60 text-orange-700 dark:text-orange-300'
    : 'bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300';

  const badgeStyle = isExceeded
    ? 'bg-rose-600 text-white'
    : isCritical90
    ? 'bg-orange-600 text-white'
    : 'bg-amber-500 text-white';

  const actionStyle = isExceeded
    ? 'text-rose-700 dark:text-rose-300 hover:text-rose-900 dark:hover:text-rose-100'
    : isCritical90
    ? 'text-orange-700 dark:text-orange-300 hover:text-orange-900 dark:hover:text-orange-100'
    : 'text-amber-800 dark:text-amber-300 hover:text-amber-950 dark:hover:text-amber-100';

  return (
    <div
      role="alert"
      className={`mb-3 p-3.5 rounded-2xl border shadow-xs flex items-start gap-3 transition-all ${containerStyle}`}
    >
      <div className={`p-2 rounded-xl shrink-0 ${iconBgStyle}`}>
        {isExceeded ? <AlertTriangle size={18} /> : <BellRing size={18} />}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums ${badgeStyle}`}>
            {badgeText}
          </span>
          <span className="text-xs font-bold leading-snug">{title}</span>
        </div>
        <p className="text-[11px] leading-relaxed opacity-90 m-0 tabular-nums">
          {message}
        </p>
        <button
          type="button"
          onClick={onAction}
          className={`inline-flex items-center gap-0.5 text-[11px] font-bold pt-0.5 cursor-pointer ${actionStyle}`}
        >
          {actionLabel}
          <ChevronRight size={13} />
        </button>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Tutup notifikasi anggaran"
        title="Tutup peringatan ini"
        className="p-1.5 -mr-1 -mt-1 rounded-lg opacity-60 hover:opacity-100 transition cursor-pointer shrink-0"
      >
        <X size={15} />
      </button>
    </div>
  );
};
