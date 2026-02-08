'use client';

import React from 'react';
import { Search } from 'lucide-react';

export interface MetricsTab {
  id: string;
  label: string;
  count: number;
}

export interface MetricsBarProps {
  tabs: MetricsTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({
  tabs,
  activeTab,
  onTabChange,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  actions,
}) => {
  return (
    <div className="bg-white border-b border-slate-200">
      <div className="flex items-center justify-between px-4">
        {/* Tabs */}
        <div className="flex items-center gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'metrics-tab-active text-primary border-primary'
                  : 'metrics-tab text-slate-500 border-b-2 border-transparent hover:text-slate-700'
              }`}
            >
              {tab.label}
              <span className="ml-1 text-slate-500">({tab.count})</span>
            </button>
          ))}
        </div>

        {/* Right Side: Search + Actions */}
        <div className="flex items-center gap-3 ml-6">
          {onSearchChange && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                className="input-base pl-9 py-1.5 text-sm max-w-xs rounded-md border border-slate-200"
              />
            </div>
          )}

          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
};

export default MetricsBar;
