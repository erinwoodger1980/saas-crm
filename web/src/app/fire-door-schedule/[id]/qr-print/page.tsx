"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface LineItem {
  id: string;
  doorRef: string | null;
  lajRef: string | null;
  rating: string | null;
  doorsetType: string | null;
}

export default function FireDoorQRPrintPage() {
  const params = useParams();
  const projectId = params?.id as string;
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrData, setQrData] = useState<Record<string, string>>({});

  useEffect(() => {
    if (projectId) {
      loadLineItems();
    }
  }, [projectId]);

  async function loadLineItems() {
    setLoading(true);
    try {
      // Load fire door schedule line items for this project
      const data = await apiFetch<{ ok: boolean; lineItems: LineItem[] }>(
        `/fire-door-schedule/${projectId}/line-items`
      );
      if (data.ok) {
        setLineItems(data.lineItems);
        // Generate QR data for all items (universal QR - user selects process after scanning)
        generateQRData(data.lineItems);
      }
    } catch (e: any) {
      console.error("Failed to load line items:", e);
    } finally {
      setLoading(false);
    }
  }

  function generateQRData(items: LineItem[]) {
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://www.joineryai.app";
    const qrMap: Record<string, string> = {};
    items.forEach((item) => {
      // Single QR code per line item - user selects process after scanning
      qrMap[item.id] = `${baseUrl}/fire-door-qr/${item.id}`;
    });
    setQrData(qrMap);
  }

  useEffect(() => {
    if (lineItems.length > 0) {
      generateQRData(lineItems);
    }
  }, [lineItems]);

  function printLabel(lineItemId: string) {
    const lineItem = lineItems.find((li) => li.id === lineItemId);
    if (!lineItem) return;

    const qrUrl = qrData[lineItemId];
    if (!qrUrl) {
      alert('QR data not ready. Please wait a moment and try again.');
      return;
    }

    // Create a print window with just this label
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert('Pop-up blocked. Please allow pop-ups for this site.');
      return;
    }

    const labelHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Label - ${lineItem.doorRef || lineItem.lajRef || lineItem.id}</title>
          <style>
            @page {
              size: 2.25in 1.25in;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 1.25in;
              width: 2.25in;
            }
            .label {
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 8px;
              width: 100%;
              height: 100%;
              box-sizing: border-box;
            }
            .qr-container {
              flex-shrink: 0;
            }
            .info {
              flex: 1;
              display: flex;
              flex-direction: column;
              gap: 2px;
              font-size: 9px;
              overflow: hidden;
            }
            .door-ref {
              font-size: 11px;
              font-weight: bold;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .process {
              font-size: 10px;
              font-weight: 600;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .detail {
              font-size: 8px;
              color: #666;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          </style>
        </head>
        <body>
          <div class="label">
            <div class="qr-container">
              <canvas id="qr-code"></canvas>
            </div>
            <div class="info">
              <div class="door-ref">${lineItem.doorRef || lineItem.lajRef || "Door"}</div>
              <div class="process">Workshop QR</div>
              ${lineItem.rating ? `<div class="detail">Rating: ${lineItem.rating}</div>` : ""}
              ${lineItem.doorsetType ? `<div class="detail">${lineItem.doorsetType}</div>` : ""}
            </div>
          </div>
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
          <script>
            console.log('Print page loaded');
            console.log('QR URL:', '${qrUrl}');
            
            function generateQR() {
              if (typeof QRCode === 'undefined') {
                console.error('QRCode library not loaded');
                document.body.innerHTML = '<div style="padding: 20px; font-family: Arial;">Error: QR Code library failed to load. Please check your internet connection and try again.</div>';
                return;
              }
              
              var canvas = document.getElementById('qr-code');
              if (!canvas) {
                console.error('Canvas element not found');
                return;
              }
              
              QRCode.toCanvas(canvas, '${qrUrl}', {
                width: 80,
                margin: 1,
                errorCorrectionLevel: 'M'
              }, function(error) {
                if (error) {
                  console.error('QR Code generation error:', error);
                  document.body.innerHTML = '<div style="padding: 20px; font-family: Arial;">Error generating QR code: ' + error + '</div>';
                } else {
                  console.log('QR code generated successfully');
                  setTimeout(function() { 
                    window.print(); 
                    setTimeout(function() { window.close(); }, 100);
                  }, 500);
                }
              });
            }
            
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', generateQR);
            } else {
              generateQR();
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(labelHtml);
    printWindow.document.close();
  }

  if (loading) {
    return (
      <div className="p-8">
        <div>Loading line items...</div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Print QR Labels</h1>
        <div className="text-sm text-muted-foreground">
          One QR code per door - user selects process after scanning
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lineItems.map((lineItem) => (
          <div
            key={lineItem.id}
            className="border rounded-lg p-4 space-y-3 hover:shadow-md transition-shadow"
          >
            <div className="flex justify-center">
              <QRCode value={qrData[lineItem.id] || ""} size={120} />
            </div>
            <div className="space-y-1">
              <div className="font-semibold text-center">
                {lineItem.doorRef || lineItem.lajRef || "Door"}
              </div>
              <div className="text-sm text-center text-muted-foreground">
                Workshop QR
              </div>
              {lineItem.rating && (
                <div className="text-xs text-center text-muted-foreground">
                  Rating: {lineItem.rating}
                </div>
              )}
            </div>
            <Button
              onClick={() => printLabel(lineItem.id)}
              className="w-full"
              size="sm"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Label
            </Button>
          </div>
        ))}
      </div>

      {lineItems.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
          No line items found for this project
        </div>
      )}
    </div>
  );
}
