# Duolingo-Style Gamification System

Complete task gamification with celebrations, streaks, achievements, and seamless calendar integration.

## 🎉 Features

### Celebrations & Animations
- **Confetti Animation**: Dual-side confetti burst using `canvas-confetti`
- **Random Messages**: 5 celebration types (standard, streak, milestone, perfect-day, speedrun)
- **Encouraging Phrases**: 10+ motivational messages rotate randomly
- **Animated Icons**: Trophy, Flame, Star, Zap, Target with bounce animations
- **Auto-close**: Modal disappears after 5 seconds
- **Stats Display**: Shows streak, points earned, and total completed

### Streak Tracking
- **Current Streak**: Consecutive days with task completions (fire icon 🔥 when ≥7 days)
- **Longest Streak**: Personal best record
- **Daily Progress**: Tasks completed today with percentage
- **Motivational Messages**: Dynamic messages based on streak length

### Achievements System
1. **Getting Started** 🎯 - Complete your first task
2. **Week Warrior** 🔥 - 7-day completion streak
3. **Productive** ⚡ - Complete 10 tasks
4. **Task Master** 🏆 - Complete 50 tasks
5. **Centurion** 👑 - Complete 100 tasks
6. **Unstoppable** 🚀 - 30-day completion streak

Each achievement shows:
- Progress bar for locked achievements
- Unlock date for completed achievements
- Current progress vs target

### Points & Leveling
- **Points by Priority**:
  - URGENT: 25 points
  - HIGH: 15 points
  - MEDIUM: 10 points
  - LOW: 5 points
- **Level Calculation**: `level = floor(totalPoints / 100) + 1`
- **XP Progress Bar**: Visual progress to next level with gradient animation

### Bidirectional Process-Task Sync
- **Task Creation**: Workshop process assignments automatically create tasks
- **Task Complete → Process Complete**: Marking task done completes the workshop process
- **Process Complete → Task Complete**: Marking process done completes the task
- **Metadata Tracking**: Tasks store `processCode` in meta for bidirectional linking

### Calendar Deep Links
- **iCal Export**: Download tasks as `.ics` file
- **Deep Links**: Events link directly to specific parts of app:
  - LEAD tasks → `/leads?task={id}`
  - PROJECT/WORKSHOP tasks → `/workshop?task={id}`
  - QUOTE tasks → `/quotes/{relatedId}?task={id}`
  - WORKSHOP processes → `/workshop?opportunity={id}&task={id}`
  - Default → `/tasks?id={id}`
- **Event Details**: Includes description, priority, status, assignees, and clickable URL

## 📁 Files Created/Modified

### Frontend Components
- `web/src/components/tasks/TaskCelebration.tsx` (NEW, 214 lines)
  - Celebration modal with confetti and animations
  
- `web/src/components/tasks/TaskStreakTracker.tsx` (NEW, 230 lines)
  - Stats dashboard with level, streaks, achievements
  
- `web/src/components/tasks/TaskCenter.tsx` (MODIFIED)
  - Added celebration integration
  - Added "Complete Task" button
  - Added handleCompleteTask function
  
- `web/src/components/tasks/CalendarIntegration.tsx` (MODIFIED)
  - Added hint about deep links in calendar events

### Backend Endpoints
- `api/src/routes/tasks.ts` (MODIFIED)
  - `POST /tasks/:id/complete` - Mark task done, sync to process
  - `GET /tasks/stats/:userId` - Get streaks, achievements, points, level
  - `GET /tasks/calendar-export/ical` - Export tasks with deep links
  
- `api/src/routes/workshop-processes.ts` (MODIFIED)
  - `PATCH /workshop-processes/process/:processId/complete` - Mark process done, sync to task

## 🎮 User Experience

1. **Starting Out**:
   - User sees TaskStreakTracker at top of TaskCenter
   - Shows current level, streak, and today's progress
   - Achievements displayed with locked/unlocked status

2. **Completing Tasks**:
   - Click green "Complete Task" button
   - Confetti animation bursts from both sides
   - Random celebration message appears
   - Stats update in real-time (streak, points, total)
   - Modal auto-closes after 5 seconds

