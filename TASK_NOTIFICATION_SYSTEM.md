# Task Notification System

## Overview
The task notification system provides real-time alerts to users when new tasks are assigned to them. Notifications include:
- **Browser push notifications** - Visible even when the tab is in the background
- **Sound alerts** - A pleasant notification tone
- **Vibration** - For mobile devices (if supported by the browser)

## How It Works

### Architecture
1. **Hook: `useTaskNotifications`** (`/web/src/hooks/useTaskNotifications.ts`)
   - Polls the `/tasks/workshop` API endpoint every 30 seconds
   - Tracks which task IDs have already been seen
   - Triggers notifications for new tasks created after the hook initializes
   - Manages notification permission state

2. **Components: `NotificationPrompt` & `NotificationToggle`** (`/web/src/components/notifications/NotificationPrompt.tsx`)
   - `NotificationPrompt`: Auto-appears 3 seconds after page load (if permission not granted)
   - `NotificationToggle`: Button in the header to enable/check notification status
   - Both handle permission requests and display current state

3. **Sound File:** `/web/public/notification.mp3`
   - Pleasant notification tone played when new tasks arrive
   - Falls back gracefully if audio cannot be played

### User Experience

#### First-Time Setup
1. User visits the workshop page
2. After 3 seconds, a prompt appears in the bottom-right corner
3. User clicks "Enable Notifications" button
4. Browser shows native permission dialog
5. If granted, notifications are active immediately

#### When New Tasks Arrive
1. Every 30 seconds, the system checks for new tasks
2. For each new task assigned to the user:
   - Shows a browser notification with the task title
   - Plays the notification sound
   - Vibrates the device (mobile only)
3. Clicking the notification brings the user to the workshop page

#### Notification States
- **Default (not asked)**: Shows prompt after 3 seconds, button says "Enable Notifications"
- **Granted**: Button shows "Notifications On" with bell icon
- **Denied**: Button shows "Enable Notifications" with bell-off icon, clicking explains how to enable in browser settings

### Browser Support

#### Desktop
- ✅ Chrome/Edge: Full support (notifications, sound)
- ✅ Firefox: Full support (notifications, sound)
- ✅ Safari: Full support (notifications, sound)

#### Mobile
- ✅ Chrome Android: Full support (notifications, sound, vibration)
- ✅ Safari iOS: Limited support (notifications work only when app is open, no vibration)
- ⚠️ Note: iOS requires the tab to be open for notifications to show

### Technical Details

#### Polling Strategy
- Polls every 30 seconds to balance responsiveness with server load
- Only polls when:
  - User is logged in
  - Notification permission is granted
  - Component is mounted

#### Task Detection
- Tracks task IDs in a Set to avoid duplicate notifications
- Compares task `createdAt` timestamp with last check time
- Only notifies for tasks created after the user enabled notifications

#### Audio Handling
- Audio element created once and reused
- Volume set to 50% to avoid being jarring
- Gracefully handles when audio playback is blocked by browser policy

#### Vibration Pattern
- `[200, 100, 200]` = vibrate 200ms, pause 100ms, vibrate 200ms
- Only runs on devices that support the Vibration API
- Falls back silently if not supported

## Configuration

### Polling Interval
To change how often the system checks for new tasks, modify the interval in `useTaskNotifications.ts`:

```typescript
const interval = setInterval(checkForNewTasks, 30000); // 30 seconds
```

### Sound File
Replace `/web/public/notification.mp3` with your own sound file. Keep it short (< 1 second) for best UX.

### Vibration Pattern
Modify the pattern in `useTaskNotifications.ts`:

```typescript
navigator.vibrate([200, 100, 200]); // Customize the array
```

Pattern format: `[vibrate_ms, pause_ms, vibrate_ms, pause_ms, ...]`

## Testing

### Manual Testing
1. Open workshop page in one browser tab as a regular user
2. Open admin panel in another tab
3. Create a new task assigned to the workshop user
4. Within 30 seconds, the notification should appear

### Testing Notification Permission States

**Test Default State (Not Asked):**
1. Open in incognito/private window
2. Verify prompt appears after 3 seconds
3. Close prompt and verify it doesn't appear again in that session

**Test Granted State:**
1. Click "Enable Notifications"
2. Grant permission in browser dialog
3. Verify button changes to "Notifications On"
4. Create a test task and verify notification appears

**Test Denied State:**
1. Click "Enable Notifications"
2. Deny permission in browser dialog
3. Verify button still shows "Enable Notifications"
4. Click button and verify alert about browser settings

### Testing Mobile Vibration
1. Open on a physical Android device (iOS doesn't support vibration API)
2. Enable notifications
3. Create a test task
4. Verify device vibrates when notification arrives

## Future Enhancements

### Potential Improvements
- [ ] **WebSocket Support**: Real-time updates instead of polling
- [ ] **Service Worker**: Notifications even when tab is closed
- [ ] **Notification Grouping**: Stack multiple tasks into one notification
- [ ] **Custom Notification Actions**: "View Task" and "Mark as Done" buttons
- [ ] **Do Not Disturb**: Schedule quiet hours
- [ ] **Filter Preferences**: Choose which task types trigger notifications
- [ ] **Desktop App**: Electron wrapper for persistent notifications

### API Webhook Alternative
Instead of polling, you could:
1. Add WebSocket endpoint to backend
2. Emit events when tasks are created
3. Frontend listens for events in real-time
4. Benefits: Instant notifications, lower server load

### Service Worker Implementation
For notifications when the browser is closed:
1. Register a service worker
2. Use Push API with backend subscription
3. Backend sends push notifications via web push protocol
4. Requires HTTPS in production

## Troubleshooting

### Notifications Not Appearing
1. Check browser permission: Settings → Privacy & Security → Notifications
2. Verify user is logged in and has `user.id`
3. Check browser console for errors
4. Ensure tasks are being assigned to the correct user
5. Try closing and reopening the tab

### Sound Not Playing
1. Check browser autoplay policy (may require user interaction first)
2. Verify `/notification.mp3` file exists
3. Check browser console for audio errors
4. Try clicking the page once to enable audio playback

### Vibration Not Working
1. Check device support: Only works on Android devices
2. iOS doesn't support the Vibration API
3. Some browsers may block vibration in certain contexts

### Prompt Not Showing
1. Check if user previously dismissed it (stored in localStorage)
2. Clear localStorage: `localStorage.removeItem('notification-prompt-dismissed')`
3. Verify `permission` state is 'default'

## Security & Privacy

### Permission Handling
- System only requests permission when user explicitly clicks button
- Respects user's choice and doesn't repeatedly prompt
- Stores dismissal preference in localStorage (per-origin)

### Data Privacy
- No notification data is sent to external servers
- All processing happens client-side
- Task data is only fetched from your own API

### Best Practices
- Always provide a way to disable notifications
- Make permission request clear and contextual
- Respect "Do Not Disturb" system settings (automatic in most browsers)
