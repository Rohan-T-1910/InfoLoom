import React from 'react';
import { ClusteringModelResponse } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Users, PieChart, Layers, Gauge, ShieldCheck } from 'lucide-react';

interface ClusterDistributionCardProps {
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

export const ClusterDistributionCard: React.FC<ClusterDistributionCardProps> = ({ model }) => {
  return (
    <Card className="border-white/[0.08] bg-[#0c0817]/90 backdrop-blur-xl">
      <CardHeader className="pb-4 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base text-white font-semibold">
                Segment Distribution & Balance
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Partition of {model.n_samples} total instances into {model.k} distinct clusters.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {model.silhouette_score != null && (
              <Badge variant="success" className="text-xs">
                Silhouette: {model.silhouette_score.toFixed(3)}
              </Badge>
            )}
            <Badge variant="purple" className="text-xs">
              K = {model.k} Segments
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
            <span className="text-[11px] text-slate-400 font-medium">Clustered Samples</span>
            <p className="text-lg font-mono font-bold text-white mt-1">
              {model.n_samples.toLocaleString()}
            </p>
            <span className="text-[10px] text-slate-500">100% assigned</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
            <span className="text-[11px] text-slate-400 font-medium">Inertia (WCSS)</span>
            <p className="text-lg font-mono font-bold text-white mt-1">
              {model.inertia.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </p>
            <span className="text-[10px] text-slate-500">Compactness</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
            <span className="text-[11px] text-slate-400 font-medium">Silhouette Score</span>
            <p className="text-lg font-mono font-bold text-emerald-400 mt-1">
              {model.silhouette_score != null ? model.silhouette_score.toFixed(4) : '—'}
            </p>
            <span className="text-[10px] text-slate-500">Separation quality</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
            <span className="text-[11px] text-slate-400 font-medium">Scaled Features</span>
            <p className="text-lg font-mono font-bold text-purple-300 mt-1">
              {model.feature_names.length}
            </p>
            <span className="text-[10px] text-slate-500">Standardized</span>
          </div>
        </div>

        {/* Stacked Proportional Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Overall Proportion</span>
            <span className="font-mono">100% of data partition</span>
          </div>
          <div className="h-4 w-full rounded-full bg-white/5 overflow-hidden flex">
            {model.cluster_profiles.map((p, idx) => (
              <div
                key={p.cluster_id}
                style={{
                  width: `${p.percentage}%`,
                  backgroundColor: CLUSTER_COLORS[idx % CLUSTER_COLORS.length],
                }}
                className="h-full transition-all duration-500 relative group cursor-pointer"
                title={`${p.name}: ${p.size} (${p.percentage}%)`}
              />
            ))}
          </div>
        </div>

        {/* Per-Cluster Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {model.cluster_profiles.map((p, idx) => {
            const color = CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
            return (
              <div
                key={p.cluster_id}
                className="p-4 rounded-xl bg-[#120d24]/60 border border-white/[0.06] space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-semibold text-white">
                      {p.name}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {p.percentage}%
                  </Badge>
                </div>

                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-slate-400 font-mono">
                    {p.size.toLocaleString()} records
                  </span>
                  <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${p.percentage}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
