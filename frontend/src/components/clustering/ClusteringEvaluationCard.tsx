import React, { useState } from 'react';
import { Line } from 'react-chartjs-2';
import { ClusteringEvaluationResponse } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Sparkles,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  LineChart,
  Users,
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
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);

  const kLabels = evaluation.k_metrics.map((m) => `${m.k} Groups`);
  const inertias = evaluation.k_metrics.map((m) => m.inertia);
  const silhouettes = evaluation.k_metrics.map((m) => m.silhouette_score ?? 0);

  // Inertia (Elbow Method) Chart Data
  const inertiaData = {
    labels: kLabels,
    datasets: [
      {
        label: 'Compactness (Inertia)',
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
        label: 'Separation Quality',
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
    <Card className="border-white/[0.08] bg-[#0c0817]/95 backdrop-blur-xl shadow-xl">
      <CardHeader className="pb-4 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <CardTitle className="text-base text-white font-semibold">
                Group Count Recommendation
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-400">
              Analyzed {evaluation.n_samples} records using {evaluation.features.length} selected fields to recommend the most balanced division.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="purple" className="text-xs px-2.5 py-1">
              Recommended: {evaluation.suggested_k} Groups
            </Badge>
            {currentK !== evaluation.suggested_k && (
              <Button
                variant="glow"
                size="sm"
                onClick={() => onApplyK(evaluation.suggested_k)}
                className="h-8 text-xs px-3"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Use {evaluation.suggested_k} Groups
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-5">
        {/* User-friendly Recommendation Banner */}
        <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-300 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">
                Recommended: {evaluation.suggested_k} distinct groups
              </h4>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                Based on the natural patterns and distribution of your selected fields, dividing your data into {evaluation.suggested_k} groups provides the clearest contrast between segments without overcomplicating the profiles.
              </p>
            </div>
          </div>

          {currentK !== evaluation.suggested_k ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onApplyK(evaluation.suggested_k)}
              className="text-xs border-purple-500/30 text-purple-300 hover:bg-purple-900/30 shrink-0"
            >
              Apply Recommendation ({evaluation.suggested_k})
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 shrink-0 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>Applied</span>
            </div>
          )}
        </div>

        {/* Collapsible Technical Details (Elbow & Silhouette curves) */}
        <div className="pt-2 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors"
          >
            {showTechnicalDetails ? (
              <ChevronUp className="w-3.5 h-3.5 text-purple-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-purple-400" />
            )}
            <span>View technical group evaluation curves</span>
          </button>

          {showTechnicalDetails && (
            <div className="mt-4 space-y-6 animate-in fade-in duration-200">
              {/* Dual Diagnostic Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart 1: Compactness */}
                <div className="p-4 rounded-xl bg-[#120d24]/60 border border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-white block">
                        Group Compactness (Lower is more cohesive)
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Evaluates intra-group variance as group count increases
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      Variance Curve
                    </Badge>
                  </div>

                  <div className="h-44 w-full">
                    <Line data={inertiaData} options={chartOptions} />
                  </div>
                </div>

                {/* Chart 2: Separation */}
                <div className="p-4 rounded-xl bg-[#120d24]/60 border border-white/[0.06] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-white block">
                        Group Distinction (Higher indicates clearer boundaries)
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Measures how distinct each group is from its neighbors
                      </span>
                    </div>
                    <Badge variant="success" className="text-[10px]">
                      Separation Index
                    </Badge>
                  </div>

                  <div className="h-44 w-full">
                    <Line data={silhouetteData} options={chartOptions} />
                  </div>
                </div>
              </div>

              {/* Evaluation Metrics Summary Table */}
              <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-[#120d24]/40">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-slate-400 bg-white/[0.02]">
                      <th className="py-2.5 px-3 font-semibold">Group Count</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Compactness Score</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Separation Index</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {evaluation.k_metrics.map((m) => {
                      const isSuggested = m.k === evaluation.suggested_k;
                      return (
                        <tr
                          key={m.k}
                          className={`transition-colors ${
                            isSuggested ? 'bg-purple-600/15' : 'hover:bg-white/[0.02]'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-medium text-white flex items-center gap-2">
                            <span>{m.k} Groups</span>
                            {isSuggested && (
                              <Badge variant="purple" className="text-[9px] px-1.5 py-0">
                                Recommended
                              </Badge>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-right text-slate-300">
                            {m.inertia.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-right text-emerald-400 font-semibold">
                            {m.silhouette_score != null ? m.silhouette_score.toFixed(4) : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {isSuggested ? (
                              <span className="text-purple-300 font-medium">Optimal Choice</span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
