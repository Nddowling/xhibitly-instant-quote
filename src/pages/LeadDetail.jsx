import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Building2, User, Repeat } from 'lucide-react';

export default function LeadDetail() {
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const leadId = urlParams.get('id');

  useEffect(() => {
    loadLead();
  }, [leadId]);

  const loadLead = async () => {
    if (!leadId) {
      navigate('/Leads');
      return;
    }

    const record = await base44.entities.Lead.get(leadId);
    setLead(record || null);
    setLoading(false);
  };

  const handleConvert = async () => {
    if (!lead?.id) return;
    setConverting(true);
    const response = await base44.functions.invoke('convertLeadToContact', { leadId: lead.id });
    const nextContactId = response?.data?.contactId;
    if (nextContactId) {
      navigate(`/ContactDetail?id=${encodeURIComponent(nextContactId)}`);
      return;
    }
    await loadLead();
    setConverting(false);
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!lead) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500">Lead not found.</div>;
  }

  return (
    <div className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] bg-slate-50 p-4 md:p-10 pb-24 md:pb-10">
      <div className="max-w-5xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-[#e2231a]/10 rounded-full flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-[#e2231a]" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-2xl">{lead.company_name || 'No Company'}</CardTitle>
                    <Badge variant="outline">{lead.status === 'converted' ? 'Converted' : 'Lead'}</Badge>
                  </div>
                  <CardDescription className="text-base font-medium text-slate-700 mt-1">
                    {lead.full_name || 'Unknown Lead'}
                  </CardDescription>
                </div>
              </div>
              <Button onClick={handleConvert} disabled={converting || lead.status === 'converted'} className="bg-[#e2231a] hover:bg-[#b01b13]">
                <Repeat className="w-4 h-4 mr-2" />
                {lead.status === 'converted' ? 'Already Converted' : converting ? 'Converting...' : 'Convert to Contact'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="text-sm font-medium text-slate-900 break-all">{lead.email || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Phone</p>
                  <p className="text-sm font-medium text-slate-900">{lead.phone || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Title</p>
                  <p className="text-sm font-medium text-slate-900">{lead.title || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-slate-400" />
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  <p className="text-sm font-medium text-slate-900">{lead.status || 'open'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}