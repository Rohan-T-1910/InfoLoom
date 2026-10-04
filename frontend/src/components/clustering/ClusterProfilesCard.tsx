import React, { useState } from 'react';
import { ClusteringModelResponse } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Users,
  Sliders,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

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
  const [activeClusterId, setActiveClusterId] = useState<number>(
    model.cluster_profiles[0]?.cluster_id ?? 0
  );
  const [showTechnicalStats, setShowTechnicalStats] = useState<boolean>(false);

  const activeProfile =
    model.cluster_profiles.find((p) => p.cluster_id === activeClusterId) ||
    model.cluster_profiles[0];

  // Calculate weighted overall dataset average for each feature
  const overallAverages: Record<string, number> = {};
  model.feature_names.forEach((feat) => {
    let totalWeightedSum = 0;
    let totalSize = 0;

    model.cluster_profiles.forEach((p) => {
      const stat = p.stats.find((s) => s.feature === feat);
      if (stat && stat.mean != null) {
        totalWeightedSum += stat.mean * p.size;
        totalSize += p.size;
      }
    });

    overallAverages[feat] = totalSize > 0 ? totalWeightedSum / totalSize : 0;
  });

  // Generate plain-language, calculated observations for the active group
  const generateGroupObservations = (profile: typeof activeProfile) => {
    if (!profile) return [];

    const traitDiffs = profile.stats.map((s) => {
      const overall = overallAverages[s.feature] ?? s.mean;
      const diffRatio = overall !== 0 ? (s.mean - overall) / Math.abs(overall) : 0;
      return {
        feature: s.feature,
        groupMean: s.mean,
        overallMean: overall,
        diffRatio,
        absRatio: Math.abs(diffRatio),
      };
    });

    // Sort by most distinguishing characteristics
    traitDiffs.sort((a, b) => b.absRatio - a.absRatio);

    const observations: { text: string; direction: 'high' | 'low' | 'typical' }[] = [];

    traitDiffs.forEach((item) => {
      const pct = Math.round(item.diffRatio * 100);
      const formattedGroupMean =
        Math.abs(item.groupMean) >= 1000
          ? item.groupMean.toLocaleString(undefined, { maximumFractionDigits: 1 })
          : item.groupMean.toLocaleString(undefined, { maximumFractionDigits: 2 });
      const formattedOverall =
        Math.abs(item.overallMean) >= 1000
          ? item.overallMean.toLocaleString(undefined, { maximumFractionDigits: 1 })
          : item.overallMean.toLocaleString(undefined, { maximumFractionDigits: 2 });

      if (item.diffRatio >= 0.1) {
        observations.push({
          text: `Has a higher average ${item.feature} (${formattedGroupMean} vs ${formattedOverall} dataset average, +${pct}%)`,
          direction: 'high',
        });
      } else if (item.diffRatio <= -0.1) {
        observations.push({
          text: `Typically shows lower average ${item.feature} (${formattedGroupMean} vs ${formattedOverall} dataset average, ${pct}%)`,
          direction: 'low',
        });
      } else {
        observations.push({
          text: `Is characterized by typical ${item.feature} levels (${formattedGroupMean} vs ${formattedOverall} average)`,
          direction: 'typical',
        });
      }
    });

    return observations;
  };

  const observations = generateGroupObservations(activeProfile);

  return (
    <Card className="border-white/[0.08] bg-[#0c0817]/95 backdrop-blur-xl shadow-xl">
      <CardHeader className="pb-4 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base text-white font-semibold">
                What Makes Each Group Different
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Compare characteristics across groups to understand distinct patterns in your data.
              </CardDescription>
            </div>
          </div>

          {/* Group Selector Tabs */}
          <div className="flex flex-wrap gap-1.5 bg-[#120d24] p-1 rounded-xl border border-white/[0.06]">
            {model.cluster_profiles.map((p, idx) => {
              const isSelected = p.cluster_id === activeClusterId;
              const color = CLUSTER_COLORS[idx % CLUSTER_COLORS.length];
              const groupLabel = p.name?.startsWith('Cluster')
                ? `Group ${idx + 1}`
                : p.name || `Group ${idx + 1}`;

              return (
                <button
                  key={p.cluster_id}
                  type="button"
                  onClick={() => setActiveClusterId(p.cluster_id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span>{groupLabel}</span>
                  <span className="text-[10px] opacity-70">({p.percentage}%)</span>
                </button>
              );
            })}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {activeProfile && (
          <div className="space-y-6">
            {/* Active Group Highlight Banner */}
            <div className="p-4 rounded-xl bg-[#120d24]/80 border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{
                    backgroundColor:
                      CLUSTER_COLORS[activeProfile.cluster_id % CLUSTER_COLORS.length],
                  }}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-white">
                      {activeProfile.name?.startsWith('Cluster')
                        ? `Group ${activeProfile.cluster_id + 1}`
                        : activeProfile.name || `Group ${activeProfile.cluster_id + 1}`}
                    </h4>
                    <Badge variant="purple" className="text-[10px] px-2 py-0.5">
                      {activeProfile.size.toLocaleString()} records ({activeProfile.percentage}% of data)
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    Characterized by noticeable patterns in {model.feature_names.slice(0, 3).join(', ')}.
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                  Group Size
                </span>
                <span className="text-xl font-mono font-bold text-purple-300">
                  {activeProfile.percentage}%
                </span>
              </div>
            </div>

            {/* Natural-Language Distinct Characteristics */}
            <div className="space-y-2.5">
              <span className="text-xs font-semibold text-slate-300 block flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Key Distinguishing Traits (Calculated vs Dataset Average)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {observations.slice(0, 4).map((obs, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[#120d24]/50 border border-white/[0.06] flex items-start gap-2.5 text-xs text-slate-200"
                  >
                    {obs.direction === 'high' ? (
                      <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    ) : obs.direction === 'low' ? (
                      <TrendingDown className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                      <Minus className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    )}
                    <span className="leading-relaxed">{obs.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Field Comparison Table */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300 block">
                Field Averages Comparison
              </span>
              <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-[#120d24]/30">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-slate-400 bg-white/[0.02]">
                      <th className="py-2.5 px-4 font-semibold">Field</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Group Average</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Overall Average</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Comparison</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {activeProfile.stats.map((s) => {
                      const overall = overallAverages[s.feature] ?? s.mean;
                      const diff = overall !== 0 ? (s.mean - overall) / Math.abs(overall) : 0;
                      const diffPct = Math.round(diff * 100);

                      return (
                        <tr key={s.feature} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4 font-medium text-white">
                            {s.feature}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-purple-300 font-bold">
                            {Math.abs(s.mean) >= 1000
                              ? s.mean.toLocaleString(undefined, { maximumFractionDigits: 1 })
                              : s.mean.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-slate-300">
                            {Math.abs(overall) >= 1000
                              ? overall.toLocaleString(undefined, { maximumFractionDigits: 1 })
                              : overall.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {diffPct > 5 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                                <TrendingUp className="w-3 h-3" />
                                +{diffPct}% vs avg
                              </span>
                            ) : diffPct < -5 ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                                <TrendingDown className="w-3 h-3" />
                                {diffPct}% vs avg
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-medium">
                                Typical
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Collapsible Detailed Statistical Breakdown for Analysts */}
            <div className="pt-2 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => setShowTechnicalStats(!showTechnicalStats)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-300 transition-colors"
              >
                {showTechnicalStats ? (
                  <ChevronUp className="w-3.5 h-3.5 text-purple-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-purple-400" />
                )}
                <span>View detailed statistical distribution (Min, Max, Median, Std Dev)</span>
              </button>

              {showTechnicalStats && (
                <div className="mt-3 overflow-x-auto rounded-xl border border-white/[0.06] bg-[#120d24]/50 animate-in fade-in duration-200">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-slate-400 bg-white/[0.02]">
                        <th className="py-2.5 px-4 font-semibold">Field</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Mean</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Median</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Std Dev</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Min</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Max</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {activeProfile.stats.map((s) => (
                        <tr key={s.feature} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-4 font-mono text-white">{s.feature}</td>
                          <td className="py-2.5 px-3 text-right font-mono text-purple-300">
                            {s.mean.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                            {s.median.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                            {s.std.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                            {s.min.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-slate-400">
                            {s.max.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
