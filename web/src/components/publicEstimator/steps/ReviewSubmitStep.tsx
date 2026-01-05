'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { ClientInfo, ProjectInfo, LineItemData } from '../PublicEstimatorWizard';

interface ReviewSubmitStepProps {
  clientInfo: ClientInfo;
  projectInfo: ProjectInfo;
  lineItems: LineItemData[];
  isSubmitting: boolean;
  error: string | null;
  onSubmit: () => void;
  onBack: () => void;
}

export default function ReviewSubmitStep({
  clientInfo,
  projectInfo,
  lineItems,
  isSubmitting,
  error,
  onSubmit,
  onBack,
}: ReviewSubmitStepProps) {
  return (
    <div className="space-y-6">
      <p className="text-gray-600">
        Please review your information below. Once you submit, we'll generate a detailed estimate and send it to your email.
      </p>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Client Information */}
      <Card className="p-4 bg-slate-50">
        <h3 className="font-semibold text-lg mb-4">Your Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Name</p>
            <p className="font-medium">{clientInfo.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="font-medium">{clientInfo.email}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Phone</p>
            <p className="font-medium">{clientInfo.phone}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Company</p>
            <p className="font-medium">{clientInfo.company || '—'}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-sm text-gray-600">Address</p>
            <p className="font-medium">
              {clientInfo.address}, {clientInfo.city}, {clientInfo.postcode}
            </p>
          </div>
        </div>
      </Card>

      {/* Project Information */}
      <Card className="p-4 bg-slate-50">
        <h3 className="font-semibold text-lg mb-4">Project Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Property Type</p>
            <p className="font-medium capitalize">{projectInfo.propertyType}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Project Type</p>
            <p className="font-medium capitalize">{projectInfo.projectType}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Location</p>
            <p className="font-medium">{projectInfo.location}</p>
          </div>
          {projectInfo.targetDate && (
            <div>
              <p className="text-sm text-gray-600">Target Date</p>
              <p className="font-medium">
                {new Date(projectInfo.targetDate).toLocaleDateString()}
              </p>
            </div>
          )}
          {projectInfo.projectDescription && (
            <div className="md:col-span-2">
              <p className="text-sm text-gray-600">Description</p>
              <p className="font-medium">{projectInfo.projectDescription}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Line Items */}
      <Card className="p-4 bg-slate-50">
        <h3 className="font-semibold text-lg mb-4">Items ({lineItems.length})</h3>
        <div className="space-y-4">
          {lineItems.map((item, idx) => (
            <div key={item.id} className="border-b last:border-b-0 pb-4 last:pb-0">
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-medium">Item {idx + 1}: {item.description}</h4>
                <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Qty: {item.quantity}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                {item.productType && (
                  <div>
                    <p className="text-gray-600">Type</p>
                    <p className="font-medium capitalize">{item.productType}</p>
                  </div>
                )}
                {item.widthMm && (
                  <div>
                    <p className="text-gray-600">Width</p>
                    <p className="font-medium">{item.widthMm}mm</p>
                  </div>
                )}
                {item.heightMm && (
                  <div>
                    <p className="text-gray-600">Height</p>
                    <p className="font-medium">{item.heightMm}mm</p>
                  </div>
                )}
                {item.timber && (
                  <div>
                    <p className="text-gray-600">Timber</p>
                    <p className="font-medium capitalize">{item.timber}</p>
                  </div>
                )}
                {item.ironmongery && (
                  <div>
                    <p className="text-gray-600">Ironmongery</p>
                    <p className="font-medium capitalize">{item.ironmongery}</p>
                  </div>
                )}
                {item.glazing && (
                  <div>
                    <p className="text-gray-600">Glazing</p>
                    <p className="font-medium capitalize">{item.glazing}</p>
                  </div>
                )}
              </div>

              {item.photoUrl && (
                <div className="mt-3">
                  <img src={item.photoUrl} alt="Item reference" className="w-20 h-20 object-cover rounded" />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Submit Notice */}
      <Card className="p-4 bg-green-50 border-green-200">
        <p className="text-sm text-green-800">
          ✓ Once submitted, we'll analyze your information and send a detailed estimate to{' '}
          <span className="font-semibold">{clientInfo.email}</span> within 24 hours.
        </p>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between pt-4">
        <Button onClick={onBack} variant="outline" size="lg" disabled={isSubmitting}>
          Back
        </Button>
        <Button
          onClick={onSubmit}
          size="lg"
          className="bg-green-600 hover:bg-green-700"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Submit & Generate Estimate'}
        </Button>
      </div>
    </div>
  );
}
