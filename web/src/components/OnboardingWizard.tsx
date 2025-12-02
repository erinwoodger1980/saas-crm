"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle, ArrowRight, ArrowLeft, X, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

interface WizardStep {
  id: string;
  title: string;
  description: string;
  content: React.ReactNode;
  action?: {
    label: string;
    path: string;
  };
  completed?: boolean;
}

interface OnboardingWizardProps {
  open: boolean;
  onClose: () => void;
  wizardType: 'onboarding' | 'import-data' | 'workshop-setup' | 'automation-setup';
}

export default function OnboardingWizard({ open, onClose, wizardType }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const router = useRouter();

  const wizardSteps: Record<string, WizardStep[]> = {
    onboarding: [
      {
        id: 'company-info',
        title: 'Company Information',
        description: 'Set up your company details and branding',
        content: (
          <div className="space-y-4">
            <p className="text-gray-700">Let's start by setting up your company profile. This information appears on quotes, invoices, and your customer-facing landing page.</p>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
              <h4 className="font-semibold text-blue-900 mb-2">What you'll configure:</h4>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>• Company name and logo</li>
                <li>• Contact details (phone, email, address)</li>
                <li>• VAT registration number and rate</li>
                <li>• Financial year end date</li>
              </ul>
            </div>
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              <strong>Tip:</strong> Your logo should be PNG or JPG format, minimum 200x200px for best quality.
            </div>
          </div>
        ),
        action: {
          label: 'Go to Company Settings',
          path: '/settings'
        }
      },
      {
        id: 'questionnaires',
        title: 'Customer Questionnaires',
        description: 'Create forms to gather project information from customers',
        content: (
          <div className="space-y-4">
            <p className="text-gray-700">Questionnaires help you collect detailed project requirements from customers through your landing page or public forms.</p>
            <div className="bg-green-50 border-l-4 border-green-500 p-4">
              <h4 className="font-semibold text-green-900 mb-2">Common questions to ask:</h4>
              <ul className="space-y-2 text-sm text-green-800">
                <li>• Property type (residential, commercial, listed building)</li>
                <li>• Number of windows/doors needed</li>
                <li>• Timber, glass, and finish preferences</li>
                <li>• Measurements and specifications</li>
                <li>• Installation requirements</li>
                <li>• Budget and timeline</li>
              </ul>
            </div>
            <p className="text-sm text-gray-600">You can create multiple questionnaires for different product types (e.g., one for sash windows, another for fire doors).</p>
          </div>
        ),
        action: {
          label: 'Setup Questionnaires',
          path: '/settings'
        }
      },
      {
        id: 'email-integration',
        title: 'Email Integration',
        description: 'Connect Gmail or Outlook for automatic lead creation',
        content: (
          <div className="space-y-4">
            <p className="text-gray-700">Connect your email to automatically create leads from customer inquiries and track all communications in one place.</p>
            <div className="bg-purple-50 border-l-4 border-purple-500 p-4">
              <h4 className="font-semibold text-purple-900 mb-2">Benefits:</h4>
              <ul className="space-y-2 text-sm text-purple-800">
                <li>• Auto-create leads from incoming emails</li>
                <li>• Track email history with each customer</li>
                <li>• Send follow-ups directly from the CRM</li>
                <li>• AI-powered email generation</li>
              </ul>
            </div>
            <p className="text-sm text-gray-600">Supports Gmail (Google Workspace) and Outlook (Microsoft 365). Connection is secure and uses OAuth authentication.</p>
          </div>
        ),
        action: {
          label: 'Connect Email',
          path: '/settings/communications'
        }
      },
      {
        id: 'import-data',
        title: 'Import Existing Data',
        description: 'Bring in your existing customers and projects',
        content: (
          <div className="space-y-4">
            <p className="text-gray-700">If you have existing customer data, leads, or projects in spreadsheets, you can import them in bulk.</p>
            <div className="bg-orange-50 border-l-4 border-orange-500 p-4">
              <h4 className="font-semibold text-orange-900 mb-2">What you can import:</h4>
              <ul className="space-y-2 text-sm text-orange-800">
                <li>• <strong>Leads:</strong> Customer contacts, inquiry details, source information</li>
                <li>• <strong>Fire Door Schedules:</strong> MJS numbers, specifications, job locations</li>
                <li>• <strong>Material Costs:</strong> Pricing for timber, glass, ironmongery</li>
              </ul>
            </div>
            <p className="text-sm text-gray-600">Prepare your CSV files with column headers. The system will let you map columns to the right fields during import.</p>
          </div>
        ),
        action: {
          label: 'Import Data',
          path: '/leads'
        }
      },
      {
        id: 'automation',
        title: 'Setup Automation',
        description: 'Create automatic tasks to streamline your workflow',
        content: (
          <div className="space-y-4">
            <p className="text-gray-700">Automation rules create tasks automatically based on project dates and status changes, so nothing falls through the cracks.</p>
            <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4">
              <h4 className="font-semibold text-indigo-900 mb-2">Popular automations:</h4>
              <ul className="space-y-2 text-sm text-indigo-800">
                <li>• Order materials 20 days before delivery</li>
                <li>• Schedule installation prep 3 days before install date</li>
                <li>• Follow up 3 days after sending quote</li>
                <li>• Request feedback 7 days after project completion</li>
              </ul>
            </div>
            <p className="text-sm text-gray-600">Use our AI assistant to describe automations in plain English, or build them step-by-step in the automation builder.</p>
          </div>
        ),
        action: {
          label: 'Create Automations',
          path: '/settings/automation'
        }
      }
    ],
    'import-data': [
      {
        id: 'prepare-csv',
        title: 'Prepare Your CSV File',
        description: 'Format your data for import',
        content: (
          <div className="space-y-4">
            <p className="text-gray-700">CSV (Comma-Separated Values) files work best for bulk imports. You can export from Excel or Google Sheets.</p>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
              <h4 className="font-semibold text-blue-900 mb-2">CSV Format Requirements:</h4>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>• First row must contain column headers</li>
                <li>• Use clear header names (e.g., "Customer Name", "Email", "Phone")</li>
                <li>• Dates in YYYY-MM-DD or DD/MM/YYYY format</li>
                <li>• One record per row</li>
                <li>• Save as .csv file (UTF-8 encoding)</li>
              </ul>
            </div>
            <div className="mt-4 bg-gray-100 p-3 rounded font-mono text-xs">
              <div>Customer Name,Email,Phone,Project Type,Status</div>
              <div>John Smith,john@example.com,07700123456,Sash Windows,New Enquiry</div>
              <div>Jane Doe,jane@example.com,07700654321,Fire Doors,Quote Sent</div>
            </div>
          </div>
        )
      },
      {
        id: 'import-leads',
        title: 'Import Leads',
        description: 'Upload customer contacts and inquiries',
        content: (
          <div className="space-y-4">
            <p className="text-gray-700">Import your existing customer inquiries to start tracking them in the CRM.</p>
            <div className="bg-green-50 border-l-4 border-green-500 p-4">
              <h4 className="font-semibold text-green-900 mb-2">Lead fields to include:</h4>
              <ul className="space-y-2 text-sm text-green-800">
                <li>• <strong>Required:</strong> Customer Name, Email or Phone</li>
                <li>• <strong>Recommended:</strong> Project Description, Status, Source</li>
                <li>• <strong>Optional:</strong> Address, Budget, Timeline, Lead Owner</li>
              </ul>
            </div>
            <p className="text-sm text-gray-600">The system will validate emails and flag any duplicates before importing.</p>
          </div>
        ),
        action: {
          label: 'Import Leads',
          path: '/leads'
        }
      },
      {
        id: 'import-fire-doors',
        title: 'Import Fire Door Schedules',
        description: 'Upload MJS schedules and door specifications',
        content: (
          <div className="space-y-4">
            <p className="text-gray-700">If you have existing fire door projects, import them with MJS numbers, specifications, and production details.</p>
            <div className="bg-orange-50 border-l-4 border-orange-500 p-4">
              <h4 className="font-semibold text-orange-900 mb-2">Fire door schedule fields:</h4>
              <ul className="space-y-2 text-sm text-orange-800">
                <li>• MJS Number (unique identifier)</li>
                <li>• Job Name and Client Name</li>
                <li>• Job Location</li>
                <li>• Delivery Date and Installation Date</li>
                <li>• Door specifications (size, rating, finish)</li>
                <li>• Material status (timber, glass, ironmongery)</li>
              </ul>
            </div>
          </div>
        ),
        action: {
          label: 'Import Fire Door Schedule',
          path: '/fire-doors/imports'
        }
      }
    ],
    'workshop-setup': [
      {
        id: 'workshop-overview',
        title: 'Workshop Management Overview',
        description: 'Understand how workshop scheduling works',
        content: (
          <div className="space-y-4">
            <p className="text-gray-700">The workshop system helps you track production, schedule jobs, and manage material ordering across all projects.</p>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Key features:</h4>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>• <strong>Job Schedule:</strong> Visual timeline of all projects</li>
                <li>• <strong>Material Tracking:</strong> Order, expected, and received dates</li>
                <li>• <strong>Task Management:</strong> Production tasks linked to projects</li>
                <li>• <strong>Status Updates:</strong> Real-time progress tracking</li>
              </ul>
            </div>
          </div>
        )
      },
      {
        id: 'import-projects',
        title: 'Import Existing Projects',
        description: 'Bring in your current workshop schedule',
        content: (
          <div className="space-y-4">
            <p className="text-gray-700">Import your existing projects to populate the workshop schedule. This includes delivery dates, installation dates, and current status.</p>
            <div className="bg-green-50 border-l-4 border-green-500 p-4">
              <h4 className="font-semibold text-green-900 mb-2">What to include in your CSV:</h4>
              <ul className="space-y-2 text-sm text-green-800">
                <li>• Project/Job identifier (MJS Number or Job Name)</li>
                <li>• Customer name</li>
                <li>• Delivery date (when materials should arrive)</li>
                <li>• Installation date (when work will be done on-site)</li>
                <li>• Current status (e.g., "In Production", "Ready for Install")</li>
              </ul>
            </div>
          </div>
        ),
        action: {
          label: 'Import Projects',
          path: '/fire-doors/imports'
        }
      },
      {
        id: 'setup-automation',
        title: 'Automate Material Ordering',
        description: 'Create automatic reminders for material orders',
        content: (
          <div className="space-y-4">
            <p className="text-gray-700">Set up automation to create "Order Materials" tasks automatically based on delivery dates.</p>
            <div className="bg-purple-50 border-l-4 border-purple-500 p-4">
              <h4 className="font-semibold text-purple-900 mb-2">Recommended automation:</h4>
              <div className="space-y-3 text-sm text-purple-800">
                <div>
                  <strong>Rule:</strong> When delivery date is set on a project...
                </div>
                <div className="pl-4">
                  → Create "Order Paint" task <strong>20 days before</strong> delivery
                </div>
                <div className="pl-4">
                  → Create "Order Timber" task <strong>25 days before</strong> delivery
                </div>
                <div className="pl-4">
                  → Create "Order Glass" task <strong>20 days before</strong> delivery
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-600">You can use our AI assistant: just type "create a task to order paint 20 days before delivery"</p>
          </div>
        ),
        action: {
          label: 'Setup Automation',
          path: '/settings/automation'
        }
      }
    ],
    'automation-setup': [
      {
        id: 'automation-basics',
        title: 'Understanding Automation',
        description: 'How automation rules work',
        content: (
          <div className="space-y-4">
            <p className="text-gray-700">Automation rules consist of a trigger (when something happens) and actions (what to do automatically).</p>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Anatomy of an automation:</h4>
              <div className="space-y-3 text-sm text-blue-800">
                <div><strong>Trigger:</strong> When deliveryDate is set on an Opportunity</div>
                <div><strong>Action:</strong> Create "Order Materials" task</div>
                <div><strong>Timing:</strong> 20 days before the delivery date</div>
                <div><strong>Assignment:</strong> Assign to workshop manager</div>
              </div>
            </div>
          </div>
        )
      },
      {
        id: 'use-ai',
        title: 'Create with AI Assistant',
        description: 'Describe automations in plain English',
        content: (
          <div className="space-y-4">
            <p className="text-gray-700">The easiest way to create automations is using our AI assistant. Just describe what you want in natural language!</p>
            <div className="bg-purple-50 border-l-4 border-purple-500 p-4">
              <h4 className="font-semibold text-purple-900 mb-2">Example prompts:</h4>
              <ul className="space-y-2 text-sm text-purple-800">
                <li>• "Create a task to order paint 20 days before delivery"</li>
                <li>• "Send follow-up email 3 days after quote is sent"</li>
                <li>• "Create high priority installation prep task 3 days before install date"</li>
                <li>• "Remind me to check material status 10 days before delivery"</li>
              </ul>
            </div>
            <p className="text-sm text-gray-600">The AI will generate the automation rule for you to review and approve.</p>
          </div>
        ),
        action: {
          label: 'Try AI Assistant',
          path: '/settings/automation'
        }
      },
      {
        id: 'field-links',
        title: 'Setup Field Links',
        description: 'Sync tasks with project fields',
        content: (
          <div className="space-y-4">
            <p className="text-gray-700">Field Links create two-way sync between tasks and project fields. When you complete a task, it updates the related field automatically.</p>
            <div className="bg-green-50 border-l-4 border-green-500 p-4">
              <h4 className="font-semibold text-green-900 mb-2">Example use case:</h4>
              <div className="space-y-2 text-sm text-green-800">
                <div>1. Create field link: "paintOrderedAt" ↔ "Order Paint" task</div>
                <div>2. When task is marked complete → paintOrderedAt is set to today</div>
                <div>3. If you manually set paintOrderedAt → task is marked complete</div>
                <div>4. Bidirectional sync keeps everything in sync!</div>
              </div>
            </div>
          </div>
        ),
        action: {
          label: 'Setup Field Links',
          path: '/settings/automation'
        }
      }
    ]
  };

  const steps = wizardSteps[wizardType] || wizardSteps.onboarding;
  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCompletedSteps(prev => new Set(prev).add(currentStep));
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleActionClick = () => {
    const action = steps[currentStep].action;
    if (action) {
      setCompletedSteps(prev => new Set(prev).add(currentStep));
      onClose();
      router.push(action.path);
    }
  };

  const handleStepClick = (index: number) => {
    setCurrentStep(index);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4">
      <Card className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-indigo-600" />
              <h2 className="text-2xl font-bold text-gray-900">
                {wizardType === 'onboarding' && 'Welcome to Your CRM'}
                {wizardType === 'import-data' && 'Import Your Data'}
                {wizardType === 'workshop-setup' && 'Workshop Setup Guide'}
                {wizardType === 'automation-setup' && 'Automation Setup Guide'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span>Step {currentStep + 1} of {steps.length}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Step Navigation */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            {steps.map((step, index) => (
              <button
                key={step.id}
                onClick={() => handleStepClick(index)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
                  index === currentStep
                    ? 'bg-indigo-600 text-white'
                    : completedSteps.has(index)
                    ? 'bg-green-100 text-green-800'
                    : 'bg-white text-gray-600 hover:bg-gray-100'
                }`}
              >
                {completedSteps.has(index) ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
                <span className="font-medium">{step.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {steps[currentStep].title}
            </h3>
            <p className="text-gray-600 mb-6">
              {steps[currentStep].description}
            </p>
            {steps[currentStep].content}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous
          </Button>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
            >
              Close
            </Button>

            {steps[currentStep].action ? (
              <Button
                onClick={handleActionClick}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700"
              >
                {steps[currentStep].action?.label}
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={currentStep === steps.length - 1}
                className="flex items-center gap-2"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
