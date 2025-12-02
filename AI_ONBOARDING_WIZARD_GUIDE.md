# AI Onboarding Wizard System

## Overview
The AI Search Bar now includes a comprehensive onboarding wizard system that guides new users through complex setup processes using natural language queries.

## How It Works

### 1. Natural Language Triggers
Users can ask questions like:
- "How do I set up my workshop schedule?"
- "How do I import existing orders?"
- "Help me get started"
- "How do I set up the app?"

### 2. AI Knowledge Base
The system matches keywords in user queries to a comprehensive knowledge base (`getUserManualKnowledge()` in `api/src/routes/ai.ts`) covering:

#### Onboarding & Setup
- Initial setup and getting started
- Workshop schedule configuration
- Data import processes

#### Workshop & Production
- Fire door schedule management
- Material ordering (paint, timber, glass)
- Production tracking and status monitoring

#### Lead Management
- Lead capture via landing pages
- Email integration (Gmail/Outlook)
- CSV imports
- Public estimator forms

#### Quoting
- Quote builder with line items
- PDF supplier quote parsing
- Fire door pricing calculator

#### Advanced Features
- Automation rules with AI assistant
- Field links (bidirectional sync)
- AI training for PDF parsing
- Timesheets and hour tracking
- Supplier RFQ system

### 3. Wizard Modal Types

#### `onboarding` - Full System Setup (5 steps)
1. **Company Information**: Logo, contact details, VAT, financial year
2. **Customer Questionnaires**: Create forms for project requirements
3. **Email Integration**: Connect Gmail/Outlook for auto-lead creation
4. **Import Data**: Bulk import leads, projects, materials
5. **Setup Automation**: Create automatic task rules

#### `import-data` - Data Import (3 steps)
1. **Prepare CSV**: Format requirements and examples
2. **Import Leads**: Customer contacts and inquiries
3. **Import Fire Doors**: MJS schedules and specifications

#### `workshop-setup` - Workshop Management (3 steps)
1. **Workshop Overview**: Understanding the system
2. **Import Projects**: Bring in existing schedule
3. **Setup Automation**: Material ordering tasks

#### `automation-setup` - Automation Guide (3 steps)
1. **Automation Basics**: How rules work
2. **Use AI Assistant**: Natural language examples
3. **Setup Field Links**: Bidirectional sync

## Implementation Details

### Files Modified

#### `/web/src/components/OnboardingWizard.tsx` (New)
- Multi-step wizard modal component
- Progress bar with step navigation
- Rich content with examples, tips, warnings
- Action buttons that navigate to relevant settings
- Clickable step indicators
- Previous/Next navigation

#### `/web/src/components/AISearchBar.tsx`
- Added wizard state: `showWizard`, `wizardType`
- Extended `executeAction()` to detect `params.wizard`
- Opens wizard modal when wizard action detected
- Wizard renders at z-200 above all other content

#### `/api/src/routes/ai.ts`
- Expanded `getUserManualKnowledge()` with 20+ feature entries
- Added onboarding keywords: setup, getting started, initial setup
- Added workshop keywords: workshop schedule, production, job schedule
- Added import keywords: import orders, bulk import, migrate data
- Each entry returns action with `params: { wizard: 'type' }`

### How Actions Flow

1. User types query in AI search bar (Cmd/Ctrl+K)
2. Query sent to `POST /ai/search` endpoint
3. `findManualAnswer()` matches keywords in knowledge base
4. Returns action: `{ type: 'modal', target: '/', params: { wizard: 'onboarding' } }`
5. AISearchBar detects `params.wizard` in `executeAction()`
6. Sets wizard type and opens `<OnboardingWizard>`
7. User navigates through steps, clicking actions to reach settings
8. Wizard closes, user completes setup in actual settings pages

### Wizard Features

#### Visual Design
- Gradient header with Sparkles icon
- Color-coded step buttons (current=indigo, completed=green)
- Progress bar showing percentage complete
- Icon indicators (CheckCircle for completed, Circle for pending)

#### Content Structure
Each step includes:
- **Title**: Brief step name
- **Description**: One-sentence summary
- **Content**: Detailed explanation with:
  - Instructional text
  - Colored info boxes (blue, green, purple, orange)
  - Bullet lists of features/requirements
  - Tips and warnings
  - Code examples (for CSV format)
- **Action Button**: Optional "Go to [Setting]" button

#### Navigation
- **Previous**: Go back one step (disabled on first step)
- **Next**: Advance one step (hidden if action button present)
- **Action Button**: Navigate to relevant settings page
- **Close**: Exit wizard any time
- **Step Pills**: Click any step to jump directly

#### State Management
- Tracks completed steps with Set
- Current step highlighted
- Progress bar updates automatically
- Wizard type determines which steps to show

## Usage Examples

