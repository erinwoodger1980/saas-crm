import { ReactNode } from 'react';
import { Sidebar } from '@/components/admin/Sidebar';

export const metadata = {
  title: 'Admin Dashboard | Joinery AI',
  description: 'Manage landing pages, tenants, and SEO settings'
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
