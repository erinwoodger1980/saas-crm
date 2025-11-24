"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ExternalLink, Copy, CheckCircle2, Users, FileText, 
  TrendingUp, Shield, Clock, AlertCircle 
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface TenantSettings {
  slug?: string;
  brandName?: string;
  isFireDoorManufacturer?: boolean;
}

export default function FireDoorPortalPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const data = await apiFetch<TenantSettings>("/tenant/settings");
      setSettings(data);
    } catch (error) {
      console.error("Failed to load tenant settings:", error);
      toast({
        title: "Error",
        description: "Failed to load portal settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const portalUrl = typeof window !== 'undefined' && settings?.slug 
    ? `${window.location.origin}/public/fire-doors/${settings.slug}/new-job`
    : "";

  const copyToClipboard = () => {
    if (portalUrl) {
      navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Portal URL copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!settings?.isFireDoorManufacturer) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900">
              <AlertCircle className="h-5 w-5" />
              Feature Not Enabled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-orange-800">
              Fire door portal is not enabled for your account. Please contact support to enable this feature.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-50 py-8">
      <div className="container mx-auto px-6 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Fire Door Client Portal
          </h1>
          <p className="text-slate-600 text-lg">
            Share your custom quote request form with customers
          </p>
        </div>

        {/* Portal URL Card */}
        <Card className="mb-6 border-2 border-blue-200 bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5 text-blue-600" />
              Your Client Portal URL
            </CardTitle>
            <CardDescription>
              Share this link with your customers to submit fire door quotes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <div className="flex-1 p-4 bg-slate-50 rounded-lg border border-slate-200 font-mono text-sm break-all">
                {portalUrl || "Loading..."}
              </div>
              <Button
                onClick={copyToClipboard}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(portalUrl, '_blank')}
                disabled={!portalUrl}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Card className="bg-white/70 backdrop-blur border-slate-200">
            <CardHeader>
              <div className="p-3 w-fit rounded-xl bg-blue-100">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <CardTitle className="text-lg mt-4">Customer-Friendly Form</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm">
                Clean, professional form your customers can fill out with all door specifications and project details.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur border-slate-200">
            <CardHeader>
              <div className="p-3 w-fit rounded-xl bg-green-100">
                <FileText className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle className="text-lg mt-4">Detailed Specifications</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm">
                Captures all required information: fire ratings, dimensions, materials, finishes, ironmongery, and more.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur border-slate-200">
            <CardHeader>
              <div className="p-3 w-fit rounded-xl bg-purple-100">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <CardTitle className="text-lg mt-4">Auto-Import</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm">
                Submissions automatically appear in your system as leads and fire door projects, ready to process.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur border-slate-200">
            <CardHeader>
              <div className="p-3 w-fit rounded-xl bg-orange-100">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
              <CardTitle className="text-lg mt-4">Save Time</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm">
                No more back-and-forth emails. Customers submit everything upfront, reducing quote turnaround time.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur border-slate-200">
            <CardHeader>
              <div className="p-3 w-fit rounded-xl bg-red-100">
                <Shield className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-lg mt-4">Professional Branding</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm">
                Form displays your company name and branding, maintaining your professional image.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur border-slate-200">
            <CardHeader>
              <div className="p-3 w-fit rounded-xl bg-slate-100">
                <CheckCircle2 className="h-6 w-6 text-slate-600" />
              </div>
              <CardTitle className="text-lg mt-4">Validation Built-In</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 text-sm">
                Form validates required fields, ensuring you receive complete information every time.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* How to Use */}
        <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-2xl">How to Use the Client Portal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Share the Link</h3>
                <p className="text-slate-600 text-sm">
                  Copy the portal URL and share it via email, website, or marketing materials
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Customers Fill Out Form</h3>
                <p className="text-slate-600 text-sm">
                  They enter project details, door specifications, and contact information
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Receive & Process</h3>
                <p className="text-slate-600 text-sm">
                  Submission appears in your Leads and Fire Door Schedule, ready for review and quoting
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                4
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">Send Quote</h3>
                <p className="text-slate-600 text-sm">
                  Use the Fire Door Calculator to price the project and send a professional quote
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tips Section */}
        <Card className="mt-6 bg-white/70 backdrop-blur">
          <CardHeader>
            <CardTitle>💡 Tips for Best Results</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex gap-2">
                <span className="text-blue-600">•</span>
                <span>Add the portal link to your email signature</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600">•</span>
                <span>Feature it prominently on your website's "Get a Quote" page</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600">•</span>
                <span>Include it in follow-up emails when customers inquire about fire doors</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600">•</span>
                <span>Test the form yourself to see the customer experience</span>
              </li>
              <li className="flex gap-2">
                <span className="text-blue-600">•</span>
                <span>Check your Fire Door Schedule regularly for new submissions</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
