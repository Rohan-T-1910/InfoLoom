import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { ForecastEvaluationMetrics, ForecastModelResponse } from '../../types';
import {
  TrendingUp,
  Activity,
  Target,
  BarChart2,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface ForecastMetricsCardProps {
  metrics: ForecastEvaluationMetrics;
  modelOrder?: number[];
  modelType?: string;
  aic?: number | null;
  bic?: number | null;
  frequency?: string;
  dateMin?: string;
  dateMax?: string;
  totalObservations?: number;
  horizon?: number;
}

export const ForecastMetricsCard: React.FC<ForecastMetricsCardProps> = ({
  metrics,
  modelOrder,
  modelType = 'ARIMA',
  aic,
  bic,
  frequency,
  dateMin,
  dateMax,
  totalObservations,
  horizon,
}) => {
  // Determine MAPE quality tier
  const mapeVal = metrics.mape;
  let mapeColor = 'text-emerald-400';
  let mapeBadge = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  let mapeDesc = 'Excellent accuracy (<10%)';

  if (mapeVal > 50) {
    mapeColor = 'text-rose-400';
    mapeBadge = 'border-rose-500/30 bg-rose-500/10 text-rose-300';
    mapeDesc = 'High error rate (>50%)';
  } else if (mapeVal > 20) {
    mapeColor = 'text-amber-400';
    mapeBadge = 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    mapeDesc = 'Moderate accuracy (20-50%)';
  } else if (mapeVal > 10) {
    mapeColor = 'text-cyan-400';
    mapeBadge = 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
    mapeDesc = 'Good accuracy (10-20%)';
  }

  const orderStr = modelOrder ? `(${modelOrder.join(', ')})` : '';

  return (
    <div className="space-y-4">
      {/* Top Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Primary Metric: MAPE */}
        <Card className="border border-white/[0.08] bg-[#0c0818]/90 p-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">MAPE (Backtest)</span>
            <div className="p-1.5 rounded-lg bg-purple-950/60 text-purple-400">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold font-mono tracking-tight ${mapeColor}`}>
              {metrics.mape.toFixed(2)}%
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Holdout Error</span>
            <span className={`px-1.5 py-0.5 rounded border text-[10px] ${mapeBadge}`}>
              {mapeDesc}
            </span>
          </div>
        </Card>

        {/* RMSE */}
        <Card className="border border-white/[0.08] bg-[#0c0818]/90 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">RMSE</span>
            <div className="p-1.5 rounded-lg bg-indigo-950/60 text-indigo-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono tracking-tight">
            {metrics.rmse < 0.01 ? metrics.rmse.toExponential(3) : metrics.rmse.toFixed(3)}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Root Mean Squared Error</span>
            <span className="font-mono text-slate-300">MAE: {metrics.mae.toFixed(3)}</span>
          </div>
        </Card>

        {/* Directional Accuracy */}
        <Card className="border border-white/[0.08] bg-[#0c0818]/90 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Directional Trend</span>
            <div className="p-1.5 rounded-lg bg-cyan-950/60 text-cyan-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-white font-mono tracking-tight">
            {metrics.directional_accuracy !== null && metrics.directional_accuracy !== undefined
              ? `${metrics.directional_accuracy.toFixed(1)}%`
              : 'N/A'}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Trend Direction Accuracy</span>
            <span className="font-mono text-slate-300">
              R²: {metrics.r2 !== null && metrics.r2 !== undefined ? metrics.r2.toFixed(3) : 'N/A'}
            </span>
          </div>
        </Card>

        {/* Model Spec & Horizon */}
        <Card className="border border-white/[0.08] bg-[#0c0818]/90 p-4 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Model Architecture</span>
            <div className="p-1.5 rounded-lg bg-emerald-950/60 text-emerald-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-white font-mono tracking-tight">
            {modelType} {orderStr}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Horizon: <strong className="text-white">{horizon || metrics.test_samples} steps</strong></span>
            <span className="font-mono text-slate-300">Freq: {frequency || 'Auto'}</span>
          </div>
        </Card>
      </div>

      {/* Auxiliary Metadata Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-purple-400" />
            <span>Range:</span>
            <span className="text-slate-200 font-mono">
              {dateMin ? dateMin.split('T')[0] : 'Start'} → {dateMax ? dateMax.split('T')[0] : 'End'}
            </span>
          </div>
          {totalObservations && (
            <div className="flex items-center gap-1.5">
              <span>Observations:</span>
              <span className="text-slate-200 font-mono font-medium">{totalObservations}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span>Split:</span>
            <span className="text-slate-300 font-mono">
              Train ({metrics.train_samples}) / Val ({metrics.test_samples})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {aic !== null && aic !== undefined && (
            <span className="font-mono text-[11px] text-slate-400">
              AIC: <span className="text-slate-200">{aic.toFixed(1)}</span>
            </span>
          )}
          {bic !== null && bic !== undefined && (
            <span className="font-mono text-[11px] text-slate-400">
              BIC: <span className="text-slate-200">{bic.toFixed(1)}</span>
            </span>
          )}
          <Badge variant="outline" className="text-[10px] border-purple-500/30 text-purple-300">
            Rolling Backtest Evaluated
          </Badge>
        </div>
      </div>
    </div>
  );
};
