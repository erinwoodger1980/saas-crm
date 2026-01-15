import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Mode = 'generate' | 'check';

type FieldInfo = { name: string; type: string };

type LookupTableInfo = {
  id: string;
  tableName?: string;
  name?: string;
  category?: string;
  columns?: string[];
};

function extractFirstJsonObject(text: string): any | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < 0 || end <= start) return null;
  const candidate = text.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode: Mode = body?.mode;
    const prompt: string = String(body?.prompt || '');
    const formula: string = String(body?.formula || '');
    const availableFields: FieldInfo[] = Array.isArray(body?.availableFields) ? body.availableFields : [];
    const availableLookupTables: LookupTableInfo[] = Array.isArray(body?.availableLookupTables) ? body.availableLookupTables : [];

    if (mode !== 'generate' && mode !== 'check') {
      return NextResponse.json({ ok: false, error: 'mode must be generate|check' }, { status: 400 });
    }

    if (mode === 'generate' && !prompt.trim()) {
      return NextResponse.json({ ok: false, error: 'prompt is required' }, { status: 400 });
    }

    const apiKey = (process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || process.env.OPENAI_APIKEY || '').trim();
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: 'AI service not configured' }, { status: 500 });
    }

    const fields = availableFields
      .map((f) => ({ name: String(f?.name || '').trim(), type: String(f?.type || '').trim() }))
      .filter((f) => f.name)
      .slice(0, 400);

    const lookupTables = availableLookupTables
      .map((t) => ({
        name: String(t?.tableName || t?.name || '').trim(),
        category: t?.category ? String(t.category) : undefined,
        columns: Array.isArray(t?.columns) ? t.columns.map((c) => String(c)).filter(Boolean).slice(0, 100) : [],
      }))
      .filter((t) => t.name)
      .slice(0, 100);

    const systemPrompt = `You help users build and validate spreadsheet formulas for a CRM.

Formula syntax:
- Field reference: \$\{fieldName\}
  Example: \$\{quantity\}
- Functions: SUM(a,b), MULTIPLY(a,b), DIVIDE(a,b), SUBTRACT(a,b), IF(condition, trueValue, falseValue), MAX, MIN, ROUND, CEIL, FLOOR, CONCAT, LENGTH.
- Operators: + - * / = != > < >= <= && ||
- Lookup: LOOKUP("TableName", "colA=\$\{field1\}&colB=\$\{field2\}", "returnCol")
  Multiple match columns are separated with '&'.

You MUST only use provided field names and provided lookup table names/columns. If the user asks for a field that doesn't exist, suggest the closest existing field name.

Return ONLY valid JSON with this shape:
{
  "formula": string,
  "notes": string,
  "issues": string[],
  "suggestedFix": string | null
}

If mode=generate: produce a best-effort formula.
If mode=check: analyze the provided formula, list issues (empty if none), and suggestedFix if you can fix it.`;

    const userPrompt = mode === 'generate'
      ? `Mode: generate\n\nUser request (plain English):\n${prompt}\n\nAvailable fields (name,type):\n${JSON.stringify(fields)}\n\nAvailable lookup tables (name,category,columns):\n${JSON.stringify(lookupTables)}\n\nReturn ONLY JSON.`
      : `Mode: check\n\nFormula to check:\n${formula}\n\nAvailable fields (name,type):\n${JSON.stringify(fields)}\n\nAvailable lookup tables (name,category,columns):\n${JSON.stringify(lookupTables)}\n\nReturn ONLY JSON.`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: mode === 'generate' ? 0.3 : 0.1,
        max_tokens: 900,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      return NextResponse.json({ ok: false, error: 'OpenAI request failed', detail: txt.slice(0, 500) }, { status: 500 });
    }

    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return NextResponse.json({ ok: false, error: 'Empty AI response' }, { status: 500 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = extractFirstJsonObject(String(content));
    }

    if (!parsed || typeof parsed !== 'object') {
      return NextResponse.json({ ok: false, error: 'Invalid AI response format', raw: String(content).slice(0, 500) }, { status: 500 });
    }

    const out = {
      ok: true,
      formula: typeof parsed.formula === 'string' ? parsed.formula : '',
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      issues: Array.isArray(parsed.issues) ? parsed.issues.map((s: any) => String(s)).filter(Boolean).slice(0, 20) : [],
      suggestedFix: typeof parsed.suggestedFix === 'string' ? parsed.suggestedFix : null,
    };

    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Failed to process request' }, { status: 500 });
  }
}
