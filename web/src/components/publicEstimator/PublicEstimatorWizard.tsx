'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ClientInfoStep from './steps/ClientInfoStep';
import ProjectInfoStep from './steps/ProjectInfoStep';
import LineItemsStep from './steps/LineItemsStep';
import ReviewSubmitStep from './steps/ReviewSubmitStep';
import { ThankYouStep } from './steps/ThankYouStep';
import { ProgressBar } from './ProgressBar';
import { SocialProofPanel } from './SocialProofPanel';

export interface ClientInfo {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postcode: string;
  company?: string;
}

export interface ProjectInfo {
  propertyType: string; // 'residential', 'commercial', 'other'
  projectType: string; // 'doors', 'windows', 'both'
  location: string;
  projectDescription?: string;
  targetDate?: string; // ISO date string
  budget?: string;
  urgency?: 'low' | 'medium' | 'high';
}

export interface LineItemData {
  id: string;
  description: string;
  quantity: number;
  widthMm?: number;
  heightMm?: number;
  productType?: 'doors' | 'windows';
  productOption?: string;
  timber?: string;
  ironmongery?: string;
  glazing?: string;
  photoUrl?: string;
  estimatedPrice?: number;
}

type WizardStep = 'client' | 'project' | 'lineitems' | 'review' | 'thankyou';

interface PublicEstimatorWizardProps {
  tenantSlug?: string;
  leadId?: string;
  token?: string;
}

export default function PublicEstimatorWizard({ 
  tenantSlug, 
  leadId, 
  token 
}: PublicEstimatorWizardProps = {}) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('client');
  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postcode: '',
  });
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({
    propertyType: '',
    projectType: '',
    location: '',
  });
  const [lineItems, setLineItems] = useState<LineItemData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Fetch lead data if leadId is provided
  useEffect(() => {
    if (leadId && tenantSlug) {
      const fetchLeadData = async () => {
        try {
          const response = await fetch(`/api/leads/${leadId}`);
          if (response.ok) {
            const lead = await response.json();
            // Pre-fill form with lead data
            setClientInfo(prev => ({
              ...prev,
              name: lead.contactName || prev.name,
              email: lead.email || prev.email,
              phone: lead.phone || prev.phone,
              address: lead.address || prev.address,
              city: lead.city || prev.city,
              postcode: lead.postcode || prev.postcode,
            }));
          }
        } catch (error) {
          console.warn('Failed to fetch lead data for pre-fill:', error);
        }
      };
      fetchLeadData();
    }
  }, [leadId, tenantSlug]);

  const stepIndex: Record<WizardStep, number> = {
    client: 0,
    project: 1,
    lineitems: 2,
    review: 3,
    thankyou: 4,
  };

  const progress = ((stepIndex[currentStep] + 1) / 5) * 100;

  const handleClientInfoNext = useCallback((info: ClientInfo) => {
    setClientInfo(info);
    setCurrentStep('project');
  }, []);

  const handleProjectInfoNext = useCallback((info: ProjectInfo) => {
    setProjectInfo(info);
    setCurrentStep('lineitems');
  }, []);
    setLineItems(items);
    setCurrentStep('review');
  }, []);

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      // Prepare estimate data
      const estimateData = {
        clientInfo,
        projectInfo,
        lineItems: lineItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          widthMm: item.widthMm,
          heightMm: item.heightMm,
          productType: item.productType,
          productOption: item.productOption,
          timber: item.timber,
          ironmongery: item.ironmongery,
          glazing: item.glazing,
          photoUrl: item.photoUrl,
        })),
      };

      // Submit to backend to create lead and quote
      const response = await fetch('/api/public/estimate-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(estimateData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit estimate');
      }

      const result = await response.json();
      console.log('[PublicEstimatorWizard] Estimate submitted:', result);

      // Move to thank you step
      setCurrentStep('thankyou');
    } catch (error) {
      console.error('[PublicEstimatorWizard] Submission error:', error);
      setSubmissionError(
        error instanceof Error ? error.message : 'Failed to submit estimate'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [clientInfo, projectInfo, lineItems]);

  const handleBack = useCallback(() => {
    const steps: WizardStep[] = ['client', 'project', 'lineitems', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  }, [currentStep]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        {/* Progress Bar */}
        <ProgressBar progress={progress} />

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Left Column - Steps */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle>
                  {currentStep === 'client' && 'Your Details'}
                  {currentStep === 'project' && 'Project Information'}
                  {currentStep === 'lineitems' && 'Add Items'}
                  {currentStep === 'review' && 'Review Your Estimate'}
                  {currentStep === 'thankyou' && 'Thank You!'}
                </CardTitle>
              </CardHeader>
              <CardContent className="min-h-96">
                {currentStep === 'client' && (
                  <ClientInfoStep
                    initialData={clientInfo}
                    onNext={handleClientInfoNext}
                  />
                )}

                {currentStep === 'project' && (
                  <ProjectInfoStep
                    initialData={projectInfo}
                    onNext={handleProjectInfoNext}
                    onBack={handleBack}
                  />
                )}

                {currentStep === 'lineitems' && (
                  <LineItemsStep
                    projectType={projectInfo.projectType}
                    items={lineItems}
                    onNext={handleLineItemsNext}
                    onBack={handleBack}
                  />
                )}

                {currentStep === 'review' && (
                  <ReviewSubmitStep
                    clientInfo={clientInfo}
                    projectInfo={projectInfo}
                    lineItems={lineItems}
                    isSubmitting={isSubmitting}
                    error={submissionError}
                    onSubmit={handleSubmit}
                    onBack={handleBack}
                  />
                )}

                {currentStep === 'thankyou' && (
                  <ThankYouStep 
                    companyName="Custom Joinery"
                    contactEmail="estimates@example.com"
                    contactPhone="+44 1234 567890"
                    estimatedResponseTime="24 hours"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Social Proof */}
          {currentStep !== 'thankyou' && (
            <div className="lg:col-span-1">
              <SocialProofPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
