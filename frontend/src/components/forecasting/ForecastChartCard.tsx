import React, { useState, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import '../../lib/chartSetup';
import {
  ForecastModelResponse,
  TimeSeriesPoint,
  FutureForecastPoint,
  ForecastBacktestPoint,
} from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  TrendingUp,
  Download,
  Calendar,
  Table as TableIcon,
  LineChart as LineChartIcon,
  Info,
} from 'lucide-react';

interface ForecastChartCardProps {
  model: ForecastModelResponse;
}

type ViewMode = 'all' | 'future' | 'backtest' | 'table';

export const ForecastChartCard: React.FC<ForecastChartCardProps> = ({ model }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('all');

  const historical = model.historical_points || [];
  const future = model.forecast_points || [];
  const backtest = model.backtest_points || model.validation_points || [];
  const horizon = model.horizon ?? model.forecast_horizon ?? future.length ?? 14;

  // Export forecast CSV
  const handleExportCSV = () => {
    if (!future.length) return;
    const headers = ['Date', 'Forecast', 'Lower_Expected_Bound', 'Upper_Expected_Bound'];
    const rows = future.map((f) => {
      const dateStr = f.date || f.timestamp || '';
      return [
        dateStr,
        typeof f.forecast === 'number' ? f.forecast.toFixed(4) : '',
        typeof f.lower_ci === 'number' ? f.lower_ci.toFixed(4) : '',
        typeof f.upper_ci === 'number' ? f.upper_ci.toFixed(4) : '',
      ];
    });
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `${(model.name || 'forecast').replace(/\s+/g, '_')}_${horizon}_periods.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Safe date formatter
  const formatDate = (iso: string | undefined | null) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      if (model.frequency === 'h') {
        return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: '2-digit' });
    } catch {
      return String(iso);
    }
  };

  // Prepare Chart Data safely with simplified plain labels: "Past", "Forecast", "Expected range"
  const chartData = useMemo(() => {
    if (viewMode === 'future') {
      const labels = future.map((f) => formatDate(f.date || f.timestamp));
      return {
        labels,
        datasets: [
          {
            label: 'Expected range (Upper)',
            data: future.map((f) => f.upper_ci),
            borderColor: 'rgba(56, 189, 248, 0.35)',
            backgroundColor: 'rgba(56, 189, 248, 0.08)',
            pointRadius: 0,
            borderWidth: 1,
            borderDash: [4, 4],
            fill: '+1',
            tension: 0.2,
          },
          {
            label: 'Expected range',
            data: future.map((f) => f.lower_ci),
            borderColor: 'rgba(56, 189, 248, 0.35)',
            backgroundColor: 'transparent',
            pointRadius: 0,
            borderWidth: 1,
            borderDash: [4, 4],
            fill: false,
            tension: 0.2,
          },
          {
            label: 'Forecast',
            data: future.map((f) => f.forecast),
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.4)',
            pointBackgroundColor: '#38bdf8',
            pointBorderColor: '#fff',
            pointRadius: 5,
            pointHoverRadius: 7,
            borderWidth: 2.5,
            tension: 0.2,
          },
        ],
      };
    }

    if (viewMode === 'backtest') {
      const labels = backtest.map((b) => formatDate(b.date || b.timestamp));
      return {
        labels,
        datasets: [
          {
            label: 'Past',
            data: backtest.map((b) => b.actual),
            borderColor: '#a855f7',
            backgroundColor: 'rgba(168, 85, 247, 0.2)',
            pointBackgroundColor: '#a855f7',
            pointBorderColor: '#fff',
            pointRadius: 4,
            borderWidth: 2,
            tension: 0.2,
          },
          {
            label: 'Forecast',
            data: backtest.map((b) => b.predicted),
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.2)',
            pointBackgroundColor: '#38bdf8',
            pointBorderColor: '#fff',
            pointRadius: 4,
            borderWidth: 2,
            borderDash: [5, 4],
            tension: 0.2,
          },
        ],
      };
    }

    // Default 'all': Past performance + Expected Future Forecast
    const allLabels: string[] = [
      ...historical.map((h) => formatDate(h.date || h.timestamp)),
      ...future.map((f) => formatDate(f.date || f.timestamp)),
    ];

    const histCount = historical.length;
    const futureCount = future.length;

    const histData: (number | null)[] = [
      ...historical.map((h) => h.value),
      ...new Array(futureCount).fill(null),
    ];

    const lastHistVal = histCount > 0 ? historical[histCount - 1].value : null;

    const forecastData: (number | null)[] = [
      ...new Array(Math.max(0, histCount - 1)).fill(null),
      ...(lastHistVal !== null && histCount > 0 ? [lastHistVal] : []),
      ...future.map((f) => f.forecast),
    ];

    const upperCIData: (number | null)[] = [
      ...new Array(Math.max(0, histCount - 1)).fill(null),
      ...(lastHistVal !== null && histCount > 0 ? [lastHistVal] : []),
      ...future.map((f) => f.upper_ci),
    ];

    const lowerCIData: (number | null)[] = [
      ...new Array(Math.max(0, histCount - 1)).fill(null),
      ...(lastHistVal !== null && histCount > 0 ? [lastHistVal] : []),
      ...future.map((f) => f.lower_ci),
    ];

    return {
      labels: allLabels,
      datasets: [
        {
          label: 'Expected range (Upper)',
          data: upperCIData,
          borderColor: 'rgba(56, 189, 248, 0.35)',
          backgroundColor: 'rgba(56, 189, 248, 0.08)',
          pointRadius: 0,
          borderWidth: 1,
          borderDash: [3, 3],
          fill: '+1',
          tension: 0.2,
        },
        {
          label: 'Expected range',
          data: lowerCIData,
          borderColor: 'rgba(56, 189, 248, 0.35)',
          backgroundColor: 'transparent',
          pointRadius: 0,
          borderWidth: 1,
          borderDash: [3, 3],
          fill: false,
          tension: 0.2,
        },
        {
          label: 'Past',
          data: histData,
          borderColor: '#a855f7',
          backgroundColor: 'rgba(168, 85, 247, 0.1)',
          pointBackgroundColor: '#a855f7',
          pointBorderColor: '#fff',
          pointRadius: historical.length > 80 ? 0 : 3,
          pointHoverRadius: 5,
          borderWidth: 2,
          tension: 0.15,
        },
        {
          label: 'Forecast',
          data: forecastData,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.2)',
          pointBackgroundColor: '#38bdf8',
          pointBorderColor: '#fff',
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 2.5,
          borderDash: [6, 4],
          tension: 0.2,
        },
      ],
    };
  }, [historical, future, backtest, viewMode, model.frequency]);

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#cbd5e1',
          font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
          boxWidth: 14,
          padding: 16,
          filter: (item: any) => !item.text.includes('(Upper)'),
        },
      },
      tooltip: {
        backgroundColor: '#0c0818',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        padding: 12,
        titleFont: { size: 12, family: "'Plus Jakarta Sans', sans-serif", weight: '600' },
        bodyFont: { size: 12, family: "'JetBrains Mono', monospace" },
        callbacks: {
          label: (context: any) => {
            const val = context.parsed.y;
            if (val === null || val === undefined) return '';
            const datasetLabel = context.dataset.label.replace(' (Upper)', '');
            return ` ${datasetLabel}: ${Number(val).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: {
          color: '#94a3b8',
          font: { family: "'JetBrains Mono', monospace", size: 11 },
          maxRotation: 45,
          maxTicksLimit: 14,
        },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.06)' },
        ticks: {
          color: '#94a3b8',
          font: { family: "'JetBrains Mono', monospace", size: 11 },
          callback: (value: any) =>
            typeof value === 'number' && Math.abs(value) >= 1000
              ? `${(value / 1000).toFixed(1)}k`
              : value,
        },
      },
    },
  };

  return (
    <Card className="border border-white/[0.08] bg-[#0c0818]/90 overflow-hidden shadow-xl">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            <CardTitle className="text-base font-semibold text-white">
              {model.name && !model.name.startsWith('ARIMA(') ? model.name : `${model.target_column} Forecast (${horizon} periods)`}
            </CardTitle>
            <Badge variant="purple" className="text-[10px]">
              {model.target_column}
            </Badge>
          </div>
          <CardDescription className="text-xs text-slate-400 mt-1">
            Timeline: <strong className="text-slate-300">{model.date_column}</strong> • Forecast period:{' '}
            <strong className="text-cyan-400">{horizon} periods ahead</strong>
          </CardDescription>
        </div>

        {/* View Mode Controls & Export */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-black/40 border border-white/10 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('all')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                viewMode === 'all'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Full Timeline
            </button>
            <button
              onClick={() => setViewMode('future')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                viewMode === 'future'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Future Only
            </button>
            {backtest.length > 0 && (
              <button
                onClick={() => setViewMode('backtest')}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                  viewMode === 'backtest'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Accuracy Test
              </button>
            )}
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                viewMode === 'table'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Table View
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="text-xs text-slate-300 h-8"
          >
            <Download className="w-3.5 h-3.5 mr-1 text-cyan-400" />
            Download Forecast (CSV)
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        {/* Business explanation banner */}
        <div className="flex items-center gap-2 text-xs text-slate-300 bg-cyan-950/20 border border-cyan-500/20 rounded-xl px-3.5 py-2.5">
          <Info className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            Based on the historical pattern, InfoLoom expects the metric to follow this trend over the selected period.
          </span>
        </div>

        {viewMode !== 'table' ? (
          <div className="h-96 w-full">
            <Line data={chartData} options={chartOptions} />
          </div>
        ) : (
          /* Tabular Forecast View */
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>
                Projected values for the next <strong>{future.length}</strong> time intervals with expected boundaries.
              </span>
              <span className="font-mono text-[11px] text-cyan-400">
                Sorted chronologically
              </span>
            </div>
            <div className="overflow-x-auto max-h-96 rounded-xl border border-white/[0.08] bg-[#090514]">
              <table className="w-full text-xs text-left">
                <thead className="bg-white/[0.04] text-slate-300 font-semibold border-b border-white/[0.08] sticky top-0">
                  <tr>
                    <th className="py-2.5 px-4">Period</th>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4 text-right">Forecasted Value</th>
                    <th className="py-2.5 px-4 text-right">Expected Min</th>
                    <th className="py-2.5 px-4 text-right">Expected Max</th>
                    <th className="py-2.5 px-4 text-right">Expected Range</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {future.map((point, idx) => {
                    const spread = (point.upper_ci ?? 0) - (point.lower_ci ?? 0);
                    return (
                      <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 px-4 font-mono text-slate-400">t + {idx + 1}</td>
                        <td className="py-2.5 px-4 font-mono text-slate-300">
                          {formatDate(point.date || point.timestamp)}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-cyan-400">
                          {typeof point.forecast === 'number'
                            ? point.forecast.toFixed(4)
                            : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-400">
                          {typeof point.lower_ci === 'number'
                            ? point.lower_ci.toFixed(4)
                            : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-400">
                          {typeof point.upper_ci === 'number'
                            ? point.upper_ci.toFixed(4)
                            : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-500">
                          ±{(spread / 2).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Simplified Plain Legend */}
        <div className="pt-2 border-t border-white/[0.06] flex flex-wrap items-center justify-between text-xs text-slate-400 gap-3">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-purple-500 rounded-full" />
              <span>Past ({historical.length} observations)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-cyan-400 border-dashed rounded-full" />
              <span>Forecast ({future.length} periods)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-2 bg-sky-500/20 border border-sky-400/40 rounded-sm" />
              <span>Expected range</span>
            </div>
          </div>
          <span className="text-[11px] text-slate-400">
            Click on points or switch to Table View to inspect values
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
