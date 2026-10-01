import React, { useState } from 'react';
import { CategoricalColumnStats, NumericColumnStats } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Search, Filter, Hash, Type } from 'lucide-react';

interface EDASummaryStatsProps {
  stats: Record<string, NumericColumnStats | CategoricalColumnStats>;
}

export const EDASummaryStats: React.FC<EDASummaryStatsProps> = ({ stats }) => {
  const [filterType, setFilterType] = useState<'all' | 'numeric' | 'categorical'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const columnNames = Object.keys(stats);

  const filteredColumns = columnNames.filter((col) => {
    const colStat = stats[col];
    const matchesSearch = col.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      filterType === 'all' ||
      (filterType === 'numeric' && colStat.data_type === 'numeric') ||
      (filterType === 'categorical' && colStat.data_type === 'categorical');
    return matchesSearch && matchesType;
  });

  return (
    <Card className="border border-white/[0.08] bg-[#0c0818]/90">
      <CardHeader className="pb-3 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <span>Statistical Profiles & Metrics</span>
              <Badge variant="purple" className="text-xs">
                {columnNames.length} Features
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-1">
              Parametric moments (mean, std, skewness, kurtosis) and non-parametric percentiles (IQR, median).
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-slate-500" />
              <Input
                placeholder="Search features..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-black/40 border-white/10"
              />
            </div>

            <div className="flex bg-slate-900/80 p-0.5 rounded-lg border border-white/10 text-xs">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filterType === 'all' ? 'bg-purple-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({columnNames.length})
              </button>
              <button
                onClick={() => setFilterType('numeric')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filterType === 'numeric' ? 'bg-purple-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                }`}
              >
                Numeric
              </button>
              <button
                onClick={() => setFilterType('categorical')}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  filterType === 'categorical' ? 'bg-purple-600 text-white font-medium' : 'text-slate-400 hover:text-white'
                }`}
              >
                Categorical
              </button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-[#120c24] text-slate-400 uppercase tracking-wider font-semibold border-b border-white/[0.08]">
            <tr>
              <th className="py-3 px-4">Feature Name</th>
              <th className="py-3 px-3">Type</th>
              <th className="py-3 px-3">Count / Missing</th>
              <th className="py-3 px-3 text-right">Mean / Mode</th>
              <th className="py-3 px-3 text-right">Median / Unique</th>
              <th className="py-3 px-3 text-right">Std Dev</th>
              <th className="py-3 px-3 text-right">Min - Max</th>
              <th className="py-3 px-3 text-right">IQR [25% - 75%]</th>
              <th className="py-3 px-3 text-right">Skewness / Kurtosis</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {filteredColumns.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-500">
                  No features match the current query or filter.
                </td>
              </tr>
            ) : (
              filteredColumns.map((colName) => {
                const stat = stats[colName];
                const isNumeric = stat.data_type === 'numeric';

                return (
                  <tr key={colName} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-medium text-slate-200">
                      <div className="flex items-center gap-1.5">
                        {isNumeric ? (
                          <Hash className="w-3.5 h-3.5 text-purple-400" />
                        ) : (
                          <Type className="w-3.5 h-3.5 text-indigo-400" />
                        )}
                        <span>{colName}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <Badge variant={isNumeric ? 'purple' : 'secondary'} className="text-[10px] px-1.5 py-0">
                        {isNumeric ? 'Numeric' : 'Categorical'}
                      </Badge>
                    </td>

                    <td className="py-3 px-3">
                      <div>{stat.count.toLocaleString()} valid</div>
                      <div className={`text-[10px] ${stat.missing_count > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                        {stat.missing_count > 0 ? `${stat.missing_count} (${stat.missing_percentage}%) null` : '0% null'}
                      </div>
                    </td>

                    {isNumeric ? (
                      <>
                        <td className="py-3 px-3 text-right font-mono text-purple-200">
                          {stat.mean !== null ? stat.mean.toLocaleString() : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-200">
                          {stat.median !== null ? stat.median.toLocaleString() : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-400">
                          {stat.std !== null ? stat.std.toLocaleString() : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-300">
                          {stat.min !== null && stat.max !== null ? `${stat.min} → ${stat.max}` : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-400">
                          {stat.iqr !== null ? (
                            <span>
                              {stat.iqr} <span className="text-slate-500 text-[10px]">[{stat.q25} - {stat.q75}]</span>
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          <span className={stat.skewness !== null && Math.abs(stat.skewness) > 1 ? 'text-amber-400' : 'text-slate-400'}>
                            {stat.skewness !== null ? stat.skewness : '—'}
                          </span>
                          <span className="text-slate-600 mx-1">/</span>
                          <span className="text-slate-400">{stat.kurtosis !== null ? stat.kurtosis : '—'}</span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 px-3 text-right font-mono text-indigo-300">
                          <span className="truncate max-w-[120px] inline-block" title={stat.mode || 'N/A'}>
                            {stat.mode || '—'}
                          </span>
                          {stat.mode_frequency ? (
                            <span className="text-[10px] text-slate-500 block">({stat.mode_frequency}x)</span>
                          ) : null}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-200">
                          {stat.unique} distinct
                        </td>
                        <td colSpan={4} className="py-3 px-3 text-right">
                          <div className="flex flex-wrap justify-end gap-1 max-w-[340px] ml-auto">
                            {stat.top_categories.slice(0, 3).map((tc, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-white/[0.04] text-[10px] text-slate-300"
                                title={`${tc.category}: ${tc.count} (${tc.percentage}%)`}
                              >
                                {tc.category}: <span className="text-indigo-400">{tc.percentage}%</span>
                              </span>
                            ))}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
};
