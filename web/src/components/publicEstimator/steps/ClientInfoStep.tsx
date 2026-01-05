'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { ClientInfo } from '../PublicEstimatorWizard';

interface ClientInfoStepProps {
  initialData: ClientInfo;
  onNext: (data: ClientInfo) => void;
}

export default function ClientInfoStep({ initialData, onNext }: ClientInfoStepProps) {
  const [data, setData] = useState<ClientInfo>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!data.name.trim()) newErrors.name = 'Name is required';
    if (!data.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
      newErrors.email = 'Invalid email format';

    if (!data.phone.trim()) newErrors.phone = 'Phone is required';
    else if (!/^[\d+\s\-()]{10,}$/.test(data.phone.replace(/\s/g, '')))
      newErrors.phone = 'Invalid phone format';

    if (!data.address.trim()) newErrors.address = 'Address is required';
    if (!data.city.trim()) newErrors.city = 'City is required';
    if (!data.postcode.trim()) newErrors.postcode = 'Postcode is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: keyof ClientInfo, value: string) => {
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
        Let's start with your contact information. We'll use this to send your estimate and keep you updated.
      </p>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <Label htmlFor="name" className="font-semibold mb-2 block">
            Full Name *
          </Label>
          <Input
            id="name"
            value={data.name}
            onChange={e => handleChange('name', e.target.value)}
            placeholder="John Smith"
            className={errors.name ? 'border-red-500' : ''}
          />
          {errors.name && (
            <p className="text-red-600 text-sm mt-1">{errors.name}</p>
          )}
        </div>

        {/* Email */}
        <div>
          <Label htmlFor="email" className="font-semibold mb-2 block">
            Email Address *
          </Label>
          <Input
            id="email"
            type="email"
            value={data.email}
            onChange={e => handleChange('email', e.target.value)}
            placeholder="john@example.com"
            className={errors.email ? 'border-red-500' : ''}
          />
          {errors.email && (
            <p className="text-red-600 text-sm mt-1">{errors.email}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <Label htmlFor="phone" className="font-semibold mb-2 block">
            Phone Number *
          </Label>
          <Input
            id="phone"
            value={data.phone}
            onChange={e => handleChange('phone', e.target.value)}
            placeholder="+44 1234 567890"
            className={errors.phone ? 'border-red-500' : ''}
          />
          {errors.phone && (
            <p className="text-red-600 text-sm mt-1">{errors.phone}</p>
          )}
        </div>

        {/* Company */}
        <div>
          <Label htmlFor="company" className="font-semibold mb-2 block">
            Company (Optional)
          </Label>
          <Input
            id="company"
            value={data.company || ''}
            onChange={e => handleChange('company', e.target.value)}
            placeholder="Your company name"
          />
        </div>

        {/* Address */}
        <div>
          <Label htmlFor="address" className="font-semibold mb-2 block">
            Address *
          </Label>
          <Input
            id="address"
            value={data.address}
            onChange={e => handleChange('address', e.target.value)}
            placeholder="123 High Street"
            className={errors.address ? 'border-red-500' : ''}
          />
          {errors.address && (
            <p className="text-red-600 text-sm mt-1">{errors.address}</p>
          )}
        </div>

        {/* City */}
        <div>
          <Label htmlFor="city" className="font-semibold mb-2 block">
            City/Town *
          </Label>
          <Input
            id="city"
            value={data.city}
            onChange={e => handleChange('city', e.target.value)}
            placeholder="London"
            className={errors.city ? 'border-red-500' : ''}
          />
          {errors.city && (
            <p className="text-red-600 text-sm mt-1">{errors.city}</p>
          )}
        </div>

        {/* Postcode */}
        <div>
          <Label htmlFor="postcode" className="font-semibold mb-2 block">
            Postcode *
          </Label>
          <Input
            id="postcode"
            value={data.postcode}
            onChange={e => handleChange('postcode', e.target.value)}
            placeholder="SW1A 1AA"
            className={errors.postcode ? 'border-red-500' : ''}
          />
          {errors.postcode && (
            <p className="text-red-600 text-sm mt-1">{errors.postcode}</p>
          )}
        </div>
      </div>

      {/* CTA Button */}
      <div className="flex justify-end pt-4">
        <Button onClick={handleSubmit} size="lg" className="bg-blue-600 hover:bg-blue-700">
          Continue to Project Details
        </Button>
      </div>
    </div>
  );
}
