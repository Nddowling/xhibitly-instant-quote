import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Plus, LayoutDashboard, Pencil, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export default function Dashboards() {
  const [dashboards, setDashboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const data = await base44.entities.Dashboard.list('-created_date');
    setDashboards(data);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const d = await base44.entities.Dashboard.create({ name: newName, last_modified_at: new Date().toISOString() });
    navigate(createPageUrl('DashboardView') + `?id=${d.id}`);
  };

  const handleDelete = async (id) => {
    await base44.entities.Dashboard.delete(id);
    setDashboards(dashboards.filter(d => d.id !== id));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboards</h1>
          <p className="text-sm text-slate-500 mt-0.5">{dashboards.length} dashboard{dashboards.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-[#e2231a] hover:bg-[#c41e17] text-white gap-2">
          <Plus className="w-4 h-4" /> New Dashboard
        </Button>
      </div>

      {creating && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 flex items-center gap-3">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Dashboard name..."
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
          />
          <Button onClick={handleCreate} className="bg-[#e2231a] hover:bg-[#c41e17] text-white">Create</Button>
          <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : dashboards.length === 0 ? (
        <div className="text-center py-20">
          <LayoutDashboard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No dashboards yet</p>
          <Button onClick={() => setCreating(true)} className="mt-4 bg-[#e2231a] hover:bg-[#c41e17]">Create your first dashboard</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboards.map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate(createPageUrl('DashboardView') + `?id=${d.id}`)}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-[#e2231a]/10 rounded-xl flex items-center justify-center">
                  <LayoutDashboard className="w-5 h-5 text-[#e2231a]" />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); navigate(createPageUrl('DashboardView') + `?id=${d.id}&edit=1`); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">{d.name}</h3>
              {d.description && <p className="text-xs text-slate-500 mb-2 line-clamp-2">{d.description}</p>}
              {d.last_modified_at && (
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {format(new Date(d.last_modified_at), 'MMM d, yyyy')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}