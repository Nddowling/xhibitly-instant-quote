import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Plus, BarChart2, Table, Clock, Star, Search, Folder, Play, Pencil, Copy, Trash2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const FOLDERS = ['All Reports', 'Recent', 'Created by Me', 'Public'];

const TYPE_COLORS = {
  tabular: 'bg-blue-100 text-blue-700',
  summary: 'bg-purple-100 text-purple-700',
  matrix: 'bg-amber-100 text-amber-700',
};

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [folder, setFolder] = useState('All Reports');
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [reps, u] = await Promise.all([
      base44.entities.Report.list('-created_date'),
      base44.auth.me(),
    ]);
    setReports(reps);
    setUser(u);
    setLoading(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.Report.delete(id);
    setReports(reports.filter(r => r.id !== id));
  };

  const handleClone = async (report) => {
    const { id, created_date, ...rest } = report;
    const cloned = await base44.entities.Report.create({ ...rest, name: `${report.name} (Copy)` });
    setReports([cloned, ...reports]);
  };

  const filtered = reports.filter(r => {
    const matchSearch = !search || r.name.toLowerCase().includes(search.toLowerCase());
    const matchFolder = folder === 'All Reports' ? true
      : folder === 'Created by Me' ? r.created_by === user?.email
      : folder === 'Public' ? r.is_public
      : folder === 'Recent' ? true
      : r.folder_name === folder;
    return matchSearch && matchFolder;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Folder sidebar */}
      <aside className="w-48 bg-white border-r border-slate-200 p-3 flex-shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 mb-2">Folders</p>
        {FOLDERS.map(f => (
          <button
            key={f}
            onClick={() => setFolder(f)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left mb-0.5 transition-colors ${
              folder === f ? 'bg-[#e2231a]/10 text-[#e2231a] font-medium' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            {f}
          </button>
        ))}
      </aside>

      {/* Main */}
      <div className="flex-1 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
            <p className="text-sm text-slate-500 mt-0.5">{filtered.length} report{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          <Button
            onClick={() => navigate(createPageUrl('ReportBuilder'))}
            className="bg-[#e2231a] hover:bg-[#c41e17] text-white gap-2"
          >
            <Plus className="w-4 h-4" /> New Report
          </Button>
        </div>

        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search reports..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <BarChart2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No reports found</p>
            <Button onClick={() => navigate(createPageUrl('ReportBuilder'))} className="mt-4 bg-[#e2231a] hover:bg-[#c41e17]">
              Create your first report
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(report => (
              <div key={report.id} className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-4 hover:shadow-sm transition-shadow">
                <BarChart2 className="w-8 h-8 text-slate-300 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 truncate">{report.name}</span>
                    <Badge className={`text-xs ${TYPE_COLORS[report.report_type] || 'bg-slate-100 text-slate-600'}`}>
                      {report.report_type}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{report.source_object}</Badge>
                  </div>
                  {report.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{report.description}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    {report.last_run_at && (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {format(new Date(report.last_run_at), 'MMM d, yyyy')}
                      </span>
                    )}
                    {report.is_public && <Badge variant="outline" className="text-xs">Public</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => navigate(createPageUrl('ReportView') + `?id=${report.id}`)} className="gap-1 text-xs">
                    <Play className="w-3 h-3" /> Run
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => navigate(createPageUrl('ReportBuilder') + `?id=${report.id}`)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleClone(report)}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600" onClick={() => handleDelete(report.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}