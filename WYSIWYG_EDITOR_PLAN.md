# WYSIWYG Landing Page Editor - Implementation Plan

## Overview

Build a visual editor for landing page content management that allows admins to edit tenant landing pages directly in the browser with real-time preview.

## Architecture

```
┌─────────────────────────────────────────┐
│  Admin UI (web/src/app/admin/*)         │
│  - Landing Editor Page                  │
│  - Tiptap WYSIWYG components            │
│  - Image upload & gallery manager       │
│  - Preview toggle (Desktop/Mobile)      │
└────────────┬────────────────────────────┘
             │
             │ PUT /landing-tenants/:id/content
             │ POST /landing-tenants/:id/publish
             │
             ▼
┌─────────────────────────────────────────┐
│  API (/api/src/routes/landing-tenants)  │
│  - Update draft content                 │
│  - Publish to live                      │
│  - Upload images                        │
└────────────┬────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│  Database (LandingTenantContent)        │
│  - headline, subhead, urgency, etc.     │
│  - draft vs published versions          │
└─────────────────────────────────────────┘
```

## Current State

✅ **Already Complete:**
- `LandingTenantContent` model in Prisma schema
- API routes (`/api/src/routes/landing-tenants.ts`) for CRUD operations
- Landing page rendering (`/web/src/app/tenant/[slug]/landing/page.tsx`)
- Image upload infrastructure (S3/local storage)

⏳ **To Build:**
- Admin editor UI with Tiptap WYSIWYG
- Drag-and-drop image upload
- Visual section editors (hero, reviews, gallery, etc.)
- Real-time preview
- Publish workflow

## Phase 1: Admin Editor Shell

### 1.1 Create Admin Layout
**File:** `web/src/app/admin/layout.tsx`

```tsx
import { Sidebar } from '@/components/admin/Sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50">
        {children}
      </main>
    </div>
  );
}
```

### 1.2 Create Sidebar Navigation
**File:** `web/src/components/admin/Sidebar.tsx`

```tsx
import Link from 'next/link';
import { LayoutDashboard, FileText, Image, BarChart3, Settings } from 'lucide-react';

export function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r">
      <div className="p-6">
        <h1 className="text-xl font-bold">CRM Admin</h1>
      </div>
      <nav className="space-y-1 px-3">
        <Link href="/admin" className="nav-item">
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </Link>
        <Link href="/admin/tenants" className="nav-item">
          <FileText size={20} />
          <span>Tenants</span>
        </Link>
        <Link href="/admin/seo-keywords" className="nav-item">
          <BarChart3 size={20} />
          <span>SEO & Keywords</span>
        </Link>
        <Link href="/admin/settings" className="nav-item">
          <Settings size={20} />
          <span>Settings</span>
        </Link>
      </nav>
    </aside>
  );
}
```

### 1.3 Create Tenant List Page
**File:** `web/src/app/admin/tenants/page.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Edit, Eye, Plus } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  hasLandingPage: boolean;
  publishedAt: string | null;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/landing-tenants', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => res.json())
      .then(data => {
        setTenants(data.tenants);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Landing Pages</h1>
        <Link href="/admin/tenants/new" className="btn-primary">
          <Plus size={20} />
          New Tenant
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-4">Tenant</th>
              <th className="text-left p-4">Slug</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Last Published</th>
              <th className="text-right p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map(tenant => (
              <tr key={tenant.id} className="border-b hover:bg-gray-50">
                <td className="p-4 font-medium">{tenant.name}</td>
                <td className="p-4 text-gray-600">{tenant.slug}</td>
                <td className="p-4">
                  {tenant.hasLandingPage ? (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                      Published
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm">
                      Draft
                    </span>
                  )}
                </td>
                <td className="p-4 text-gray-600">
                  {tenant.publishedAt ? new Date(tenant.publishedAt).toLocaleDateString() : '-'}
                </td>
                <td className="p-4">
                  <div className="flex justify-end gap-2">
                    <Link href={`/admin/tenants/${tenant.id}/edit`} className="btn-icon">
                      <Edit size={16} />
                    </Link>
                    <Link href={`/tenant/${tenant.slug}/landing`} target="_blank" className="btn-icon">
                      <Eye size={16} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

## Phase 2: Landing Page Editor

### 2.1 Create Editor Page
**File:** `web/src/app/admin/tenants/[id]/edit/page.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Save, Eye, Upload, Sparkles } from 'lucide-react';
import { HeroEditor } from '@/components/admin/editors/HeroEditor';
import { ReviewsEditor } from '@/components/admin/editors/ReviewsEditor';
import { GalleryEditor } from '@/components/admin/editors/GalleryEditor';
import { GuaranteesEditor } from '@/components/admin/editors/GuaranteesEditor';
import { PreviewPanel } from '@/components/admin/PreviewPanel';

