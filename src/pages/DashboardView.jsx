import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { runReport } from '@/components/utils/reportEngine';
import { Plus, Pencil, Eye, Save, Trash2, X, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReportChart from '@/components/reports/ReportChart';
import ReportResultsTable from '@/components/reports/ReportResultsTable';

export default function DashboardView() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const dashboardId = urlParams.get('id');
  const startEdit = urlParams.get('edit') === '1';

  const [dashboard, setDashboard] = useState(null);
  const [widgets, setWidgets] = useState([]);
  const [widgetData, setWidgetData] = useState({});
  const [reports, setReports] = useState([]);
  const [editMode, setEditMode] = useState(startEdit);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [newWidget, setNewWidget] = useState({ report_id: '', widget_type: 'chart', title: '' });

  useEffect(() => {
    if (dashboardId) loadAll();
  }, [dashboardId]);

  const loadAll = async () => {
    const [dash, wids, reps] = await Promise.all([
      base44.entities.Dashboard.filter({ id: dashboardId }).then(r => r[0]),
      base44.entities.DashboardWidget.filter({ dashboard_id: dashboardId }),
      base44.entities.Report.list(),
    ]);
    setDashboard(dash);
    setWidgets(wids);
    setReports(reps);
    runWidgets(wids, reps);
  };

  const runWidgets = async (wids, reps) => {
    const data = {};
    await Promise.all(wids.map(async w => {
      const report = reps.find(r => r.id === w.report_id);
      if (report) {
        const result = await runReport(report);
        data[w.id] = result;
      }
    }));
    setWidgetData(data);
  };

  const addWidget = async () => {
    if (!newWidget.report_id) return;
    const report = reports.find(r => r.id === newWidget.report_id);
    const w = await base44.entities.DashboardWidget.create({
      dashboard_id: dashboardId,
      report_id: newWidget.report_id,
      title: newWidget.title || report?.name || 'Widget',
      widget_type: newWidget.widget_type,
    });
    const result = await runReport(report);
    setWidgets(ws => [...ws, w]);
    setWidgetData(d => ({ ...d, [w.id]: result }));
    setShowAddWidget(false);
    setNewWidget({ report_id: '', widget_type: 'chart', title: '' });
  };

  const removeWidget = async (id) => {
    await base44.entities.DashboardWidget.delete(id);
    setWidgets(ws => ws.filter(w => w.id !== id));
  };

  const refreshWidget = async (widget) => {
    const report = reports.find(r => r.id === widget.report_id);
    if (report) {
      const result = await runReport(report);
      setWidgetData(d => ({ ...d, [widget.id]: result }));
    }
  };

  if (!dashboard) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-slate-900">{dashboard.name}</h1>
        <div className="flex items-center gap-2">
          {editMode && (
            <Button size="sm" onClick={() => setShowAddWidget(true)} className="bg-[#e2231a] hover:bg-[#c41e17] text-white gap-1">
              <Plus className="w-3.5 h-3.5" /> Add Widget
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setEditMode(!editMode)} className="gap-1">
            {editMode ? <><Eye className="w-3.5 h-3.5" /> View</> : <><Pencil className="w-3.5 h-3.5" /> Edit</>}
          </Button>
        </div>
      </div>

      <div className="p-6">
        {widgets.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-400 text-sm mb-4">No widgets yet.</p>
            {editMode && (
              <Button onClick={() => setShowAddWidget(true)} className="bg-[#e2231a] hover:bg-[#c41e17] text-white gap-1">
                <Plus className="w-4 h-4" /> Add Widget
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {widgets.map(widget => {
              const data = widgetData[widget.id];
              const report = reports.find(r => r.id === widget.report_id);
              return (
                <div key={widget.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <span className="font-semibold text-slate-800 text-sm">{widget.title}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => refreshWidget(widget)} className="p-1 text-slate-400 hover:text-slate-700">
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                      {report && (
                        <button onClick={() => navigate(createPageUrl('ReportView') + `?id=${report.id}`)} className="p-1 text-slate-400 hover:text-slate-700">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {editMode && (
                        <button onClick={() => removeWidget(widget.id)} className="p-1 text-red-400 hover:text-red-600">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="p-4">
                    {!data ? (
                      <div className="flex items-center justify-center py-10">
                        <div className="w-6 h-6 border-3 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : widget.widget_type === 'metric' ? (
                      <MetricWidget widget={widget} data={data} />
                    ) : widget.widget_type === 'chart' && report ? (
                      <ReportChart report={{ ...report, chart_type: widget.chart_override || report.chart_type }} results={data} />
                    ) : (
                      <ReportResultsTable report={report} results={data} compact />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Widget Modal */}
      {showAddWidget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Add Widget</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Report</label>
                <select value={newWidget.report_id} onChange={e => setNewWidget(w => ({ ...w, report_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value="">Select a report...</option>
                  {reports.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Widget Type</label>
                <div className="flex gap-2">
                  {['chart', 'table', 'metric'].map(t => (
                    <button key={t} onClick={() => setNewWidget(w => ({ ...w, widget_type: t }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize flex-1 ${newWidget.widget_type === t ? 'bg-[#e2231a] text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <input value={newWidget.title} onChange={e => setNewWidget(w => ({ ...w, title: e.target.value }))}
                placeholder="Title override (optional)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div className="flex gap-2 mt-5">
              <Button onClick={addWidget} disabled={!newWidget.report_id} className="flex-1 bg-[#e2231a] hover:bg-[#c41e17] text-white">Add Widget</Button>
              <Button variant="ghost" onClick={() => setShowAddWidget(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricWidget({ widget, data }) {
  const value = data?.rows?.[0]?.[widget.metric_field] ?? data?.total ?? 0;
  const formatted = typeof value === 'number' ? value.toLocaleString() : value;
  return (
    <div className="text-center py-4">
      <p className="text-4xl font-black text-slate-900">{formatted}</p>
      <p className="text-sm text-slate-500 mt-1">{widget.title}</p>
    </div>
  );
}