### Example 1: New User Onboarding
```
User: "help me get started with the app"

AI Response:
"Let me guide you through initial setup! We'll configure your company 
details, create customer questionnaires, connect your email, import 
existing data, and set up automation to save time."

[Button: Start Onboarding Guide]
```

### Example 2: Workshop Setup
```
User: "how do i set up my workshop schedule and import existing orders"

AI Response:
"I'll walk you through workshop management! We'll import your existing 
projects, set up the production schedule, and create automatic material 
ordering tasks based on delivery dates."

[Button: Workshop Setup Guide]
```

### Example 3: Data Import
```
User: "i need to import my customer list"

AI Response:
"I can help you import your data! We'll prepare your CSV file, map the 
columns, and import your customers. You can also import fire door 
schedules and material costs."

[Button: Import Data Guide]
```

## Adding New Wizards

To add a new wizard type:

### 1. Update Knowledge Base (`api/src/routes/ai.ts`)
```typescript
{
  keywords: ['your', 'trigger', 'keywords'],
  answer: "Description of what the wizard does",
  action: {
    label: "Start Guide",
    action: {
      type: 'modal',
      target: '/',
      params: { wizard: 'your-wizard-type' }
    }
  }
}
```

### 2. Add Wizard Type (`web/src/components/OnboardingWizard.tsx`)
```typescript
// Update type union
wizardType: 'onboarding' | 'import-data' | 'workshop-setup' | 'automation-setup' | 'your-wizard-type';

// Add wizard steps
'your-wizard-type': [
  {
    id: 'step-1',
    title: 'Step Title',
    description: 'Brief description',
    content: (
      <div className="space-y-4">
        <p>Step content with instructions...</p>
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
          <h4 className="font-semibold text-blue-900 mb-2">Features:</h4>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• Feature 1</li>
            <li>• Feature 2</li>
          </ul>
        </div>
      </div>
    ),
    action: {
      label: 'Go to Settings',
      path: '/settings/your-section'
    }
  }
  // Add more steps...
]
```

## Benefits

### For New Users
- Guided setup reduces confusion
- Visual walkthroughs with examples
- Clear next steps with action buttons
- Can resume wizard at any time

### For Support Team
- Reduced support requests for setup
- Standardized onboarding process
- Users self-serve complex configurations
- Natural language access to help

### For Business
- Faster time-to-value for new clients
- Higher feature adoption rates
- Better user experience
- Scalable onboarding without manual training

## Future Enhancements

### Planned Improvements
- [ ] Video tutorials embedded in wizard steps
- [ ] Interactive tooltips on actual UI elements
- [ ] Checklist tracking for setup completion
- [ ] "Resume Setup" banner if wizard incomplete
- [ ] Wizard completion tracking in user preferences
- [ ] Auto-fill forms based on wizard selections
- [ ] Progress persistence across sessions
- [ ] AI-powered setup recommendations based on business type

### Integration Opportunities
- Link wizard steps directly to settings forms
- Pre-populate form fields from wizard context
- Track which wizards users have completed
- Suggest relevant wizards based on usage patterns
- Add "Ask AI" button within wizard for additional help

## Testing Checklist

- [ ] Trigger onboarding wizard with "help me get started"
- [ ] Trigger import wizard with "import existing orders"
- [ ] Trigger workshop wizard with "set up workshop schedule"
- [ ] Trigger automation wizard with "how do automations work"
- [ ] Navigate between steps with Previous/Next
- [ ] Jump to specific step by clicking pill
- [ ] Close wizard and reopen
- [ ] Click action buttons to navigate to settings
- [ ] Verify progress bar updates correctly
- [ ] Test on mobile/tablet screen sizes
- [ ] Verify z-index ordering (wizard above all)
- [ ] Check completed step indicators turn green

## Architecture Notes

### Why Modal-Based?
- Non-blocking: Users can close and resume later
- Contextual: Shows exactly when needed via AI
- Focused: Full attention on guidance
- Portable: Can be triggered from anywhere

### Why Not In-App Tours?
- Wizards provide comprehensive multi-page guidance
- Better for complex multi-step processes
- Allows explanation before showing UI
- Works even if features aren't enabled yet

### State Management
- Wizard state lives in AISearchBar component
- Completion tracking could move to backend
- Currently session-based (resets on refresh)
- Future: Persist progress in user preferences

## Keyboard Shortcuts

- `Cmd/Ctrl + K` - Open AI search bar
- `Escape` - Close search bar or wizard
- `Tab` - Navigate between steps (when focused)
- `Enter` - Trigger suggested action

## Accessibility

- Proper semantic HTML structure
- ARIA labels for progress indicators
- Keyboard navigable
- Focus management on open/close
- Color contrast meets WCAG AA standards
- Screen reader friendly step descriptions
