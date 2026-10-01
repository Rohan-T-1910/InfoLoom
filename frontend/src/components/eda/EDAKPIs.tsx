import React from 'react';
import { DatasetKPIs } from '../../types';
import { Card } from '../ui/card';
import {
  Rows,
  Columns,
  AlertCircle,
  Copy,
  Hash,
  Binary,
  HardDrive,
} from 'lucide-react';

interface EDAKPIsProps {
  kpis: DatasetKPIs;
  isCleaned: boolean;
  cached: boolean;
  createdAt?: string | null;
}

export const EDAKPIs: React.FC<EDAKPIsProps> = ({ kpis, isCleaned, cached, createdAt }) => {
  const kpiItems = [
    {
      title: 'Total Dimensions',
      value: `${kpis.row_count.toLocaleString()} × ${kpis.column_count}`,
      subvalue: `${kpis.total_cells.toLocaleString()} data cells`,
      icon: Rows,
      color: 'text-purple-400',
      bgColor: 'bg-purple-950/40',
    },
    {
      title: 'Missing Values',
      value: `${kpis.missing_percentage}%`,
      subvalue: `${kpis.missing_cells.toLocaleString()} empty cells`,
      icon: AlertCircle,
      color: kpis.missing_percentage > 5 ? 'text-amber-400' : 'text-emerald-400',
      bgColor: kpis.missing_percentage > 5 ? 'bg-amber-950/30' : 'bg-emerald-950/30',
    },
    {
      title: 'Duplicate Rows',
      value: `${kpis.duplicate_percentage}%`,
      subvalue: `${kpis.duplicate_rows.toLocaleString()} exact duplicates`,
      icon: Copy,
      color: kpis.duplicate_rows > 0 ? 'text-rose-400' : 'text-emerald-400',
      bgColor: kpis.duplicate_rows > 0 ? 'bg-rose-950/30' : 'bg-emerald-950/30',
    },
    {
      title: 'Feature Split',
      value: `${kpis.numeric_columns_count} Num / ${kpis.categorical_columns_count} Cat`,
      subvalue: `${Math.round((kpis.numeric_columns_count / kpis.column_count) * 100)}% numeric density`,
      icon: Binary,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-950/40',
    },
    {
      title: 'Memory Footprint',
      value: kpis.memory_human,
      subvalue: `${(kpis.memory_bytes / 1024).toFixed(1)} KB in-memory`,
      icon: HardDrive,
      color: 'text-slate-300',
      bgColor: 'bg-slate-900/60',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
      {kpiItems.map((item, idx) => {
        const Icon = item.icon;
        return (
          <Card
            key={idx}
            className="p-4 border border-white/[0.08] bg-[#0c0818]/90 hover:border-purple-500/30 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400 font-medium">{item.title}</span>
              <div className={`p-1.5 rounded-lg ${item.bgColor} ${item.color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight text-white mb-0.5">{item.value}</div>
              <div className="text-[11px] text-slate-400 truncate">{item.subvalue}</div>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
