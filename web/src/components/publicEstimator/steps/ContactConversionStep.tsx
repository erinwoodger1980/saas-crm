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
        <h2 className="text-3xl font-bold text-slate-900">
          {isInviteMode ? 'Confirm your details' : 'You\'re almost there!'}
        </h2>
        <p className="mt-3 text-base text-slate-600 leading-relaxed">
          {isInviteMode
            ? `We have your details on file. Please confirm they're still correct.`
            : `Just a few quick details so ${companyName} can send you a personalized quote. We'll never spam you or share your information with anyone else.`}
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
      <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-4">
        <div className="flex gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500 text-white flex-shrink-0">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="text-sm text-slate-700">
            <p className="font-semibold text-slate-900 text-base">Your privacy is 100% protected</p>
            <p className="mt-1 leading-relaxed">
              We'll only contact you about your quote. Your details are encrypted and secure. 
              We never sell or share your information with anyone. Promise.
            </p>
          </div>
        </div>
      </div>

      {/* Benefits recap */}
      <div className="rounded-2xl border-2 p-6" style={{ borderColor: `${primaryColor}30`, backgroundColor: `${primaryColor}05` }}>
        <h3 className="text-lg font-bold text-slate-900 mb-4">What happens next:</h3>
        <ul className="space-y-3 text-base text-slate-700">
          <li className="flex gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0 text-white font-bold text-sm" style={{ backgroundColor: primaryColor }}>1</div>
            <span><strong>Within 24 hours:</strong> {companyName}'s expert team reviews your photos and creates a detailed quote</span>
          </li>
          <li className="flex gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0 text-white font-bold text-sm" style={{ backgroundColor: primaryColor }}>2</div>
            <span><strong>You'll receive:</strong> A personalized estimate via email with all the details and options</span>
          </li>
          <li className="flex gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0 text-white font-bold text-sm" style={{ backgroundColor: primaryColor }}>3</div>
            <span><strong>Optional:</strong> Free site visit to confirm measurements and answer any questions</span>
          </li>
          <li className="flex gap-3">
            <div className="flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0 text-white font-bold text-sm" style={{ backgroundColor: primaryColor }}>4</div>
            <span><strong>Your choice:</strong> Take your time to compare – absolutely no pressure to proceed</span>
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
          className="flex-1 rounded-2xl py-7 text-lg font-bold text-white shadow-lg hover:shadow-xl transition-shadow"
          style={{ backgroundColor: primaryColor }}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Sending your request...
            </span>
          ) : (
            '✓ Request my free estimate'
          )}
        </Button>
      </div>
    </div>
  );
}
