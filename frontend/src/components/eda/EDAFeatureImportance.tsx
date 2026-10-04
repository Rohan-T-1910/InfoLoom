import React from 'react';
import { FeatureImportanceResponse } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Bar } from 'react-chartjs-2';
import '../../lib/chartSetup';
import { Sparkles, HelpCircle, Layers } from 'lucide-react';

interface EDAFeatureImportanceProps {
  featureImportance: FeatureImportanceResponse | null | undefined;
  onTargetChange?: (target: string) => void;
  isLoading?: boolean;
}

const isIdentifierColumn = (name: string): boolean => {
  if (!name) return false;
  const clean = name.toLowerCase().replace(/[\s_-]+/g, '');
  return (
    clean === 'id' ||
    clean === 'idx' ||
    clean === 'index' ||
    clean === 'uuid' ||
    clean === 'guid' ||
    clean === 'pk' ||
    clean === 'key' ||
    clean === 'token' ||
    clean === 'hash' ||
    clean === 'ssn' ||
    clean.endsWith('id') ||
    clean.startsWith('id') ||
    clean.includes('identifier') ||
    clean.includes('transactionid') ||
    clean.includes('customerid') ||
    clean.includes('orderid') ||
    clean.includes('productid') ||
    clean.includes('accountid') ||
    clean.includes('sessionid') ||
    clean.includes('clientid') ||
    clean.includes('invoiceid') ||
    clean.includes('itemid') ||
    clean.includes('memberid') ||
    clean.includes('employeeid') ||
    clean.includes('ordernumber') ||
    clean.includes('customernumber') ||
    clean.includes('transactionnumber')
  );
};

export const EDAFeatureImportance: React.FC<EDAFeatureImportanceProps> = ({
  featureImportance,
  onTargetChange,
  isLoading,
}) => {
  if (!featureImportance) {
    return (
      <Card className="border border-white/[0.08] bg-[#0c0818]/90 p-8 text-center text-slate-500">
        <Sparkles className="w-8 h-8 text-purple-400 mx-auto mb-2 opacity-50" />
        <p className="text-sm font-medium">No target outcome selected.</p>
        <p className="text-xs text-slate-500 mt-1">
          Select an outcome column to identify which factors have the strongest relationship with it.
        </p>
      </Card>
    );
  }

  const { target_column, features, candidate_targets } = featureImportance;

  // Filter out identifier columns (e.g. Transaction ID, Customer ID) from candidate targets and features
  const businessCandidateTargets = (candidate_targets || []).filter((tgt) => !isIdentifierColumn(tgt));
  const businessFeatures = features.filter((f) => !isIdentifierColumn(f.feature));

  // Re-normalize percentages so remaining analytical drivers represent 100% of analyzed weight
  const rawSum = businessFeatures.reduce((acc, curr) => acc + (curr.importance || 0), 0);
  const normalizedFeatures = businessFeatures.map((f, idx) => {
    const pct = rawSum > 0 ? Math.round(((f.importance || 0) / rawSum) * 1000) / 10 : f.percentage;
    return {
      ...f,
      rank: idx + 1,
      percentage: pct,
    };
  });

  // Chart configuration
  const chartLabels = normalizedFeatures.map((f) => f.feature);
  const chartValues = normalizedFeatures.map((f) => f.percentage);

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Relative Influence Share (%)',
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
            return `Influence: ${context.parsed.x}% relative share`;
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
                <span>What Influences the Outcome?</span>
              </CardTitle>
              <Badge variant="purple" className="text-xs">
                Outcome: {target_column}
              </Badge>
            </div>
            <CardDescription className="text-xs text-slate-400 mt-1">
              These factors showed the strongest relationship with the selected outcome in the initial analysis.
            </CardDescription>
          </div>

          {/* Outcome Switcher */}
          {businessCandidateTargets.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Analyse Outcome:</span>
              <div className="flex flex-wrap gap-1.5">
                {businessCandidateTargets.map((tgt) => (
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
          {/* Main Influence Bar Chart */}
          <div className="lg:col-span-3 h-[320px] w-full">
            {normalizedFeatures.length > 0 ? (
              <Bar data={chartData} options={chartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No non-identifier factors available for ranking.
              </div>
            )}
          </div>

          {/* Ranked Factors Summary Card */}
          <div className="space-y-3 lg:border-l lg:border-white/[0.08] lg:pl-6 flex flex-col justify-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Ranked Key Factors</span>
            </div>

            <div className="space-y-2">
              {normalizedFeatures.slice(0, 4).map((f) => (
                <div
                  key={f.feature}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-black/40 border border-white/[0.06] text-xs"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="w-5 h-5 rounded-full bg-purple-600/30 border border-purple-500/30 flex items-center justify-center font-mono text-[10px] text-purple-300 font-bold flex-shrink-0">
                      {f.rank}
                    </span>
                    <span className="font-semibold text-slate-200 truncate">{f.feature}</span>
                  </div>
                  <span className="font-mono text-purple-300 font-bold flex-shrink-0">
                    {f.percentage}%
                  </span>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-lg bg-black/30 border border-white/[0.04] text-[11px] text-slate-400 leading-relaxed flex items-start gap-1.5 mt-2">
              <HelpCircle className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
              <span>
                These factors show initial association with <strong className="text-slate-200">{target_column}</strong>. Associations do not imply direct cause-and-effect.
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
