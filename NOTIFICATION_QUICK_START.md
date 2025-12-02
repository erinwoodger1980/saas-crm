# Task Notification System - Quick Start

## What You Get

When a new task is assigned to a user, they will receive:
1. **Browser notification** - Pops up even if the tab is in background
2. **Sound alert** - Pleasant notification tone
3. **Vibration** - On mobile devices (Android)

## How to Enable

### For Users
1. Visit the Workshop page (`/workshop`)
2. After 3 seconds, a prompt will appear in the bottom-right corner
3. Click **"Enable Notifications"**
4. Allow notifications in the browser dialog
5. Done! You'll now receive alerts for new tasks

### Quick Toggle
- Look for the notification bell icon in the top toolbar
- Click it to enable/check notification status
- Green = On, Gray = Off

## How It Works

- The system checks for new tasks **every 30 seconds**
- Only tasks assigned **after** you enable notifications will trigger alerts
- Clicking a notification takes you directly to the workshop page

## Browser Support

✅ **Chrome/Edge** (Desktop & Mobile) - Full support  
✅ **Firefox** (Desktop & Mobile) - Full support  
✅ **Safari** (Desktop) - Full support  
⚠️ **Safari iOS** - Works but requires tab to be open  

## Testing

1. Open workshop page as User A (enable notifications)
2. Open admin panel in another tab/window
3. Create a new task assigned to User A
4. Within 30 seconds, notification should appear on User A's screen

## Customization

### Change Check Frequency
Edit `/web/src/hooks/useTaskNotifications.ts` line 95:
```typescript
const interval = setInterval(checkForNewTasks, 30000); // Change 30000 to desired ms
```

### Change Notification Sound
Replace `/web/public/notification.mp3` with your own audio file

### Change Vibration Pattern
Edit `/web/src/hooks/useTaskNotifications.ts` line 79:
```typescript
navigator.vibrate([200, 100, 200]); // [vibrate_ms, pause_ms, vibrate_ms, ...]
```

## Troubleshooting

**Notifications not appearing?**
- Check browser settings: Notifications must be allowed for your site
- Ensure you're logged in
- Try closing and reopening the tab

**Sound not playing?**
- Some browsers block audio until user interacts with the page
- Click anywhere on the page first, then test

**Vibration not working?**
- Only Android devices support vibration
- iOS doesn't support the Vibration API

## Files Created

- `/web/src/hooks/useTaskNotifications.ts` - Main notification logic
- `/web/src/components/notifications/NotificationPrompt.tsx` - UI components
- `/web/public/notification.mp3` - Notification sound
- `/TASK_NOTIFICATION_SYSTEM.md` - Detailed documentation

## API Endpoint Used

- `GET /tasks/workshop?status=NOT_STARTED,IN_PROGRESS` - Fetches assigned tasks

## Future Enhancements

Consider adding:
- WebSocket for instant notifications (no polling)
- Service Worker for notifications when tab is closed
- Custom notification actions ("Mark as Done", "View Task")
- User preferences for notification types
