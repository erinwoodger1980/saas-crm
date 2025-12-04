# Geofence Implementation for Workshop Timer

## Overview
Implemented a location-based geofencing system for the workshop timer to track staff attendance on-site when clocking in. The system includes:
- Automatic geolocation capture when starting timers (with permission handling)
- Distance calculation from configured workshop location using Haversine formula
- Warnings displayed to staff when outside the geofence radius
- Installer bypass flag to allow flexible enforcement for installation crews
- Per-tenant configuration for geofence location and radius

## Database Changes

### Migration: `20251226_add_geofence_fields`
Applied migration adds the following columns:

**WorkshopTimer table:**
- `latitude` (DOUBLE PRECISION) - User's latitude when timer started
- `longitude` (DOUBLE PRECISION) - User's longitude when timer started
- `locationAccuracy` (DOUBLE PRECISION) - Accuracy in meters from browser
- `locationCaptured` (TIMESTAMP) - When location was captured
- `outsideGeofence` (BOOLEAN, default FALSE) - Flag if user was outside allowed radius

**User table:**
- `isInstaller` (BOOLEAN, default FALSE) - Bypasses geofence enforcement if true

**Tenant table:**
- `geofenceEnabled` (BOOLEAN, default FALSE) - Enable/disable geofence checking
- `geofenceLatitude` (DOUBLE PRECISION) - Workshop center latitude
- `geofenceLongitude` (DOUBLE PRECISION) - Workshop center longitude
- `geofenceRadiusMeters` (DOUBLE PRECISION, default 100) - Allowed radius in meters

## Backend Implementation

### File: `api/src/routes/workshop.ts`

**Distance Calculation Function:**
```typescript
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number
```
- Uses Haversine formula for accurate distance calculation
- Earth radius: 6371km (6371e3 meters)
- Returns distance in meters between two coordinates

**POST /workshop/timer/start Endpoint Updates:**

1. **Request Body Enhancement:**
   - Now accepts optional: `latitude`, `longitude`, `accuracy` from client
   - All existing parameters still work as before

2. **Geofence Validation Logic:**
   ```
   IF tenant.geofenceEnabled AND user.isInstaller = false AND location provided:
     - Calculate distance from user location to workshop location
     - IF distance > geofenceRadiusMeters:
       - Set outsideGeofence = true
       - Generate warning message with distance details
   ```

3. **Response Enhancement:**
   - Returns combined warnings (assignment warnings + geofence warnings)
   - Includes `outsideGeofence` boolean flag in response
   - Warning format: `"Clocked in Xm from workshop (allowed: Ym)"`

4. **Location Storage:**
   - All location data (latitude, longitude, accuracy, timestamp) stored with timer
   - Enables future reporting and audit trails

## Frontend Implementation

### File: `web/src/components/workshop/WorkshopTimer.tsx`

**Updated Functions:**
1. `startTimer()` - Initial timer start
2. `handleSwapTimerComplete()` - Timer swap with completion
3. `handleSwapTimerSkip()` - Timer swap without completion

**Geolocation Capture Logic:**
```typescript
if ("geolocation" in navigator) {
  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { 
        timeout: 5000,
        enableHighAccuracy: false 
      });
    });
    
    payload.latitude = position.coords.latitude;
    payload.longitude = position.coords.longitude;
    payload.accuracy = position.coords.accuracy;
  } catch (geoError) {
    // Continue without location - it's optional
  }
}
```

**Features:**
- 5-second timeout for location capture (doesn't block timer start)
- Graceful degradation if permission denied or unavailable
- Low accuracy mode (enableHighAccuracy: false) for better battery life
- Optional - timer works without location data

**Warning Display:**
- Alerts user if `response.warning` received
- Shows both assignment and geofence warnings if applicable
- Examples:
  - `"Clocked in 250m from workshop (allowed: 100m)"`
  - `"Failed to update process assignment."`

## Configuration for Admins

### Setup Steps:
1. **Enable Geofence** (in settings):
   - Set `geofenceEnabled` to true
   - Configure workshop center coordinates (latitude/longitude)
   - Set allowed radius in meters (default: 100m)

2. **Mark Installers** (in user management):
   - Set `isInstaller = true` for installation crews
   - These users will not be blocked by geofence

### Example Settings:
```json
{
  "geofenceEnabled": true,
  "geofenceLatitude": 51.5074,
  "geofenceLongitude": -0.1278,
  "geofenceRadiusMeters": 150
}
```

## Behavior Matrix

| Scenario | Geofence Enabled | Installer | Location Provided | Result |
|----------|------------------|-----------|-------------------|--------|
| Onsite staff | true | false | yes | Timer starts, no warning |
| Offsite staff | true | false | yes | Timer starts, warning displayed |
| Installer at site | true | true | yes | Timer starts, no warning |
| Installer offsite | true | true | yes | Timer starts, no warning |
| No location | true | false | no | Timer starts, no location warning |
| Geofence disabled | false | false | yes | Timer starts, no warning |

## Privacy & Permissions

- **Browser Permission:** User must grant geolocation permission when first prompted
- **Optional:** Location capture fails silently; timer still starts without it
- **Data Storage:** Location stored only in local database for audit/reporting
- **No Tracking:** Location captured only when timer starts, not continuously

## Testing Checklist

- [ ] Verify database migration applied successfully
- [ ] Test timer start without location (permission denied)
- [ ] Test timer start with location (onsite - no warning)
- [ ] Test timer start outside geofence radius
- [ ] Test installer bypass flag (should never show geofence warning)
- [ ] Test timer swap/skip with location capture
- [ ] Test geofence disabled (no warnings shown)
- [ ] Verify location data stored in database
- [ ] Check warning message formatting and accuracy
- [ ] Test on mobile and desktop browsers

## Future Enhancements

1. **Settings UI:** Create admin page to configure geofence
2. **User Management:** Add checkbox to mark users as installers
3. **Analytics Dashboard:** View timers by geofence status
4. **Geofence Zones:** Support multiple geofence zones per tenant
5. **GPS History:** Show staff location trail during day
6. **Notifications:** Send alerts for geofence violations
7. **Backup Providers:** Support geofence via IP geo-location fallback

## Code Files Modified

1. **Database Schema:** `api/prisma/schema.prisma`
   - Added geofence fields to WorkshopTimer, User, Tenant models

2. **Backend API:** `api/src/routes/workshop.ts`
   - Added calculateDistance() function
   - Enhanced POST /workshop/timer/start endpoint
   - Added geofence validation logic

3. **Frontend Component:** `web/src/components/workshop/WorkshopTimer.tsx`
   - Updated startTimer() function
   - Updated handleSwapTimerComplete() function
   - Updated handleSwapTimerSkip() function
   - Added geolocation capture with fallback handling

4. **Database Migration:** `api/prisma/migrations/20251226_add_geofence_fields/migration.sql`
   - Applied all column additions to production database

## Deployment Notes

- Migration was successfully applied to production database
- No breaking changes to existing API contracts
- All existing functionality preserved (geofence is additive)
- Backwards compatible - works without geofence enabled
- Both web and API builds compile without errors
