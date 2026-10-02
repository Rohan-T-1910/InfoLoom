import React, { useState } from 'react';
import { StructuredInsightFact, InsightSeverityType } from '../../types';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  TrendingUp,
  TrendingDown,
  PieChart,
  Percent,
  GitCommit,
  ShieldAlert,
  BrainCircuit,
  BarChart2,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Layers,
} from 'lucide-react';

interface InsightCardProps {
  fact: StructuredInsightFact;
  showPolished?: boolean;
}

export const InsightCard: React.FC<InsightCardProps> = ({ fact, showPolished = true }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  // Icon & color styling by category
  const getCategoryMeta = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'trend':
        return {
          icon: <TrendingUp className="w-4 h-4 text-cyan-400" />,
          label: 'Trend Direction',
          badgeClass: 'border-cyan-500/30 text-cyan-300 bg-cyan-500/10',
        };
      case 'top_contributor':
        return {
          icon: <PieChart className="w-4 h-4 text-amber-400" />,
          label: 'Top Contributor',
          badgeClass: 'border-amber-500/30 text-amber-300 bg-amber-500/10',
        };
      case 'percentage_change':
        return {
          icon: <Percent className="w-4 h-4 text-emerald-400" />,
          label: 'Percentage Shift',
          badgeClass: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10',
        };
      case 'correlation':
        return {
          icon: <GitCommit className="w-4 h-4 text-indigo-400" />,
          label: 'Correlation Signal',
          badgeClass: 'border-indigo-500/30 text-indigo-300 bg-indigo-500/10',
        };
      case 'forecast':
        return {
          icon: <Activity className="w-4 h-4 text-purple-400" />,
          label: 'Forecast Trajectory',
          badgeClass: 'border-purple-500/30 text-purple-300 bg-purple-500/10',
        };
      case 'anomaly':
        return {
          icon: <ShieldAlert className="w-4 h-4 text-rose-400" />,
          label: 'Outlier Anomaly',
          badgeClass: 'border-rose-500/30 text-rose-300 bg-rose-500/10',
        };
      case 'model_performance':
        return {
          icon: <BrainCircuit className="w-4 h-4 text-violet-400" />,
          label: 'Model Benchmark',
          badgeClass: 'border-violet-500/30 text-violet-300 bg-violet-500/10',
        };
      case 'distribution':
        return {
          icon: <BarChart2 className="w-4 h-4 text-blue-400" />,
          label: 'Distribution Shape',
          badgeClass: 'border-blue-500/30 text-blue-300 bg-blue-500/10',
        };
      default:
        return {
          icon: <FileCheck className="w-4 h-4 text-slate-400" />,
          label: 'Data Quality',
          badgeClass: 'border-slate-500/30 text-slate-300 bg-slate-500/10',
        };
    }
  };

  // Severity styling
  const getSeverityBadge = (sev: InsightSeverityType) => {
    switch (sev) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border border-rose-500/40 bg-rose-500/15 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.25)]">
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            Critical
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border border-amber-500/40 bg-amber-500/15 text-amber-300">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            Warning
          </span>
        );
      case 'positive':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border border-emerald-500/40 bg-emerald-500/15 text-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Positive
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border border-slate-500/30 bg-white/[0.04] text-slate-300">
            <Info className="w-3 h-3 text-slate-400" />
            Info
          </span>
        );
    }
  };

  const meta = getCategoryMeta(fact.category);
  const isPolishedActive = showPolished && fact.is_llm_polished && fact.polished_explanation && !showOriginal;
  const displayText = isPolishedActive ? fact.polished_explanation : fact.explanation;

  return (
    <Card className="border border-white/[0.08] bg-[#0c0818]/90 backdrop-blur-md overflow-hidden transition-all hover:border-white/20">
      <CardHeader className="pb-3 pt-4 px-5 border-b border-white/[0.04]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              {meta.icon}
            </div>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${meta.badgeClass}`}>
              {meta.label}
            </span>

            {/* AI Polish status indicator */}
            {fact.is_llm_polished && (
              <span
                onClick={() => setShowOriginal(!showOriginal)}
                className="cursor-pointer inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-purple-300 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 transition-colors"
                title="Click to toggle between AI-polished phrasing and deterministic template text"
              >
                <Sparkles className="w-2.5 h-2.5 text-purple-400" />
                {showOriginal ? 'Template Text' : 'AI Phrased'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400">
              Confidence: <strong className="text-slate-200">{Math.round(fact.confidence * 100)}%</strong>
            </span>
            {getSeverityBadge(fact.severity)}
          </div>
        </div>

        <CardTitle className="text-base font-semibold text-white tracking-tight flex items-center justify-between">
          <span>{fact.title}</span>
          {fact.direction === 'upward' && <ArrowUpRight className="w-4 h-4 text-emerald-400 shrink-0" />}
          {fact.direction === 'downward' && <ArrowDownRight className="w-4 h-4 text-rose-400 shrink-0" />}
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-3.5 pb-4 px-5 space-y-3">
        {/* Main Human-Readable Explanation */}
        <p className="text-xs text-slate-300 leading-relaxed font-sans">
          {displayText}
        </p>

        {/* Metric Badges Strip */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <div className="px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] font-mono text-slate-400">
            Feature: <strong className="text-slate-200">{fact.feature}</strong>
          </div>

          {fact.secondary_feature && (
            <div className="px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] font-mono text-slate-400">
              Pair: <strong className="text-slate-200">{fact.secondary_feature}</strong>
            </div>
          )}

          {fact.change_pct !== null && fact.change_pct !== undefined && (
            <div
              className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono font-medium ${
                fact.change_pct >= 0
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
              }`}
            >
              Delta: {fact.change_pct >= 0 ? '+' : ''}
              {fact.change_pct.toFixed(1)}%
            </div>
          )}

          {fact.current_value !== null && fact.current_value !== undefined && (
            <div className="px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] font-mono text-slate-400">
              Value: <strong className="text-slate-200">{fact.current_value.toLocaleString()}</strong>
            </div>
          )}

          {fact.comparison_value !== null && fact.comparison_value !== undefined && (
            <div className="px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06] text-[11px] font-mono text-slate-400">
              Baseline: <strong className="text-slate-300">{fact.comparison_value.toLocaleString()}</strong>
            </div>
          )}
        </div>

        {/* Supporting Evidence Accordion */}
        <div className="pt-2 border-t border-white/[0.04]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full h-7 px-2 text-[11px] text-slate-400 hover:text-white justify-between hover:bg-white/[0.02]"
          >
            <span className="flex items-center gap-1.5 font-mono">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              Supporting Evidence &amp; Analytical Basis
            </span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </Button>

          {isExpanded && (
            <div className="mt-2.5 p-3 rounded-xl bg-black/40 border border-white/[0.06] space-y-2 text-xs animate-in fade-in-50 duration-200">
              <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pb-1.5 border-b border-white/[0.06]">
                <span>Deterministic Rule Verification</span>
                <span className="text-emerald-400 font-medium">100% Data Backed</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                {Object.entries(fact.supporting_evidence || {}).map(([key, val]) => (
                  <div key={key} className="p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <span className="text-[10px] text-slate-500 font-mono block uppercase">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className="font-mono text-slate-200 font-medium break-all">
                      {typeof val === 'number'
                        ? val.toLocaleString(undefined, { maximumFractionDigits: 4 })
                        : Array.isArray(val)
                        ? val.join(', ')
                        : String(val)}
                    </span>
                  </div>
                ))}
              </div>

              {fact.is_llm_polished && showOriginal && (
                <div className="mt-2 pt-2 border-t border-white/[0.04] text-[11px] text-slate-400">
                  <span className="text-purple-400 font-mono font-semibold">Original Template: </span>
                  <span className="italic">{fact.explanation}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
