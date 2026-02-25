import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileJson, Image as ImageIcon, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function CatalogImportUploader({ onImportComplete }) {
  const [jsonFile, setJsonFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleImport = async () => {
    if (!jsonFile) return;
    setIsImporting(true);
    setError(null);
    setResult(null);

    try {
      // 1. Read JSON file
      const jsonText = await jsonFile.text();
      const pageData = JSON.parse(jsonText);

      // Normalize pageData in case it's an array or missing page_number
      let pageNumber = pageData.page_number;
      let products = pageData.products || [];

      if (Array.isArray(pageData)) {
        products = pageData;
      }
      
      if (!pageNumber) {
        const match = jsonFile.name.match(/\d+/);
        pageNumber = match ? parseInt(match[0], 10) : 1;
      }

      const normalizedPageData = {
        ...pageData,
        page_number: pageNumber,
        products: products
      };

      // 2. Upload image if provided
      let imageUrl = '';
      if (imageFile) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: imageFile });
        imageUrl = file_url;
      }

      // 3. Import via backend function
      const response = await base44.functions.invoke('importCatalogPage', {
        action: 'import_page',
        page_data: normalizedPageData,
        image_url: imageUrl
      });

      if (response.data.success) {
        setResult(response.data.page);
        if (onImportComplete) onImportComplete(response.data.page);
      } else {
        setError(response.data.error || 'Import failed');
      }
    } catch (err) {
      console.error("Import error:", err);
      setError(err.response?.data?.error || err.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card className="border-dashed border-2 border-slate-200 bg-white">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Upload className="w-5 h-5 text-[#e2231a]" />
          Import Catalog Page
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <FileJson className="w-4 h-4 text-blue-500" />
            Page JSON File
          </Label>
          <Input
            type="file"
            accept=".json"
            onChange={(e) => setJsonFile(e.target.files?.[0] || null)}
            className="cursor-pointer"
          />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-green-500" />
            Page Image (optional)
          </Label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            className="cursor-pointer"
          />
        </div>

        <Button
          onClick={handleImport}
          disabled={!jsonFile || isImporting}
          className="w-full bg-[#e2231a] hover:bg-[#b01b13]"
        >
          {isImporting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Import Page
            </>
          )}
        </Button>

        {result && (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 p-3 rounded-lg text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Page {result.page_number} imported — {(result.products || []).length} products found
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-700 bg-red-50 p-3 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}