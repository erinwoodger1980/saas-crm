"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { X, Camera } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface QRScannerModalProps {
  onClose: () => void;
  onScanSuccess: (url: string) => void;
}

export default function QRScannerModal({ onClose, onScanSuccess }: QRScannerModalProps) {
  const { toast } = useToast();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [jsQRLoaded, setJsQRLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Load jsQR library
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
    script.async = true;
    script.onload = () => {
      setJsQRLoaded(true);
    };
    document.body.appendChild(script);

    startCamera();
    return () => {
      stopCamera();
      document.body.removeChild(script);
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setHasPermission(true);

        // Wait for video to be ready before starting scan
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play().then(() => {
              // Start scanning for QR codes after video is playing
              scanIntervalRef.current = setInterval(() => {
                scanForQRCode();
              }, 500);
            }).catch((playErr) => {
              console.error("Error playing video:", playErr);
            });
          }
        };
      }
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      setError(err.message || "Failed to access camera");
      setHasPermission(false);
      toast({
        variant: "destructive",
        title: "Camera Error",
        description: "Unable to access camera. Please check permissions.",
      });
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const scanForQRCode = () => {
    if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== videoRef.current.HAVE_ENOUGH_DATA) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Try to detect QR code using browser's barcode detection API if available
    if ('BarcodeDetector' in window) {
      // @ts-ignore - BarcodeDetector is not in TypeScript types yet
      const barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
      barcodeDetector
        .detect(imageData)
        .then((barcodes: any[]) => {
          if (barcodes.length > 0) {
            const qrCode = barcodes[0].rawValue;
            handleQRCodeDetected(qrCode);
          }
        })
        .catch((err: any) => {
          console.error("Barcode detection error:", err);
        });
    } else {
      // Fallback: Use jsQR library
      try {
        // @ts-ignore - jsQR will be loaded dynamically
        if (typeof window.jsQR !== 'undefined') {
          // @ts-ignore
          const code = window.jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          if (code) {
            handleQRCodeDetected(code.data);
          }
        }
      } catch (err) {
        console.error("jsQR error:", err);
      }
    }
  };

  const handleQRCodeDetected = (qrData: string) => {
    // Stop scanning
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    toast({
      title: "QR Code Scanned",
      description: "Loading item details...",
    });

    // Check if it's a valid fire door QR URL
    if (qrData.includes('/fire-door-qr/')) {
      onScanSuccess(qrData);
    } else {
      toast({
        variant: "destructive",
        title: "Invalid QR Code",
        description: "This is not a valid fire door QR code.",
      });
      // Resume scanning after 2 seconds
      setTimeout(() => {
        if (videoRef.current && !scanIntervalRef.current) {
          scanIntervalRef.current = setInterval(() => {
            scanForQRCode();
          }, 500);
        }
      }, 2000);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <Card 
        className="relative w-full max-w-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Scan QR Code</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Camera View */}
        <div className="p-4">
          <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
            {hasPermission === null && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                <div className="text-center">
                  <Camera className="w-12 h-12 mx-auto mb-2 animate-pulse" />
                  <p>Requesting camera access...</p>
                </div>
              </div>
            )}

            {hasPermission === false && (
              <div className="absolute inset-0 flex items-center justify-center text-white p-6">
                <div className="text-center">
                  <Camera className="w-12 h-12 mx-auto mb-2 text-red-400" />
                  <p className="font-semibold mb-2">Camera Access Denied</p>
                  <p className="text-sm text-gray-300 mb-4">
                    Please enable camera permissions in your browser settings.
                  </p>
                  {error && (
                    <p className="text-xs text-red-400 mt-2">{error}</p>
                  )}
                </div>
              </div>
            )}

            {hasPermission && (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                
                {/* QR Code targeting frame */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-64 h-64 border-4 border-white/50 rounded-lg">
                    {/* Corner decorations */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 -translate-x-1 -translate-y-1" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 translate-x-1 -translate-y-1" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 -translate-x-1 translate-y-1" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 translate-x-1 translate-y-1" />
                  </div>
                </div>

                {/* Instructions */}
                <div className="absolute bottom-4 left-0 right-0 text-center">
                  <div className="inline-block bg-black/70 text-white px-4 py-2 rounded-full text-sm">
                    Position QR code within the frame
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Hidden canvas for QR detection */}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-gray-50 text-center text-sm text-gray-600">
          Point your camera at a fire door QR code sticker to scan
        </div>
      </Card>
    </div>
  );
}