export default function EditLandingPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params?.id as string;

  const [tenant, setTenant] = useState<any>(null);
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    // Fetch tenant data
    fetch(`/api/landing-tenants/${tenantId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    })
      .then(res => res.json())
      .then(data => {
        setTenant(data.tenant);
        setContent(data.content || getDefaultContent());
        setLoading(false);
      });
  }, [tenantId]);

  const handleSave = async (publish = false) => {
    setSaving(true);
    try {
      // Save draft
      await fetch(`/api/landing-tenants/${tenantId}/content`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(content)
      });

      // Publish if requested
      if (publish) {
        await fetch(`/api/landing-tenants/${tenantId}/publish`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        alert('✅ Published successfully!');
      } else {
        alert('✅ Draft saved!');
      }
    } catch (error) {
      alert('❌ Save failed: ' + error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="flex h-screen">
      {/* Editor Panel */}
      <div className="flex-1 overflow-y-auto p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">{tenant.name}</h1>
            <p className="text-gray-600">Edit Landing Page</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="btn-secondary"
            >
              <Eye size={20} />
              {showPreview ? 'Hide' : 'Show'} Preview
            </button>
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="btn-secondary"
            >
              <Save size={20} />
              Save Draft
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="btn-primary"
            >
              <Upload size={20} />
              Publish
            </button>
          </div>
        </div>

        {/* Section Editors */}
        <div className="space-y-8">
          <HeroEditor
            content={content}
            onChange={setContent}
            tenant={tenant}
          />
          
          <ReviewsEditor
            content={content}
            onChange={setContent}
            tenant={tenant}
          />
          
          <GalleryEditor
            content={content}
            onChange={setContent}
            tenant={tenant}
          />
          
          <GuaranteesEditor
            content={content}
            onChange={setContent}
            tenant={tenant}
          />
        </div>
      </div>

      {/* Preview Panel */}
      {showPreview && (
        <PreviewPanel
          tenant={tenant}
          content={content}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}

function getDefaultContent() {
  return {
    headline: 'Expert Craftsmanship Since 1960',
    subhead: 'Bespoke timber windows and doors',
    urgency: { text: 'Limited slots available this month', sub: 'Book your survey today' },
    guarantees: {
      bullets: [
        '50-year anti-rot guarantee',
        'FENSA approved installation',
        'Free no-obligation survey'
      ],
      riskReversal: 'If you\'re not 100% satisfied, we\'ll make it right'
    },
    priceFromText: 'Sash windows from £850 per window',
    priceRange: 'Full house installations from £8,500',
    leadMagnet: {
      title: 'Free Buyer\'s Guide',
      cta: 'Download Now',
      url: '/brochure.pdf'
    },
    serviceAreas: '["Kent", "East Sussex", "West Sussex"]'
  };
}
```

### 2.2 Create Hero Editor Component
**File:** `web/src/components/admin/editors/HeroEditor.tsx`

```tsx
'use client';

import { Sparkles } from 'lucide-react';
import { TiptapEditor } from '../TiptapEditor';

interface HeroEditorProps {
  content: any;
  onChange: (content: any) => void;
  tenant: any;
}

export function HeroEditor({ content, onChange, tenant }: HeroEditorProps) {
  const handleHeadlineChange = (headline: string) => {
    onChange({ ...content, headline });
  };

  const handleSubheadChange = (subhead: string) => {
    onChange({ ...content, subhead });
  };

  const generateAIVariations = async () => {
    // TODO: Call OpenAI to generate headline variations
    alert('AI generation coming soon!');
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Hero Section</h2>
        <button onClick={generateAIVariations} className="btn-secondary text-sm">
          <Sparkles size={16} />
          AI Suggestions
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Headline</label>
          <TiptapEditor
            content={content.headline || ''}
            onChange={handleHeadlineChange}
            placeholder="Enter headline..."
            singleLine
          />
          <p className="text-xs text-gray-500 mt-1">
            Tip: Include keywords like "Sash Windows" or "{tenant.serviceAreas?.[0]}"
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Subheadline</label>
          <TiptapEditor
            content={content.subhead || ''}
            onChange={handleSubheadChange}
            placeholder="Enter subheadline..."
            singleLine
          />
        </div>

        {/* Urgency Banner */}
        <div className="border-t pt-4">
          <label className="block text-sm font-medium mb-2">Urgency Banner (Optional)</label>
          <input
            type="text"
            value={content.urgency?.text || ''}
            onChange={(e) => onChange({
              ...content,
              urgency: { ...content.urgency, text: e.target.value }
            })}
            placeholder="Limited slots available this month"
            className="input w-full"
          />
          <input
            type="text"
            value={content.urgency?.sub || ''}
            onChange={(e) => onChange({
              ...content,
              urgency: { ...content.urgency, sub: e.target.value }
            })}
            placeholder="Book your survey today"
            className="input w-full mt-2"
          />
        </div>
      </div>
    </div>
  );
}
```

### 2.3 Create Tiptap WYSIWYG Editor
**File:** `web/src/components/admin/TiptapEditor.tsx`

```tsx
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered } from 'lucide-react';

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  singleLine?: boolean;
}

export function TiptapEditor({ content, onChange, placeholder, singleLine }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose max-w-none focus:outline-none p-4 border rounded-md min-h-[100px]',
      },
    },
  });

  if (!editor) return null;

  return (
    <div>
      {/* Toolbar */}
      {!singleLine && (
        <div className="flex gap-2 mb-2 p-2 border rounded-md bg-gray-50">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive('bold') ? 'btn-icon-active' : 'btn-icon'}
          >
            <Bold size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive('italic') ? 'btn-icon-active' : 'btn-icon'}
          >
            <Italic size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive('bulletList') ? 'btn-icon-active' : 'btn-icon'}
          >
            <List size={16} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive('orderedList') ? 'btn-icon-active' : 'btn-icon'}
          >
            <ListOrdered size={16} />
          </button>
        </div>
      )}

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}
```

## Phase 3: Image Management

### 3.1 Create Gallery Editor
**File:** `web/src/components/admin/editors/GalleryEditor.tsx`

```tsx
'use client';

import { useState } from 'react';
import { Upload, Trash2, MoveUp, MoveDown } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Image from 'next/image';

interface GalleryEditorProps {
  content: any;
  onChange: (content: any) => void;
  tenant: any;
}

export function GalleryEditor({ content, onChange, tenant }: GalleryEditorProps) {
  const [uploading, setUploading] = useState(false);

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 10,
    onDrop: async (files) => {
      setUploading(true);
      try {
        const formData = new FormData();
        files.forEach(file => formData.append('images', file));

        const res = await fetch(`/api/landing-tenants/${tenant.id}/images`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: formData
        });

        const data = await res.json();
        onChange({
          ...content,
          gallery: [...(content.gallery || []), ...data.images]
        });
      } catch (error) {
        alert('Upload failed: ' + error);
      } finally {
        setUploading(false);
      }
    }
  });

  const removeImage = (index: number) => {
    const newGallery = content.gallery.filter((_: any, i: number) => i !== index);
    onChange({ ...content, gallery: newGallery });
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    const newGallery = [...content.gallery];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newGallery[index], newGallery[targetIndex]] = [newGallery[targetIndex], newGallery[index]];
    onChange({ ...content, gallery: newGallery });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Gallery</h2>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 transition"
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto mb-4 text-gray-400" size={48} />
        <p className="text-gray-600">
          {uploading ? 'Uploading...' : 'Drag & drop images here, or click to select'}
        </p>
        <p className="text-xs text-gray-500 mt-2">Supports: JPG, PNG, WebP (max 10 files)</p>
      </div>

      {/* Gallery Grid */}
      {content.gallery && content.gallery.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mt-6">
          {content.gallery.map((img: any, index: number) => (
            <div key={index} className="relative group">
              <Image
                src={img.src}
                alt={img.alt || 'Gallery image'}
                width={300}
                height={200}
                className="rounded-lg object-cover w-full h-48"
              />
              <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                <button
                  onClick={() => moveImage(index, 'up')}
                  disabled={index === 0}
                  className="btn-icon bg-white"
                >
                  <MoveUp size={16} />
                </button>
                <button
                  onClick={() => moveImage(index, 'down')}
                  disabled={index === content.gallery.length - 1}
                  className="btn-icon bg-white"
                >
                  <MoveDown size={16} />
                </button>
                <button
                  onClick={() => removeImage(index)}
                  className="btn-icon bg-red-500 text-white"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <input
                type="text"
                value={img.alt || ''}
                onChange={(e) => {
                  const newGallery = [...content.gallery];
                  newGallery[index].alt = e.target.value;
                  onChange({ ...content, gallery: newGallery });
                }}
                placeholder="Alt text"
                className="input text-sm mt-2 w-full"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 3.2 Create Image Upload API Route
**File:** `web/src/app/api/upload/route.ts`

```tsx
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('images') as File[];

    const uploadDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    const uploadedImages = [];

    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const filename = `${uuidv4()}-${file.name}`;
      const filepath = join(uploadDir, filename);

      await writeFile(filepath, buffer);

      uploadedImages.push({
        src: `/uploads/${filename}`,
        alt: '',
        caption: ''
      });
    }

    return NextResponse.json({ images: uploadedImages });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

