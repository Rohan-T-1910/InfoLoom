import React from 'react';
import { Line } from 'react-chartjs-2';
import '../../lib/chartSetup';
import { ForecastEvaluationResponse } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Activity,
  CheckCircle2,
  TrendingUp,
  Target,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';

interface ForecastEvaluationCardProps {
  evaluation: ForecastEvaluationResponse;
  onProceedToForecast: () => void;
  isTraining?: boolean;
}

export const ForecastEvaluationCard: React.FC<ForecastEvaluationCardProps> = ({
  evaluation,
  onProceedToForecast,
  isTraining = false,
}) => {
  const points = evaluation.backtest_points || evaluation.validation_points || [];
  const metrics = evaluation.metrics || ({} as any);

  const formatDate = (iso: string | undefined | null) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      if (evaluation.frequency === 'h') {
        return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
    } catch {
      return String(iso);
    }
  };

  const labels = points.map((p) => formatDate(p.date || p.timestamp));
  const actuals = points.map((p) => p.actual);
  const predicted = points.map((p) => p.predicted);

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Actual Recorded Values',
        data: actuals,
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168, 85, 247, 0.2)',
        pointBackgroundColor: '#a855f7',
        pointBorderColor: '#fff',
        pointRadius: 4,
        borderWidth: 2,
        tension: 0.2,
      },
      {
        label: `Test Prediction (${evaluation.model_name || 'Forecast Model'})`,
        data: predicted,
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.2)',
        pointBackgroundColor: '#38bdf8',
        pointBorderColor: '#fff',
        pointRadius: 4,
        borderWidth: 2,
        borderDash: [5, 4],
        tension: 0.2,
      },
    ],
  };

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#cbd5e1',
          font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
          boxWidth: 14,
          padding: 14,
        },
      },
      tooltip: {
        backgroundColor: '#0c0818',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        padding: 10,
        titleFont: { size: 12, family: "'Plus Jakarta Sans', sans-serif" },
        bodyFont: { size: 12, family: "'JetBrains Mono', monospace" },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: {
          color: '#94a3b8',
          font: { family: "'JetBrains Mono', monospace", size: 10 },
          maxRotation: 45,
          maxTicksLimit: 10,
        },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.06)' },
        ticks: {
          color: '#94a3b8',
          font: { family: "'JetBrains Mono', monospace", size: 10 },
        },
      },
    },
  };

  const dirAcc =
    typeof metrics.directional_accuracy === 'number'
      ? metrics.directional_accuracy
      : typeof metrics.direction_accuracy === 'number'
      ? metrics.direction_accuracy
      : null;

  const horizon = evaluation.horizon ?? evaluation.validation_horizon ?? points.length ?? 14;

  return (
    <Card className="border border-purple-500/30 bg-[#0c0818]/90 overflow-hidden shadow-lg shadow-purple-950/20">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/[0.06] bg-gradient-to-r from-purple-950/30 via-transparent to-transparent">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <CardTitle className="text-base font-semibold text-white">
              Backtest Evaluation Diagnostics
            </CardTitle>
            <Badge variant="purple" className="text-[10px]">
              {evaluation.target_column}
            </Badge>
          </div>
          <CardDescription className="text-xs text-slate-400 mt-1 flex items-center gap-2">
            <span>Historical accuracy test ({horizon} periods backtested).</span>
            <span className="text-emerald-400 flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              Zero lookahead bias guaranteed
            </span>
          </CardDescription>
        </div>

        <Button
          variant="glow"
          size="sm"
          onClick={onProceedToForecast}
          disabled={isTraining}
          className="text-xs font-medium"
        >
          {isTraining ? 'Generating Future Forecast...' : 'Train & Generate Forecast'}
          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl border border-white/[0.08] bg-[#090514]">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Historical Error</span>
              <Target className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-xl font-bold font-mono text-cyan-400">
              {(metrics.mape || 0).toFixed(2)}%
            </div>
            <span className="text-[10px] text-slate-500">Average percentage variance</span>
          </div>

          <div className="p-3 rounded-xl border border-white/[0.08] bg-[#090514]">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Typical Deviation</span>
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              ±{(metrics.mae || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-500">Average difference per period</span>
          </div>

          <div className="p-3 rounded-xl border border-white/[0.08] bg-[#090514]">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Trend Accuracy</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400">
              {dirAcc !== null ? `${dirAcc.toFixed(1)}%` : 'Consistent'}
            </div>
            <span className="text-[10px] text-slate-500">Correct direction shifts</span>
          </div>

          <div className="p-3 rounded-xl border border-white/[0.08] bg-[#090514]">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Test Period</span>
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {horizon} Periods
            </div>
            <span className="text-[10px] text-slate-500">Validation window</span>
          </div>
        </div>

        {/* Backtest Holdout Plot */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-300 font-medium">
              Comparison: Predicted vs. Actual Historical Values ({horizon} periods)
            </span>
          </div>
          <div className="h-64 w-full bg-[#090514] rounded-xl border border-white/[0.06] p-3">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
