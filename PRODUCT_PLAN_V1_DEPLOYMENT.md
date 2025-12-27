# ProductPlan V1 - Deployment & Operations Guide

**Status**: Ready for Production  
**Date**: 27 December 2025  
**Build**: ✅ Verified (0 TypeScript errors)

## Pre-Deployment Checklist

### Build Validation
```bash
✓ pnpm build        # Completes with 0 errors
✓ TypeScript check  # No type errors
✓ Next.js compile   # All routes optimized
✓ Static generation # Pages pre-rendered
```

### Code Review Checklist
- [ ] Review schema in [web/src/types/product-plan.ts](web/src/types/product-plan.ts)
- [ ] Review system prompt in [web/src/app/api/ai/generate-product-plan/route.ts](web/src/app/api/ai/generate-product-plan/route.ts)
- [ ] Review compiler in [web/src/lib/scene/plan-compiler.ts](web/src/lib/scene/plan-compiler.ts)
- [ ] Review renderer in [web/src/lib/scene/plan-renderer.ts](web/src/lib/scene/plan-renderer.ts)
- [ ] Test UI in [web/src/components/settings/ProductTypeEditModal.tsx](web/src/components/settings/ProductTypeEditModal.tsx)

### Feature Validation
- [ ] Settings → "Generate with AI" → plan appears
- [ ] Adjust variables → values persist
- [ ] Compile → ProductParams created
- [ ] Inspect [AI2SCENE] logs in DevTools
- [ ] Quote line helpers functional

### Performance Testing
- [ ] AI endpoint responds in <3 seconds
- [ ] Scene generation <100ms
- [ ] Canvas renders at 60 FPS
- [ ] Memory stable on modal open/close

## Deployment Steps

### 1. Environment Setup

Ensure `.env.local` includes:

```bash
# OpenAI API Key
OPENAI_API_KEY=sk-...

# Standard Wealden Joinery vars (existing)
NEXT_PUBLIC_TENANT_ID=...
DATABASE_URL=...
```

### 2. Database Migrations

No database migrations required—ProductPlan stores as JSON in existing fields:
- TEMPLATE: `tenant.settings.productTypes[...].plan`
- INSTANCE: `quote.lines[...].customData.plan`

### 3. Build & Deploy

```bash
# Local verification
cd /Users/Erin/saas-crm
pnpm build
pnpm start  # Test locally

# Deploy (using your CI/CD)
git add .
git commit -m "feat: ProductPlan V1 - component-level AI assembly"
git push origin main  # Triggers deployment pipeline
```

### 4. Monitoring

After deployment, watch for:

```bash
# 1. [AI2SCENE] logs in Production
# → Inspect browser console on Settings/Quote pages
# → Look for plan generation and compilation summaries

# 2. API endpoint response times
# → Monitor /api/ai/generate-product-plan latency
# → Should be 1-3 seconds (OpenAI call + parsing)

# 3. WebGL disposal on modal close
# → No memory leaks or context loss

# 4. Material assignments
# → Verify materialRoleMap applied correctly
```

## Operational Tasks

### 1. Monitoring & Debugging

**Real-Time Logs** (Production):
```
Search logs for: [AI2SCENE]

Examples:
[AI2SCENE] Generated ProductPlan: {
  detected: { category: "door", type: "timber_door", confidence: 0.85 },
  componentCount: 8,
  componentsByRole: { STILE: 2, RAIL_TOP: 1, ... }
}

[AI2SCENE] ProductPlan Compilation Summary: {
  detected: {...},
  componentCounts: { total: 8, byRole: {...} },
  profileSlots: { estimated: 2, uploaded: 0 },
  materials: { rolesAssigned: 3, placeholders: 3 },
  gltf: { missingModels: 1, total: 1 }
}
```

### 2. Common Issues & Fixes

**Issue**: "Failed to generate product plan"  
**Root Cause**: OpenAI API down or key invalid  
**Fix**:
1. Check `OPENAI_API_KEY` in `.env.local`
2. Verify API quota at https://platform.openai.com/account/billing/overview
3. Monitor OpenAI status at https://status.openai.com/

**Issue**: Schema validation fails  
**Root Cause**: AI returned invalid JSON  
**Fix**:
1. Fallback plan (2-panel door) will be returned automatically
2. Check browser console for [AI2SCENE] validation errors
3. Report to team if > 10% failure rate

**Issue**: Scene doesn't render after compilation  
**Root Cause**: Expression evaluation error  
**Fix**:
1. Verify all variable names in expressions match plan.variables
2. Check expression syntax (no invalid operators)
3. Ensure expressions evaluate to positive numbers

**Issue**: Memory leak on modal open/close  
**Root Cause**: WebGL resources not disposed  
**Fix**:
1. Verify SceneDisposer cleanup in ProductConfigurator3D
2. Check canvas element is removed from DOM
3. Monitor memory in DevTools → Performance