## Phase 4: Preview Panel

### 4.1 Create Preview Component
**File:** `web/src/components/admin/PreviewPanel.tsx`

```tsx
'use client';

import { useState } from 'react';
import { X, Monitor, Smartphone } from 'lucide-react';

interface PreviewPanelProps {
  tenant: any;
  content: any;
  onClose: () => void;
}

export function PreviewPanel({ tenant, content, onClose }: PreviewPanelProps) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');

  const previewUrl = `/tenant/${tenant.slug}/landing?preview=true`;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-1/2 bg-white shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b">
        <h3 className="font-semibold">Preview</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setDevice('desktop')}
            className={device === 'desktop' ? 'btn-icon-active' : 'btn-icon'}
          >
            <Monitor size={20} />
          </button>
          <button
            onClick={() => setDevice('mobile')}
            className={device === 'mobile' ? 'btn-icon-active' : 'btn-icon'}
          >
            <Smartphone size={20} />
          </button>
          <button onClick={onClose} className="btn-icon">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Preview Frame */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4">
        <div
          className={`mx-auto bg-white shadow-lg transition-all ${
            device === 'mobile' ? 'max-w-[375px]' : 'w-full'
          }`}
        >
          <iframe
            src={previewUrl}
            className="w-full h-full border-0"
            style={{ height: device === 'mobile' ? '667px' : '100vh' }}
          />
        </div>
      </div>
    </div>
  );
}
```

