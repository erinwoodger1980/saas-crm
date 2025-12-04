# Geofence Feature - Quick Reference & Next Steps

## ✅ Completed Implementation

### Backend
- ✅ Added calculateDistance() function using Haversine formula
- ✅ Enhanced POST /workshop/timer/start with geofence validation
- ✅ Location data captured and stored with each timer
- ✅ Geofence warnings returned in API response
- ✅ Installer bypass logic implemented

### Frontend
- ✅ Added geolocation capture in startTimer()
- ✅ Added geolocation capture in handleSwapTimerComplete()
- ✅ Added geolocation capture in handleSwapTimerSkip()
- ✅ Graceful fallback if permission denied
- ✅ Warning alerts displayed to user

### Database
- ✅ Migration applied (20251226_add_geofence_fields)
- ✅ All new fields created with proper defaults
- ✅ Database indexes added for geofence queries
- ✅ Prisma Client regenerated

### Builds
- ✅ Web build: No errors
- ✅ API build: No errors

## 📋 Next Steps (Priority Order)

### High Priority
1. **Create Geofence Settings UI**
   - New admin settings page for geofence configuration
   - Location: `/admin/workshop-settings` or similar
   - Fields:
     - Toggle: Enable/disable geofence
     - Latitude input (with map picker if available)
     - Longitude input (with map picker if available)
     - Radius input (in meters, default 100)
   - Save to database via PATCH /admin/tenant-settings or similar

2. **User Management - Installer Flag**
   - Add checkbox/toggle in user edit page
   - Label: "Bypass Workshop Geofence (for installers/mobile staff)"
   - Saves `isInstaller` flag to database
   - Location: `/admin/users` or `/admin/team` page

### Medium Priority
3. **Testing & QA**
   - Test on different browsers and mobile devices
   - Test with location permission denied
   - Test with location permission granted
   - Verify accuracy of distance calculations
   - Test warning messages display correctly

4. **Dashboard Visibility** (Optional)
   - Add column to workshop timer log showing geofence status
   - Show distance from workshop for each timer entry
   - Filter/sort by geofence violations

### Low Priority
5. **Enhancements**
   - GPS history visualization
   - Multiple geofence zones
   - Notifications/alerts for violations
   - IP-based geofence fallback
   - Reporting dashboard

## 🧪 Quick Testing Commands

### Test Location Capture
```javascript
// In browser console while on workshop page:
navigator.geolocation.getCurrentPosition(
  pos => console.log('Lat:', pos.coords.latitude, 'Lon:', pos.coords.longitude),
  err => console.log('Error:', err)
);
```

### Check Database Fields
```sql
-- Verify columns were added to WorkshopTimer
SELECT 
  id, latitude, longitude, outsideGeofence, locationCaptured
FROM "WorkshopTimer" 
LIMIT 5;

-- Check Tenant geofence config
SELECT 
  id, geofenceEnabled, geofenceLatitude, geofenceLongitude, geofenceRadiusMeters
FROM "Tenant";

-- Check User installer flags
SELECT 
  id, name, email, isInstaller
FROM "User";
```

## 📍 Current Implementation Status

### API Response Example
```json
{
  "ok": true,
  "timer": {
    "id": "timer123",
    "userId": "user456",
    "projectId": "proj789",
    "process": "manufacturing",
    "startedAt": "2024-12-26T10:30:00Z",
    "latitude": 51.5074,
    "longitude": -0.1278,
    "locationAccuracy": 15.5,
    "locationCaptured": "2024-12-26T10:30:00Z",
    "outsideGeofence": false
  },
  "warning": "Clocked in 150m from workshop (allowed: 100m)",
  "outsideGeofence": true
}
```

### Geofence Warning Logic
```
IF tenant.geofenceEnabled = true
  AND user.isInstaller = false
  AND latitude/longitude provided
  AND distance > tenant.geofenceRadiusMeters
THEN
  show warning: "Clocked in {distance}m from workshop (allowed: {radius}m)"
```

## 📖 Code References

### Backend Route
- File: `/api/src/routes/workshop.ts`
- Function: `router.post("/timer/start")`
- Lines: ~1219-1400

### Frontend Component
- File: `/web/src/components/workshop/WorkshopTimer.tsx`
- Functions: `startTimer()`, `handleSwapTimerComplete()`, `handleSwapTimerSkip()`
- Lines: ~117-360

### Database Schema
- File: `/api/prisma/schema.prisma`
- Models: `Tenant` (lines ~32-35), `User` (line ~154), `WorkshopTimer` (lines ~1455-1462)

### Migration
- File: `/api/prisma/migrations/20251226_add_geofence_fields/migration.sql`
- Status: ✅ Applied to production

## 🔐 Privacy & Permissions

- Location captured only when timer starts (not continuously)
- Browser must grant geolocation permission
- Location data stored in secure database
- Gracefully handles permission denied scenario
- Timer still works without location data

## 🚀 Deployment Checklist

Before deploying to production:
- [ ] Run full test suite
- [ ] Test on staging environment
- [ ] Verify mobile browser compatibility
- [ ] Check location accuracy on different devices
- [ ] Monitor database performance with location queries
- [ ] Review distance calculations for local area
- [ ] Test with VPN/proxies to verify fallback behavior

## 💡 Tips for Admins

1. **Finding Your Workshop Coordinates:**
   - Use Google Maps: right-click location → copy coordinates
   - Format: Latitude, Longitude (e.g., 51.5074, -0.1278)

2. **Setting Appropriate Radius:**
   - Small shop: 50-100m
   - Large workshop: 100-200m
   - Multi-site: disable and use per-site in future

3. **Testing the System:**
   - Mark test user as installer (bypasses geofence)
   - Start timer from different locations
   - Check warning messages appear correctly

## 📞 Support

For issues or questions:
1. Check console logs (browser dev tools) for geolocation errors
2. Verify browser has location permission
3. Test distance calculation with known coordinates
4. Check database migration was applied: `SELECT * FROM "WorkshopTimer" LIMIT 1;`
