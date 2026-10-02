import React from 'react';
import { InsightKPISummary } from '../../types';
import { Card } from '../ui/card';
import { Sparkles, AlertTriangle, CheckCircle2, AlertCircle, Compass } from 'lucide-react';

interface InsightSummaryCardsProps {
  kpi: InsightKPISummary;
}

export const InsightSummaryCards: React.FC<InsightSummaryCardsProps> = ({ kpi }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Card 1: Total Insights */}
      <Card className="p-4 border border-white/[0.08] bg-[#0c0818]/90 relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 font-medium">Total Insights</span>
          <div className="p-1.5 rounded-lg bg-purple-950/60 text-purple-400">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold font-mono text-white tracking-tight">
          {kpi.total_insights}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>{kpi.categories_covered.length} dimensions covered</span>
          <span className="text-purple-300 font-mono">100% data-driven</span>
        </div>
      </Card>

      {/* Card 2: Critical Alerts */}
      <Card className="p-4 border border-white/[0.08] bg-[#0c0818]/90 relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 font-medium">Critical Alerts</span>
          <div className="p-1.5 rounded-lg bg-rose-950/60 text-rose-400">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold font-mono text-rose-400 tracking-tight">
          {kpi.critical_count}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>High-priority shifts</span>
          <span className="text-rose-400 font-mono font-medium">
            {kpi.critical_count > 0 ? 'Requires attention' : 'All clear'}
          </span>
        </div>
      </Card>

      {/* Card 3: Growth & Positive Trends */}
      <Card className="p-4 border border-white/[0.08] bg-[#0c0818]/90 relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 font-medium">Positive Signals</span>
          <div className="p-1.5 rounded-lg bg-emerald-950/60 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
          {kpi.positive_count}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>Upward &amp; strong fits</span>
          <span className="text-emerald-400 font-mono">Favorable trajectory</span>
        </div>
      </Card>

      {/* Card 4: Actionable Warnings */}
      <Card className="p-4 border border-white/[0.08] bg-[#0c0818]/90 relative overflow-hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 font-medium">Warnings &amp; Signals</span>
          <div className="p-1.5 rounded-lg bg-amber-950/60 text-amber-400">
            <AlertCircle className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold font-mono text-amber-400 tracking-tight">
          {kpi.warning_count}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>Elevated outliers/skews</span>
          <span className="text-amber-400 font-mono">Statistical drift</span>
        </div>
      </Card>
    </div>
  );
};
