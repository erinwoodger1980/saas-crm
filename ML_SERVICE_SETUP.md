# ML Service Setup Guide

## Overview
Your ML service is now deployed at: `https://new-ml-zo9l.onrender.com`

The service has the following endpoints:
- ✅ `GET /` - Root endpoint (returns `{"ok":true,"models":{"price":true,"win":true}}`)
- ✅ `GET /health` - Health check
- ✅ `POST /parse` - Legacy PDF parsing endpoint (file upload or URL)
- ✅ `POST /parse-quote` - Parse quote from URL
- ✅ `POST /parse-quote-upload` - Parse quote from file upload
- ✅ `POST /predict` - Price/win predictions
- ✅ `POST /train` - Model training

## Configure ML_URL in Render

### For your API service (api.joineryai.app):

1. Go to https://dashboard.render.com
2. Select your **API service** (the Node.js/Express service)
3. Click **Environment** in the left sidebar
4. Click **Add Environment Variable**
5. Add:
   ```
   Key:   ML_URL
   Value: https://new-ml-zo9l.onrender.com
   ```
6. Click **Save Changes**
7. Render will automatically redeploy your API service

### For your Web service (if needed):

1. Select your **Web service** (the Next.js service)
2. Click **Environment** in the left sidebar
3. Add:
   ```
   Key:   NEXT_PUBLIC_ML_URL
   Value: https://new-ml-zo9l.onrender.com
   ```
4. Click **Save Changes**

## Testing the Integration

Once deployed, you can test:

1. **Health Check**: Visit https://api.joineryai.app/ml/health
   - Should return `{"ok":true,"target":"https://new-ml-zo9l.onrender.com"}`

2. **Settings UI**: 
   - Log into your app
   - Go to Settings → AI Training
   - Header should show ML service status badge (green = connected)

3. **PDF Parsing**:
   - Upload a supplier quote PDF in the Quotes section
   - Click "Parse" to extract line items
   - Should use ML service instead of fallback parser

## Build Smoke Test

The API build includes a smoke test that will now:
- ✅ Skip gracefully in Render environment (because `RENDER=true`)
- ✅ Run when ML_URL is configured locally for development

No action needed for the smoke test - it's already configured to skip in production.

## Endpoints Reference

### POST /parse
Accepts file upload or JSON with URL. Returns parsed PDF data.

**File Upload:**
```bash
curl -X POST https://new-ml-zo9l.onrender.com/parse \
  -F "file=@quote.pdf"
```

**URL:**
```bash
curl -X POST https://new-ml-zo9l.onrender.com/parse \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/quote.pdf"}'
```

### POST /parse-quote-upload
Accepts multipart file upload. Used by API's `callMlWithUpload()`.

```bash
curl -X POST https://new-ml-zo9l.onrender.com/parse-quote-upload \
  -F "file=@quote.pdf"
```

### POST /parse-quote
Accepts JSON with signed URL. Used by API's `callMlWithSignedUrl()`.

```bash
curl -X POST https://new-ml-zo9l.onrender.com/parse-quote \
  -H "Content-Type: application/json" \
  -d '{"url":"https://signed-url.com/quote.pdf","filename":"quote.pdf"}'
```

## Status

- [x] ML service deployed and healthy
- [x] `/parse` endpoint implemented
- [x] `/parse-quote-upload` endpoint implemented
- [ ] ML_URL environment variable configured in Render API service
- [ ] ML_URL environment variable configured in Render Web service (optional)
- [ ] Test ML integration in production

## Next Steps

1. **Add ML_URL to Render** (see instructions above)
2. **Wait for automatic redeploy** (takes ~2-3 minutes)
3. **Test integration** by uploading a quote PDF
4. **Monitor logs** for any ML service errors

## Troubleshooting

**If ML parsing still fails:**
- Check Render logs for the API service
- Verify ML_URL is exactly: `https://new-ml-zo9l.onrender.com`
- Check ML service logs for incoming requests
- Test ML endpoints directly with curl

**If smoke test fails locally:**
- Set `ML_URL=http://localhost:8000` in your `.env.local`
- Run ML service locally: `cd ml && uvicorn main:app`
- Or skip the test: `SKIP_PARSE_SMOKE=true pnpm build`
