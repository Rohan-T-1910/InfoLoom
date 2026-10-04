import React, { useState } from 'react';
import { ClusteringModelResponse } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Users, PieChart, Layers, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [showTechnical, setShowTechnical] = useState<boolean>(false);

  // Derive human-friendly quality assessment
  const getQualityLabel = (score?: number | null) => {
    if (score == null) return 'Calculated';
    if (score >= 0.5) return 'Strong Contrast';
    if (score >= 0.3) return 'Clear Separation';
    return 'Moderate Separation';
  };

  return (
    <Card className="border-white/[0.08] bg-[#0c0817]/95 backdrop-blur-xl shadow-xl">
      <CardHeader className="pb-4 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base text-white font-semibold">
                Group Overview & Balance
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                {model.n_samples.toLocaleString()} total records divided into {model.k} groups.
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="purple" className="text-xs">
              {model.k} Groups
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* User-friendly KPI Summary Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
            <span className="text-[11px] text-slate-400 font-medium">Total Records</span>
            <p className="text-lg font-mono font-bold text-white mt-1">
              {model.n_samples.toLocaleString()}
            </p>
            <span className="text-[10px] text-emerald-400 font-medium">100% grouped</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
            <span className="text-[11px] text-slate-400 font-medium">Number of Groups</span>
            <p className="text-lg font-mono font-bold text-white mt-1">
              {model.k}
            </p>
            <span className="text-[10px] text-purple-300 font-medium">Natural partition</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
            <span className="text-[11px] text-slate-400 font-medium">Fields Used</span>
            <p className="text-lg font-mono font-bold text-purple-300 mt-1">
              {model.feature_names.length}
            </p>
            <span className="text-[10px] text-slate-400">Determining traits</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#120d24] border border-white/[0.06]">
            <span className="text-[11px] text-slate-400 font-medium">Group Distinction</span>
            <p className="text-lg font-semibold text-emerald-400 mt-1">
              {getQualityLabel(model.silhouette_score)}
            </p>
            <span className="text-[10px] text-slate-400">Consistent boundaries</span>
          </div>
        </div>

        {/* Stacked Proportional Distribution Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Overall Dataset Proportion</span>
            <span className="font-mono text-slate-300">100% of records</span>
          </div>
          <div className="h-4 w-full rounded-full bg-white/5 overflow-hidden flex shadow-inner">
            {model.cluster_profiles.map((p, idx) => (
              <div
                key={p.cluster_id}
                style={{
                  width: `${p.percentage}%`,
                  backgroundColor: CLUSTER_COLORS[idx % CLUSTER_COLORS.length],
                }}
                className="h-full transition-all duration-500 hover:brightness-125"
                title={`${p.name || `Group ${idx + 1}`}: ${p.percentage}% (${p.size} records)`}
              />
            ))}
          </div>

          {/* Group breakdown chips */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
            {model.cluster_profiles.map((p, idx) => {
              const color = CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
              const groupLabel = p.name?.startsWith('Cluster') ? `Group ${idx + 1}` : p.name || `Group ${idx + 1}`;
              return (
                <div
                  key={p.cluster_id}
                  className="p-3 rounded-xl bg-[#120d24]/60 border border-white/[0.06] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div>
                      <span className="text-xs font-semibold text-white block">
                        {groupLabel}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {p.size.toLocaleString()} records
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-purple-300">
                      {p.percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Collapsible Technical Details for Data Scientists */}
        <div className="pt-2 border-t border-white/[0.06]">
          <button
            type="button"
            onClick={() => setShowTechnical(!showTechnical)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors"
          >
            {showTechnical ? (
              <ChevronUp className="w-3.5 h-3.5 text-purple-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-purple-400" />
            )}
            <span>View technical validation scores</span>
          </button>

          {showTechnical && (
            <div className="mt-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-slate-400 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <span>Inertia (Within-Cluster Sum of Squares):</span>
                <span className="text-slate-300 font-mono">
                  {model.inertia.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Silhouette Score (-1 to +1):</span>
                <span className="text-emerald-400 font-mono font-semibold">
                  {model.silhouette_score != null ? model.silhouette_score.toFixed(4) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Features used in distance calculation:</span>
                <span className="text-slate-300 font-mono">{model.feature_names.join(', ')}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
