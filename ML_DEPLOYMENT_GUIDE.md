# 🚀 ML Service Deployment Guide

## 📊 **Database Requirements for Full Functionality**

### **Core Features (Always Available)**
✅ **PDF Parsing**: `/parse-quote`, `/debug-parse`  
✅ **ML Predictions**: `/predict` (when models available)  
✅ **Basic Training**: `/train` with manual data  

### **Email Training Features (Database Required)**
🗄️ **Auto Email Discovery**: `/start-email-training`  
🗄️ **Quote Preview**: `/preview-email-quotes`  
🗄️ **Historical Analysis**: Full ML training pipeline  

## 🏗️ **Deployment Options**

### **Option 1: Full Stack with Database** ⭐ **Recommended**
```yaml
# In render.yaml - ML service with database
- type: web
  name: ml
  env: docker
  rootDir: ml
  envVars:
    - key: DATABASE_URL
      value: your-postgresql-connection-string
```

**Benefits:**
- ✅ Complete email-to-ML training workflow
- ✅ Automated quote discovery from Gmail/M365
- ✅ Historical quote analysis and pattern learning
- ✅ Continuous model improvement

### **Option 2: Core Parsing Only**
```yaml
# In render.yaml - ML service without database
- type: web
  name: ml
  env: docker
  rootDir: ml
  # No DATABASE_URL - email features disabled
```

**Benefits:**
- ✅ All PDF parsing functionality
- ✅ Quote Builder integration
- ✅ Manual ML training
- ⚠️ No automated email processing

## 🔧 **Environment Configuration**

### **Required Environment Variables**
```bash
PORT=8000                    # Service port (auto-set by Render)
```

### **Optional Environment Variables**
```bash
DATABASE_URL=postgresql://... # PostgreSQL connection (for email features)
MODELS_DIR=/mnt/models        # Model storage directory
APP_ENV=production           # Environment indicator
```

## 🎯 **Production Database Setup**

### **1. PostgreSQL Database**
Your ML service connects to the **same database** as your main API:
- ✅ Uses existing `DATABASE_URL` environment variable
- ✅ Accesses same tenant data and user information
- ✅ Stores ML training data alongside CRM data

### **2. Database Schema**
The ML service creates its own tables:
```sql
-- Example ML training data table
CREATE TABLE ml_training_data (
    id SERIAL PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    email_subject TEXT,
    quote_data JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### **3. Connection Handling**
```python
# Graceful degradation in main.py
try:
    from email_trainer import EmailTrainingWorkflow
    EMAIL_TRAINING_AVAILABLE = True
except ImportError:
    EMAIL_TRAINING_AVAILABLE = False
    # Core parsing still works!
```

## 🚦 **Deployment Status Check**

### **Service Health Endpoints**
- `GET /health` - Service status
- `GET /` - Basic service info
- `POST /parse-quote` - Core parsing test

### **Feature Availability**
- `/start-email-training` → Returns 503 if no database
- `/preview-email-quotes` → Returns 503 if no database
- All other endpoints work regardless

## 📈 **Scaling Considerations**

### **Database Performance**
- ML training queries can be intensive
- Consider read replicas for heavy analysis
- Background job queues for large training runs

### **Model Storage**
- Models stored in `/mnt/models` volume
- Persist between deployments
- Share across ML service instances

## 🔒 **Security**

### **Database Access**
- Uses same PostgreSQL instance as main API
- Inherits existing security and backup policies
- No additional database credentials needed

### **Email Credentials**
- Gmail/M365 credentials passed via API calls
- Not stored in environment variables
- Temporary access for training sessions only

## 🎉 **Deployment Steps**

1. **Add ML service to `render.yaml`** ✅ Done
2. **Set `DATABASE_URL` in Render dashboard** (same as API service)
3. **Deploy with `git push`**
4. **Verify health at `https://your-ml-service.render.com/health`**
5. **Test email training from dashboard**

Your ML service will work perfectly in production with the same database setup as your main application! 🚀