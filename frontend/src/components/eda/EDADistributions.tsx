import React, { useState } from 'react';
import { ColumnDistribution } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Bar } from 'react-chartjs-2';
import '../../lib/chartSetup';
import { BarChart3, Hash, Type, Sparkles } from 'lucide-react';

interface EDADistributionsProps {
  distributions: Record<string, ColumnDistribution>;
}

export const EDADistributions: React.FC<EDADistributionsProps> = ({ distributions }) => {
  const columnNames = Object.keys(distributions);
  const [selectedColumn, setSelectedColumn] = useState<string>(columnNames[0] || '');

  const activeDist = distributions[selectedColumn];

  if (!activeDist || columnNames.length === 0) {
    return (
      <Card className="border border-white/[0.08] bg-[#0c0818]/90 p-8 text-center text-slate-500">
        No distribution data available.
      </Card>
    );
  }

  const isNumeric = activeDist.data_type === 'numeric';

  // Chart data
  const chartLabels = activeDist.bins.map((b) => b.label);
  const chartValues = activeDist.bins.map((b) => b.count);
  const chartPercentages = activeDist.bins.map((b) => b.percentage);

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: 'Number of Records',
        data: chartValues,
        backgroundColor: isNumeric
          ? 'rgba(168, 85, 247, 0.65)'
          : 'rgba(139, 92, 246, 0.65)',
        hoverBackgroundColor: isNumeric
          ? 'rgba(192, 132, 252, 0.9)'
          : 'rgba(167, 139, 250, 0.9)',
        borderColor: isNumeric ? '#c084fc' : '#a78bfa',
        borderWidth: 1.5,
        borderRadius: 6,
      },
    ],
  };

  const chartOptions: any = {
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
            const idx = context.dataIndex;
            const count = chartValues[idx]?.toLocaleString() || 0;
            const pct = chartPercentages[idx] || 0;
            return `Records: ${count} (${pct}% of total)`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          color: '#94a3b8',
          font: { size: 11 },
          maxRotation: 40,
          minRotation: 0,
        },
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.05)',
        },
        ticks: {
          color: '#94a3b8',
          font: { size: 11 },
          precision: 0,
        },
      },
    },
  };

  // Plain-language takeaway text
  let takeaway = '';
  if (isNumeric && activeDist.summary) {
    const minVal = activeDist.summary.min?.toLocaleString() ?? '—';
    const maxVal = activeDist.summary.max?.toLocaleString() ?? '—';
    const typVal = activeDist.summary.median?.toLocaleString() ?? activeDist.summary.mean?.toLocaleString() ?? '—';
    takeaway = `Values range from ${minVal} to ${maxVal}, with typical records clustering around ${typVal}.`;
  } else if (!isNumeric && activeDist.bins.length > 0) {
    const topBin = activeDist.bins[0];
    takeaway = `'${topBin.label}' is the most frequent option, representing ${topBin.percentage}% of all records.`;
  }

  return (
    <Card className="border border-white/[0.08] bg-[#0c0818]/90">
      <CardHeader className="pb-3 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              <span>Field Value Distribution</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-0.5">
              See how records are distributed across different values for any field.
            </CardDescription>
          </div>

          {/* Field Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Select Field:</span>
            <select
              value={selectedColumn}
              onChange={(e) => setSelectedColumn(e.target.value)}
              className="bg-slate-900 border border-purple-500/30 text-purple-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              {columnNames.map((c) => (
                <option key={c} value={c}>
                  {c} ({distributions[c]?.data_type === 'numeric' ? 'Number' : 'Category'})
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Distribution Chart */}
          <div className="lg:col-span-3 h-[320px] w-full">
            <Bar data={chartData} options={chartOptions} />
          </div>

          {/* Plain-Language Field Overview Panel */}
          <div className="space-y-3.5 lg:border-l lg:border-white/[0.08] lg:pl-6 flex flex-col justify-center">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <span className="text-xs text-slate-400 font-medium">Field</span>
              <span className="font-semibold text-sm text-slate-100 flex items-center gap-1.5 truncate max-w-[140px]">
                {isNumeric ? (
                  <Hash className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                ) : (
                  <Type className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                )}
                <span className="truncate">{selectedColumn}</span>
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <span className="text-xs text-slate-400">Content Type</span>
              <Badge variant={isNumeric ? 'purple' : 'secondary'} className="text-[10px]">
                {isNumeric ? 'Number' : 'Category / Text'}
              </Badge>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <span className="text-xs text-slate-400">Total Records</span>
              <span className="font-mono text-xs font-semibold text-white">
                {activeDist.summary?.count?.toLocaleString() || 0}
              </span>
            </div>

            {isNumeric ? (
              <>
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <span className="text-xs text-slate-400">Typical Value</span>
                  <span className="font-mono text-xs font-semibold text-purple-300">
                    {activeDist.summary?.median !== undefined
                      ? activeDist.summary.median.toLocaleString()
                      : activeDist.summary?.mean !== undefined
                      ? activeDist.summary.mean.toLocaleString()
                      : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <span className="text-xs text-slate-400">Value Range</span>
                  <span className="font-mono text-xs text-slate-300">
                    {activeDist.summary?.min?.toLocaleString()} → {activeDist.summary?.max?.toLocaleString()}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                <span className="text-xs text-slate-400">Distinct Options</span>
                <span className="font-mono text-xs font-semibold text-indigo-300">
                  {activeDist.summary?.unique || activeDist.bins.length} categories
                </span>
              </div>
            )}

            {/* Quick takeaway observation */}
            {takeaway && (
              <div className="p-3 rounded-lg bg-black/40 border border-white/[0.06] text-xs text-slate-300">
                <div className="flex items-center gap-1.5 text-purple-300 font-semibold mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Key Observation</span>
                </div>
                <p className="leading-relaxed text-[11px] text-slate-400">{takeaway}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
