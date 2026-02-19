import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Image, Sparkles, X } from 'lucide-react';

export default function DesignSection({ boothDesign }) {
  const [imageOpen, setImageOpen] = useState(false);

  if (!boothDesign) return null;

  return (
    <>
      <Card className="border shadow-sm">
        <CardHeader className="pb-2 pt-4 px-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Booth Design</CardTitle>
            {boothDesign.tier && (
              <Badge variant="outline" className="text-xs">{boothDesign.tier}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <h3 className="font-semibold text-slate-900 mb-3">{boothDesign.design_name}</h3>

          {boothDesign.design_image_url && (
            <div
              className="relative aspect-[16/9] bg-slate-100 rounded-lg overflow-hidden mb-4 cursor-pointer group"
              onClick={() => setImageOpen(true)}
            >
              <img
                src={boothDesign.design_image_url}
                alt={boothDesign.design_name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-2">
                  <Image className="w-5 h-5 text-slate-700" />
                </div>
              </div>
            </div>
          )}

          {boothDesign.experience_story && (
            <div className="mb-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Experience Story</p>
              <p className="text-sm text-slate-600 leading-relaxed">{boothDesign.experience_story}</p>
            </div>
          )}

          {boothDesign.key_moments?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1.5">Key Moments</p>
              <div className="space-y-1.5">
                {boothDesign.key_moments.map((m, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-slate-600">
                    <Sparkles className="w-3.5 h-3.5 text-[#e2231a] mt-0.5 shrink-0" />
                    {m}
                  </div>
                ))}
              </div>
            </div>
          )}

          {boothDesign.design_rationale && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Design Rationale</p>
              <p className="text-sm text-slate-600 leading-relaxed">{boothDesign.design_rationale}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full-screen image viewer */}
      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent className="max-w-4xl p-0 bg-black border-0">
          <button
            onClick={() => setImageOpen(false)}
            className="absolute top-3 right-3 z-10 bg-black/50 hover:bg-black/70 rounded-full p-1.5 text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={boothDesign.design_image_url}
            alt={boothDesign.design_name}
            className="w-full h-auto rounded-lg"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}