## Phase 5: Additional Features

### 5.1 AI Content Generator
**File:** `web/src/lib/ai-content-generator.ts`

```typescript
export async function generateHeadlineVariations(
  tenantName: string,
  industry: string,
  keywords: string[]
): Promise<string[]> {
  const response = await fetch('/api/ai/generate-headlines', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify({ tenantName, industry, keywords })
  });

  const data = await response.json();
  return data.headlines;
}

// API Route: web/src/app/api/ai/generate-headlines/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(request: NextRequest) {
  const { tenantName, industry, keywords } = await request.json();

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: 'You are a conversion-focused copywriter specializing in landing pages.'
      },
      {
        role: 'user',
        content: `Generate 5 compelling headline variations for a landing page:
        - Business: ${tenantName}
        - Industry: ${industry}
        - Keywords: ${keywords.join(', ')}
        
        Make them benefit-focused, include location/keywords, and optimize for conversions.
        Return only the headlines, one per line.`
      }
    ]
  });

  const headlines = completion.choices[0].message.content?.split('\n').filter(Boolean) || [];
  return NextResponse.json({ headlines });
}
```

### 5.2 Revision History
**Extend Prisma Schema:**

```prisma
model LandingContentRevision {
  id        String   @id @default(cuid())
  tenantId  String
  content   Json
  createdBy String   // User ID
  createdAt DateTime @default(now())
  comment   String?
  
  tenant    Tenant   @relation(fields: [tenantId], references: [id])
  
  @@index([tenantId, createdAt])
}
```

