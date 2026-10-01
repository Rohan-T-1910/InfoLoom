import React from 'react';
import { Line } from 'react-chartjs-2';
import { ClusteringEvaluationResponse } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  TrendingDown,
  Sparkles,
  CheckCircle2,
  Info,
  HelpCircle,
  Zap,
} from 'lucide-react';

interface ClusteringEvaluationCardProps {
  evaluation: ClusteringEvaluationResponse;
  currentK: number;
  onApplyK: (k: number) => void;
}

export const ClusteringEvaluationCard: React.FC<ClusteringEvaluationCardProps> = ({
  evaluation,
  currentK,
  onApplyK,
}) => {
  const kLabels = evaluation.k_metrics.map((m) => `K = ${m.k}`);
  const inertias = evaluation.k_metrics.map((m) => m.inertia);
  const silhouettes = evaluation.k_metrics.map((m) => m.silhouette_score ?? 0);

  // Inertia (Elbow Method) Chart Data
  const inertiaData = {
    labels: kLabels,
    datasets: [
      {
        label: 'Inertia (Within-Cluster Sum of Squares)',
        data: inertias,
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        tension: 0.3,
        pointBackgroundColor: evaluation.k_metrics.map((m) =>
          m.k === evaluation.suggested_k ? '#eab308' : '#c084fc'
        ),
        pointBorderColor: '#fff',
        pointRadius: evaluation.k_metrics.map((m) => (m.k === evaluation.suggested_k ? 6 : 4)),
        fill: true,
      },
    ],
  };

  // Silhouette Chart Data
  const silhouetteData = {
    labels: kLabels,
    datasets: [
      {
        label: 'Silhouette Score (-1 to +1)',
        data: silhouettes,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.3,
        pointBackgroundColor: evaluation.k_metrics.map((m) =>
          m.k === evaluation.suggested_k ? '#eab308' : '#34d399'
        ),
        pointBorderColor: '#fff',
        pointRadius: evaluation.k_metrics.map((m) => (m.k === evaluation.suggested_k ? 6 : 4)),
        fill: true,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(15, 10, 30, 0.95)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: '#cbd5e1',
        padding: 10,
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.04)',
        },
        ticks: {
          color: '#94a3b8',
          font: { size: 10 },
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.04)',
        },
        ticks: {
          color: '#94a3b8',
          font: { size: 10 },
        },
      },
    },
  };

  return (
    <Card className="border-white/[0.08] bg-[#0c0817]/90 backdrop-blur-xl">
      <CardHeader className="pb-4 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-5 h-5 text-purple-400" />
              <CardTitle className="text-base text-white font-semibold">
                K Selection Diagnostic (Elbow & Silhouette)
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-400">
              Evaluated across {evaluation.n_samples} samples using {evaluation.features.length} selected features.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="purple" className="text-xs px-2.5 py-1">
              Suggested: K = {evaluation.suggested_k}
            </Badge>
            {currentK !== evaluation.suggested_k && (
              <Button
                variant="glow"
                size="sm"
                onClick={() => onApplyK(evaluation.suggested_k)}
                className="h-7 text-xs px-2.5"
              >
                <Zap className="w-3 h-3 mr-1" />
                Apply K={evaluation.suggested_k}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Recommendation Callout */}
        <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/20 flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300">
            <span className="font-semibold text-white">Statistical Suggestion: </span>
            {evaluation.suggestion_reason}
          </div>
        </div>

        {/* Dual Diagnostic Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Inertia (Elbow Method) */}
          <div className="p-4 rounded-xl bg-[#120d24]/60 border border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">
                  1. Elbow Curve (Inertia vs K)
                </span>
                <span className="text-[10px] text-slate-400">
                  Look for the "elbow" bend where inertia reduction levels off
                </span>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                Lower is more compact
              </Badge>
            </div>

            <div className="h-48 w-full">
              <Line data={inertiaData} options={chartOptions} />
            </div>
          </div>

          {/* Chart 2: Silhouette Score */}
          <div className="p-4 rounded-xl bg-[#120d24]/60 border border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">
                  2. Silhouette Coefficient vs K
                </span>
                <span className="text-[10px] text-slate-400">
                  Measures how similar points are to their own cluster vs other clusters
                </span>
              </div>
              <Badge variant="success" className="text-[10px]">
                Higher is better (Max: +1.0)
              </Badge>
            </div>

            <div className="h-48 w-full">
              <Line data={silhouetteData} options={chartOptions} />
            </div>
          </div>
        </div>

        {/* Evaluation Metrics Summary Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-slate-400 bg-white/[0.02]">
                <th className="py-2.5 px-3 font-semibold">Clusters (K)</th>
                <th className="py-2.5 px-3 font-semibold text-right">Inertia (Sum of Squares)</th>
                <th className="py-2.5 px-3 font-semibold text-right">Silhouette Score</th>
                <th className="py-2.5 px-3 font-semibold text-right">Status</th>
                <th className="py-2.5 px-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {evaluation.k_metrics.map((m) => {
                const isSuggested = m.k === evaluation.suggested_k;
                const isSelected = m.k === currentK;

                return (
                  <tr
                    key={m.k}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-purple-600/15'
                        : isSuggested
                        ? 'bg-amber-500/[0.04]'
                        : 'hover:bg-white/[0.02]'
                    }`}
                  >
                    <td className="py-2.5 px-3 font-mono font-bold text-white">
                      K = {m.k}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                      {m.inertia.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                      {m.silhouette_score != null ? m.silhouette_score.toFixed(4) : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {isSuggested ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-300 font-semibold px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20">
                          <Sparkles className="w-2.5 h-2.5" /> Recommended
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">Evaluated</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => onApplyK(m.k)}
                        className={`text-xs px-2.5 py-0.5 rounded font-medium transition-colors ${
                          isSelected
                            ? 'bg-purple-600 text-white'
                            : 'bg-white/5 text-slate-300 hover:text-white'
                        }`}
                      >
                        {isSelected ? 'Active' : 'Select'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
