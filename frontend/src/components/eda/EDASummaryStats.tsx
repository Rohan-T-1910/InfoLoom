import React, { useState } from 'react';
import { CategoricalColumnStats, NumericColumnStats } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Search, Hash, Type, CheckCircle2, AlertCircle } from 'lucide-react';

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
              <span>Dataset Fields & Column Overview</span>
              <Badge variant="purple" className="text-xs">
                {columnNames.length} Total Fields
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-1">
              Summary of all fields in the dataset, data completeness, and typical values.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
              <Input
                placeholder="Search fields..."
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
              <th className="py-3 px-4">Field Name</th>
              <th className="py-3 px-3">Content Type</th>
              <th className="py-3 px-3">Completeness</th>
              <th className="py-3 px-3">Usable Entries</th>
              <th className="py-3 px-3">Typical Value</th>
              <th className="py-3 px-4 text-right">Value Range / Options</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {filteredColumns.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  No fields match the current search query or filter.
                </td>
              </tr>
            ) : (
              filteredColumns.map((colName) => {
                const stat = stats[colName];
                const isNumeric = stat.data_type === 'numeric';
                const hasMissing = stat.missing_count > 0;
                const completeness = (100 - stat.missing_percentage).toFixed(1);

                return (
                  <tr key={colName} className="hover:bg-white/[0.02] transition-colors">
                    {/* Field Name */}
                    <td className="py-3 px-4 font-medium text-slate-200">
                      <div className="flex items-center gap-2">
                        {isNumeric ? (
                          <div className="p-1 rounded bg-purple-950/50 text-purple-400 border border-purple-500/20">
                            <Hash className="w-3.5 h-3.5" />
                          </div>
                        ) : (
                          <div className="p-1 rounded bg-indigo-950/50 text-indigo-400 border border-indigo-500/20">
                            <Type className="w-3.5 h-3.5" />
                          </div>
                        )}
                        <span className="font-semibold text-slate-100">{colName}</span>
                      </div>
                    </td>

                    {/* Content Type */}
                    <td className="py-3 px-3">
                      <Badge variant={isNumeric ? 'purple' : 'secondary'} className="text-[10px] px-2 py-0.5">
                        {isNumeric ? 'Number' : 'Category / Text'}
                      </Badge>
                    </td>

                    {/* Completeness */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        {!hasMissing ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-300 font-medium">100% complete</span>
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-amber-300 font-medium">
                              {completeness}% ({stat.missing_count.toLocaleString()} missing)
                            </span>
                          </>
                        )}
                      </div>
                    </td>

                    {/* Usable Entries */}
                    <td className="py-3 px-3 text-slate-300">
                      <span>{stat.count.toLocaleString()} valid records</span>
                    </td>

                    {/* Typical Value */}
                    <td className="py-3 px-3">
                      {isNumeric ? (
                        <div>
                          <span className="font-semibold text-slate-200">
                            {stat.median !== null ? stat.median.toLocaleString() : stat.mean !== null ? stat.mean.toLocaleString() : '—'}
                          </span>
                          <span className="text-[10px] text-slate-500 ml-1.5">(typical value)</span>
                        </div>
                      ) : (
                        <div className="max-w-[200px] truncate" title={stat.mode || 'N/A'}>
                          <span className="font-semibold text-slate-200">{stat.mode || '—'}</span>
                          {stat.mode_frequency ? (
                            <span className="text-[10px] text-slate-400 ml-1.5">
                              ({stat.mode_frequency} records)
                            </span>
                          ) : null}
                        </div>
                      )}
                    </td>

                    {/* Range / Options */}
                    <td className="py-3 px-4 text-right">
                      {isNumeric ? (
                        <span className="text-slate-300 font-mono text-xs">
                          {stat.min !== null && stat.max !== null
                            ? `${stat.min.toLocaleString()} → ${stat.max.toLocaleString()}`
                            : '—'}
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-slate-300 font-medium">
                            {stat.unique} distinct
                          </span>
                          {stat.top_categories && stat.top_categories.length > 0 && (
                            <div className="hidden md:flex items-center gap-1">
                              <span className="text-slate-600">•</span>
                              <span className="text-[10px] text-slate-400 truncate max-w-[140px]">
                                e.g. {stat.top_categories.slice(0, 2).map((tc) => tc.category).join(', ')}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
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
