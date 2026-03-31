import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { BUILT_IN_OBJECTS } from '@/components/utils/reportEngine';
import { getAllObjects, getObjectFields } from '@/components/utils/metadataEngine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Database, ArrowRight, CheckCircle2 } from 'lucide-react';

const EXCLUDED_FIELDS = ['id', 'created_date', 'updated_date', 'created_by'];

function parseCsv(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const parseLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];
      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(line => parseLine(line));
  return { headers, rows };
}

function normalize(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function convertValue(value, fieldType) {
  if (value == null || value === '') return null;
  if (fieldType === 'number' || fieldType === 'currency') {
    const num = Number(String(value).replace(/[$,]/g, ''));
    return Number.isNaN(num) ? null : num;
  }
  if (fieldType === 'checkbox') {
    const normalized = String(value).trim().toLowerCase();
    return ['true', '1', 'yes', 'y'].includes(normalized);
  }
  return String(value).trim();
}

export default function SetupDataLoader() {
  const [objects, setObjects] = useState([]);
  const [selectedObject, setSelectedObject] = useState('Contact');
  const [fields, setFields] = useState([]);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    loadObjects();
  }, []);

  useEffect(() => {
    if (selectedObject) loadFields(selectedObject);
  }, [selectedObject]);

  const loadObjects = async () => {
    const allObjects = await getAllObjects();
    setObjects(allObjects || []);
    setLoading(false);
  };

  const loadFields = async (objectApiName) => {
    const objectFields = await getObjectFields(objectApiName);
    setFields((objectFields || []).filter(field => !EXCLUDED_FIELDS.includes(field.api_name)));
    setMapping({});
    setResult(null);
  };

  const suggestedMapping = useMemo(() => {
    const next = {};
    headers.forEach((header) => {
      const matchedField = fields.find(field => normalize(field.api_name) === normalize(header) || normalize(field.label) === normalize(header));
      if (matchedField) next[header] = matchedField.api_name;
    });
    return next;
  }, [headers, fields]);

  useEffect(() => {
    if (headers.length) setMapping(suggestedMapping);
  }, [suggestedMapping, headers.length]);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsv(text);
    setFileName(file.name);
    setHeaders(parsed.headers);
    setRows(parsed.rows);
    setResult(null);
  };

  const handleMappingChange = (header, value) => {
    setMapping(prev => ({ ...prev, [header]: value === '__skip__' ? '' : value }));
  };

  const buildRecord = (row) => {
    const record = {};
    headers.forEach((header, index) => {
      const fieldApiName = mapping[header];
      if (!fieldApiName) return;
      const field = fields.find(item => item.api_name === fieldApiName);
      if (!field) return;
      const converted = convertValue(row[index], field.field_type);
      if (converted !== null) record[fieldApiName] = converted;
    });

    if (selectedObject === 'Contact') {
      const first = record.first_name || null;
      const last = record.last_name || null;
      if (!first && !last && record.full_name) {
        const parts = String(record.full_name).trim().split(/\s+/);
        record.first_name = parts[0] || null;
        record.last_name = parts.slice(1).join(' ') || null;
      }
      record.full_name = [record.first_name, record.last_name].filter(Boolean).join(' ').trim() || null;
    }

    return record;
  };

  const previewRecords = useMemo(() => rows.slice(0, 5).map(buildRecord), [rows, mapping, fields, selectedObject]);

  const importRecords = async () => {
    setImporting(true);
    const records = rows.map(buildRecord).filter(record => Object.keys(record).length > 0);

    const validRecords = records.filter(record => {
      if (selectedObject === 'Contact') {
        return Boolean(record.first_name || record.last_name || record.full_name);
      }
      return true;
    });

    if (!validRecords.length) {
      setResult({ success: false, message: 'No valid rows to import.' });
      setImporting(false);
      return;
    }

    await base44.entities[selectedObject].bulkCreate(validRecords);
    setResult({ success: true, message: `${validRecords.length} records imported to ${selectedObject}.` });
    setImporting(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Data Loader</h2>
        <p className="text-sm text-slate-500">Upload any CSV, map columns to object fields, and create new records.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database className="w-4 h-4" /> Import Target</CardTitle>
          <CardDescription>Select which object you want to create records for.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Object</label>
            <Select value={selectedObject} onValueChange={setSelectedObject} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder="Select object" />
              </SelectTrigger>
              <SelectContent>
                {objects.map(object => (
                  <SelectItem key={object.api_name} value={object.api_name}>{object.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">CSV File</label>
            <label className="flex h-10 items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 text-sm text-slate-600 cursor-pointer hover:bg-slate-50">
              <Upload className="w-4 h-4" />
              <span className="truncate">{fileName || 'Choose CSV file'}</span>
              <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </CardContent>
      </Card>

      {headers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Column Mapping</CardTitle>
            <CardDescription>Map each CSV column to a field on {selectedObject}. Unmapped columns will be skipped.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {headers.map(header => (
              <div key={header} className="grid gap-3 md:grid-cols-[1fr_auto_1fr] items-center">
                <div className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 bg-slate-50">{header}</div>
                <ArrowRight className="w-4 h-4 text-slate-400 mx-auto" />
                <Select value={mapping[header] || '__skip__'} onValueChange={(value) => handleMappingChange(header, value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Skip column" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__skip__">Skip column</SelectItem>
                    {fields.map(field => (
                      <SelectItem key={field.api_name} value={field.api_name}>{field.label} ({field.api_name})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {previewRecords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>First 5 records that will be created.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {previewRecords.map((record, index) => (
                <div key={index} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                  <pre className="whitespace-pre-wrap break-words">{JSON.stringify(record, null, 2)}</pre>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={importRecords} disabled={!rows.length || importing} className="bg-[#e2231a] hover:bg-[#c41e17] text-white">
          {importing ? 'Importing...' : 'Create Records'}
        </Button>
        {selectedObject === 'Contact' && (
          <p className="text-xs text-slate-500">For contacts, blank values stay blank, and name is built from first/last name when available.</p>
        )}
      </div>

      {result && (
        <div className={`rounded-xl border p-4 text-sm flex items-center gap-2 ${result.success ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          <CheckCircle2 className="w-4 h-4" />
          {result.message}
        </div>
      )}
    </div>
  );
}