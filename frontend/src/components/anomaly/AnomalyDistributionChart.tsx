import React from 'react';
import { Bar } from 'react-chartjs-2';
import '../../lib/chartSetup';
import { AnomalyDistributionBucket } from '../../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { BarChart2, Info, ShieldAlert, Sparkles } from 'lucide-react';

interface AnomalyDistributionChartProps {
  buckets: AnomalyDistributionBucket[];
  thresholdScore: number;
}

export const AnomalyDistributionChart: React.FC<AnomalyDistributionChartProps> = ({
  buckets,
  thresholdScore,
}) => {
  if (!buckets || buckets.length === 0) {
    return null;
  }

  const labels = buckets.map((b) => b.label);
  const normalCounts = buckets.map((b) => Math.max(0, b.count - b.anomaly_count));
  const anomalyCounts = buckets.map((b) => b.anomaly_count);

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Normal Inliers',
        data: normalCounts,
        backgroundColor: 'rgba(168, 85, 247, 0.65)',
        borderColor: '#a855f7',
        borderWidth: 1,
        borderRadius: 4,
        stack: 'Stack 0',
      },
      {
        label: 'Flagged Outliers / Anomalies',
        data: anomalyCounts,
        backgroundColor: 'rgba(244, 63, 94, 0.85)',
        borderColor: '#f43f5e',
        borderWidth: 1,
        borderRadius: 4,
        stack: 'Stack 0',
      },
    ],
  };

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
          boxWidth: 12,
          padding: 14,
        },
      },
      tooltip: {
        backgroundColor: '#0c0818',
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        padding: 10,
        titleFont: { size: 12, family: "'Plus Jakarta Sans', sans-serif" },
        bodyFont: { size: 11, family: "'JetBrains Mono', monospace" },
      },
    },
    scales: {
      x: {
        stacked: true,
        grid: { color: 'rgba(255, 255, 255, 0.04)' },
        ticks: {
          color: '#94a3b8',
          font: { family: "'JetBrains Mono', monospace", size: 10 },
          maxRotation: 45,
        },
      },
      y: {
        stacked: true,
        grid: { color: 'rgba(255, 255, 255, 0.06)' },
        ticks: {
          color: '#94a3b8',
          font: { family: "'JetBrains Mono', monospace", size: 10 },
          precision: 0,
        },
      },
    },
  };

  return (
    <Card className="border border-white/[0.08] bg-[#0c0818]/90 overflow-hidden">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-purple-400" />
            <CardTitle className="text-base font-semibold text-white">
              Anomaly Score Distribution
            </CardTitle>
            <Badge variant="purple" className="text-[10px]">
              Histogram Bins
            </Badge>
          </div>
          <CardDescription className="text-xs text-slate-400 mt-1">
            Records with scores below the decision threshold ({thresholdScore.toFixed(4)}) deviate significantly from normal patterns and are flagged as anomalies.
          </CardDescription>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-purple-500" />
            <span>Normal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
            <span>Anomalous</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5">
        <div className="h-64 w-full">
          <Bar data={chartData} options={chartOptions} />
        </div>
      </CardContent>
    </Card>
  );
};
