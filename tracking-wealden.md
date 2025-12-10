# Wealden Joinery tracking (marketing section)

This file documents the Google Tag Manager (GTM) and Meta Pixel hooks for the `/wealden-joinery` marketing routes.

## IDs to populate
- **GTM_ID**: `TODO_GTM_ID` in `web/src/app/(wealden)/wealden-joinery/_components/tracking.tsx`
- **META_PIXEL_ID**: `TODO_META_PIXEL_ID` in the same file

## Scripts loaded
- GTM bootstraps `dataLayer` for events beginning with `wealden_*`.
- Meta Pixel initialises `PageView` and can emit `Lead`, `ViewContent`, `StartTrial`, `CompleteRegistration`, and `Contact` events.

## Event map
- `wealden_view_content` / `ViewContent`: navigation to key product pages (windows, doors, alu-clad, projects, choices).
- `wealden_estimator_started` / `StartTrial`: CTA click to open or begin the AI Estimator.
- `wealden_estimator_completed` / `CompleteRegistration`: estimator finished with contact details submitted.
- `wealden_lead` / `Lead`: contact form submission or estimator submission with contact details.
- `wealden_consultation_booked` / `Contact`: consultation booking confirmation.

Each helper lives in `wealdenTrack` inside `tracking.tsx` and automatically adds `brand: "Wealden Joinery"` to the GTM payload.

## Pageview coverage
- The route group layout (`web/src/app/(wealden)/wealden-joinery/layout.tsx`) loads GTM and Meta Pixel for all nested pages once the IDs are set.

## Notes
- Keep lead capture forms lightweight: fire events only on successful submissions to avoid noisy data.
- When integrating the existing AI Estimator component, call `wealdenTrack.estimatorStarted` on load/open and `wealdenTrack.estimatorCompleted` once contact details are submitted.
- If using modal CTAs, ensure the underlying CTA button still triggers `ViewContent` or `StartTrial` so ads attribution captures the interaction.
