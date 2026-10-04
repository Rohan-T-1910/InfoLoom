import React from 'react';
import { DatasetKPIs } from '../../types';
import { Card } from '../ui/card';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  LayoutGrid,
} from 'lucide-react';

interface EDAKPIsProps {
  kpis: DatasetKPIs;
  isCleaned: boolean;
  cached: boolean;
  createdAt?: string | null;
}

export const EDAKPIs: React.FC<EDAKPIsProps> = ({ kpis }) => {
  const completenessPct = Math.max(0, +(100 - kpis.missing_percentage).toFixed(1));
  const hasDuplicates = kpis.duplicate_rows > 0;
  const hasMissing = kpis.missing_cells > 0;

  const kpiItems = [
    {
      title: 'Total Records',
      value: `${kpis.row_count.toLocaleString()} rows`,
      subvalue: `${kpis.column_count} fields (${kpis.total_cells.toLocaleString()} data points)`,
      icon: Database,
      color: 'text-purple-400',
      bgColor: 'bg-purple-950/40',
    },
    {
      title: 'Data Completeness',
      value: `${completenessPct}%`,
      subvalue: hasMissing
        ? `${kpis.missing_cells.toLocaleString()} empty values (${kpis.missing_percentage}%)`
        : 'All records fully complete',
      icon: hasMissing ? AlertCircle : CheckCircle2,
      color: kpis.missing_percentage > 5 ? 'text-amber-400' : 'text-emerald-400',
      bgColor: kpis.missing_percentage > 5 ? 'bg-amber-950/30' : 'bg-emerald-950/30',
    },
    {
      title: 'Duplicate Records',
      value: hasDuplicates ? `${kpis.duplicate_rows.toLocaleString()} duplicates` : 'None',
      subvalue: hasDuplicates
        ? `${kpis.duplicate_percentage}% of total dataset`
        : 'All rows are unique',
      icon: Copy,
      color: hasDuplicates ? 'text-amber-400' : 'text-emerald-400',
      bgColor: hasDuplicates ? 'bg-amber-950/30' : 'bg-emerald-950/30',
    },
    {
      title: 'Usable Fields',
      value: `${kpis.column_count} Fields`,
      subvalue: `${kpis.numeric_columns_count} numerical, ${kpis.categorical_columns_count} categorical`,
      icon: LayoutGrid,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-950/40',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