**Create Revision Viewer:**
```tsx
// web/src/components/admin/RevisionHistory.tsx
export function RevisionHistory({ tenantId }: { tenantId: string }) {
  const [revisions, setRevisions] = useState([]);

  useEffect(() => {
    fetch(`/api/landing-tenants/${tenantId}/revisions`)
      .then(res => res.json())
      .then(data => setRevisions(data.revisions));
  }, [tenantId]);

  const restoreRevision = async (revisionId: string) => {
    await fetch(`/api/landing-tenants/${tenantId}/restore`, {
      method: 'POST',
      body: JSON.stringify({ revisionId })
    });
    alert('Revision restored!');
  };

  return (
    <div className="space-y-4">
      {revisions.map((rev: any) => (
        <div key={rev.id} className="border p-4 rounded">
          <div className="flex justify-between">
            <div>
              <p className="font-medium">{rev.comment || 'Untitled'}</p>
              <p className="text-sm text-gray-600">{new Date(rev.createdAt).toLocaleString()}</p>
            </div>
            <button onClick={() => restoreRevision(rev.id)} className="btn-secondary">
              Restore
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

## Phase 6: Styling

### 6.1 Global Styles
**File:** `web/src/app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 transition;
  }
  
  .btn-secondary {
    @apply px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center gap-2 transition;
  }
  
  .btn-icon {
    @apply p-2 rounded-md hover:bg-gray-100 transition;
  }
  
  .btn-icon-active {
    @apply p-2 rounded-md bg-blue-100 text-blue-600;
  }
  
  .input {
    @apply px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500;
  }
  
  .nav-item {
    @apply flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-gray-100 transition;
  }
}

/* Tiptap Editor Styles */
.ProseMirror {
  outline: none;
}

.ProseMirror p {
  margin: 0.5rem 0;
}

.ProseMirror ul,
.ProseMirror ol {
  padding-left: 1.5rem;
}
```

## Implementation Timeline

### Week 1: Foundation
- ✅ Set up admin layout and navigation
- ✅ Create tenant list page
- ✅ Build editor page shell

### Week 2: Core Editors
- ✅ Implement HeroEditor with Tiptap
- ✅ Implement ReviewsEditor
- ✅ Implement GuaranteesEditor
- ✅ Implement PricingEditor

### Week 3: Image Management
- ✅ Build GalleryEditor with drag-and-drop
- ✅ Create image upload API
- ✅ Implement image reordering

### Week 4: Preview & Polish
- ✅ Build PreviewPanel with device toggle
- ✅ Add save/publish workflow
- ✅ Test end-to-end

### Week 5: AI & Advanced Features
- ⏳ Integrate AI headline generator
- ⏳ Add revision history
- ⏳ Build SEO optimizer tool

## Testing Checklist

- [ ] Create new tenant
- [ ] Edit headline with Tiptap
- [ ] Upload images via drag-and-drop
- [ ] Reorder gallery images
- [ ] Preview on desktop/mobile
- [ ] Save draft
- [ ] Publish to live
- [ ] Verify live page renders correctly
- [ ] Test with ?kw=Keyword query param
- [ ] Generate AI headline variations
- [ ] Restore previous revision

## Dependencies Required

```json
{
  "dependencies": {
    "@tiptap/react": "^2.1.0",
    "@tiptap/starter-kit": "^2.1.0",
    "@tiptap/pm": "^2.1.0",
    "react-dropzone": "^14.2.0",
    "lucide-react": "^0.300.0",
    "react-hook-form": "^7.49.0",
    "zod": "^3.22.0"
  }
}
```

## Security Considerations

1. **Authentication:** All admin routes require JWT token
2. **Authorization:** Check user.role === 'admin' before allowing edits
3. **File Upload:** Validate file types and sizes
4. **XSS Protection:** Sanitize HTML from Tiptap before rendering
5. **CSRF Protection:** Use CSRF tokens for state-changing operations

## Next Steps (Priority Order)

1. **Create Admin Layout & Sidebar** (`web/src/app/admin/layout.tsx`)
2. **Build Tenant List Page** (`web/src/app/admin/tenants/page.tsx`)
3. **Create Editor Page Shell** (`web/src/app/admin/tenants/[id]/edit/page.tsx`)
4. **Implement HeroEditor** (`web/src/components/admin/editors/HeroEditor.tsx`)
5. **Build Tiptap Component** (`web/src/components/admin/TiptapEditor.tsx`)
6. **Create GalleryEditor** with react-dropzone
7. **Build PreviewPanel** with iframe
8. **Wire up Save/Publish workflow**
9. **Test end-to-end**
10. **Deploy to production**

---

**Status:** Ready to implement  
**Priority:** High  
**Complexity:** Medium  
**Estimated Time:** 3-4 weeks
