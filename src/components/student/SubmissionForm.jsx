import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Upload, X } from 'lucide-react';

export default function SubmissionForm({ formData, setFormData, onSubmit, onCancel, isUploading }) {
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const extension = file.name.split('.').pop().toLowerCase();
      if (extension === 'glb' || extension === 'gltf') {
        setFormData({ ...formData, file });
      } else {
        alert('Please upload a GLB or GLTF file');
      }
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="shadow-lg border-0 bg-white">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Upload New Design</CardTitle>
              <CardDescription>Submit your GLB or GLTF 3D model file</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onCancel} disabled={isUploading}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="title" className="font-medium">Project Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Trade Show Booth Design"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="font-medium">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your design concept, objectives, and key features..."
              className="h-28 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="font-medium">3D Model File *</Label>
            <div
              onClick={() => document.getElementById('file-input').click()}
              className="border-2 border-dashed border-slate-200 hover:border-[#e2231a]/30 rounded-xl p-6 text-center cursor-pointer transition-colors group"
            >
              <Upload className="w-8 h-8 text-slate-300 group-hover:text-[#e2231a]/50 mx-auto mb-2 transition-colors" />
              {formData.file ? (
                <p className="text-sm font-medium text-slate-700">{formData.file.name}</p>
              ) : (
                <>
                  <p className="text-sm text-slate-500">Click to upload</p>
                  <p className="text-xs text-slate-400 mt-1">GLB or GLTF files only</p>
                </>
              )}
            </div>
            <input
              id="file-input"
              type="file"
              accept=".glb,.gltf"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              onClick={onSubmit}
              disabled={isUploading || !formData.title || !formData.file}
              className="flex-1 bg-[#e2231a] hover:bg-[#b01b13] h-11"
            >
              {isUploading ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Uploading...
                </span>
              ) : 'Submit Design'}
            </Button>
            <Button onClick={onCancel} variant="outline" disabled={isUploading} className="h-11">
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}