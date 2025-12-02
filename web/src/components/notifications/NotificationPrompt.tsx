'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface NotificationPromptProps {
  onEnable: () => Promise<NotificationPermission | undefined>;
  permission: NotificationPermission;
}

export function NotificationPrompt({ onEnable, permission }: NotificationPromptProps) {
  const [dismissed, setDismissed] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Check if user has already dismissed the prompt
    const hasDissmissed = localStorage.getItem('notification-prompt-dismissed');
    if (hasDissmissed) {
      setDismissed(true);
      return;
    }

    // Show prompt after 3 seconds if permission is default
    if (permission === 'default') {
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [permission]);

  const handleEnable = async () => {
    const result = await onEnable();
    if (result === 'granted') {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('notification-prompt-dismissed', 'true');
    setDismissed(true);
    setShowPrompt(false);
  };

  if (!showPrompt || dismissed || permission !== 'default') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-5">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Enable Task Notifications</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <CardDescription className="mb-4">
            Get notified with sound and vibration when new tasks are assigned to you. Stay on top of your work!
          </CardDescription>
          <div className="flex gap-2">
            <Button onClick={handleEnable} className="flex-1">
              <Bell className="mr-2 h-4 w-4" />
              Enable Notifications
            </Button>
            <Button variant="outline" onClick={handleDismiss}>
              Not Now
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function NotificationToggle({ 
  permission, 
  onEnable 
}: { 
  permission: NotificationPermission;
  onEnable: () => Promise<NotificationPermission | undefined>;
}) {
  const handleToggle = async () => {
    if (permission === 'default') {
      await onEnable();
    } else if (permission === 'denied') {
      alert('Notifications are blocked. Please enable them in your browser settings.');
    }
  };

  return (
    <Button
      variant={permission === 'granted' ? 'default' : 'outline'}
      size="sm"
      onClick={handleToggle}
      className="flex items-center gap-2"
    >
      {permission === 'granted' ? (
        <>
          <Bell className="h-4 w-4" />
          Notifications On
        </>
      ) : (
        <>
          <BellOff className="h-4 w-4" />
          Enable Notifications
        </>
      )}
    </Button>
  );
}
