'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, Star } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  serviceAreas?: string[];
  avgRating?: number;
  reviewCount?: number;
  distance?: number;
}

interface NearbyTenantsProps {
  currentTenant: {
    id: string;
    slug: string;
    serviceAreas?: string[];
  };
  location: string;
}

export function NearbyTenants({ currentTenant, location }: NearbyTenantsProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNearby() {
      try {
        // Fetch tenants in same service area
        const res = await fetch(
          `/api/landing-tenants/nearby?location=${encodeURIComponent(location)}&exclude=${currentTenant.id}&limit=3`
        );
        
        if (res.ok) {
          const data = await res.json();
          setTenants(data.tenants || []);
        }
      } catch (error) {
        console.error('Failed to fetch nearby tenants:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchNearby();
  }, [currentTenant.id, location]);

  if (loading || tenants.length === 0) {
    return null;
  }

  return (
    <section className="bg-gray-50 py-16">
      <div className="max-w-7xl mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-12">
          More Joiners Near {location}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tenants.map(tenant => (
            <Link
              key={tenant.id}
              href={`/${tenant.slug}/${location.toLowerCase().replace(/\s+/g, '-')}`}
              className="bg-white rounded-lg shadow-md hover:shadow-xl transition p-6 group"
            >
              <h3 className="text-xl font-semibold mb-2 group-hover:text-blue-600 transition">
                {tenant.name}
              </h3>
              
              <div className="flex items-center gap-2 text-gray-600 mb-3">
                <MapPin size={16} className="text-gray-400" />
                <span className="text-sm">
                  {tenant.serviceAreas?.slice(0, 2).join(', ')}
                </span>
              </div>
              
              {tenant.avgRating && tenant.reviewCount && (
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={16}
                        className={
                          i < Math.round(tenant.avgRating!)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }
                      />
                    ))}
                  </div>
                  <span className="text-sm text-gray-600">
                    {tenant.avgRating.toFixed(1)} ({tenant.reviewCount} reviews)
                  </span>
                </div>
              )}
              
              <p className="text-blue-600 text-sm font-medium group-hover:underline">
                View Profile →
              </p>
            </Link>
          ))}
        </div>
        
        {/* Internal linking boost */}
        <div className="mt-12 text-center">
          <p className="text-gray-600 mb-4">
            Looking for joinery services in {location}? Browse our network of trusted professionals.
          </p>
          <Link
            href={`/search?location=${encodeURIComponent(location)}`}
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            View All Joiners in {location}
          </Link>
        </div>
      </div>
    </section>
  );
}
