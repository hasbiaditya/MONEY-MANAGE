import React from 'react';
import { Home, ListFilter, PieChart, WalletCards, Settings } from 'lucide-react';

export type TabType = 'beranda' | 'transaksi' | 'statistik' | 'anggaran' | 'pengaturan';

interface NavbarProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange }) => {
  const tabs = [
    { id: 'beranda' as TabType, label: 'Beranda', icon: Home },
    { id: 'transaksi' as TabType, label: 'Transaksi', icon: ListFilter },
    { id: 'statistik' as TabType, label: 'Statistik', icon: PieChart },
    { id: 'anggaran' as TabType, label: 'Anggaran', icon: WalletCards },
    { id: 'pengaturan' as TabType, label: 'Pengaturan', icon: Settings },
  ];

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={isActive ? 'on' : ''}
            aria-label={tab.label}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
