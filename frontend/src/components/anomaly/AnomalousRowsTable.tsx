import React, { useState, useMemo } from 'react';
import { AnomalousRowDetail } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  ShieldAlert,
  Download,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AnomalousRowsTableProps {
  rows: AnomalousRowDetail[];
  modelName: string;
}

export const AnomalousRowsTable: React.FC<AnomalousRowsTableProps> = ({
  rows,
  modelName,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Filter anomalous rows
  const filteredRows = useMemo(() => {
    return (rows || []).filter((r) => {
      if (severityFilter !== 'all' && r.severity !== severityFilter) {
        return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesIndex = String(r.index).includes(term);
        const matchesFeature = Object.entries(r.feature_values).some(
          ([k, v]) => k.toLowerCase().includes(term) || String(v).includes(term)
        );
        return matchesIndex || matchesFeature;
      }
      return true;
    });
  }, [rows, severityFilter, searchTerm]);

  // Export anomalies to CSV
  const handleExportCSV = () => {
    if (!rows.length) return;
    const firstRowFeatures = Object.keys(rows[0].feature_values);
    const headers = [
      'Row_Number',
      'Severity',
      'Outlier_Likelihood_Pct',
      ...firstRowFeatures,
      'Primary_Unusual_Metric',
      'Deviation_Multiple',
    ];

    const csvRows = rows.map((r) => {
      const topDev = r.top_deviations[0] || { feature: '', z_score: 0 };
      return [
        r.index + 1,
        r.severity,
        `${(r.normalized_score * 100).toFixed(1)}%`,
        ...firstRowFeatures.map((f) => r.feature_values[f] ?? ''),
        topDev.feature,
        `${topDev.z_score.toFixed(1)}x`,
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `${modelName.replace(/\s+/g, '_')}_unusual_records.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleExpand = (idx: number) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  return (
    <Card className="border border-white/[0.08] bg-[#0c0818]/90 overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <CardTitle className="text-base font-semibold text-white">
              Flagged Anomalous Records ({rows.length})
            </CardTitle>
            <Badge variant="purple" className="text-[10px]">
              Root-Cause Explanations
            </Badge>
          </div>
          <CardDescription className="text-xs text-slate-400 mt-1">
            Records whose metric values diverge furthest from standard patterns. Click any row to expand details.
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Severity filter buttons */}
          <div className="flex items-center bg-black/40 border border-white/10 rounded-lg p-0.5">
            {(['all', 'high', 'medium', 'low'] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium capitalize transition-all ${
                  severityFilter === sev
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {sev === 'all' ? 'All Records' : `${sev} Priority`}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={!rows.length}
            className="text-xs text-slate-300 h-8"
          >
            <Download className="w-3.5 h-3.5 mr-1 text-rose-400" />
            Download Records (CSV)
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Search input */}
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by row number or value..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#090514] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>

        {/* Table of anomalous rows */}
        <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#090514]">
          <table className="w-full text-xs text-left">
            <thead className="bg-white/[0.03] text-slate-300 font-semibold border-b border-white/[0.08]">
              <tr>
                <th className="py-2.5 px-4">Record #</th>
                <th className="py-2.5 px-3">Priority</th>
                <th className="py-2.5 px-3">Outlier Rating</th>
                <th className="py-2.5 px-4">Primary Factor Driving Anomaly</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No unusual records found matching active filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isExpanded = expandedIndex === row.index;
                  let badgeClass = 'border-rose-500/30 bg-rose-500/10 text-rose-400';
                  if (row.severity === 'medium') {
                    badgeClass = 'border-amber-500/30 bg-amber-500/10 text-amber-400';
                  } else if (row.severity === 'low') {
                    badgeClass = 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400';
                  }

                  return (
                    <React.Fragment key={row.index}>
                      <tr
                        onClick={() => toggleExpand(row.index)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded ? 'bg-purple-950/20' : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-white">
                          #{row.index}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wider ${badgeClass}`}>
                            {row.severity}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-rose-400">
                          {(row.normalized_score * 100).toFixed(1)}%
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1.5">
                            {row.top_deviations.slice(0, 2).map((dev) => (
                              <span
                                key={dev.feature}
                                className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[11px] text-slate-300"
                              >
                                <strong className="text-purple-300">{dev.feature}:</strong>{' '}
                                {dev.z_score > 0
                                  ? `+${dev.z_score.toFixed(1)}x above normal`
                                  : `${Math.abs(dev.z_score).toFixed(1)}x below normal`}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-slate-400"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </td>
                      </tr>

                      {/* Expanded feature detail panel */}
                      {isExpanded && (
                        <tr className="bg-black/40">
                          <td colSpan={5} className="p-4 border-y border-white/[0.06]">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-white">
                                  Full Deviation Analysis for Row #{row.index}
                                </span>
                                <span className="text-slate-400 text-[11px]">
                                  Compared against typical dataset distribution
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                {row.top_deviations.map((dev) => (
                                  <div
                                    key={dev.feature}
                                    className="p-3 rounded-xl border border-white/[0.06] bg-[#0c0818] space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-semibold text-purple-300">
                                        {dev.feature}
                                      </span>
                                      <span
                                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                                          Math.abs(dev.z_score) >= 2.5
                                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                        }`}
                                      >
                                        {dev.z_score > 0
                                          ? `+${dev.z_score.toFixed(2)}σ`
                                          : `${dev.z_score.toFixed(2)}σ`}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                                      <span>Observed Value: <strong className="text-white">{dev.value}</strong></span>
                                      <span>Typical Avg: ~{dev.inlier_mean.toFixed(1)}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