### 3. Performance Optimization

**If plan generation is slow** (>3 seconds):
- Current: gpt-4o-mini (fast, cost-effective)
- Option: Switch to gpt-4-turbo for higher quality (longer latency)
- Or: Add prompt caching (OpenAI API feature)

**If scene rendering is slow** (>100ms):
- Profile buildSceneFromPlan() with DevTools
- Reduce component count in AI prompt if needed
- Cache ComponentNode[] per plan hash

### 4. Analytics & Reporting

Track these metrics:
```
Daily:
- Plans generated (success + fallback count)
- Avg. AI latency (ms)
- Avg. compilation time (ms)
- Scene node count (avg, min, max)

Weekly:
- Component role distribution (STILE, RAIL, PANEL usage)
- Material role distribution (TIMBER_PRIMARY popularity)
- Profile source breakdown (estimated vs. uploaded)
- Confidence scores (avg across plans)

Monthly:
- Total products created with ProductPlan
- Cost of OpenAI API calls
- User satisfaction (feedback from Settings/Quote)
```

## Future Work (Post-Deployment)

### Phase 2: Profile & GLTF Support
- [ ] Real SVG/DXF profile parser
- [ ] Cache profile geometries
- [ ] Hardware GLTF models
- [ ] Profile upload UI

### Phase 3: Advanced AI
- [ ] OpenAI GPT-4 Vision (image-based generation)
- [ ] Prompt caching for cost reduction
- [ ] Fine-tuned model for joinery domain

### Phase 4: Persistence
- [ ] `/api/product-type/template-config` endpoint
- [ ] `/api/scene-state` endpoint
- [ ] Plan versioning & history

### Phase 5: Enterprise Features
- [ ] Batch plan generation from CSV
- [ ] Plan comparison UI (side-by-side)
- [ ] Plan templates (door/window library)
- [ ] Custom material libraries per tenant

## Rollback Plan

If critical issues arise:

```bash
# 1. Disable ProductPlan UI (quick fix)
# - Comment out "Generate with AI" tab in ProductTypeEditModal
# - Users still can access manual config

# 2. Revert to previous build
git revert HEAD  # Reverts the ProductPlan commit
pnpm build
pnpm deploy

# 3. Full rollback (if needed)
git checkout <previous-commit-hash>
pnpm build
pnpm deploy
```

## Support & Documentation

### User Documentation
- **Settings Users**: See "Component Plan" tab after generating with AI
  - Input: Image + description
  - Output: Component schedule with variables to edit
  - Action: Compile and save

- **Quote Users**: Use helpers in [web/src/lib/api/product-plan-integration.ts](web/src/lib/api/product-plan-integration.ts)
  - Function: `generatePlanForLineItem(lineItem)`
  - Result: ProductPlan stored in `lineItem.customData`

### Developer Documentation
- [PRODUCT_PLAN_V1_DOCUMENTATION.md](PRODUCT_PLAN_V1_DOCUMENTATION.md) - Full reference
- [PRODUCT_PLAN_V1_CODE_REFERENCE.md](PRODUCT_PLAN_V1_CODE_REFERENCE.md) - Integration guide
- This file - Deployment & operations

### Debug Access
1. Open any Settings or Quote page
2. Press F12 → DevTools → Console tab
3. Search for "[AI2SCENE]" in logs
4. Inspect requests in Network tab → `/api/ai/generate-product-plan`

## Scaling Considerations

### Database Growth
Each plan is ~2-5 KB JSON. Estimate:
- 100 products/month × 5 KB = 500 KB/month
- 1000 quote lines/month × 5 KB = 5 MB/month
- Annual: ~66 MB (negligible)

### API Quota
OpenAI gpt-4o-mini pricing:
- Input: $0.00015 / 1K tokens (~100-200 tokens per plan)
- Output: $0.0006 / 1K tokens (~500-1000 tokens per plan)
- Cost/plan: ~$0.0008
- Budget: $1000/month = 1.2M plans (far beyond scale)

### Concurrent Requests
- Current: Sequential (one plan at a time per user)
- Future: Queue system if >100 concurrent requests

## Security Checklist

- [ ] OpenAI API key not in code (uses .env.local)
- [ ] No sensitive data in prompts (only dimensions, category)
- [ ] Input validation on description (max length, no injection)
- [ ] Rate limiting on /api/ai/generate-product-plan (future)
- [ ] CORS headers correct for quote domain
- [ ] User auth verified before plan access

## Success Metrics

After 2 weeks of deployment:
- [ ] > 90% plan generation success rate (include fallbacks)
- [ ] < 2 second avg. latency from user click to plan display
- [ ] 0 WebGL context loss errors
- [ ] Component schedule displays correctly for >95% of plans
- [ ] Users report better 3D preview accuracy

---

**ProductPlan V1 Ready for Production** ✅