3. **Building Streaks**:
   - Complete tasks daily to maintain streak
   - Fire icon 🔥 appears when streak ≥ 7 days
   - Motivational messages encourage continued progress
   - Streak counter resets if day missed

4. **Unlocking Achievements**:
   - Progress bars fill as milestones approached
   - Achievement unlocks with celebration
   - Unlock date displayed on completed achievements
   - 6 achievements to collect

5. **Leveling Up**:
   - XP bar fills with each task completion
   - Level increases every 100 points
   - Higher levels show mastery and dedication

6. **Workshop Integration**:
   - Workshop process assignments auto-create tasks
   - Completing task marks process complete
   - Completing process marks task complete
   - Seamless bidirectional sync

7. **Calendar Integration**:
   - Export tasks to external calendars
   - Click event in Google/Outlook/Apple Calendar
   - Deep link opens specific task/opportunity in app
   - Seamless workflow between calendar and CRM

## 🚀 Usage

### Complete a Task
```typescript
// Frontend
const response = await apiFetch(`/tasks/${taskId}/complete`, {
  method: 'POST',
  headers: { 'x-tenant-id': tenantId }
});

// Response includes updated task and celebration trigger
// Frontend then fetches stats and shows celebration
```

### Get User Stats
```typescript
const stats = await apiFetch(`/tasks/stats/${userId}`, {
  headers: { 'x-tenant-id': tenantId }
});

// Returns:
// - currentStreak: number
// - longestStreak: number
// - totalTasksCompleted: number
// - tasksCompletedToday: number
// - totalPoints: number
// - level: number
// - nextLevelPoints: number
// - achievements: array with progress and unlock dates
```

### Export Calendar
```typescript
// User clicks "Export iCal" button
// Downloads .ics file with all tasks
// Each event includes deep link to specific task/opportunity
// Can import into any calendar app (Google, Outlook, Apple Calendar)
```

## 🎨 Design Patterns

### Duolingo-Inspired
- **Immediate Feedback**: Celebration appears instantly on completion
- **Visual Rewards**: Confetti, animations, gradient text
- **Progress Visibility**: Streaks, levels, achievements always visible
- **Positive Reinforcement**: Encouraging messages, no negative feedback
- **Daily Habits**: Streak system encourages daily engagement
- **Clear Goals**: Achievements provide concrete milestones
- **Gamified Progression**: Points and levels create addictive loop

### Addictive Mechanics
- **Variable Rewards**: Random celebration messages keep experience fresh
- **Loss Aversion**: Don't want to break the streak
- **Progress Bars**: Visual progress creates desire to complete
- **Social Proof**: Achievements show mastery
- **Immediate Gratification**: Confetti and points instantly
- **Clear Feedback Loop**: Complete task → celebration → stats update → level up

## 📊 Analytics Opportunities

Track gamification engagement:
- Completion rates before/after gamification
- Average streak length
- Most common achievement unlock order
- Level distribution across users
- Time to first celebration
- Daily active users with streaks

## 🔧 Configuration

Environment variables:
- `APP_URL` - Base URL for deep links (e.g., `https://app.example.com`)

Points can be adjusted in `api/src/routes/tasks.ts`:
```typescript
const priorityPoints = {
  URGENT: 25,
  HIGH: 15,
  MEDIUM: 10,
  LOW: 5
};
```

Achievements can be added/modified in the `/tasks/stats/:userId` endpoint.

## 🎯 Future Enhancements

- Team leaderboards
- Daily/weekly challenges
- Custom achievement badges
- Streak recovery (1 "freeze" per month)
- Task templates with point multipliers
- Power-ups and bonuses
- Social sharing of achievements
- Push notifications for streaks about to break
- Gamification analytics dashboard

## ✅ Commits

1. `98ccd2ff` - Add Duolingo-style gamification system with celebrations, streaks, and achievements
2. `dca1cd51` - Add calendar export with deep links to tasks and opportunities

---

**Result**: Tasks are now fun, addictive, and deeply integrated with workshop processes and external calendars. Users are encouraged to complete tasks daily, maintain streaks, and unlock achievements while seamlessly navigating between the CRM, workshop, and their calendar apps.
