import React from 'react';
import { FeatureImportanceResponse } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Bar } from 'react-chartjs-2';
import '../../lib/chartSetup';
import { Target, Sparkles, Award, Cpu } from 'lucide-react';

interface EDAFeatureImportanceProps {
  featureImportance: FeatureImportanceResponse | null | undefined;
  onTargetChange?: (target: string) => void;
  isLoading?: boolean;
}

export const EDAFeatureImportance: React.FC<EDAFeatureImportanceProps> = ({
  featureImportance,
  onTargetChange,
  isLoading,
}) => {
  if (!featureImportance) {
    return (
      <Card className="border border-white/[0.08] bg-[#0c0818]/90 p-8 text-center text-slate-500">
        <Target className="w-8 h-8 text-purple-400 mx-auto mb-2 opacity-50" />
        <p className="text-sm font-medium">No target feature selected for importance analysis.</p>
        <p className="text-xs text-slate-500 mt-1">
          Select a candidate target column to train a baseline Random Forest model and rank predictive features.
        </p>
      </Card>
    );
  }

  const {
    target_column,
    problem_type,
    model_used,
    baseline_score_name,
    baseline_score,
    features,
    candidate_targets,
  } = featureImportance;

  // Horizontal bar chart configuration
  const chartLabels = features.map((f) => f.feature);
  const chartValues = features.map((f) => f.percentage);

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Feature Importance Share (%)',
        data: chartValues,
        backgroundColor: 'rgba(168, 85, 247, 0.75)',
        hoverBackgroundColor: 'rgba(216, 180, 254, 0.95)',
        borderColor: '#a855f7',
        borderWidth: 1.5,
        borderRadius: 6,
      },
    ],
  };

  const chartOptions: any = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: '#0f0a1c',
        titleColor: '#f1f5f9',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(168, 85, 247, 0.3)',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (context: any) => {
            const raw = features[context.dataIndex]?.importance;
            return `Importance: ${context.parsed.x}% (raw: ${raw})`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: '#94a3b8',
          font: { size: 11 },
          callback: (value: any) => `${value}%`,
        },
      },
      y: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#cbd5e1',
          font: { size: 12, weight: 'bold' },
        },
      },
    },
  };

  return (
    <Card className="border border-white/[0.08] bg-[#0c0818]/90">
      <CardHeader className="pb-3 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Baseline Feature Importance Ranking</span>
              </CardTitle>
              <Badge variant="purple" className="text-xs uppercase tracking-wider">
                {problem_type}
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-400 mt-1">
              Relative Gini / variance reduction from a fast baseline tree ensemble ({model_used}).
            </CardDescription>
          </div>

          {/* Candidate Target Quick Switcher */}
          {candidate_targets.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Target Feature:</span>
              <div className="flex flex-wrap gap-1.5">
                {candidate_targets.map((tgt) => (
                  <button
                    key={tgt}
                    onClick={() => onTargetChange && onTargetChange(tgt)}
                    disabled={isLoading}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      tgt === target_column
                        ? 'bg-purple-600 text-white shadow-sm ring-1 ring-purple-400 font-semibold'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-white/10'
                    }`}
                  >
                    {tgt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Importance Horizontal Bar Chart */}
          <div className="lg:col-span-3 h-[360px] w-full">
            <Bar data={chartData} options={chartOptions} />
          </div>

          {/* Baseline Metric & Top Predictors Card */}
          <div className="space-y-4 lg:border-l lg:border-white/[0.08] lg:pl-6 flex flex-col justify-center">
            {/* Baseline Model Score */}
            <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/20">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-purple-300 font-medium">{baseline_score_name}</span>
                <Award className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-bold text-white font-mono">
                {baseline_score !== null
                  ? problem_type === 'classification'
                    ? `${(baseline_score * 100).toFixed(1)}%`
                    : baseline_score.toFixed(3)
                  : 'N/A'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Quick heuristic baseline performance prior to hyperparameter tuning.
              </p>
            </div>

            {/* Top 3 Ranked Predictors */}
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                <span>Top Influential Drivers</span>
              </div>
              {features.slice(0, 3).map((f) => (
                <div
                  key={f.feature}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-white/[0.06] text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-600/30 border border-purple-500/30 flex items-center justify-center font-mono text-[10px] text-purple-300 font-bold">
                      {f.rank}
                    </span>
                    <span className="font-semibold text-slate-200">{f.feature}</span>
                  </div>
                  <span className="font-mono text-purple-300 font-bold">{f.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
