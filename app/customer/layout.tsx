"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut, Home, FileText, Briefcase, DoorOpen } from "lucide-react";

interface CustomerUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  clientAccount: {
    companyName: string;
  };
}

export default function CustomerPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("customerToken");
    if (!token) {
      router.push("/customer/login");
      return;
    }

    // Fetch user info
    fetch("/api/customer-auth/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Unauthorized");
        return res.json();
      })
      .then((data) => {
        setUser(data.user);
        setLoading(false);
      })
      .catch(() => {
        localStorage.removeItem("customerToken");
        router.push("/customer/login");
      });
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("customerToken");
    router.push("/customer/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const navItems = [
    { href: "/customer/dashboard", label: "Dashboard", icon: Home },
    { href: "/customer/quotes", label: "Quotes", icon: FileText },
    { href: "/customer/projects", label: "Projects", icon: Briefcase },
    { href: "/customer/fire-doors", label: "Fire Doors", icon: DoorOpen },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-gray-900">Customer Portal</h1>
              <nav className="hidden md:flex space-x-4">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <button
                      key={item.href}
                      onClick={() => router.push(item.href)}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium ${
                        isActive
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden md:block text-sm text-gray-600">
                <div className="font-medium">{user?.clientAccount.companyName}</div>
                <div className="text-xs">{user?.email}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
