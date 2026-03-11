import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { runReport } from '@/components/utils/reportEngine';
import { Play, Pencil, Download, BarChart2, Table, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import ReportResultsTable from '@/components/reports/ReportResultsTable';
import ReportChart from '@/components/reports/ReportChart';

export default function ReportView() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const reportId = urlParams.get('id');

  const [report, setReport] = useState(null);
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [view, setView] = useState('both'); // 'table' | 'chart' | 'both'

  useEffect(() => {
    if (reportId) loadReport();
  }, [reportId]);

  const loadReport = async () => {
    const reps = await base44.entities.Report.filter({ id: reportId });
    if (reps[0]) {
      setReport(reps[0]);
      await executeReport(reps[0]);
    }
  };

  const executeReport = async (r) => {
    setRunning(true);
    const res = await runReport(r);
    setResults(res);
    await base44.entities.Report.update(r.id, { last_run_at: new Date().toISOString() });
    setRunning(false);
  };

  const exportCsv = () => {
    if (!results?.rows?.length) return;
    const headers = report.selected_fields?.map(f => f.label).join(',');
    const rows = results.rows.map(row =>
      report.selected_fields?.map(f => JSON.stringify(row[f.field] ?? '')).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.name}.csv`;
    a.click();
  };

  if (!report) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{report.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs">{report.source_object}</Badge>
              <Badge className="text-xs bg-blue-100 text-blue-700">{report.report_type}</Badge>
              {report.last_run_at && (
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Last run {format(new Date(report.last_run_at), 'MMM d, h:mm a')}
                </span>
              )}
              {results && <span className="text-xs text-slate-500">{results.total} records</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {report.chart_type && report.chart_type !== 'none' && (
              <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden">
                {['table', 'chart', 'both'].map(v => (
                  <button key={v} onClick={() => setView(v)}
                    className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${view === v ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                    {v}
                  </button>
                ))}
              </div>
            )}
            <Button size="sm" variant="outline" onClick={() => executeReport(report)} disabled={running} className="gap-1">
              <Play className="w-3.5 h-3.5" /> {running ? 'Running...' : 'Run Again'}
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv} className="gap-1">
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate(createPageUrl('ReportBuilder') + `?id=${report.id}`)} className="gap-1">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {running ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : results ? (
          <>
            {(view === 'chart' || view === 'both') && report.chart_type && report.chart_type !== 'none' && (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <ReportChart report={report} results={results} />
              </div>
            )}
            {(view === 'table' || view === 'both') && (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <ReportResultsTable report={report} results={results} />
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}