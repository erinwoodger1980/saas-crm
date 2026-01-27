'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  FileText, 
  BarChart3, 
  Settings,
  Image as ImageIcon,
  Search,
  Wrench,
  ShieldCheck
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/admin/tenants', icon: FileText, label: 'Landing Pages' },
    { href: '/admin/joinery-network', icon: ShieldCheck, label: 'Joinery Network' },
    { href: '/admin/dev-console', icon: Wrench, label: 'Developer Console' },
    { href: '/admin/features/review', icon: FileText, label: 'Feature Review' },
    { href: '/admin/seo-keywords', icon: Search, label: 'SEO & Keywords' },
    { href: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
    { href: '/admin/media', icon: ImageIcon, label: 'Media Library' },
    { href: '/admin/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <aside className="w-64 bg-white border-r border-gray-200">
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-900">Joinery AI</h1>
        <p className="text-sm text-gray-500">Admin Dashboard</p>
      </div>
      
      <nav className="space-y-1 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${
                isActive
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-sm">
            E
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Admin</p>
            <p className="text-xs text-gray-500">admin@joineryai.app</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
