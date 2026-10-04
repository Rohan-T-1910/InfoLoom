import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import {
  ReportReadinessResponse,
  ReportDocumentResponse,
  CSVExportPreviewResponse,
  Dataset,
} from '../types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  FileText,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Cpu,
  TrendingUp,
  ShieldAlert,
  Network,
  Database,
  Eye,
  Check,
  Calendar,
  Layers,
  BarChart3,
  HardDrive,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Dataset selection
  const datasetIdParam = searchParams.get('datasetId');
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(
    datasetIdParam ? parseInt(datasetIdParam, 10) : null
  );

  // CSV Export Mode state
  const [exportType, setExportType] = useState<'ml' | 'forecast' | 'anomaly'>('ml');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);
  const [exportErrorMessage, setExportErrorMessage] = useState<string | null>(null);

  // 1. Fetch user datasets
  const { data: datasetsData, isLoading: isLoadingDatasets } = useQuery({
    queryKey: ['datasets'],
    queryFn: () => api.listDatasets(0, 50),
  });

  const datasets = datasetsData?.items || [];
  const effectiveId = selectedDatasetId ?? (datasets[0]?.id ?? null);
  const currentDataset = datasets.find((d) => d.id === effectiveId) || datasets[0] || null;

  useEffect(() => {
    if (!selectedDatasetId && datasets.length > 0) {
      setSelectedDatasetId(datasets[0].id);
    }
  }, [datasets, selectedDatasetId]);

  const handleDatasetChange = (id: number) => {
    setSelectedDatasetId(id);
    setSearchParams({ datasetId: String(id) });
    setDownloadSuccessMessage(null);
    setExportErrorMessage(null);
  };

  // 2. Fetch Report Readiness
  const {
    data: readiness,
    isLoading: isLoadingReadiness,
    refetch: refetchReadiness,
  } = useQuery<ReportReadinessResponse>({
    queryKey: ['report-readiness', effectiveId],
    queryFn: () => api.getReportReadiness(effectiveId!),
    enabled: !!effectiveId,
  });

  // 3. Fetch CSV Export Preview
  const {
    data: csvPreview,
    isLoading: isLoadingCsvPreview,
    isPending: isPendingCsvPreview,
    error: csvPreviewError,
    refetch: refetchCsvPreview,
  } = useQuery<CSVExportPreviewResponse>({
    queryKey: ['csv-preview', effectiveId, exportType],
    queryFn: () => api.previewPredictionsCSV(effectiveId!, exportType),
    enabled: !!effectiveId,
    retry: false,
  });

  // 4. Fetch Report History
  const {
    data: history = [],
    isLoading: isLoadingHistory,
    refetch: refetchHistory,
  } = useQuery<ReportDocumentResponse[]>({
    queryKey: ['report-history', effectiveId],
    queryFn: () => api.getReportHistory(effectiveId!, 15),
    enabled: !!effectiveId,
  });

  // PDF Download Handler
  const handleDownloadPdf = async () => {
    if (!effectiveId) return;
    setIsGeneratingPdf(true);
    setDownloadSuccessMessage(null);
    setExportErrorMessage(null);
    try {
      const { blob, filename } = await api.downloadPdfReport(effectiveId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setDownloadSuccessMessage(`Executive PDF report "${filename}" downloaded successfully.`);
      refetchHistory();
    } catch (err: any) {
      setExportErrorMessage(err.message || 'Failed to generate PDF report.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // CSV Export Handler
  const handleDownloadCsv = async () => {
    if (!effectiveId) return;
    setIsExportingCsv(true);
    setDownloadSuccessMessage(null);
    setExportErrorMessage(null);
    try {
      const { blob, filename } = await api.downloadPredictionsCSV(effectiveId, exportType);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setDownloadSuccessMessage(`Prediction dataset "${filename}" exported successfully.`);
      refetchHistory();
    } catch (err: any) {
      setExportErrorMessage(err.message || `Failed to export ${exportType.toUpperCase()} predictions.`);
    } finally {
      setIsExportingCsv(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Missing phase routing links
  const getPhaseLink = (key: string) => {
    switch (key) {
      case 'cleaning':
        return `/datasets?datasetId=${effectiveId}`;
      case 'eda':
        return `/eda?datasetId=${effectiveId}`;
      case 'ml_models':
        return `/models?datasetId=${effectiveId}`;
      case 'clustering':
        return `/clustering?datasetId=${effectiveId}`;
      case 'forecasting':
        return `/forecasting?datasetId=${effectiveId}`;
      case 'anomalies':
        return `/anomalies?datasetId=${effectiveId}`;
      case 'insights':
        return `/insights?datasetId=${effectiveId}`;
      default:
        return `/dashboard`;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-r from-purple-950/40 via-[#0e091b] to-[#080512] p-8 backdrop-blur-xl">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-950/40 text-purple-300 text-xs font-semibold mb-4">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Executive Reports &amp; Exports</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
            Reports &amp; Exports
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            Create publication-ready PDF summary reports and export prediction datasets across exploration, predictive modeling, segmentation, and forecasting.
          </p>

          {/* Dataset Selector */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 backdrop-blur-md">
              <Database className="w-4 h-4 text-purple-400" />
              <select
                className="bg-transparent text-sm font-medium text-white focus:outline-none cursor-pointer pr-2"
                value={effectiveId || ''}
                onChange={(e) => handleDatasetChange(Number(e.target.value))}
                disabled={isLoadingDatasets || datasets.length === 0}
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id} className="bg-slate-900 text-white">
                    {d.original_filename} ({d.row_count?.toLocaleString()} rows)
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchReadiness();
                refetchCsvPreview();
                refetchHistory();
              }}
              className="text-xs text-slate-400 hover:text-white"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh Readiness
            </Button>
          </div>
        </div>

        {/* Ambient Glow */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />
      </div>

      {/* Global Alerts / Feedback */}
      <AnimatePresence>
        {downloadSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 text-emerald-300 text-sm"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{downloadSuccessMessage}</span>
          </motion.div>
        )}

        {exportErrorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 p-4 rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-300 text-sm"
          >
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{exportErrorMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid: Left PDF & Readiness, Right CSV Prediction Export */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: PDF Report Generator & Analytical Readiness (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Executive PDF Card */}
          <Card className="border border-white/[0.08] bg-[#0c0818]/90 overflow-hidden shadow-xl">
            <CardHeader className="border-b border-white/[0.06] bg-white/[0.01] pb-5">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-white flex items-center gap-2.5">
                    <FileText className="w-5 h-5 text-purple-400" />
                    Executive PDF Report
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs mt-1">
                    Comprehensive summary with charts, benchmark tables, and key findings.
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="bg-purple-950/50 text-purple-300 border-purple-500/30 text-xs px-2.5 py-1"
                >
                  Executive PDF
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* PDF Preview Specs Box */}
              <div className="grid grid-cols-3 gap-3 p-4 rounded-xl border border-white/[0.06] bg-black/30 text-center">
                <div>
                  <div className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    Total Included
                  </div>
                  <div className="text-lg font-bold text-purple-300 font-mono mt-0.5">
                    {readiness?.available_sections_count || 0} / {readiness?.total_sections_count || 8}
                  </div>
                  <div className="text-[10px] text-slate-400">Sections Included</div>
                </div>
                <div className="border-x border-white/[0.06]">
                  <div className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    Visual Layout
                  </div>
                  <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">Automated</div>
                  <div className="text-[10px] text-slate-400">Numbered Pages</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                    Pending Sections
                  </div>
                  <div className="text-lg font-bold text-slate-300 font-mono mt-0.5">
                    {(readiness?.total_sections_count || 8) - (readiness?.available_sections_count || 0)}
                  </div>
                  <div className="text-[10px] text-slate-400">Not Yet Run</div>
                </div>
              </div>

              {/* PDF Download Button */}
              <div className="pt-2">
                <Button
                  variant="glow"
                  size="lg"
                  onClick={handleDownloadPdf}
                  disabled={isGeneratingPdf || !effectiveId}
                  className="w-full justify-center text-sm font-semibold h-12 shadow-lg shadow-purple-600/20"
                >
                  {isGeneratingPdf ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Generating Executive PDF...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Generate Report
                    </>
                  )}
                </Button>
                <p className="text-[11px] text-center text-slate-400 mt-2">
                  Includes summary tables, charts, model evaluations, and key business insights.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Analytical Phase Readiness Checklist */}
          <Card className="border border-white/[0.08] bg-[#0c0818]/90 shadow-xl">
            <CardHeader className="border-b border-white/[0.06] pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-400" />
                    Analytical Section Readiness
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs">
                    Inspect which modules have executed. Optional sections will indicate when not yet run.
                  </CardDescription>
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  {readiness?.available_sections_count} Available
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 divide-y divide-white/[0.06]">
              {isLoadingReadiness ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-400" />
                  Checking dataset readiness...
                </div>
              ) : (
                readiness?.sections.map((section) => {
                  const isAvail = section.status === 'available';
                  return (
                    <div
                      key={section.key}
                      className="py-3.5 flex items-center justify-between gap-4 first:pt-1 last:pb-1"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            isAvail
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-900 text-slate-400 border border-white/10'
                          }`}
                        >
                          {isAvail ? <Check className="w-4 h-4" /> : <Clock className="w-3.5 h-3.5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white">{section.name}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                            {section.detail}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isAvail ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-950/40 text-emerald-300 border-emerald-500/30 text-[10px]"
                          >
                            Ready
                          </Badge>
                        ) : (
                          <Link to={getPhaseLink(section.key)}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[11px] h-7 px-2 text-purple-400 hover:text-purple-300 hover:bg-purple-950/30"
                            >
                              Run Now
                              <ArrowRight className="w-3 h-3 ml-1" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: CSV Prediction Export (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border border-white/[0.08] bg-[#0c0818]/90 shadow-xl">
            <CardHeader className="border-b border-white/[0.06] pb-4">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                Export Predictions as CSV
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs">
                Export prediction results with original input features and calculated values.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              {/* Type Switcher Tabs */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                  Select Prediction Type
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/40 border border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setExportType('ml');
                      setExportErrorMessage(null);
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                      exportType === 'ml'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5" />
                    <span>Predictive Models</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setExportType('forecast');
                      setExportErrorMessage(null);
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                      exportType === 'forecast'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Forecast</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setExportType('anomaly');
                      setExportErrorMessage(null);
                    }}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                      exportType === 'anomaly'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Anomalies</span>
                  </button>
                </div>
              </div>

              {/* Status / Preview Box */}
              {isPendingCsvPreview || isLoadingCsvPreview || (!csvPreview && !csvPreviewError) ? (
                <div className="p-8 text-center text-slate-400 text-xs rounded-xl border border-white/10 bg-black/20">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-purple-400" />
                  Loading export preview...
                </div>
              ) : csvPreviewError ? (
                <div className="p-5 rounded-xl border border-amber-500/30 bg-amber-950/20 text-center space-y-3">
                  <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                  <div>
                    <h4 className="text-xs font-bold text-amber-200">
                      No Predictions Available
                    </h4>
                    <p className="text-[11px] text-amber-300/80 mt-1">
                      Run {exportType === 'ml' ? 'predictive modeling' : exportType === 'forecast' ? 'forecasting' : 'anomaly detection'} first to generate prediction records.
                    </p>
                  </div>
                  <Link to={getPhaseLink(exportType === 'ml' ? 'ml_models' : exportType === 'forecast' ? 'forecasting' : 'anomalies')}>
                    <Button variant="outline" size="sm" className="text-xs border-amber-500/40 text-amber-300">
                      Go to {exportType === 'ml' ? 'Predictive Modeling' : exportType === 'forecast' ? 'Forecasting' : 'Anomaly Detection'}
                      <ArrowRight className="w-3 h-3 ml-1.5" />
                    </Button>
                  </Link>
                </div>
              ) : csvPreview ? (
                <div className="space-y-4">
                  {/* Model Metadata pill */}
                  <div className="flex items-center justify-between text-xs p-3 rounded-lg bg-black/30 border border-white/[0.06]">
                    <div>
                      <span className="text-slate-400">Model: </span>
                      <span className="font-semibold text-white">{csvPreview.model_name}</span>
                    </div>
                    <div className="font-mono text-purple-300">
                      {csvPreview.total_rows.toLocaleString()} rows
                    </div>
                  </div>

                  {/* Columns Included */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                      Included Schema Columns ({csvPreview.columns.length})
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto p-1.5 rounded-lg bg-black/20 border border-white/[0.04]">
                      {csvPreview.columns.map((col) => (
                        <span
                          key={col}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300 border border-white/[0.04]"
                        >
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 5-Row Mini Preview Table */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                      <span>Sample Output Rows (Top 5)</span>
                      <span className="text-[10px] text-slate-400 font-normal">Live sample</span>
                    </span>
                    <div className="overflow-x-auto rounded-lg border border-white/[0.08] bg-black/30 max-h-48">
                      <table className="w-full text-left text-[11px] border-collapse font-mono">
                        <thead>
                          <tr className="border-b border-white/10 bg-white/[0.04]">
                            {csvPreview.columns.slice(0, 4).map((c) => (
                              <th key={c} className="p-2 text-slate-300 font-semibold truncate max-w-[120px]">
                                {c}
                              </th>
                            ))}
                            {csvPreview.columns.length > 4 && (
                              <th className="p-2 text-slate-400">+{csvPreview.columns.length - 4} more</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.04] text-slate-300">
                          {csvPreview.preview_rows.map((row, idx) => (
                            <tr key={idx} className="hover:bg-white/[0.02]">
                              {csvPreview.columns.slice(0, 4).map((c) => (
                                <td key={c} className="p-2 truncate max-w-[120px]">
                                  {row[c] !== null && row[c] !== undefined
                                    ? typeof row[c] === 'number'
                                      ? row[c].toFixed?.(3) ?? String(row[c])
                                      : String(row[c])
                                    : '—'}
                                </td>
                              ))}
                              {csvPreview.columns.length > 4 && <td className="p-2 text-slate-400">...</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Export CSV Button */}
                  <Button
                    variant="outline"
                    size="default"
                    onClick={handleDownloadCsv}
                    disabled={isExportingCsv}
                    className="w-full justify-center text-xs font-semibold h-11 border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/30"
                  >
                    {isExportingCsv ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Exporting CSV Stream...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Export {csvPreview.total_rows.toLocaleString()} Rows as CSV
                      </>
                    )}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Document Audit History */}
          <Card className="border border-white/[0.08] bg-[#0c0818]/90 shadow-xl">
            <CardHeader className="border-b border-white/[0.06] pb-3">
              <CardTitle className="text-sm font-bold text-white flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-purple-400" />
                  Generated Document Audit Log
                </span>
                <span className="text-[11px] font-normal text-slate-400">
                  {history.length} records
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-60 overflow-y-auto divide-y divide-white/[0.04]">
              {isLoadingHistory ? (
                <div className="py-6 text-center text-xs text-slate-400">Loading history...</div>
              ) : history.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 px-4">
                  No reports or exports generated yet for this dataset.
                </div>
              ) : (
                history.map((doc) => (
                  <div key={doc.id} className="p-3.5 hover:bg-white/[0.02] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-950/40 border border-purple-500/20 text-purple-300">
                        {doc.report_type.includes('pdf') ? (
                          <FileText className="w-4 h-4 text-purple-400" />
                        ) : (
                          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white truncate max-w-[200px]">
                          {doc.title}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2 font-mono">
                          <span>{new Date(doc.created_at).toLocaleString()}</span>
                          <span>•</span>
                          <span>{formatFileSize(doc.file_size_bytes)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
