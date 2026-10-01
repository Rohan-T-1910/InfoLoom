import React, { useState } from 'react';
import { ClusteringModelResponse } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Layers, Sliders, BarChart2, TrendingUp, Filter } from 'lucide-react';

interface ClusterProfilesCardProps {
  model: ClusteringModelResponse;
}

const CLUSTER_COLORS = [
  '#a855f7', // purple
  '#06b6d4', // cyan
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ec4899', // pink
  '#6366f1', // indigo
  '#f97316', // orange
  '#14b8a6', // teal
  '#8b5cf6', // violet
  '#84cc16', // lime
];

export const ClusterProfilesCard: React.FC<ClusterProfilesCardProps> = ({ model }) => {
  const [activeClusterId, setActiveClusterId] = useState<number>(0);

  const activeProfile =
    model.cluster_profiles.find((p) => p.cluster_id === activeClusterId) ||
    model.cluster_profiles[0];

  return (
    <Card className="border-white/[0.08] bg-[#0c0817]/90 backdrop-blur-xl">
      <CardHeader className="pb-4 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base text-white font-semibold">
                Customer Segment Profiles & Feature Statistics
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Detailed parametric and non-parametric profiles for each identified cluster.
              </CardDescription>
            </div>
          </div>

          {/* Cluster Selector Tabs */}
          <div className="flex flex-wrap gap-1.5 bg-[#120d24] p-1 rounded-xl border border-white/[0.06]">
            {model.cluster_profiles.map((p, idx) => {
              const isSelected = p.cluster_id === activeClusterId;
              const color = CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
              return (
                <button
                  key={p.cluster_id}
                  type="button"
                  onClick={() => setActiveClusterId(p.cluster_id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span>Cluster {p.cluster_id}</span>
                </button>
              );
            })}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {activeProfile && (
          <div className="space-y-5">
            {/* Active Profile Header Banner */}
            <div className="p-4 rounded-xl bg-[#120d24]/80 border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor:
                        CLUSTER_COLORS[activeProfile.cluster_id % CLUSTER_COLORS.length],
                    }}
                  />
                  <h4 className="text-sm font-bold text-white">
                    {activeProfile.name}
                  </h4>
                  <Badge variant="purple" className="text-[10px]">
                    Segment #{activeProfile.cluster_id}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Encompasses{' '}
                  <strong className="text-white font-mono">
                    {activeProfile.size.toLocaleString()}
                  </strong>{' '}
                  rows ({activeProfile.percentage}% of dataset partition)
                </p>
              </div>

              <div className="text-right">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider block">
                  Segment Weight
                </span>
                <span className="text-lg font-mono font-bold text-purple-300">
                  {activeProfile.percentage}%
                </span>
              </div>
            </div>

            {/* Feature Statistics Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] text-slate-400 bg-white/[0.02]">
                    <th className="py-3 px-4 font-semibold">Feature Name</th>
                    <th className="py-3 px-3 font-semibold text-right">Mean (μ)</th>
                    <th className="py-3 px-3 font-semibold text-right">Median</th>
                    <th className="py-3 px-3 font-semibold text-right">Std Dev (σ)</th>
                    <th className="py-3 px-3 font-semibold text-right">Min</th>
                    <th className="py-3 px-4 font-semibold text-right">Max</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {activeProfile.stats.map((s) => (
                    <tr key={s.feature} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-white">
                        {s.feature}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-purple-300 font-bold">
                        {s.mean.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-300">
                        {s.median.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-400">
                        {s.std.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-400">
                        {s.min.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400">
                        {s.max.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cluster Centers Comparison Grid */}
            <div className="p-4 rounded-xl bg-[#120d24]/50 border border-white/[0.06] space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <Sliders className="w-3.5 h-3.5 text-purple-400" />
                <span>All Cluster Centroids (Unscaled Space)</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-slate-400">
                      <th className="py-2 px-3 font-semibold">Cluster</th>
                      {model.feature_names.map((f) => (
                        <th key={f} className="py-2 px-3 font-semibold text-right font-mono">
                          {f}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {model.cluster_profiles.map((p, idx) => (
                      <tr
                        key={p.cluster_id}
                        className={`transition-colors ${
                          p.cluster_id === activeClusterId
                            ? 'bg-purple-600/10'
                            : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <td className="py-2.5 px-3 flex items-center gap-2 font-medium text-white">
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                CLUSTER_COLORS[idx % CLUSTER_COLORS.length],
                            }}
                          />
                          <span>Cluster {p.cluster_id}</span>
                        </td>
                        {model.feature_names.map((feat) => {
                          const val = model.cluster_centers[feat]?.[idx];
                          return (
                            <td key={feat} className="py-2.5 px-3 text-right font-mono text-slate-300">
                              {val != null ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
