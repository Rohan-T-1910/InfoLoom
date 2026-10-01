import React, { useState } from 'react';
import { ColumnDistribution } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Bar } from 'react-chartjs-2';
import '../../lib/chartSetup';
import { BarChart3, Hash, Type } from 'lucide-react';

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

  // Chart.js data configuration
  const chartLabels = activeDist.bins.map((b) => b.label);
  const chartValues = activeDist.bins.map((b) => b.count);
  const chartPercentages = activeDist.bins.map((b) => b.percentage);

  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        label: isNumeric ? 'Bin Frequency' : 'Category Count',
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
          afterLabel: (context: any) => {
            const idx = context.dataIndex;
            return `Share: ${chartPercentages[idx]}% of total`;
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
          maxRotation: 45,
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

  return (
    <Card className="border border-white/[0.08] bg-[#0c0818]/90">
      <CardHeader className="pb-3 border-b border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              <span>Univariate Distributions & Histograms</span>
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-0.5">
              Visualize frequency shapes, spreads, and multi-modal distributions across dataset columns
            </CardDescription>
          </div>

          {/* Column Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Select Column:</span>
            <select
              value={selectedColumn}
              onChange={(e) => setSelectedColumn(e.target.value)}
              className="bg-slate-900 border border-purple-500/30 text-purple-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              {columnNames.map((c) => (
                <option key={c} value={c}>
                  {c} ({distributions[c]?.data_type === 'numeric' ? 'Num' : 'Cat'})
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Distribution Chart */}
          <div className="lg:col-span-3 h-[340px] w-full">
            <Bar data={chartData} options={chartOptions} />
          </div>

          {/* Column Summary Characteristics */}
          <div className="space-y-3 lg:border-l lg:border-white/[0.08] lg:pl-6 flex flex-col justify-center">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <span className="text-xs text-slate-400 font-medium">Feature</span>
              <span className="font-semibold text-sm text-slate-100 flex items-center gap-1.5">
                {isNumeric ? (
                  <Hash className="w-3.5 h-3.5 text-purple-400" />
                ) : (
                  <Type className="w-3.5 h-3.5 text-indigo-400" />
                )}
                {selectedColumn}
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <span className="text-xs text-slate-400">Data Type</span>
              <Badge variant={isNumeric ? 'purple' : 'secondary'} className="text-[10px]">
                {isNumeric ? 'Continuous / Numeric' : 'Discrete / Categorical'}
              </Badge>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <span className="text-xs text-slate-400">Total Valid Samples</span>
              <span className="font-mono text-xs font-semibold text-white">
                {activeDist.summary?.count?.toLocaleString() || 0}
              </span>
            </div>

            {isNumeric ? (
              <>
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <span className="text-xs text-slate-400">Arithmetic Mean</span>
                  <span className="font-mono text-xs font-semibold text-purple-300">
                    {activeDist.summary?.mean !== undefined ? activeDist.summary.mean.toLocaleString() : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                  <span className="text-xs text-slate-400">Median (50th %ile)</span>
                  <span className="font-mono text-xs font-semibold text-slate-200">
                    {activeDist.summary?.median !== undefined ? activeDist.summary.median.toLocaleString() : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Range [Min, Max]</span>
                  <span className="font-mono text-xs text-slate-300">
                    [{activeDist.summary?.min}, {activeDist.summary?.max}]
                  </span>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Distinct Categories</span>
                <span className="font-mono text-xs font-semibold text-indigo-300">
                  {activeDist.summary?.unique || 0} classes
                </span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
