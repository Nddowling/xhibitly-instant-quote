import React from 'react';
import { Bot, BookOpen, MessageSquare, Upload, Sparkles, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const steps = [
  {
    title: 'Create the support agent',
    description: 'Set up a dealer-facing onboarding and support chat that can answer platform questions.',
    icon: Bot,
  },
  {
    title: 'Build the knowledge base',
    description: 'Upload onboarding docs, SOPs, FAQs, and training content that the agent can reference.',
    icon: BookOpen,
  },
  {
    title: 'Connect chat to knowledge',
    description: 'Use the uploaded docs as the source for support answers so dealers get guided help in context.',
    icon: MessageSquare,
  },
];

const docs = [
  'Dealer onboarding checklist',
  'Quote workflow guide',
  'Catalog and SKU lookup guide',
  'Pricing rules and approvals',
  'Proposal and render process',
  'Common support FAQs',
];

export default function SetupBrokerOnboarding() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Dealer Support & Knowledge Base</h2>
        <p className="text-sm text-slate-500">Manage the onboarding support agent and the document library it should use to help dealers through the platform.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Recommended Setup Flow</CardTitle>
            <CardDescription>Keep both onboarding chat and knowledge docs together here in Setup.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.map(({ title, description, icon: StepIcon }) => (
              <div key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#e2231a]/10 text-[#e2231a] flex items-center justify-center flex-shrink-0">
                  <StepIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{title}</p>
                  <p className="text-sm text-slate-500 mt-1">{description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="w-4 h-4" /> Knowledge Base Starter Docs</CardTitle>
            <CardDescription>These are the best first documents to upload into the dealer support knowledge base.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {docs.map((doc) => (
              <div key={doc} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span>{doc}</span>
              </div>
            ))}
            <div className="pt-3 flex gap-2">
              <Button className="bg-[#e2231a] hover:bg-[#c41e17] text-white">Create Agent</Button>
              <Button variant="outline">Upload Docs</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}