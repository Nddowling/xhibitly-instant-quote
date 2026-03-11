import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { getAllObjects, getObjectFields } from '@/components/utils/metadataEngine';
import { runReport } from '@/components/utils/reportEngine';
import { Plus, X, Save, Play, ChevronDown, ChevronUp, BarChart2, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import ReportResultsTable from '@/components/reports/ReportResultsTable';
import ReportChartPanel from '@/components/reports/ReportChartPanel';
import ReportFilterEditor from '@/components/reports/ReportFilterEditor';

const REPORT_TYPES = ['tabular', 'summary', 'matrix'];
const AGGREGATES = ['none', 'count', 'sum', 'avg', 'min', 'max'];

export default function ReportBuilder() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('id');

  const [objects, setObjects] = useState([]);
  const [fields, setFields] = useState([]);
  const [results, setResults] = useState(null);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showChartPanel, setShowChartPanel] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const [report, setReport] = useState({
    name: '',
    description: '',
    source_object: 'Order',
    report_type: 'tabular',
    selected_fields: [],
    filters: [],
    filter_logic: '',
    groupings: [],
    chart_type: 'none',
    chart_x_field: '',
    chart_y_field: '',
    chart_y_aggregate: 'count',
    row_limit: 2000,
    is_public: false,
    folder_name: '',
  });

  useEffect(() => {
    getAllObjects().then(setObjects);
  }, []);

  useEffect(() => {
    loadFields(report.source_object);
  }, [report.source_object]);

  useEffect(() => {
    if (editId) {
      base44.entities.Report.filter({ id: editId }).then(res => {
        if (res[0]) setReport(res[0]);
      });
    }
  }, [editId]);

  const loadFields = async (objectName) => {
    const f = await getObjectFields(objectName);
    setFields(f);
  };

  const addField = (field) => {
    if (report.selected_fields.find(f => f.field === field.api_name)) return;
    setReport(r => ({
      ...r,
      selected_fields: [...r.selected_fields, { field: field.api_name, label: field.label, type: field.field_type }]
    }));
  };

  const removeField = (fieldName) => {
    setReport(r => ({ ...r, selected_fields: r.selected_fields.filter(f => f.field !== fieldName) }));
  };

  const setFieldAggregate = (fieldName, agg) => {
    setReport(r => ({
      ...r,
      selected_fields: r.selected_fields.map(f =>
        f.field === fieldName ? { ...f, aggregate: agg === 'none' ? undefined : agg } : f
      )
    }));
  };

  const handleRun = async () => {
    setRunning(true);
    const res = await runReport(report);
    setResults(res);
    setRunning(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { ...report, last_run_at: results?.ranAt };
    if (editId) {
      await base44.entities.Report.update(editId, payload);
    } else {
      await base44.entities.Report.create(payload);
    }
    setSaving(false);
    setShowSaveDialog(false);
    navigate(createPageUrl('Reports'));
  };

  const objectsForReport = objects.filter(o => o.allow_reports);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3 flex-wrap">
        <h1 className="text-lg font-bold text-slate-900 mr-auto">
          {editId ? 'Edit Report' : 'New Report'}
        </h1>
        <div className="flex items-center gap-2">
          {REPORT_TYPES.map(t => (
            <button key={t} onClick={() => setReport(r => ({ ...r, report_type: t }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                report.report_type === t ? 'bg-[#e2231a] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>{t}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Select value={report.source_object} onValueChange={v => setReport(r => ({ ...r, source_object: v, selected_fields: [], groupings: [] }))}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {objectsForReport.map(o => <SelectItem key={o.api_name} value={o.api_name}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Row limit" type="number" value={report.row_limit} onChange={e => setReport(r => ({ ...r, row_limit: Number(e.target.value) }))} className="w-24 h-8 text-xs" />
          <Button onClick={handleRun} disabled={running} size="sm" variant="outline" className="gap-1">
            <Play className="w-3.5 h-3.5" /> {running ? 'Running...' : 'Run'}
          </Button>
          <Button onClick={() => setShowSaveDialog(true)} size="sm" className="bg-[#e2231a] hover:bg-[#c41e17] text-white gap-1">
            <Save className="w-3.5 h-3.5" /> Save
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Field panel */}
        <aside className="w-56 bg-white border-r border-slate-200 overflow-y-auto flex-shrink-0">
          <div className="p-3 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Available Fields</p>
          </div>
          <div className="p-2">
            {fields.map(f => (
              <button key={f.api_name} onClick={() => addField(f)}
                className="w-full text-left px-2 py-1.5 rounded text-xs text-slate-700 hover:bg-slate-100 flex items-center justify-between group">
                <span className="truncate">{f.label}</span>
                <Plus className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
              </button>
            ))}
          </div>
        </aside>

        {/* Center */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Selected fields */}
          <div className="bg-white border-b border-slate-200 p-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Selected Columns</p>
            {report.selected_fields.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Click fields from the left panel to add them</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {report.selected_fields.map(f => (
                  <div key={f.field} className="flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-1">
                    <span className="text-xs text-slate-700">{f.label}</span>
                    {(f.type === 'currency' || f.type === 'number') && (
                      <select value={f.aggregate || 'none'} onChange={e => setFieldAggregate(f.field, e.target.value)}
                        className="text-xs bg-transparent text-slate-500 focus:outline-none ml-1">
                        {AGGREGATES.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    )}
                    <button onClick={() => removeField(f.field)} className="text-slate-400 hover:text-red-500 ml-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="bg-white border-b border-slate-200 p-3">
            <ReportFilterEditor
              filters={report.filters}
              filterLogic={report.filter_logic}
              fields={fields}
              onChange={(filters, filterLogic) => setReport(r => ({ ...r, filters, filter_logic: filterLogic }))}
            />
          </div>

          {/* Results */}
          <div className="flex-1 overflow-auto p-4">
            {results ? (
              <ReportResultsTable report={report} results={results} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <BarChart2 className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Click "Run" to see results</p>
              </div>
            )}
          </div>
        </div>

        {/* Chart panel */}
        <div className="w-72 bg-white border-l border-slate-200 flex flex-col flex-shrink-0">
          <button onClick={() => setShowChartPanel(!showChartPanel)}
            className="flex items-center gap-2 p-3 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider hover:bg-slate-50 transition-colors">
            <BarChart2 className="w-3.5 h-3.5" />
            Chart Builder
            {showChartPanel ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
          </button>
          {showChartPanel && (
            <ReportChartPanel
              report={report}
              fields={report.selected_fields}
              results={results}
              onChange={updates => setReport(r => ({ ...r, ...updates }))}
            />
          )}
        </div>
      </div>

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Save Report</h2>
            <div className="space-y-3">
              <Input placeholder="Report name" value={report.name} onChange={e => setReport(r => ({ ...r, name: e.target.value }))} />
              <Input placeholder="Description (optional)" value={report.description} onChange={e => setReport(r => ({ ...r, description: e.target.value }))} />
              <Input placeholder="Folder name (optional)" value={report.folder_name} onChange={e => setReport(r => ({ ...r, folder_name: e.target.value }))} />
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={report.is_public} onChange={e => setReport(r => ({ ...r, is_public: e.target.checked }))} />
                Make public (visible to all users)
              </label>
            </div>
            <div className="flex gap-2 mt-5">
              <Button onClick={handleSave} disabled={saving || !report.name} className="flex-1 bg-[#e2231a] hover:bg-[#c41e17] text-white">
                {saving ? 'Saving...' : 'Save Report'}
              </Button>
              <Button variant="ghost" onClick={() => setShowSaveDialog(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}