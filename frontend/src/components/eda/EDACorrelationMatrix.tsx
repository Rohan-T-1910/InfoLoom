import React from 'react';
import { CorrelationMatrixResponse } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { TrendingUp, TrendingDown, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react';

interface EDACorrelationMatrixProps {
  correlations: CorrelationMatrixResponse;
}

const isIdentifierColumn = (name: string): boolean => {
  const clean = name.toLowerCase().replace(/[\s_-]+/g, '');
  return (
    clean === 'id' ||
    clean.endsWith('id') ||
    clean.startsWith('id') ||
    clean.includes('identifier') ||
    clean.includes('transactionid') ||
    clean.includes('customerid')
  );
};

export const EDACorrelationMatrix: React.FC<EDACorrelationMatrixProps> = ({ correlations }) => {
  const { columns, strong_correlations, warnings } = correlations;

  // Filter out any relationships involving identifier columns
  const meaningfulPairs = (strong_correlations || []).filter(
    (pair) => !isIdentifierColumn(pair.feature_a) && !isIdentifierColumn(pair.feature_b)
  );

  return (
    <Card className="border border-white/[0.08] bg-[#0c0818]/90">
      <CardHeader className="pb-3 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Key Relationships & Patterns</span>
              {meaningfulPairs.length > 0 && (
                <Badge variant="purple" className="text-xs">
                  {meaningfulPairs.length} Notable {meaningfulPairs.length === 1 ? 'Relationship' : 'Relationships'}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-1">
              Notable relationships identified among the numerical fields in your dataset.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {/* Multicollinearity or Redundancy Warning */}
        {warnings && warnings.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-amber-300">High Overlap Detected</h4>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Certain fields share nearly identical information. When training predictive models, consider using only one of each pair to prevent redundant weighting.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {warnings.map((w, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-md bg-amber-900/30 border border-amber-500/20 text-xs text-amber-200"
                    >
                      {w.replace(/\(r=[0-9.]+\)/gi, '').replace(/\s+/g, ' ').trim()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Meaningful Relationships Grid */}
        {columns.length < 2 ? (
          <div className="p-8 text-center text-slate-400">
            <p className="text-sm font-medium">Insufficient numerical fields for relationship discovery.</p>
            <p className="text-xs text-slate-500 mt-1">
              At least two numerical columns are needed to analyze relationships between factors.
            </p>
          </div>
        ) : meaningfulPairs.length === 0 ? (
          <div className="p-6 rounded-xl border border-white/[0.06] bg-black/20 text-center">
            <CheckCircle2 className="w-6 h-6 text-purple-400 mx-auto mb-2 opacity-80" />
            <h4 className="text-sm font-semibold text-slate-200">Independent Factors</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto leading-relaxed">
              No strong relationships were identified among the numerical fields. The numerical factors appear to vary independently of one another.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {meaningfulPairs.map((pair, idx) => {
              const isPositive = pair.correlation > 0;
              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-white/[0.08] bg-black/30 hover:border-purple-500/30 transition-all flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <span>{pair.feature_a}</span>
                      <span className="text-purple-400 font-normal">↔</span>
                      <span>{pair.feature_b}</span>
                    </div>
                    <Badge
                      variant={isPositive ? 'purple' : 'destructive'}
                      className="text-[10px] px-2 py-0.5 flex items-center gap-1"
                    >
                      {isPositive ? (
                        <>
                          <TrendingUp className="w-3 h-3" />
                          <span>Positive Relationship</span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="w-3 h-3" />
                          <span>Inverse Relationship</span>
                        </>
                      )}
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mb-3">
                    {isPositive ? (
                      <>
                        <strong className="text-white">{pair.feature_a}</strong> and{' '}
                        <strong className="text-white">{pair.feature_b}</strong> show a strong positive relationship. When {pair.feature_a} is higher, {pair.feature_b} also tends to be higher.
                      </>
                    ) : (
                      <>
                        <strong className="text-white">{pair.feature_a}</strong> and{' '}
                        <strong className="text-white">{pair.feature_b}</strong> show an inverse relationship. As {pair.feature_a} increases, {pair.feature_b} tends to decrease.
                      </>
                    )}
                  </p>

                  <div className="text-[11px] text-slate-500 border-t border-white/[0.04] pt-2 flex items-center justify-between">
                    <span>Observed in dataset records</span>
                    <span className="text-slate-400 italic">Association only (not direct causation)</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
