import React from 'react';
import {
  Utensils,
  Car,
  ShoppingCart,
  Zap,
  Coffee,
  HeartPulse,
  BookOpen,
  HeartHandshake,
  Shirt,
  MoreHorizontal,
  Briefcase,
  Gift,
  Store,
  Laptop,
  TrendingUp,
  Wallet,
  PlusCircle,
  ArrowRightLeft,
  DollarSign,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Utensils,
  Car,
  ShoppingCart,
  Zap,
  Coffee,
  HeartPulse,
  BookOpen,
  HeartHandshake,
  Shirt,
  MoreHorizontal,
  Briefcase,
  Gift,
  Store,
  Laptop,
  TrendingUp,
  Wallet,
  PlusCircle,
  ArrowRightLeft,
  DollarSign,
};

// Map category name to icon if needed
export function getCategoryIconName(categoryName: string, type?: string): string {
  if (type === 'transfer' || categoryName === 'Transfer Saldo') return 'ArrowRightLeft';
  const lower = categoryName.toLowerCase();
  if (lower.includes('makan') || lower.includes('minum') || lower.includes('food')) return 'Utensils';
  if (lower.includes('trans') || lower.includes('bensin') || lower.includes('ojek') || lower.includes('motor')) return 'Car';
  if (lower.includes('belanja') || lower.includes('grocer')) return 'ShoppingCart';
  if (lower.includes('listrik') || lower.includes('pulsa') || lower.includes('tagih') || lower.includes('air')) return 'Zap';
  if (lower.includes('kafe') || lower.includes('kopi') || lower.includes('hiburan')) return 'Coffee';
  if (lower.includes('sehat') || lower.includes('obat') || lower.includes('dokter')) return 'HeartPulse';
  if (lower.includes('didik') || lower.includes('buku') || lower.includes('sekolah') || lower.includes('kuliah')) return 'BookOpen';
  if (lower.includes('sedekah') || lower.includes('zakat') || lower.includes('amal') || lower.includes('donasi')) return 'HeartHandshake';
  if (lower.includes('pakaian') || lower.includes('baju') || lower.includes('lifestyle')) return 'Shirt';
  if (lower.includes('gaji') || lower.includes('salary')) return 'Briefcase';
  if (lower.includes('bonus') || lower.includes('thr')) return 'Gift';
  if (lower.includes('usaha') || lower.includes('jual') || lower.includes('toko')) return 'Store';
  if (lower.includes('freelance') || lower.includes('proyek')) return 'Laptop';
  if (lower.includes('invest') || lower.includes('bunga') || lower.includes('dividen')) return 'TrendingUp';
  if (lower.includes('hadiah') || lower.includes('saku')) return 'Wallet';
  return type === 'income' ? 'PlusCircle' : 'MoreHorizontal';
}

interface CategoryIconProps {
  name: string;
  categoryName?: string;
  type?: 'expense' | 'income' | 'transfer';
  color?: string;
  size?: number;
  className?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  name,
  categoryName,
  type = 'expense',
  color,
  size = 18,
  className = '',
}) => {
  const iconKey = name || (categoryName ? getCategoryIconName(categoryName, type) : 'DollarSign');
  const IconComponent = ICON_MAP[iconKey] || (type === 'transfer' ? ArrowRightLeft : (type === 'income' ? PlusCircle : MoreHorizontal));

  return (
    <div
      className={`flex items-center justify-center rounded-xl shrink-0 ${className}`}
      style={{
        backgroundColor: color ? `${color}20` : (type === 'income' ? '#dcfce7' : type === 'transfer' ? '#e0f2fe' : '#fee2e2'),
        color: color || (type === 'income' ? '#15803d' : type === 'transfer' ? '#0284c7' : '#dc2626'),
        width: size * 2,
        height: size * 2,
      }}
    >
      <IconComponent size={size} strokeWidth={2.2} />
    </div>
  );
};
