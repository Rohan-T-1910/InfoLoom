import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { AnomalyModelResponse } from '../../types';
import {
  ShieldAlert,
  AlertTriangle,
  Sliders,
  CheckCircle2,
  Info,
  Layers,
} from 'lucide-react';

interface AnomalyMetricsCardProps {
  model: AnomalyModelResponse;
}

export const AnomalyMetricsCard: React.FC<AnomalyMetricsCardProps> = ({ model }) => {
  const anomPct = model.anomaly_percentage || 0;
  const count = model.n_anomalies || 0;
  const total = model.n_samples || 0;

  // Determine sensitivity tier name
  let sensitivityName = 'Balanced Scan (5%)';
  if (model.contamination <= 0.02) {
    sensitivityName = 'Strict Scan (1%)';
  } else if (model.contamination >= 0.08) {
    sensitivityName = 'Broad Scan (10%)';
  }

  // Determine severity tier
  let severityLabel = 'Moderate Outlier Density';
  let severityBadge = 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  if (anomPct >= 8) {
    severityLabel = 'Elevated Outliers';
    severityBadge = 'border-rose-500/30 bg-rose-500/10 text-rose-300';
  } else if (anomPct <= 2) {
    severityLabel = 'Rare Event Outliers';
    severityBadge = 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
  }

  return (
    <div className="space-y-4">
      {/* 4 Business-friendly KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Flagged Anomalies */}
        <Card className="border border-white/[0.08] bg-[#0c0818]/90 p-4 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Unusual Records Found</span>
            <div className="p-1.5 rounded-lg bg-rose-950/60 text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-rose-400 tracking-tight">
              {count}
            </span>
            <span className="text-xs font-mono text-slate-400">
              / {total} rows
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Portion of dataset</span>
            <span className={`px-1.5 py-0.5 rounded border text-[10px] ${severityBadge}`}>
              <span>{anomPct.toFixed(1)}%</span> flagged
            </span>
          </div>
        </Card>

        {/* Card 2: Sensitivity Setting */}
        <Card className="border border-white/[0.08] bg-[#0c0818]/90 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Scan Sensitivity</span>
            <div className="p-1.5 rounded-lg bg-purple-950/60 text-purple-400">
              <Sliders className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-white font-mono tracking-tight">
            {sensitivityName}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Score threshold</span>
            <span className="text-slate-300 font-mono">{model.threshold_score?.toFixed(4)}</span>
          </div>
        </Card>

        {/* Card 3: Columns Examined */}
        <Card className="border border-white/[0.08] bg-[#0c0818]/90 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Columns Evaluated</span>
            <div className="p-1.5 rounded-lg bg-indigo-950/60 text-indigo-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono tracking-tight">
            {model.feature_names.length} Metrics
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span className="truncate max-w-[200px]" title={model.feature_names.join(', ')}>
              {model.feature_names.slice(0, 3).join(', ')}
              {model.feature_names.length > 3 ? ` +${model.feature_names.length - 3}` : ''}
            </span>
          </div>
        </Card>

        {/* Card 4: Outlier Status */}
        <Card className="border border-white/[0.08] bg-[#0c0818]/90 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Overall Assessment</span>
            <div className="p-1.5 rounded-lg bg-emerald-950/60 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-white tracking-tight">
            {severityLabel}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Investigation focus</span>
            <span className="text-cyan-400 font-medium">Review rows below</span>
          </div>
        </Card>
      </div>

      {/* Explanatory banner */}
      <div className="px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-between text-xs text-slate-300">
        <div className="flex items-center gap-3">
          <Info className="w-4 h-4 text-rose-400 shrink-0" />
          <span>
            <strong>Understanding these findings:</strong> Flagged rows are records whose combination of numerical values differs markedly from the historical distribution (score bounds: [{model.score_min?.toFixed(3)}, {model.score_max?.toFixed(3)}]). Expand any row in the table below to see the specific metrics and deviation factors driving its priority rating.
          </span>
        </div>
      </div>
    </div>
  );
};
