import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Upload } from 'lucide-react';
import StudentHero from '@/components/student/StudentHero';
import SubmissionForm from '@/components/student/SubmissionForm';
import SubmissionCard from '@/components/student/SubmissionCard';

export default function StudentHome() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', file: null });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const currentUser = await base44.auth.me();
    setUser(currentUser);

    if (currentUser.user_type !== 'student') {
      navigate(createPageUrl('QuoteRequest'));
      return;
    }

    const userSubmissions = await base44.entities.StudentSubmission.filter({
      student_email: currentUser.email
    });
    setSubmissions(userSubmissions.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)));
    setIsLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.file) return;

    setIsUploading(true);
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
    setIsUploading(false);
    await loadData();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#e2231a] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-slate-100 pb-20 md:pb-10">
      {/* Hero with upload CTA built in */}
      {!showForm && <StudentHero onUploadClick={() => setShowForm(true)} />}

      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Upload form (replaces hero when open) */}
        {showForm && (
          <div className="pt-6 mb-6">
            <SubmissionForm
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleSubmit}
              onCancel={() => { setShowForm(false); setFormData({ title: '', description: '', file: null }); }}
              isUploading={isUploading}
            />
          </div>
        )}

        {/* Submissions list */}
        <div className={`${showForm ? '' : '-mt-6 relative z-10'}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800">My Submissions</h2>
              <p className="text-sm text-slate-400">{submissions.length} design{submissions.length !== 1 ? 's' : ''}</p>
            </div>
            {showForm ? null : (
              <Button
                onClick={() => setShowForm(true)}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Upload
              </Button>
            )}
          </div>

          {submissions.length === 0 ? (
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="py-14 text-center">
                <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-6 h-6 text-slate-300" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-1">No submissions yet</h3>
                <p className="text-sm text-slate-400 mb-5">Upload your first 3D design to get started</p>
                <Button
                  onClick={() => setShowForm(true)}
                  className="bg-[#e2231a] hover:bg-[#b01b13]"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Upload Design
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {submissions.map((sub, i) => (
                <SubmissionCard key={sub.id} submission={sub} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}