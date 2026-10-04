import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Dataset, DatasetPreviewResponse } from '../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import {
  Upload,
  Database,
  BarChart3,
  ShieldCheck,
  Trash2,
  Eye,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  FileSpreadsheet,
} from 'lucide-react';

export const DatasetsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<DatasetPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [cleaningDatasetId, setCleaningDatasetId] = useState<number | null>(null);
  const [cleanSuccess, setCleanSuccess] = useState<string | null>(null);

  // Fetch datasets
  const { data: datasetsData, isLoading } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.listDatasets(0, 50),
  });

  const datasets = datasetsData?.items || [];

  // Upload mutation
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setUploadError('Only CSV files are supported.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      await api.uploadDataset(file);
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteDataset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      queryClient.invalidateQueries({ queryKey: ['eda'] });
    },
  });

  // Clean mutation
  const cleanMutation = useMutation({
    mutationFn: (id: number) =>
      api.cleanDataset(id, {
        numeric_impute_strategy: 'median',
        categorical_impute_strategy: 'mode',
        outlier_strategy: 'clip',
        outlier_method: 'iqr',
      }),
    onSuccess: (_, datasetId) => {
      setCleanSuccess(`Dataset #${datasetId} successfully cleaned! EDA cache refreshed.`);
      queryClient.invalidateQueries({ queryKey: ['datasets'] });
      queryClient.invalidateQueries({ queryKey: ['eda'] });
      setTimeout(() => setCleanSuccess(null), 5000);
    },
  });

  // Preview handler
  const handlePreview = async (dataset: Dataset, cleaned = false) => {
    setPreviewLoading(true);
    try {
      const data = cleaned
        ? await api.getCleanedPreview(dataset.id, 10)
        : await api.getPreview(dataset.id, 10);
      setPreviewData(data);
    } catch (err: any) {
      alert(err.message || 'Failed to preview dataset');
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-purple-400" />
            <span>Dataset Management</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Upload and manage your CSV datasets for exploration, modeling, and reporting.
          </p>
        </div>

        {/* Upload Button */}
        <div>
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
            <Button variant="glow" size="default" disabled={uploading} asChild>
              <span>
                <Upload className={`w-4 h-4 mr-2 ${uploading ? 'animate-bounce' : ''}`} />
                {uploading ? 'Uploading...' : 'Upload CSV File'}
              </span>
            </Button>
          </label>
        </div>
      </div>

      {uploadError && (
        <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-950/20 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{uploadError}</span>
        </div>
      )}

      {cleanSuccess && (
        <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-950/20 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{cleanSuccess}</span>
        </div>
      )}

      {/* Datasets Table */}
      <Card className="border border-white/[0.08] bg-[#0c0818]/90">
        <CardHeader className="pb-3 border-b border-white/[0.06]">
          <CardTitle className="text-base font-semibold text-white flex items-center justify-between">
            <span>Stored Datasets</span>
            <Badge variant="purple" className="text-xs">
              {datasets.length} Files
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : datasets.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              No datasets found. Upload a CSV file above to start exploring your data.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#120c24] text-slate-400 uppercase tracking-wider font-semibold border-b border-white/[0.08]">
                  <tr>
                    <th className="py-3 px-4">Filename</th>
                    <th className="py-3 px-3">Dimensions</th>
                    <th className="py-3 px-3">Size</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Uploaded</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {datasets.map((dataset) => (
                    <tr key={dataset.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4 font-medium text-white">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-purple-400 flex-shrink-0" />
                          <span className="truncate max-w-[220px]" title={dataset.original_filename}>
                            {dataset.original_filename}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 font-mono text-slate-300">
                        {dataset.row_count || 0} rows × {dataset.column_count || 0} cols
                      </td>

                      <td className="py-3.5 px-3 font-mono text-slate-400">
                        {(dataset.file_size_bytes / 1024).toFixed(1)} KB
                      </td>

                      <td className="py-3.5 px-3">
                        <Badge
                          variant={dataset.has_cleaned ? 'success' : 'secondary'}
                          className="text-[10px] px-2 py-0.5"
                        >
                          {dataset.has_cleaned ? 'Cleaned' : 'Original'}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-3 text-slate-400">
                        {new Date(dataset.created_at).toLocaleDateString()}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Preview Raw */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-slate-300"
                            onClick={() => handlePreview(dataset, false)}
                            title="Preview Original Data"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Original
                          </Button>

                          {/* Preview Cleaned */}
                          {dataset.has_cleaned && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-emerald-300"
                              onClick={() => handlePreview(dataset, true)}
                              title="Preview Cleaned Data"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              Cleaned
                            </Button>
                          )}

                          {/* Trigger Cleaning Pipeline */}
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 px-2.5 text-xs text-slate-200 hover:text-white"
                            onClick={() => cleanMutation.mutate(dataset.id)}
                            disabled={cleanMutation.isPending}
                            title="Clean Data"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                            Clean
                          </Button>

                          {/* Launch EDA */}
                          <Link to={`/eda?datasetId=${dataset.id}`}>
                            <Button variant="default" size="sm" className="h-7 px-2.5 text-xs">
                              <BarChart3 className="w-3.5 h-3.5 mr-1 text-purple-200" />
                              Explore
                            </Button>
                          </Link>

                          {/* Delete */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-slate-400 hover:text-rose-400"
                            onClick={() => {
                              if (confirm(`Delete ${dataset.original_filename}?`)) {
                                deleteMutation.mutate(dataset.id);
                              }
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Modal */}
      {previewData && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl max-h-[85vh] flex flex-col border border-white/10 bg-[#0c0818]">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-white/[0.08]">
              <div>
                <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-purple-400" />
                  <span>{previewData.original_filename}</span>
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Showing first {previewData.sample_rows.length} preview rows of {previewData.row_count} total rows
                </CardDescription>
              </div>
              <button
                onClick={() => setPreviewData(null)}
                className="text-slate-400 hover:text-white p-1"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </CardHeader>

            <CardContent className="p-4 overflow-auto flex-1">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#140e26] text-slate-400 font-mono uppercase text-[11px] sticky top-0">
                  <tr>
                    {previewData.columns.map((c) => (
                      <th key={c} className="py-2.5 px-3 border-b border-white/10">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {previewData.sample_rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02]">
                      {previewData.columns.map((col) => (
                        <td key={col} className="py-2 px-3 font-mono text-slate-200">
                          {row[col] !== null && row[col] !== undefined ? String(row[col]) : (
                            <span className="text-slate-600 italic">null</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
