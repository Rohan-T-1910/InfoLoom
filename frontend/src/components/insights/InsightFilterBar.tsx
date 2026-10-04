import React from 'react';
import { Button } from '../ui/button';
import {
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  Cpu,
  Layers,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface InsightFilterBarProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  selectedSeverity: string;
  onSelectSeverity: (sev: string) => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  includeLLM: boolean;
  onToggleLLM: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  totalFilteredCount: number;
}

export const InsightFilterBar: React.FC<InsightFilterBarProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  selectedSeverity,
  onSelectSeverity,
  searchTerm,
  onSearchChange,
  includeLLM,
  onToggleLLM,
  onRefresh,
  isRefreshing,
  totalFilteredCount,
}) => {
  const categoryLabels: Record<string, string> = {
    all: 'All Categories',
    trend: 'Trends',
    percentage_change: '% Changes',
    top_contributor: 'Top Contributors',
    correlation: 'Correlations',
    forecast: 'Forecasting',
    anomaly: 'Anomalies',
    model_performance: 'ML Models',
    distribution: 'Distributions',
    data_quality: 'Data Quality',
  };

  const severities = ['all', 'critical', 'warning', 'positive', 'info'];

  return (
    <div className="space-y-3 p-4 rounded-xl border border-white/[0.08] bg-[#0c0818]/90 backdrop-blur-md">
      {/* Top Row: Search, LLM Toggle, and Refresh */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search insights by metric, title, or keyword..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#080512] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* LLM Phrasing Mode Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleLLM}
            className={`h-8 text-xs border transition-all ${
              includeLLM
                ? 'border-purple-500/50 bg-purple-950/40 text-purple-300'
                : 'border-white/10 text-slate-400 hover:text-white'
            }`}
            title="Toggle between executive presentation phrasing and direct factual summary."
          >
            <Sparkles className={`w-3.5 h-3.5 mr-1.5 ${includeLLM ? 'text-purple-400' : 'text-slate-500'}`} />
            {includeLLM ? 'Executive Phrasing' : 'Direct Facts'}
          </Button>

          {/* Re-generate / Refresh */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="h-8 text-xs border-white/10 text-slate-300 hover:text-white"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRefreshing ? 'animate-spin text-purple-400' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Middle Row: Category Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        <span className="text-[11px] font-mono text-slate-500 mr-1 shrink-0 uppercase tracking-wider">
          Category:
        </span>
        {['all', ...categories].map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onSelectCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 transition-all ${
                isActive
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white/[0.03] text-slate-400 hover:text-white hover:bg-white/[0.06] border border-white/[0.04]'
              }`}
            >
              {categoryLabels[cat] || cat.replace(/_/g, ' ').toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Bottom Row: Severity Filter & Count */}
      <div className="flex items-center justify-between pt-1 border-t border-white/[0.04] text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-mono text-slate-500 mr-1 uppercase tracking-wider">
            Severity:
          </span>
          {severities.map((sev) => {
            const isActive = selectedSeverity === sev;
            return (
              <button
                key={sev}
                type="button"
                onClick={() => onSelectSeverity(sev)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-mono capitalize transition-all ${
                  isActive
                    ? 'bg-white/15 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sev}
              </button>
            );
          })}
        </div>

        <span className="text-[11px] font-mono text-slate-400">
          Showing <strong className="text-white">{totalFilteredCount}</strong> insights
        </span>
      </div>
    </div>
  );
};
