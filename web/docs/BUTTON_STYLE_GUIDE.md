# Button Style Guide

This document outlines the standardized button usage patterns for consistent UI/UX across the entire application.

## Button Component Location
All buttons should use the standardized `Button` component from `@/components/ui/button`.

```typescript
import { Button } from "@/components/ui/button";
```

## Button Variants

### Default Variant (`variant="default"`)
- **Use for**: Primary actions, main CTAs, important user actions
- **Examples**: "Save", "Submit", "Create Lead", "Send Email"
- **Styling**: Dark background, white text, proper focus states

### Secondary Variant (`variant="secondary"`)
- **Use for**: Secondary actions, supporting buttons alongside primary actions
- **Examples**: "Mark Done", "Log Note", "Cancel"
- **Styling**: Light gray background, dark text

### Outline Variant (`variant="outline"`)
- **Use for**: Secondary actions, non-primary buttons, neutral actions
- **Examples**: "Import CSV", "Upload File", "Request Quote", "Browse Files"
- **Styling**: White background, border, colored text

### Ghost Variant (`variant="ghost"`)
- **Use for**: Minimal visual impact, close buttons, subtle actions
- **Examples**: "Close", navigation buttons
- **Styling**: Transparent background, minimal styling

### Destructive Variant (`variant="destructive"`)
- **Use for**: Delete actions, dangerous operations that can't be undone
- **Examples**: "Delete Lead", "Remove", "Reject"
- **Styling**: Red background/text, warning appearance

## Button Sizes

### Default Size
- Standard for most buttons
- Good balance of visibility and space usage

### Small Size (`size="sm"`)
- Use for compact UI areas, secondary actions, task buttons
- **Examples**: Task action buttons like "Compose & Send", "Mark Done"

### Large Size (`size="lg"`)
- Use for prominent CTAs, especially on marketing pages
- **Examples**: "Start Free Trial", major signup buttons

## Text Guidelines

### Capitalization
- Use **Title Case** for all button text
- ✅ "Import CSV", "New Lead", "Request Supplier Quote"
- ❌ "import csv", "new lead", "request supplier quote"

### Wording
- Use action verbs that clearly describe what happens
- Keep text concise but descriptive
- Include context when helpful: "Send Client Questionnaire" vs just "Send"

## Implementation Examples

### Basic Button
```tsx
<Button variant="default" onClick={handleSave}>
  Save Changes
</Button>
```

### Link as Button
```tsx
<Button asChild>
  <Link href="/signup">
    Start Free Trial
  </Link>
</Button>
```

### Button with Icon
```tsx
<Button variant="outline">
  <span aria-hidden="true">📎</span>
  Upload Supplier Quote
</Button>
```

### Destructive Action
```tsx
<Button 
  variant="destructive" 
  onClick={deleteLead}
  disabled={loading}
>
  🗑️ Delete Lead
</Button>
```

## Common Patterns Replaced

### Before (Inconsistent Custom Styling)
```tsx
// ❌ Don't do this
<button className="rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-rose-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_18px_40px_-18px_rgba(37,99,235,0.55)]">
  + New Lead
</button>

<button className="rounded bg-slate-900 px-3 py-1 text-xs text-white hover:bg-slate-800">
  Save
</button>
```

### After (Standardized Button Component)
```tsx
// ✅ Use this instead
<Button variant="default" onClick={handleCreateLead}>
  New Lead
</Button>

<Button variant="default" size="sm" onClick={handleSave}>
  Save
</Button>
```

## Benefits of Standardization

1. **Consistent Visual Language**: All buttons look and feel part of the same application
2. **Better Accessibility**: Proper focus states, keyboard navigation, ARIA attributes
3. **Easier Maintenance**: Changes to button styling can be made in one place
4. **Better UX**: Users learn one interaction pattern that works everywhere
5. **Design System Compliance**: Follows established design patterns and spacing

## Migration Notes

During the standardization process, we replaced:
- Custom gradient buttons with `variant="default"`
- Custom border/background combinations with `variant="outline"`
- Red/destructive styling with `variant="destructive"`
- Close/minimal buttons with `variant="ghost"`
- Fixed capitalization issues (Title Case throughout)
- Consolidated sizing to use `size` prop instead of custom padding

## Exceptions

The only acceptable custom button styling is for:
- Highly specialized UI elements (like custom toggles)
- Third-party component integration where Button component can't be used
- Marketing elements that require very specific brand styling (though these should still follow the same interaction patterns)

When in doubt, use the Button component with appropriate variant and size props.