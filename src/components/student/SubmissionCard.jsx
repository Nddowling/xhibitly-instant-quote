import React from 'react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Clock, CheckCircle, XCircle, AlertCircle, MessageSquare, ExternalLink } from 'lucide-react';
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

  const handleClick = () => {
    if (submission.model_file_url) {
      window.open(submission.model_file_url, '_blank');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card
        onClick={handleClick}
        className="border-0 shadow-sm hover:shadow-md transition-all bg-white cursor-pointer group active:scale-[0.99]"
      >
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-50 group-hover:bg-[#e2231a]/5 flex items-center justify-center shrink-0 transition-colors">
              <FileText className="w-5 h-5 text-slate-400 group-hover:text-[#e2231a]/60 transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900 truncate">{submission.title}</h3>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-[#e2231a]/50 shrink-0 transition-colors" />
                  </div>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {moment(submission.created_date).fromNow()}
                  </p>
                </div>
                <Badge className={`${config.color} border-0 shrink-0 gap-1 font-medium text-[11px] sm:text-xs`}>
                  <Icon className="w-3 h-3" />
                  <span className="hidden sm:inline">{submission.status}</span>
                  <span className="sm:hidden">{submission.status.split(' ')[0]}</span>
                </Badge>
              </div>
              {submission.description && (
                <p className="text-sm text-slate-500 mt-2 line-clamp-2">{submission.description}</p>
              )}
              {submission.feedback && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg" onClick={(e) => e.stopPropagation()}>
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