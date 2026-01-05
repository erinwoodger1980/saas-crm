'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ProjectInfo } from '../PublicEstimatorWizard';

interface ProjectInfoStepProps {
  initialData: ProjectInfo;
  onNext: (data: ProjectInfo) => void;
  onBack: () => void;
}

export default function ProjectInfoStep({ initialData, onNext, onBack }: ProjectInfoStepProps) {
  const [data, setData] = useState<ProjectInfo>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!data.propertyType) newErrors.propertyType = 'Property type is required';
    if (!data.projectType) newErrors.projectType = 'Project type is required';
    if (!data.location.trim()) newErrors.location = 'Location is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: keyof ProjectInfo, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onNext(data);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-gray-600">
        Tell us about your project so we can provide an accurate estimate.
      </p>

      <div className="space-y-4">
        {/* Property Type */}
        <div>
          <Label htmlFor="propertyType" className="font-semibold mb-2 block">
            Property Type *
          </Label>
          <Select value={data.propertyType} onValueChange={v => handleChange('propertyType', v)}>
            <SelectTrigger id="propertyType" className={errors.propertyType ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select property type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="residential">Residential</SelectItem>
              <SelectItem value="commercial">Commercial</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          {errors.propertyType && (
            <p className="text-red-600 text-sm mt-1">{errors.propertyType}</p>
          )}
        </div>

        {/* Project Type */}
        <div>
          <Label htmlFor="projectType" className="font-semibold mb-2 block">
            What are you looking for? *
          </Label>
          <Select value={data.projectType} onValueChange={v => handleChange('projectType', v)}>
            <SelectTrigger id="projectType" className={errors.projectType ? 'border-red-500' : ''}>
              <SelectValue placeholder="Select project type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="doors">Doors Only</SelectItem>
              <SelectItem value="windows">Windows Only</SelectItem>
              <SelectItem value="both">Doors & Windows</SelectItem>
            </SelectContent>
          </Select>
          {errors.projectType && (
            <p className="text-red-600 text-sm mt-1">{errors.projectType}</p>
          )}
        </div>

        {/* Location */}
        <div>
          <Label htmlFor="location" className="font-semibold mb-2 block">
            Project Location *
          </Label>
          <Input
            id="location"
            value={data.location}
            onChange={e => handleChange('location', e.target.value)}
            placeholder="e.g., South East London, Kent"
            className={errors.location ? 'border-red-500' : ''}
          />
          {errors.location && (
            <p className="text-red-600 text-sm mt-1">{errors.location}</p>
          )}
        </div>

        {/* Project Description */}
        <div>
          <Label htmlFor="description" className="font-semibold mb-2 block">
            Project Description (Optional)
          </Label>
          <Textarea
            id="description"
            value={data.projectDescription || ''}
            onChange={e => handleChange('projectDescription', e.target.value)}
            placeholder="Tell us about your project. E.g., Victorian property, period features, specific style preferences..."
            rows={4}
          />
        </div>

        {/* Target Date */}
        <div>
          <Label htmlFor="targetDate" className="font-semibold mb-2 block">
            When do you need this? (Optional)
          </Label>
          <Input
            id="targetDate"
            type="date"
            value={data.targetDate || ''}
            onChange={e => handleChange('targetDate', e.target.value)}
          />
        </div>

        {/* Urgency */}
        <div>
          <Label htmlFor="urgency" className="font-semibold mb-2 block">
            Project Urgency (Optional)
          </Label>
          <Select value={data.urgency || ''} onValueChange={v => handleChange('urgency', v as any)}>
            <SelectTrigger id="urgency">
              <SelectValue placeholder="Select urgency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low - No rush</SelectItem>
              <SelectItem value="medium">Medium - Few months</SelectItem>
              <SelectItem value="high">High - Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between pt-4">
        <Button onClick={onBack} variant="outline" size="lg">
          Back
        </Button>
        <Button onClick={handleSubmit} size="lg" className="bg-blue-600 hover:bg-blue-700">
          Continue to Items
        </Button>
      </div>
    </div>
  );
}
