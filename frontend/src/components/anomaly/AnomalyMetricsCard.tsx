import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { AnomalyModelResponse } from '../../types';
import {
  ShieldAlert,
  AlertTriangle,
  Layers,
  Activity,
  Sliders,
  CheckCircle2,
  TrendingDown,
  Info,
} from 'lucide-react';

interface AnomalyMetricsCardProps {
  model: AnomalyModelResponse;
}

export const AnomalyMetricsCard: React.FC<AnomalyMetricsCardProps> = ({ model }) => {
  const anomPct = model.anomaly_percentage;
  let severityBadge = 'border-amber-500/30 bg-amber-500/10 text-amber-300';
  let severityLabel = 'Moderate Outliers';

  if (anomPct >= 10) {
    severityBadge = 'border-rose-500/30 bg-rose-500/10 text-rose-300';
    severityLabel = 'High Outlier Density (>10%)';
  } else if (anomPct <= 2) {
    severityBadge = 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
    severityLabel = 'Rare Event Anomaly (<2%)';
  } else {
    severityBadge = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
    severityLabel = 'Standard Outliers (2-10%)';
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Flagged Anomalies */}
        <Card className="border border-white/[0.08] bg-[#0c0818]/90 p-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Flagged Anomalies</span>
            <div className="p-1.5 rounded-lg bg-rose-950/60 text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-rose-400 tracking-tight">
              {model.n_anomalies}
            </span>
            <span className="text-xs font-mono text-slate-400">
              / {model.n_samples} rows
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Contamination: {(model.contamination * 100).toFixed(1)}%</span>
            <span className={`px-1.5 py-0.5 rounded border text-[10px] ${severityBadge}`}>
              {model.anomaly_percentage.toFixed(1)}%
            </span>
          </div>
        </Card>

        {/* Card 2: Decision Threshold */}
        <Card className="border border-white/[0.08] bg-[#0c0818]/90 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Decision Threshold</span>
            <div className="p-1.5 rounded-lg bg-purple-950/60 text-purple-400">
              <Sliders className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono tracking-tight">
            {model.threshold_score.toFixed(4)}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Scores &lt; {model.threshold_score.toFixed(3)} flagged</span>
            <span className="text-slate-300 font-mono">Mean: {model.score_mean.toFixed(3)}</span>
          </div>
        </Card>

        {/* Card 3: Score Range */}
        <Card className="border border-white/[0.08] bg-[#0c0818]/90 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Score Bounds</span>
            <div className="p-1.5 rounded-lg bg-indigo-950/60 text-indigo-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-white font-mono tracking-tight">
            [{model.score_min.toFixed(3)}, {model.score_max.toFixed(3)}]
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Lower = higher anomaly</span>
            <span className="text-rose-400 font-mono">Min: {model.score_min.toFixed(3)}</span>
          </div>
        </Card>

        {/* Card 4: Model Architecture */}
        <Card className="border border-white/[0.08] bg-[#0c0818]/90 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Isolation Ensemble</span>
            <div className="p-1.5 rounded-lg bg-emerald-950/60 text-emerald-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-white font-mono tracking-tight">
            {model.n_estimators} Trees
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Features: <strong className="text-white">{model.feature_names.length}</strong></span>
            <span className="text-emerald-400 font-mono">Status: Ready</span>
          </div>
        </Card>
      </div>

      {/* Auxiliary Metadata Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-slate-300 font-medium">Evaluated Features:</span>
          {model.feature_names.map((feat) => (
            <Badge key={feat} variant="outline" className="text-[10px] border-purple-500/30 text-purple-300">
              {feat}
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          <span className="font-mono text-slate-400">
            Dataset: {model.use_cleaned ? 'Cleaned Pipeline' : 'Raw Data'}
          </span>
          <span className="text-slate-500">•</span>
          <span className="font-mono text-slate-400">
            Algorithm: Isolation Forest (iForest)
          </span>
        </div>
      </div>
    </div>
  );
};
