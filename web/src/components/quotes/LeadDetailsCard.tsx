import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, Mail, Phone, MapPin, Info } from "lucide-react";

type LeadDetailsCardProps = {
  lead?: any | null;
  questionnaireAnswers?: Record<string, any> | null;
};

export function LeadDetailsCard({ lead, questionnaireAnswers }: LeadDetailsCardProps) {
  if (!lead) return null;

  const files = Array.isArray(questionnaireAnswers?.items)
    ? questionnaireAnswers.items
        .flatMap((item: any) => {
          const fileKeys = Object.keys(item || {}).filter((key) => {
            const value = item[key];
            return (
              typeof value === "string" &&
              (value.startsWith("http") || value.includes("file") || value.includes(".pdf"))
            );
          });
          return fileKeys.map((key) => ({ key, url: item[key] }));
        })
        .filter((f: any) => f.url && f.url.trim())
    : [];

  const hasFiles = files.length > 0;
  const contactEmail = lead.email || lead.contactEmail || null;
  const contactPhone = lead.phone || lead.contactPhone || null;
  const location = lead.location || lead.address || null;
  const description = lead.description || lead.details || null;
  const capturedAt = lead.capturedAt || lead.createdAt;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">Project details</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Customer information and attachments
            </p>
          </div>
          {lead.status && (
            <Badge variant="outline" className="capitalize">
              {(lead.status || "").toLowerCase().replace(/_/g, " ")}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Contact Information */}
        <div className="space-y-2.5">
          {contactEmail && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${contactEmail}`} className="text-blue-600 hover:underline">
                {contactEmail}
              </a>
            </div>
          )}
          {contactPhone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a href={`tel:${contactPhone}`} className="text-foreground hover:text-blue-600">
                {contactPhone}
              </a>
            </div>
          )}
          {location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">{location}</span>
            </div>
          )}
          {capturedAt && (
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Enquiry received {new Date(capturedAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* Description */}
        {description && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Info className="h-4 w-4 text-muted-foreground" />
              Description
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed pl-6">
              {description}
            </p>
          </div>
        )}

        {/* Files from questionnaire */}
        {hasFiles && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Attached files ({files.length})
            </div>
            <div className="space-y-1.5 pl-6">
              {files.map((file: any, idx: number) => (
                <a
                  key={idx}
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {file.key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2")}
                </a>
              ))}
            </div>
          </div>
        )}

        {!contactEmail && !contactPhone && !location && !description && !hasFiles && (
          <p className="text-sm text-muted-foreground italic">
            No additional details available
          </p>
        )}
      </CardContent>
    </Card>
  );
}
