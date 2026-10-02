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
  Zap,
  Info,
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
  const points = evaluation.backtest_points || [];
  const metrics = evaluation.metrics;

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      if (evaluation.frequency === 'h') {
        return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
    } catch {
      return iso;
    }
  };

  const labels = points.map((p) => formatDate(p.timestamp));
  const actuals = points.map((p) => p.actual);
  const predicted = points.map((p) => p.predicted);

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Actual Values (Ground Truth)',
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
        label: `ARIMA Backtest Prediction (${evaluation.model_name})`,
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
              {evaluation.model_name}
            </Badge>
          </div>
          <CardDescription className="text-xs text-slate-400 mt-1">
            Chronological holdout validation: {metrics.train_samples} train observations,{' '}
            {metrics.test_samples} validation samples (Horizon: {evaluation.horizon} steps)
          </CardDescription>
        </div>

        <Button
          variant="glow"
          size="sm"
          onClick={onProceedToForecast}
          disabled={isTraining}
          className="text-xs font-medium"
        >
          {isTraining ? 'Training Final Model...' : 'Train & Generate Forecast'}
          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
        </Button>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl border border-white/[0.08] bg-[#090514]">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Backtest MAPE</span>
              <Target className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-xl font-bold font-mono text-cyan-400">
              {metrics.mape.toFixed(2)}%
            </div>
            <span className="text-[10px] text-slate-500">Mean Absolute % Error</span>
          </div>

          <div className="p-3 rounded-xl border border-white/[0.08] bg-[#090514]">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>RMSE</span>
              <Activity className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {metrics.rmse < 0.01 ? metrics.rmse.toExponential(3) : metrics.rmse.toFixed(3)}
            </div>
            <span className="text-[10px] text-slate-500">Root Mean Squared Error</span>
          </div>

          <div className="p-3 rounded-xl border border-white/[0.08] bg-[#090514]">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>MAE</span>
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {metrics.mae < 0.01 ? metrics.mae.toExponential(3) : metrics.mae.toFixed(3)}
            </div>
            <span className="text-[10px] text-slate-500">Mean Absolute Error</span>
          </div>

          <div className="p-3 rounded-xl border border-white/[0.08] bg-[#090514]">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Trend Direction</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400">
              {metrics.directional_accuracy !== null && metrics.directional_accuracy !== undefined
                ? `${metrics.directional_accuracy.toFixed(1)}%`
                : 'N/A'}
            </div>
            <span className="text-[10px] text-slate-500">Directional Accuracy</span>
          </div>
        </div>

        {/* Backtest Holdout Plot */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-300 font-medium">
              Out-of-Sample Holdout Comparison ({metrics.test_samples} steps)
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Zero lookahead bias guaranteed</span>
            </div>
          </div>
          <div className="h-64 w-full bg-[#090514] rounded-xl border border-white/[0.06] p-3">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
