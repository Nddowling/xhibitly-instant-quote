import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Clock, CheckCircle, XCircle, AlertCircle, Plus } from 'lucide-react';
import { motion } from 'framer-motion';

export default function StudentHome() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    file: null
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      
      if (currentUser.user_type !== 'student') {
        navigate(createPageUrl('QuoteRequest'));
        return;
      }

      const userSubmissions = await base44.entities.StudentSubmission.filter({ 
        student_email: currentUser.email 
      });
      setSubmissions(userSubmissions.sort((a, b) => 
        new Date(b.created_date) - new Date(a.created_date)
      ));
    } catch (e) {
      console.error('Error loading data:', e);
    }
    setIsLoading(false);
  };

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

  const handleSubmit = async () => {
    if (!formData.title || !formData.file) {
      alert('Please provide a title and upload a file');
      return;
    }

    setIsUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: formData.file });
      
      await base44.entities.StudentSubmission.create({
        student_id: user.id,
        student_email: user.email,
        student_name: user.contact_name || user.full_name || 'Student',
        title: formData.title,
        description: formData.description,
        model_file_url: file_url,
        status: 'Submitted'
      });

      setFormData({ title: '', description: '', file: null });
      setShowForm(false);
      await loadData();
    } catch (e) {
      console.error('Error submitting:', e);
      alert('Error uploading submission. Please try again.');
    }
    setIsUploading(false);
  };

  const getStatusColor = (status) => {
    const colors = {
      'Draft': 'bg-slate-100 text-slate-700',
      'Submitted': 'bg-blue-100 text-blue-700',
      'Under Review': 'bg-yellow-100 text-yellow-700',
      'Approved': 'bg-green-100 text-green-700',
      'Needs Revision': 'bg-orange-100 text-orange-700',
      'Rejected': 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-slate-100 text-slate-700';
  };

  const getStatusIcon = (status) => {
    if (status === 'Approved') return <CheckCircle className="w-4 h-4" />;
    if (status === 'Rejected') return <XCircle className="w-4 h-4" />;
    if (status === 'Under Review') return <Clock className="w-4 h-4" />;
    if (status === 'Needs Revision') return <AlertCircle className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 p-6 pb-24 md:pb-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Submissions</h1>
            <p className="text-slate-500 mt-1">Upload and track your design projects</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-[#e2231a] hover:bg-[#b01b13]"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Submission
          </Button>
        </div>

        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="mb-8 shadow-lg">
              <CardHeader>
                <CardTitle>Upload New Design</CardTitle>
                <CardDescription>Submit your GLB or GLTF 3D model file</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Project Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g., Trade Show Booth Design"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe your design concept, objectives, and key features..."
                    className="mt-1 h-32"
                  />
                </div>

                <div>
                  <Label htmlFor="file">3D Model File (GLB or GLTF) *</Label>
                  <div className="mt-1 flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('file').click()}
                      className="w-full justify-start"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {formData.file ? formData.file.name : 'Choose file...'}
                    </Button>
                    <input
                      id="file"
                      type="file"
                      accept=".glb,.gltf"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Supported formats: GLB, GLTF
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={handleSubmit}
                    disabled={isUploading || !formData.title || !formData.file}
                    className="flex-1 bg-[#e2231a] hover:bg-[#b01b13]"
                  >
                    {isUploading ? 'Uploading...' : 'Submit'}
                  </Button>
                  <Button
                    onClick={() => {
                      setShowForm(false);
                      setFormData({ title: '', description: '', file: null });
                    }}
                    variant="outline"
                    disabled={isUploading}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="space-y-4">
          {submissions.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Upload className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-700 mb-2">No submissions yet</h3>
                <p className="text-slate-500 mb-6">Upload your first 3D design to get started</p>
                <Button onClick={() => setShowForm(true)} className="bg-[#e2231a] hover:bg-[#b01b13]">
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Submission
                </Button>
              </CardContent>
            </Card>
          ) : (
            submissions.map((submission) => (
              <motion.div
                key={submission.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-slate-900 mb-2">
                          {submission.title}
                        </h3>
                        {submission.description && (
                          <p className="text-slate-600 text-sm mb-3">{submission.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                          <span>Submitted {new Date(submission.created_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Badge className={`${getStatusColor(submission.status)} flex items-center gap-1`}>
                        {getStatusIcon(submission.status)}
                        {submission.status}
                      </Badge>
                    </div>

                    {submission.feedback && (
                      <div className="bg-slate-50 rounded-lg p-4 mb-3">
                        <Label className="text-sm font-semibold text-slate-700 mb-1 block">
                          Feedback
                        </Label>
                        <p className="text-sm text-slate-600">{submission.feedback}</p>
                      </div>
                    )}

                    {submission.grade && (
                      <div className="flex items-center gap-2 mb-3">
                        <Label className="text-sm font-semibold text-slate-700">Grade:</Label>
                        <span className="text-lg font-bold text-[#e2231a]">{submission.grade}</span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(submission.model_file_url, '_blank')}
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        View File
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}