/**
 * ThankYouStep - Confirmation after estimate submission
 * Sets clear expectations and provides next step options
 */

import { CheckCircle, Calendar, MessageSquare, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ThankYouStepProps {
  companyName: string;
  contactEmail?: string;
  contactPhone?: string;
  estimatedResponseTime?: string;
  primaryColor?: string;
  brandLogo?: string;
  onBookCall?: () => void;
  onAskQuestion?: () => void;
}

export function ThankYouStep({
  companyName,
  contactEmail,
  contactPhone,
  estimatedResponseTime = '24 hours',
  primaryColor = '#3b82f6',
  brandLogo,
  onBookCall,
  onAskQuestion,
}: ThankYouStepProps) {
  return (
    <div className="space-y-8 pb-8">
      {/* Success animation */}
      <div className="text-center">
        <div 
          className="mx-auto flex h-24 w-24 items-center justify-center rounded-full animate-pulse"
          style={{ backgroundColor: `${primaryColor}15` }}
        >
          <CheckCircle 
            className="h-16 w-16" 
            style={{ color: primaryColor }}
          />
        </div>
        
        <h1 className="mt-6 text-3xl font-bold text-slate-900">
          Thank you!
        </h1>
        <p className="mt-3 text-lg text-slate-600 max-w-md mx-auto">
          Your request has been sent to {companyName}. We'll review your details and get back to you soon.
        </p>
      </div>

      {/* What happens next */}
      <div className="rounded-3xl border-2 p-6 space-y-4" style={{ borderColor: `${primaryColor}20`, backgroundColor: `${primaryColor}05` }}>
        <h2 className="text-xl font-bold text-slate-900">
          What happens next:
        </h2>
        
        <div className="space-y-4">
          <div className="flex gap-4">
            <div 
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white flex-shrink-0 font-bold"
              style={{ backgroundColor: primaryColor }}
            >
              1
            </div>
            <div>
              <div className="font-semibold text-slate-900">Expert review</div>
              <div className="text-sm text-slate-600 mt-1">
                Our team is reviewing your photos and measurements using AI-assisted tools
              </div>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div 
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white flex-shrink-0 font-bold"
              style={{ backgroundColor: primaryColor }}
            >
              2
            </div>
            <div>
              <div className="font-semibold text-slate-900">You'll receive your quote</div>
              <div className="text-sm text-slate-600 mt-1">
                We'll email you a detailed, personalized estimate within <span className="font-medium">{estimatedResponseTime}</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div 
              className="flex h-10 w-10 items-center justify-center rounded-xl text-white flex-shrink-0 font-bold"
              style={{ backgroundColor: primaryColor }}
            >
              3
            </div>
            <div>
              <div className="font-semibold text-slate-900">Optional site visit</div>
              <div className="text-sm text-slate-600 mt-1">
                We can arrange a free visit to confirm measurements and answer questions
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contact info */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900 mb-3">
          Questions in the meantime?
        </h3>
        <div className="space-y-2 text-sm text-slate-600">
          {contactEmail && (
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
              <a href={`mailto:${contactEmail}`} className="hover:underline">
                {contactEmail}
              </a>
            </div>
          )}
          {contactPhone && (
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
              <a href={`tel:${contactPhone}`} className="hover:underline">
                {contactPhone}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {(onBookCall || onAskQuestion) && (
        <div className="grid gap-3">
          {onBookCall && (
            <Button
              onClick={onBookCall}
              size="lg"
              className="w-full gap-2 text-base"
              style={{ backgroundColor: primaryColor }}
            >
              <Calendar className="h-5 w-5" />
              Book a callback
            </Button>
          )}
          {onAskQuestion && (
            <Button
              onClick={onAskQuestion}
              variant="outline"
              size="lg"
              className="w-full gap-2 text-base border-2"
            >
              <MessageSquare className="h-5 w-5" />
              Ask a question
            </Button>
          )}
        </div>
      )}

      {/* Branding footer */}
      {brandLogo && (
        <div className="flex items-center justify-center gap-3 pt-4 border-t">
          <img
            src={brandLogo}
            alt={companyName}
            className="h-8 w-8 rounded-lg object-contain"
          />
          <span className="text-sm text-slate-500">
            Powered by {companyName}
          </span>
        </div>
      )}
    </div>
  );
}
