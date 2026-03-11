import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Phone, Mail, Users, Monitor, Send, StickyNote, Plus, Loader2,
  Calendar, ChevronDown, ChevronUp, Clock, CheckCircle2, XCircle, MinusCircle, PhoneMissed
} from 'lucide-react';
import { format, parseISO, isToday, isPast } from 'date-fns';

const ACTIVITY_TYPES = [
  { value: 'call',        label: 'Call',         icon: Phone },
  { value: 'email',       label: 'Email',        icon: Mail },
  { value: 'meeting',     label: 'Meeting',      icon: Users },
  { value: 'demo',        label: 'Demo',         icon: Monitor },
  { value: 'quote_sent',  label: 'Quote Sent',   icon: Send },
  { value: 'follow_up',  label: 'Follow-Up',    icon: Clock },
  { value: 'note',        label: 'Note',         icon: StickyNote },
];

const OUTCOMES = [
  { value: 'positive',   label: 'Positive',    icon: CheckCircle2,  color: 'text-green-600' },
  { value: 'neutral',    label: 'Neutral',     icon: MinusCircle,   color: 'text-slate-500' },
  { value: 'negative',   label: 'Negative',    icon: XCircle,       color: 'text-red-500'   },
  { value: 'no_contact', label: 'No Contact',  icon: PhoneMissed,   color: 'text-amber-500' },
];

const OUTCOME_COLORS = {
  positive:   'bg-green-100 text-green-700',
  neutral:    'bg-slate-100 text-slate-600',
  negative:   'bg-red-100 text-red-600',
  no_contact: 'bg-amber-100 text-amber-700',
};

const TYPE_ICONS = {
  call: Phone, email: Mail, meeting: Users, demo: Monitor,
  quote_sent: Send, follow_up: Clock, note: StickyNote,
};

export default function FollowUpSection({ order }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    activity_type: 'call',
    subject: '',
    description: '',
    outcome: 'positive',
    next_action: '',
    next_action_date: '',
  });

  useEffect(() => {
    loadActivities();
  }, [order?.id]);

  const loadActivities = async () => {
    const data = await base44.entities.Activity.filter({ order_id: order.id }, '-created_date', 50);
    setActivities(data || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.subject.trim()) return;
    setSaving(true);
    await base44.entities.Activity.create({
      order_id: order.id,
      activity_type: form.activity_type,
      subject: form.subject,
      description: form.description,
      outcome: form.outcome,
      next_action: form.next_action,
      next_action_date: form.next_action_date || null,
    });

    // If next action date set, also update the order's follow_up_date
    if (form.next_action_date) {
      await base44.entities.Order.update(order.id, { follow_up_date: form.next_action_date });
    }

    setForm({ activity_type: 'call', subject: '', description: '', outcome: 'positive', next_action: '', next_action_date: '' });
    setShowForm(false);
    setSaving(false);
    loadActivities();
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Header + Add button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Follow-Up Log</h3>
          <p className="text-xs text-slate-400 mt-0.5">{activities.length} activit{activities.length === 1 ? 'y' : 'ies'} recorded</p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#e2231a] hover:bg-[#b01b13] text-white h-8 px-3 text-xs gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Log Activity
        </Button>
      </div>

      {/* Log form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 space-y-4">
          {/* Activity type */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Activity Type</label>
            <div className="flex flex-wrap gap-2">
              {ACTIVITY_TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setForm(f => ({ ...f, activity_type: value }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    form.activity_type === value
                      ? 'bg-[#e2231a] text-white border-[#e2231a]'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-[#e2231a]/40'
                  }`}
                >
                  <Icon className="w-3 h-3" /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Subject *</label>
            <input
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="e.g. Called to discuss booth options"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Notes</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Details about the interaction..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30 resize-none"
            />
          </div>

          {/* Outcome */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Outcome</label>
            <div className="flex flex-wrap gap-2">
              {OUTCOMES.map(({ value, label, icon: Icon, color }) => (
                <button
                  key={value}
                  onClick={() => setForm(f => ({ ...f, outcome: value }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    form.outcome === value
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <Icon className={`w-3 h-3 ${form.outcome === value ? 'text-white' : color}`} /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Next action */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Next Action</label>
              <input
                value={form.next_action}
                onChange={e => setForm(f => ({ ...f, next_action: e.target.value }))}
                placeholder="e.g. Send revised quote"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Follow-Up Date</label>
              <input
                type="date"
                value={form.next_action_date}
                onChange={e => setForm(f => ({ ...f, next_action_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#e2231a]/30"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button onClick={handleSave} disabled={saving || !form.subject.trim()}
              className="bg-[#e2231a] hover:bg-[#b01b13] text-white h-9 px-5 text-sm font-bold disabled:opacity-40">
              {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</> : 'Save Activity'}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} className="h-9 text-sm">Cancel</Button>
          </div>
        </div>
      )}

      {/* Activity list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        </div>
      ) : activities.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-200 rounded-xl py-12 text-center">
          <Clock className="w-8 h-8 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No follow-up activities yet.</p>
          <p className="text-xs text-slate-300 mt-1">Click "Log Activity" to record the first one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map((act) => {
            const Icon = TYPE_ICONS[act.activity_type] || StickyNote;
            const followUpDate = act.next_action_date ? parseISO(act.next_action_date) : null;
            const isOverdue = followUpDate && isPast(followUpDate) && !isToday(followUpDate);
            const isDueToday = followUpDate && isToday(followUpDate);

            return (
              <div key={act.id} className="bg-white border border-slate-200 rounded-xl p-4 flex gap-3">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-slate-800">{act.subject}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {act.outcome && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${OUTCOME_COLORS[act.outcome] || 'bg-slate-100 text-slate-600'}`}>
                          {act.outcome.replace('_', ' ')}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400">
                        {format(new Date(act.created_date), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                  {act.description && (
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{act.description}</p>
                  )}
                  {act.next_action && (
                    <div className={`flex items-center gap-1.5 mt-2 text-xs font-medium rounded-lg px-2.5 py-1.5 w-fit ${
                      isOverdue ? 'bg-red-50 text-red-600' :
                      isDueToday ? 'bg-amber-50 text-amber-700' :
                      'bg-blue-50 text-blue-700'
                    }`}>
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                      <span>{act.next_action}</span>
                      {followUpDate && (
                        <span className="opacity-70">
                          · {isOverdue ? 'Overdue: ' : isDueToday ? 'Today: ' : ''}{format(followUpDate, 'MMM d')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}