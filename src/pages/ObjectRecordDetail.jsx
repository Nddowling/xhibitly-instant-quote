import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function ObjectRecordDetail() {
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  const urlParams = new URLSearchParams(window.location.search);
  const objectApiName = urlParams.get('object');
  const recordId = urlParams.get('id');

  useEffect(() => {
    loadRecord();
  }, [objectApiName, recordId]);

  const loadRecord = async () => {
    if (!objectApiName || !recordId || !base44.entities[objectApiName]) {
      navigate(-1);
      return;
    }

    setLoading(true);
    const data = await base44.entities[objectApiName].get(recordId);
    setRecord(data || null);
    setLoading(false);
  };

  const getTitle = () => {
    if (!record) return objectApiName || 'Record';
    return record.name || record.full_name || record.label || record.record_name || record.reference_number || record.email || record.code || record.sku || record.id;
  };

  const fields = record
    ? Object.entries(record).filter(([key, value]) => value !== null && value !== '' && key !== 'data')
    : [];

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] bg-slate-50 flex items-center justify-center text-slate-500">
        Record not found.
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] bg-slate-50 p-4 md:p-8 pb-24 md:pb-10">
      <div className="max-w-5xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 -ml-2 text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card className="mb-6">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <Badge variant="outline" className="mb-3">{objectApiName}</Badge>
              <CardTitle className="text-2xl break-words">{getTitle()}</CardTitle>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate(`/Setup?object=${encodeURIComponent(objectApiName)}&record=${record.id}`)}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in Setup
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.map(([key, value]) => (
                <div key={key} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{key.replace(/_/g, ' ')}</p>
                  <p className="text-sm text-slate-900 break-words whitespace-pre-wrap">
                    {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}