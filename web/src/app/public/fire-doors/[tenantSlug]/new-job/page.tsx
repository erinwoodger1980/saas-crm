"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, Trash2, CheckCircle2 } from "lucide-react";

interface DoorItem {
  id: string;
  sequence?: number;
  doorRef?: string;
  location?: string;
  quantity?: number;
  type?: string;
  coreType?: string;
  fireRating?: string;
  acousticRating?: string;
  configuration?: string;
  masterLeafWidth?: string;
  soH?: string;
  soW?: string;
  ofH?: string;
  ofW?: string;
  wallThickness?: string;
  frameMaterial?: string;
  frameFinish?: string;
  frameType?: string;
  doorFacing?: string;
  doorFinish?: string;
  doorColour?: string;
  doorLipping?: string;
  doorAction?: string;
  hingeType?: string;
  hingeConfiguration?: string;
  hingeHanding?: string;
  lock1Height?: string;
  lock2Height?: string;
  comments?: string;
}

export default function NewFireDoorJobPage() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tenantName, setTenantName] = useState<string>("");
  const [jobReference, setJobReference] = useState<string>("");

  // Client info
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [primaryContact, setPrimaryContact] = useState("");

  // Job details
  const [jobName, setJobName] = useState("");
  const [projectReference, setProjectReference] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [quoteReference, setQuoteReference] = useState("");
  const [dateRequired, setDateRequired] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");

  // Door items
  const [doorItems, setDoorItems] = useState<DoorItem[]>([
    { id: crypto.randomUUID(), sequence: 1 }
  ]);

  // Validate tenant on mount
  useEffect(() => {
    async function validateTenant() {
      try {
        const res = await fetch(`/api/public/fire-doors/${tenantSlug}/validate`);
        const data = await res.json();

        if (!data.valid) {
          setError(data.error === "feature_not_enabled" 
            ? "Fire door portal is not enabled for this company"
            : "Company not found");
          setLoading(false);
          return;
        }

        setTenantName(data.tenantName);
        setLoading(false);
      } catch (err) {
        setError("Failed to validate company. Please try again.");
        setLoading(false);
      }
    }

    validateTenant();
  }, [tenantSlug]);

  const addDoorItem = () => {
    setDoorItems([
      ...doorItems,
      { id: crypto.randomUUID(), sequence: doorItems.length + 1 }
    ]);
  };

  const removeDoorItem = (id: string) => {
    if (doorItems.length === 1) return; // Keep at least one item
    setDoorItems(doorItems.filter(item => item.id !== id));
  };

  const updateDoorItem = (id: string, field: keyof DoorItem, value: any) => {
    setDoorItems(doorItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Validate required fields
      if (!companyName || !email || !jobName) {
        setError("Please fill in all required fields (Company Name, Email, Job Name)");
        setSubmitting(false);
        return;
      }

      if (doorItems.length === 0) {
        setError("Please add at least one door item");
        setSubmitting(false);
        return;
      }

      const payload = {
        clientInfo: {
          companyName,
          email,
          phone: phone || undefined,
          address: address || undefined,
          city: city || undefined,
          postcode: postcode || undefined,
          primaryContact: primaryContact || undefined,
        },
        jobDetails: {
          jobName,
          projectReference: projectReference || undefined,
          siteAddress: siteAddress || undefined,
          deliveryAddress: deliveryAddress || undefined,
          contactName: contactName || undefined,
          contactPhone: contactPhone || undefined,
          contactEmail: contactEmail || undefined,
          poNumber: poNumber || undefined,
          quoteReference: quoteReference || undefined,
          dateRequired: dateRequired || undefined,
          specialInstructions: specialInstructions || undefined,
        },
        doorItems: doorItems.map((item, index) => ({
          ...item,
          sequence: index + 1,
          quantity: item.quantity ? parseInt(String(item.quantity)) : undefined,
        })),
      };

      const res = await fetch(`/api/public/fire-doors/${tenantSlug}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to submit order");
        setSubmitting(false);
        return;
      }

      setJobReference(data.jobReference);
      setSuccess(true);
    } catch (err) {
      setError("Failed to submit order. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !tenantName) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-center">Order Submitted Successfully!</CardTitle>
            <CardDescription className="text-center">
              Your fire door order has been received.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">Job Reference</p>
              <p className="text-2xl font-bold text-gray-900">{jobReference}</p>
            </div>
            <p className="text-sm text-gray-600 text-center">
              You will receive a confirmation email shortly with pricing and delivery information.
            </p>
            <Button 
              className="w-full" 
              onClick={() => router.push(`/public/fire-doors/${tenantSlug}/new-job`)}
            >
              Submit Another Order
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <Card>
          <CardHeader>
            <CardTitle>New Fire Door Order - {tenantName}</CardTitle>
            <CardDescription>
              Submit your fire door specifications. All fields marked with * are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Client Information */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Company Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="companyName">Company Name *</Label>
                    <Input
                      id="companyName"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="primaryContact">Primary Contact</Label>
                    <Input
                      id="primaryContact"
                      value={primaryContact}
                      onChange={(e) => setPrimaryContact(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="postcode">Postcode</Label>
                    <Input
                      id="postcode"
                      value={postcode}
                      onChange={(e) => setPostcode(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Job Details */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Job Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="jobName">Job Name *</Label>
                    <Input
                      id="jobName"
                      value={jobName}
                      onChange={(e) => setJobName(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="projectReference">Project Reference</Label>
                    <Input
                      id="projectReference"
                      value={projectReference}
                      onChange={(e) => setProjectReference(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="poNumber">PO Number</Label>
                    <Input
                      id="poNumber"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="quoteReference">Quote Reference</Label>
                    <Input
                      id="quoteReference"
                      value={quoteReference}
                      onChange={(e) => setQuoteReference(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dateRequired">Date Required</Label>
                    <Input
                      id="dateRequired"
                      type="date"
                      value={dateRequired}
                      onChange={(e) => setDateRequired(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactName">Site Contact Name</Label>
                    <Input
                      id="contactName"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactPhone">Site Contact Phone</Label>
                    <Input
                      id="contactPhone"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactEmail">Site Contact Email</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="siteAddress">Site Address</Label>
                    <Textarea
                      id="siteAddress"
                      value={siteAddress}
                      onChange={(e) => setSiteAddress(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="deliveryAddress">Delivery Address (if different)</Label>
                    <Textarea
                      id="deliveryAddress"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="specialInstructions">Special Instructions</Label>
                    <Textarea
                      id="specialInstructions"
                      value={specialInstructions}
                      onChange={(e) => setSpecialInstructions(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              {/* Door Schedule */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Door Schedule</h3>
                  <Button type="button" onClick={addDoorItem} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Door
                  </Button>
                </div>

                <div className="space-y-4">
                  {doorItems.map((item, index) => (
                    <Card key={item.id} className="p-4">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-medium">Door {index + 1}</h4>
                        {doorItems.length > 1 && (
                          <Button
                            type="button"
                            onClick={() => removeDoorItem(item.id)}
                            variant="ghost"
                            size="sm"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label>Door Ref</Label>
                          <Input
                            value={item.doorRef || ""}
                            onChange={(e) => updateDoorItem(item.id, "doorRef", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Location</Label>
                          <Input
                            value={item.location || ""}
                            onChange={(e) => updateDoorItem(item.id, "location", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            value={item.quantity || ""}
                            onChange={(e) => updateDoorItem(item.id, "quantity", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Type</Label>
                          <Input
                            value={item.type || ""}
                            onChange={(e) => updateDoorItem(item.id, "type", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Core Type</Label>
                          <Input
                            value={item.coreType || ""}
                            onChange={(e) => updateDoorItem(item.id, "coreType", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Fire Rating</Label>
                          <Input
                            value={item.fireRating || ""}
                            onChange={(e) => updateDoorItem(item.id, "fireRating", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Configuration</Label>
                          <Input
                            value={item.configuration || ""}
                            onChange={(e) => updateDoorItem(item.id, "configuration", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Door Facing</Label>
                          <Input
                            value={item.doorFacing || ""}
                            onChange={(e) => updateDoorItem(item.id, "doorFacing", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Door Finish</Label>
                          <Input
                            value={item.doorFinish || ""}
                            onChange={(e) => updateDoorItem(item.id, "doorFinish", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Door Colour</Label>
                          <Input
                            value={item.doorColour || ""}
                            onChange={(e) => updateDoorItem(item.id, "doorColour", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Hinge Type</Label>
                          <Input
                            value={item.hingeType || ""}
                            onChange={(e) => updateDoorItem(item.id, "hingeType", e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Handing</Label>
                          <Input
                            value={item.hingeHanding || ""}
                            onChange={(e) => updateDoorItem(item.id, "hingeHanding", e.target.value)}
                          />
                        </div>
                        <div className="md:col-span-3">
                          <Label>Comments</Label>
                          <Textarea
                            value={item.comments || ""}
                            onChange={(e) => updateDoorItem(item.id, "comments", e.target.value)}
                            rows={2}
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-4">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Order"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
