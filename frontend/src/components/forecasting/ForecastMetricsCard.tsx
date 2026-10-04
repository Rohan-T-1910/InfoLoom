import React, { useState } from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { ForecastEvaluationMetrics, FutureForecastPoint } from '../../types';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Layers,
  Target,
  ChevronDown,
  Sliders,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface ForecastMetricsCardProps {
  metrics?: ForecastEvaluationMetrics | null;
  modelOrder?: number[];
  modelType?: string;
  aic?: number | null;
  bic?: number | null;
  frequency?: string;
  dateMin?: string;
  dateMax?: string;
  totalObservations?: number;
  horizon?: number;
  forecastPoints?: FutureForecastPoint[];
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
  horizon = 14,
  forecastPoints = [],
}) => {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const mapeVal = typeof metrics?.mape === 'number' ? metrics.mape : 0;
  const maeVal = typeof metrics?.mae === 'number' ? metrics.mae : 0;
  const rmseVal = typeof metrics?.rmse === 'number' ? metrics.rmse : 0;
  const dirAccVal =
    typeof metrics?.directional_accuracy === 'number'
      ? metrics.directional_accuracy
      : typeof metrics?.direction_accuracy === 'number'
      ? metrics.direction_accuracy
      : null;

  const effectiveHorizon = horizon || metrics?.validation_horizon || (forecastPoints.length > 0 ? forecastPoints.length : 14);

  // 1. Forecast Direction: Increasing / Decreasing / Stable
  let direction = 'Stable';
  let DirectionIcon = Minus;
  let directionColor = 'text-cyan-400';
  let directionBadge = 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
  let directionDesc = 'Expected to stay relatively flat over this period';

  if (forecastPoints && forecastPoints.length >= 2) {
    const firstVal = forecastPoints[0].forecast ?? 0;
    const lastVal = forecastPoints[forecastPoints.length - 1].forecast ?? 0;
    const changePct = firstVal !== 0 ? ((lastVal - firstVal) / Math.abs(firstVal)) * 100 : 0;

    if (changePct > 2.0) {
      direction = 'Increasing';
      DirectionIcon = TrendingUp;
      directionColor = 'text-emerald-400';
      directionBadge = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
      directionDesc = `Projected upward trend (+${changePct.toFixed(1)}% over window)`;
    } else if (changePct < -2.0) {
      direction = 'Decreasing';
      DirectionIcon = TrendingDown;
      directionColor = 'text-rose-400';
      directionBadge = 'border-rose-500/30 bg-rose-500/10 text-rose-300';
      directionDesc = `Projected downward trend (${changePct.toFixed(1)}% over window)`;
    }
  } else if (dirAccVal !== null) {
    if (dirAccVal >= 65) {
      direction = 'Increasing';
      DirectionIcon = TrendingUp;
      directionColor = 'text-emerald-400';
      directionBadge = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
      directionDesc = 'Historical trend leans upward over time';
    } else if (dirAccVal <= 35) {
      direction = 'Decreasing';
      DirectionIcon = TrendingDown;
      directionColor = 'text-rose-400';
      directionBadge = 'border-rose-500/30 bg-rose-500/10 text-rose-300';
      directionDesc = 'Historical trend leans downward over time';
    }
  }

  // 2. Forecast Period (Human Friendly)
  let freqUnit = 'Periods';
  if (frequency === 'D') freqUnit = 'Days';
  else if (frequency === 'W') freqUnit = 'Weeks';
  else if (frequency === 'M') freqUnit = 'Months';
  else if (frequency === 'h') freqUnit = 'Hours';

  // 3. Expected Range
  let rangeDisplay = 'Pending Calculation';
  let rangeSubtext = 'Likely range of future values';
  if (forecastPoints && forecastPoints.length > 0) {
    const validLowers = forecastPoints
      .map((p) => p.lower_ci ?? p.forecast)
      .filter((v): v is number => typeof v === 'number');
    const validUppers = forecastPoints
      .map((p) => p.upper_ci ?? p.forecast)
      .filter((v): v is number => typeof v === 'number');

    if (validLowers.length > 0 && validUppers.length > 0) {
      const minVal = Math.min(...validLowers);
      const maxVal = Math.max(...validUppers);
      rangeDisplay = `${minVal.toLocaleString(undefined, { maximumFractionDigits: 1 })} – ${maxVal.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
      rangeSubtext = 'Likely future boundaries (95% uncertainty band)';
    }
  } else if (maeVal > 0) {
    rangeDisplay = `±${maeVal.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`;
    rangeSubtext = 'Expected per-period variance range';
  }

  // 4. Forecast Confidence / Reliability (Plain English, no fake % confidence)
  let reliabilityTier = 'High Reliability';
  let reliabilityColor = 'text-emerald-400';
  let reliabilityBadge = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  let reliabilityExplanation = 'Historical data shows consistent, predictable patterns with low deviation.';

  if (totalObservations && totalObservations < 15) {
    reliabilityTier = 'Exploratory forecast';
    reliabilityColor = 'text-amber-400';
    reliabilityBadge = 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    reliabilityExplanation = 'Limited historical points available; use as a directional indicator rather than an exact target.';
  } else if (mapeVal > 40) {
    reliabilityTier = 'Exploratory forecast';
    reliabilityColor = 'text-amber-400';
    reliabilityBadge = 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    reliabilityExplanation = 'High variance in historical numbers means this is best used for general direction.';
  } else if (mapeVal > 20) {
    reliabilityTier = 'Moderate Reliability';
    reliabilityColor = 'text-cyan-400';
    reliabilityBadge = 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300';
    reliabilityExplanation = 'Solid pattern tracking suitable for general operational planning.';
  }

  return (
    <div className="space-y-4">
      {/* 4 Clean Business-Friendly Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Forecast Direction */}
        <Card className="border border-white/[0.08] bg-[#0c0818]/90 p-4 relative overflow-hidden group hover:border-white/15 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Forecast Direction</span>
            <div className={`p-1.5 rounded-lg border ${directionBadge}`}>
              <DirectionIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold tracking-tight ${directionColor}`}>
              {direction}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400 leading-tight">
            {directionDesc}
          </p>
        </Card>

        {/* Card 2: Forecast Period */}
        <Card className="border border-white/[0.08] bg-[#0c0818]/90 p-4 relative overflow-hidden group hover:border-white/15 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Forecast Period</span>
            <div className="p-1.5 rounded-lg bg-purple-950/60 border border-purple-500/30 text-purple-400">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white tracking-tight">
              Next {effectiveHorizon} {freqUnit}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400 leading-tight">
            Timeline step: <strong className="text-slate-300 capitalize">{frequency === 'D' ? 'Daily' : frequency === 'W' ? 'Weekly' : frequency === 'M' ? 'Monthly' : frequency || 'Regular'}</strong>
          </p>
        </Card>

        {/* Card 3: Expected Range */}
        <Card className="border border-white/[0.08] bg-[#0c0818]/90 p-4 relative overflow-hidden group hover:border-white/15 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Expected Range</span>
            <div className="p-1.5 rounded-lg bg-sky-950/60 border border-sky-500/30 text-sky-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-cyan-300 tracking-tight">
              {rangeDisplay}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400 leading-tight">
            {rangeSubtext}
          </p>
        </Card>

        {/* Card 4: Forecast Reliability */}
        <Card className="border border-white/[0.08] bg-[#0c0818]/90 p-4 relative overflow-hidden group hover:border-white/15 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Forecast Reliability</span>
            <div className={`p-1.5 rounded-lg border ${reliabilityBadge}`}>
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-xl font-bold tracking-tight ${reliabilityColor}`}>
              {reliabilityTier}
            </span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400 leading-tight">
            {reliabilityExplanation}
          </p>
        </Card>
      </div>

      {/* Optional Analysis Details Collapsible Section */}
      <details
        className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs transition-colors hover:border-white/10"
      >
        <summary className="flex items-center justify-between cursor-pointer list-none text-slate-400 hover:text-white font-medium select-none">
          <span className="flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5 text-purple-400" />
            <span>Analysis details (Technical Diagnostics)</span>
          </span>
          <ChevronDown className="w-4 h-4 text-slate-500 group-open:rotate-180 transition-transform" />
        </summary>

        <div className="mt-3 pt-3 border-t border-white/[0.06] grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
          {/* MAPE */}
          <div className="p-2.5 rounded-lg bg-[#090514] border border-white/[0.04]">
            <span className="text-slate-500 block mb-0.5">Historical Error (MAPE)</span>
            <span className="font-mono font-bold text-white text-sm">
              {mapeVal.toFixed(2)}%
            </span>
            <span className="block text-[10px] text-cyan-400 mt-0.5">
              {mapeVal < 10
                ? 'Excellent accuracy (<10%)'
                : mapeVal < 20
                ? 'Good accuracy (10-20%)'
                : mapeVal < 50
                ? 'Reasonable accuracy (20-50%)'
                : 'Inaccurate (>50%)'}
            </span>
          </div>

          {/* Directional Trend */}
          <div className="p-2.5 rounded-lg bg-[#090514] border border-white/[0.04]">
            <span className="text-slate-500 block mb-0.5">Directional Accuracy</span>
            <span className="font-mono font-bold text-white text-sm">
              {dirAccVal !== null ? `${dirAccVal.toFixed(1)}%` : 'Consistent'}
            </span>
            <span className="block text-[10px] text-slate-400 mt-0.5">
              Historical direction alignment
            </span>
          </div>

          {/* Architecture */}
          <div className="p-2.5 rounded-lg bg-[#090514] border border-white/[0.04]">
            <span className="text-slate-500 block mb-0.5">Model Architecture</span>
            <span className="font-mono font-bold text-purple-300 text-sm">
              {modelType} {modelOrder ? `(${modelOrder.join(',')})` : ''}
            </span>
            <span className="block text-[10px] text-slate-400 mt-0.5">
              {totalObservations ? `${totalObservations} historical observations` : 'Standard Series'}
            </span>
          </div>

          {/* RMSE / Deviation */}
          <div className="p-2.5 rounded-lg bg-[#090514] border border-white/[0.04]">
            <span className="text-slate-500 block mb-0.5">Root Mean Squared Error (RMSE)</span>
            <span className="font-mono font-bold text-slate-300 text-sm">
              {rmseVal < 0.01 ? rmseVal.toExponential(2) : rmseVal.toFixed(3)}
            </span>
            <span className="block text-[10px] text-slate-400 mt-0.5">
              ±{maeVal.toLocaleString(undefined, { maximumFractionDigits: 2 })} average deviation
            </span>
          </div>
        </div>
      </details>
    </div>
  );
};
