import React, { useState } from 'react';
import { CorrelationMatrixResponse } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { AlertTriangle, TrendingUp, TrendingDown, Info } from 'lucide-react';

interface EDACorrelationMatrixProps {
  correlations: CorrelationMatrixResponse;
}

export const EDACorrelationMatrix: React.FC<EDACorrelationMatrixProps> = ({ correlations }) => {
  const [hoveredCell, setHoveredCell] = useState<{ c1: string; c2: string; val: number | null } | null>(null);

  const { columns, matrix, strong_correlations, warnings } = correlations;

  if (columns.length < 2) {
    return (
      <Card className="border border-white/[0.08] bg-[#0c0818]/90 p-6 text-center text-slate-400">
        <Info className="w-8 h-8 text-purple-400 mx-auto mb-2 opacity-60" />
        <p className="text-sm font-medium">Insufficient numeric features for correlation analysis.</p>
        <p className="text-xs text-slate-500 mt-1">
          At least two numerical columns are required to construct a Pearson correlation matrix.
        </p>
      </Card>
    );
  }

  // Helper to calculate cell background color based on r value
  const getCellColor = (val: number | null) => {
    if (val === null || val === undefined) return 'bg-slate-900/60 text-slate-600';
    if (val === 1.0) return 'bg-purple-600/90 text-white font-bold';

    if (val > 0) {
      // Positive correlation: violet/purple intensity
      if (val >= 0.8) return 'bg-purple-600/75 text-white font-semibold';
      if (val >= 0.6) return 'bg-purple-600/50 text-purple-100';
      if (val >= 0.3) return 'bg-purple-600/30 text-purple-200';
      return 'bg-purple-950/20 text-slate-400';
    } else {
      // Negative correlation: rose/amber intensity
      if (val <= -0.8) return 'bg-rose-700/80 text-white font-semibold';
      if (val <= -0.6) return 'bg-rose-600/50 text-rose-100';
      if (val <= -0.3) return 'bg-rose-950/40 text-rose-300';
      return 'bg-rose-950/20 text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Multicollinearity Warning Banner */}
      {warnings && warnings.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 backdrop-blur-md">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-amber-300">Multicollinearity Warning Signals</h4>
              <p className="text-xs text-slate-300 mt-0.5">
                Features with correlation coefficient |r| ≥ 0.90 contain redundant variance. In regression or linear
                modeling, consider dropping one collinear feature to avoid variance inflation.
              </p>
              <ul className="mt-2 space-y-1">
                {warnings.map((w, idx) => (
                  <li key={idx} className="text-xs text-amber-200/90 flex items-center gap-1.5 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Heatmap Matrix Grid */}
        <Card className="lg:col-span-2 border border-white/[0.08] bg-[#0c0818]/90 overflow-hidden">
          <CardHeader className="pb-3 border-b border-white/[0.06]">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-100">
                  Pearson Correlation Matrix
                </CardTitle>
                <CardDescription className="text-xs text-slate-400 mt-0.5">
                  Pairwise linear relationships between numerical features (-1.0 to +1.0)
                </CardDescription>
              </div>
              {hoveredCell && (
                <div className="text-xs font-mono bg-purple-950/60 border border-purple-500/30 px-3 py-1 rounded-md text-purple-200">
                  r({hoveredCell.c1}, {hoveredCell.c2}) ={' '}
                  <span className="font-bold text-white">
                    {hoveredCell.val !== null ? hoveredCell.val.toFixed(3) : 'N/A'}
                  </span>
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-4 overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="grid" style={{ gridTemplateColumns: `110px repeat(${columns.length}, minmax(65px, 1fr))` }}>
                {/* Top header row */}
                <div className="h-10"></div>
                {columns.map((c) => (
                  <div
                    key={c}
                    className="h-10 flex items-center justify-center text-[11px] font-medium text-slate-400 px-1 truncate rotate-[-25deg] origin-bottom-left"
                    title={c}
                  >
                    {c}
                  </div>
                ))}

                {/* Rows */}
                {columns.map((rCol) => (
                  <React.Fragment key={rCol}>
                    <div
                      className="h-11 flex items-center text-xs font-medium text-slate-300 pr-2 truncate"
                      title={rCol}
                    >
                      {rCol}
                    </div>

                    {columns.map((cCol) => {
                      const val = matrix[rCol]?.[cCol] ?? null;
                      const isHovered =
                        hoveredCell?.c1 === rCol && hoveredCell?.c2 === cCol;

                      return (
                        <div
                          key={`${rCol}-${cCol}`}
                          onMouseEnter={() => setHoveredCell({ c1: rCol, c2: cCol, val })}
                          onMouseLeave={() => setHoveredCell(null)}
                          className={`
                            h-11 flex items-center justify-center font-mono text-xs rounded transition-transform cursor-pointer
                            ${getCellColor(val)}
                            ${isHovered ? 'ring-2 ring-purple-300 scale-105 z-10' : 'hover:scale-102'}
                          `}
                          title={`r(${rCol}, ${cCol}) = ${val !== null ? val : 'N/A'}`}
                        >
                          {val !== null ? val.toFixed(2) : '—'}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>

              {/* Heatmap Legend */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/[0.06] text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-rose-600/70 inline-block" />
                  <span>Negative (-1.0)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-slate-900 border border-white/10 inline-block" />
                  <span>Neutral (0.0)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-purple-600 inline-block" />
                  <span>Positive (+1.0)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Strong Correlation Pairs List */}
        <Card className="border border-white/[0.08] bg-[#0c0818]/90 flex flex-col">
          <CardHeader className="pb-3 border-b border-white/[0.06]">
            <CardTitle className="text-base font-semibold text-slate-100 flex items-center justify-between">
              <span>Significant Pairings</span>
              <Badge variant="purple" className="text-xs">
                {strong_correlations.length} Pairs
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Ranked pairs with absolute correlation |r| ≥ 0.65
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 flex-1 overflow-y-auto max-h-[460px] space-y-2.5">
            {strong_correlations.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs">
                No feature pairs exceeded the |r| ≥ 0.65 correlation threshold. Features exhibit low linear collinearity.
              </div>
            ) : (
              strong_correlations.map((pair, idx) => {
                const isPositive = pair.correlation > 0;
                return (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-white/[0.06] bg-black/40 hover:border-purple-500/30 transition-all"
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="font-semibold text-slate-200 truncate max-w-[170px]">
                        {pair.feature_a} <span className="text-purple-400 font-normal">↔</span> {pair.feature_b}
                      </div>
                      <div className="flex items-center gap-1 font-mono font-bold text-xs">
                        {isPositive ? (
                          <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                        )}
                        <span className={isPositive ? 'text-purple-300' : 'text-rose-300'}>
                          {pair.correlation > 0 ? `+${pair.correlation.toFixed(3)}` : pair.correlation.toFixed(3)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>{pair.relationship}</span>
                      <span className="font-mono text-[10px] text-slate-500">Rank #{idx + 1}</span>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
