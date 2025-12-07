/**
 * ContactConversionStep - Capture or confirm contact details
 * Now dynamically renders fields from QuestionnaireField with scope='client'
 */

'use client';

import { useState } from 'react';
import { User, Mail, Phone, MessageSquare, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UnifiedFieldRenderer } from '@/components/fields/UnifiedFieldRenderer';
import type { QuestionnaireField } from '@/lib/questionnaireFields';

interface ContactDetails {
  name?: string;
  email?: string;
  phone?: string;
  preferredContact?: string;
  [key: string]: any; // Support dynamic fields
}

interface ContactConversionStepProps {
  contactDetails?: ContactDetails;
  entryMode?: 'AD' | 'INVITE';
  isInviteMode?: boolean;
  primaryColor?: string;
  companyName?: string;
  fields?: QuestionnaireField[];
  isLoadingFields?: boolean;
  onChange: (data: { contactDetails: ContactDetails }) => void;
  onSubmit: () => void;
  onBack: () => void;
}

const PREFERRED_CONTACT_OPTIONS = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'either', label: 'Either', icon: MessageSquare },
];

export function ContactConversionStep({
  contactDetails = {},
  entryMode = 'AD',
  isInviteMode = false,
  primaryColor = '#3b82f6',
  companyName = 'us',
  fields = [],
  isLoadingFields = false,
  onChange,
  onSubmit,
  onBack,
}: ContactConversionStepProps) {
  const [details, setDetails] = useState<ContactDetails>(contactDetails);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpdate = (field: string, value: any) => {
    const updated = { ...details, [field]: value };
    setDetails(updated);
    onChange({ contactDetails: updated });
    
    // Clear error when user types
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field, details[field]);
  };

  const validateField = (field: string, value?: any) => {
    const newErrors = { ...errors };

    // Find field definition
    const fieldDef = fields.find(f => f.key === field);
    if (!fieldDef) {
      // Legacy hardcoded validation
      if (field === 'name') {
      if (!value || value.trim().length === 0) {
        newErrors.name = 'Name is required';
      } else if (value.trim().length < 2) {
        newErrors.name = 'Please enter your full name';
      } else {
        delete newErrors.name;
      }
    }

    if (field === 'email') {
      if (!value || value.trim().length === 0) {
        newErrors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        newErrors.email = 'Please enter a valid email address';
      } else {
        delete newErrors.email;
      }
    }

    if (field === 'phone') {
      if (!value || value.trim().length === 0) {
        newErrors.phone = 'Phone number is required';
      } else if (!/^[\d\s\+\(\)\-]{10,}$/.test(value)) {
        newErrors.phone = 'Please enter a valid phone number';
      } else {
        delete newErrors.phone;
      }
    }
      return;
    }

    // Dynamic field validation
    if (fieldDef.required && (!value || (typeof value === 'string' && value.trim().length === 0))) {
      newErrors[field] = `${fieldDef.label} is required`;
    } else {
      delete newErrors[field];
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateAll = () => {
    // Mark all required fields as touched
    const requiredFields = fields.filter(f => f.required).map(f => f.key);
    const allTouched: Record<string, boolean> = {};
    requiredFields.forEach(key => { allTouched[key] = true; });
    // Include legacy fields if no dynamic fields
    if (fields.length === 0) {
      allTouched.name = true;
      allTouched.email = true;
      allTouched.phone = true;
    }
    setTouched(allTouched);

    let isValid = true;
    // Validate all required fields
    requiredFields.forEach(key => {
      const fieldValid = validateField(key, details[key]);
      if (!fieldValid) isValid = false;
    });
    // Legacy validation if no dynamic fields
    if (fields.length === 0) {
      if (!validateField('name', details.name)) isValid = false;
      if (!validateField('email', details.email)) isValid = false;
      if (!validateField('phone', details.phone)) isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async () => {
    if (!validateAll()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit();
    } catch (error) {
      console.error('Submission error:', error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          {isInviteMode ? 'Confirm your details' : 'Almost done!'}
        </h2>
        <p className="mt-2 text-slate-600">
          {isInviteMode
            ? `We have your details on file. Please confirm they're still correct.`
            : `Our joiner will review your details and send you an accurate quote. No obligation.`}
        </p>
      </div>

      {/* Form */}
      <div className="space-y-4">
        {isLoadingFields && (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
          </div>
        )}

        {fields.length > 0 && !isLoadingFields && (
          <div className="space-y-4">
            {fields.map(field => (
              <div key={field.id}>
                <UnifiedFieldRenderer
                  field={{
                    key: field.key,
                    label: field.label,
                    type: field.type.toLowerCase(),
                    required: field.required,
                    options: field.options,
                    placeholder: field.placeholder,
                    helpText: field.helpText,
                    readOnly: isInviteMode && !!contactDetails[field.key],
                  }}
                  value={details[field.key]}
                  onChange={(value) => handleUpdate(field.key, value)}
                />
                {errors[field.key] && touched[field.key] && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    {errors[field.key]}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {fields.length === 0 && !isLoadingFields && (
          <>
            {/* Fallback to hardcoded fields */}
            {/* Name */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            <User className="mb-1 inline h-4 w-4" /> Full name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={details.name || ''}
            onChange={e => handleUpdate('name', e.target.value)}
            onBlur={() => handleBlur('name')}
            placeholder="e.g., John Smith"
            disabled={isInviteMode && !!contactDetails.name}
            className={`w-full rounded-2xl border-2 px-4 py-3 transition focus:outline-none ${
              errors.name && touched.name
                ? 'border-red-300 focus:border-red-400'
                : 'border-slate-200 focus:border-slate-400'
            } ${isInviteMode && contactDetails.name ? 'bg-slate-50 text-slate-700' : ''}`}
          />
          {errors.name && touched.name && (
            <p className="mt-1 flex items-center gap-1 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {errors.name}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            <Mail className="mb-1 inline h-4 w-4" /> Email address <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            value={details.email || ''}
            onChange={e => handleUpdate('email', e.target.value)}
            onBlur={() => handleBlur('email')}
            placeholder="e.g., john@example.com"
            disabled={isInviteMode && !!contactDetails.email}
            className={`w-full rounded-2xl border-2 px-4 py-3 transition focus:outline-none ${
              errors.email && touched.email
                ? 'border-red-300 focus:border-red-400'
                : 'border-slate-200 focus:border-slate-400'
            } ${isInviteMode && contactDetails.email ? 'bg-slate-50 text-slate-700' : ''}`}
          />
          {errors.email && touched.email && (
            <p className="mt-1 flex items-center gap-1 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {errors.email}
            </p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            <Phone className="mb-1 inline h-4 w-4" /> Phone number <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={details.phone || ''}
            onChange={e => handleUpdate('phone', e.target.value)}
            onBlur={() => handleBlur('phone')}
            placeholder="e.g., 07123 456789"
            disabled={isInviteMode && !!contactDetails.phone}
            className={`w-full rounded-2xl border-2 px-4 py-3 transition focus:outline-none ${
              errors.phone && touched.phone
                ? 'border-red-300 focus:border-red-400'
                : 'border-slate-200 focus:border-slate-400'
            } ${isInviteMode && contactDetails.phone ? 'bg-slate-50 text-slate-700' : ''}`}
          />
          {errors.phone && touched.phone && (
            <p className="mt-1 flex items-center gap-1 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {errors.phone}
            </p>
          )}
        </div>

        {/* Preferred contact method */}
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            How would you prefer us to contact you?
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PREFERRED_CONTACT_OPTIONS.map(option => {
              const Icon = option.icon;
              const isSelected = details.preferredContact === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => handleUpdate('preferredContact', option.value)}
                  className={`rounded-2xl border-2 p-3 transition ${
                    isSelected
                      ? 'border-current bg-opacity-5'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  style={
                    isSelected
                      ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` }
                      : {}
                  }
                >
                  <Icon
                    className="mx-auto h-5 w-5 mb-1"
                    style={isSelected ? { color: primaryColor } : {}}
                  />
                  <div className="text-sm font-medium text-slate-900">{option.label}</div>
                </button>
              );
            })}
          </div>
        </div>
          </>
        )}
      </div>

      {/* Privacy notice */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex gap-3">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: primaryColor }} />
          <div className="text-sm text-slate-600">
            <p className="font-medium text-slate-900">Your privacy matters</p>
            <p className="mt-1">
              We'll only use your details to send your estimate and arrange a consultation. 
              We never share your information with third parties.
            </p>
          </div>
        </div>
      </div>

      {/* Benefits recap */}
      <div className="rounded-2xl border-2 p-6" style={{ borderColor: `${primaryColor}30`, backgroundColor: `${primaryColor}05` }}>
        <h4 className="font-semibold text-slate-900 mb-3">What happens next:</h4>
        <ul className="space-y-2 text-sm text-slate-600">
          <li className="flex gap-2">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" style={{ color: primaryColor }} />
            <span>Our joiner reviews your details and creates your quote</span>
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" style={{ color: primaryColor }} />
            <span>You receive an accurate, detailed quote via email</span>
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" style={{ color: primaryColor }} />
            <span>Free site survey to confirm final measurements</span>
          </li>
          <li className="flex gap-2">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" style={{ color: primaryColor }} />
            <span>No obligation - compare quotes at your leisure</span>
          </li>
        </ul>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <Button
          onClick={onBack}
          variant="outline"
          className="flex-1 rounded-2xl border-2 py-6 text-base"
          disabled={isSubmitting}
        >
          Back
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="flex-1 rounded-2xl py-6 text-base text-white"
          style={{ backgroundColor: primaryColor }}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Submitting...
            </span>
          ) : (
            'Submit for review'
          )}
        </Button>
      </div>
    </div>
  );
}
