'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface Task {
  id: number;
  title: string;
  description?: string;
  createdAt: string;
}

export function useTaskNotifications(userId: number | null) {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const lastCheckRef = useRef<Date>(new Date());
  const knownTaskIdsRef = useRef<Set<number>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return;
    }

    // Create audio element for notification sound
    audioRef.current = new Audio('/notification.mp3');
    audioRef.current.volume = 0.5;

    setPermission(Notification.permission);
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) return;
    
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  };

  const checkForNewTasks = async () => {
    if (!userId || permission !== 'granted') return;

    try {
      const response: any = await apiFetch('/tasks/workshop', {
        method: 'GET',
      });

      if (response.ok && response.data) {
        const tasks: Task[] = response.data;
        const newTasks = tasks.filter(task => {
          const taskDate = new Date(task.createdAt);
          const isNew = taskDate > lastCheckRef.current && !knownTaskIdsRef.current.has(task.id);
          if (isNew) {
            knownTaskIdsRef.current.add(task.id);
          }
          return isNew;
        });

        // Show notification for each new task
        for (const task of newTasks) {
          showNotification(task);
        }

        lastCheckRef.current = new Date();
      }
    } catch (error) {
      console.error('Error checking for new tasks:', error);
    }
  };

  const showNotification = (task: Task) => {
    if (permission !== 'granted') return;

    const notification = new Notification('New Task Assigned', {
      body: task.title,
      icon: '/logo.png',
      badge: '/logo.png',
      tag: `task-${task.id}`,
      requireInteraction: false,
      silent: false,
    });

    // Vibrate if supported (primarily mobile devices)
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]); // Vibrate pattern: 200ms on, 100ms off, 200ms on
    }

    // Play notification sound
    if (audioRef.current) {
      audioRef.current.play().catch(err => {
        console.log('Could not play notification sound:', err);
      });
    }

    notification.onclick = () => {
      window.focus();
      notification.close();
      // Navigate to tasks page
      window.location.href = '/workshop';
    };

    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);
  };

  // Poll for new tasks every 30 seconds
  useEffect(() => {
    if (!userId || permission !== 'granted') return;

    const interval = setInterval(checkForNewTasks, 30000);
    
    // Initial check
    checkForNewTasks();

    return () => clearInterval(interval);
  }, [userId, permission]);

  return {
    permission,
    requestPermission,
    isEnabled: permission === 'granted',
  };
}
