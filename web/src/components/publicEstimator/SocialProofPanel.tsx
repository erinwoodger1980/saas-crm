'use client';

import { Card } from '@/components/ui/card';
import { CheckCircle2, Award, Users, Clock } from 'lucide-react';

export function SocialProofPanel() {
  return (
    <div className="space-y-4">
      {/* Testimonial */}
      <Card className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
        <div className="flex items-start space-x-2">
          <div className="text-2xl">⭐⭐⭐⭐⭐</div>
        </div>
        <p className="text-sm text-gray-700 mt-3">
          "Excellent service and incredibly detailed estimates. Highly recommend!"
        </p>
        <p className="text-xs text-gray-600 mt-2 font-semibold">— Sarah Mitchell, London</p>
      </Card>

      {/* Quick Stats */}
      <Card className="p-4 border">
        <h3 className="font-semibold mb-4 text-gray-900">Why Choose Us</h3>
        
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm text-gray-900">Expert Analysis</p>
              <p className="text-xs text-gray-600">Detailed estimates from specialists</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Clock className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm text-gray-900">Quick Response</p>
              <p className="text-xs text-gray-600">24-hour turnaround typical</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Award className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm text-gray-900">Quality Assured</p>
              <p className="text-xs text-gray-600">Premium materials & craftsmanship</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Users className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm text-gray-900">Trusted Since 2010</p>
              <p className="text-xs text-gray-600">1000+ satisfied customers</p>
            </div>
          </div>
        </div>
      </Card>

      {/* FAQ */}
      <Card className="p-4 bg-slate-50 border">
        <h3 className="font-semibold mb-3 text-gray-900">Quick Help</h3>
        <div className="space-y-3 text-sm">
          <div>
            <p className="font-medium text-gray-800">How long does it take?</p>
            <p className="text-gray-600 text-xs mt-1">Usually 24 hours from submission</p>
          </div>
          <div>
            <p className="font-medium text-gray-800">Do you offer bespoke options?</p>
            <p className="text-gray-600 text-xs mt-1">Yes, complete customization available</p>
          </div>
          <div>
            <p className="font-medium text-gray-800">What areas do you serve?</p>
            <p className="text-gray-600 text-xs mt-1">UK-wide with local consultants</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
