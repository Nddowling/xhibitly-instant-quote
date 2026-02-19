import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Clock, CheckCircle, XCircle, AlertCircle, MessageSquare } from 'lucide-react';
import moment from 'moment';

const STATUS_CONFIG = {
  'Draft': { color: 'bg-slate-100 text-slate-600', icon: FileText },
  'Submitted': { color: 'bg-blue-50 text-blue-600', icon: Clock },
  'Under Review': { color: 'bg-amber-50 text-amber-600', icon: Clock },
  'Approved': { color: 'bg-emerald-50 text-emerald-600', icon: CheckCircle },
  'Needs Revision': { color: 'bg-orange-50 text-orange-600', icon: AlertCircle },
  'Rejected': { color: 'bg-red-50 text-red-600', icon: XCircle },
};

export default function SubmissionCard({ submission, index }) {
  const config = STATUS_CONFIG[submission.status] || STATUS_CONFIG['Draft'];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900 truncate">{submission.title}</h3>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {moment(submission.created_date).fromNow()}
                  </p>
                </div>
                <Badge className={`${config.color} border-0 shrink-0 gap-1.5 font-medium`}>
                  <Icon className="w-3 h-3" />
                  {submission.status}
                </Badge>
              </div>
              {submission.description && (
                <p className="text-sm text-slate-500 mt-2 line-clamp-2">{submission.description}</p>
              )}
              {submission.feedback && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mb-1">
                    <MessageSquare className="w-3 h-3" />
                    Feedback
                  </div>
                  <p className="text-sm text-slate-600">{submission.feedback}</p>
                </div>
              )}
              {submission.grade && (
                <div className="mt-2 inline-flex items-center gap-1.5 text-sm">
                  <span className="text-slate-400">Grade:</span>
                  <span className="font-semibold text-slate-700">{submission.grade}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}