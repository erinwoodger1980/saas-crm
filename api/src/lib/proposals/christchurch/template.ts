import type { Quote, QuoteLine, TenantSettings } from "@prisma/client";

import { CHRISTCHURCH_ASSETS } from "./assets";

type QuoteWithLines = Quote & {
  lines: QuoteLine[];
  lead?: { contactName?: string | null; email?: string | null; custom?: any } | null;
  tenant?: { brandName?: string | null; name?: string | null } | null;
};

export function buildChristchurchProposalHtml(opts: {
  quote: QuoteWithLines;
  tenantSettings?: TenantSettings | null;
  currencyCode: string;
  currencySymbol: string;
  totals: { subtotal: number; vatAmount: number; totalGBP: number; vatRate: number; showVat: boolean };
  logoDataUrl?: string;
  imageUrls?: {
    logoMark?: string;
    logoWide?: string;
    coverHero?: string;
    sidebarPhoto?: string;
    badge1?: string; // Accoya
    badge2?: string; // PAS24 (legacy)
    fensa?: string;
    pas24?: string;
    fsc?: string;
    ggf?: string;
  };
  aiSummary?: {
    timber?: string;
    finish?: string;
    glazing?: string;
    fittings?: string;
    ventilation?: string;
    scopeHtml?: string;
  };
  scopeHtml?: string;
}): string {
  const { quote, tenantSettings: ts, currencySymbol: sym } = opts;
  const quoteDefaults: any = (ts?.quoteDefaults as any) || {};

  const TRANSPARENT_GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

  const img = {
    logoMark: String(opts.imageUrls?.logoMark || opts.logoDataUrl || CHRISTCHURCH_ASSETS.logoMark),
    logoWide: String(opts.imageUrls?.logoWide || CHRISTCHURCH_ASSETS.logoWide),
    coverHero: String(opts.imageUrls?.coverHero || ""),
    sidebarPhoto: String(opts.imageUrls?.sidebarPhoto || CHRISTCHURCH_ASSETS.sidebarPhoto),
    badge1: String(opts.imageUrls?.badge1 || CHRISTCHURCH_ASSETS.badge1),
    badge2: String(opts.imageUrls?.badge2 || CHRISTCHURCH_ASSETS.badge2),
    fensa: String(opts.imageUrls?.fensa || TRANSPARENT_GIF),
    pas24: String(opts.imageUrls?.pas24 || opts.imageUrls?.badge2 || CHRISTCHURCH_ASSETS.badge2),
    fsc: String(opts.imageUrls?.fsc || TRANSPARENT_GIF),
    ggf: String(opts.imageUrls?.ggf || TRANSPARENT_GIF),
  };

  const brand = (ts?.brandName || quote.tenant?.brandName || "Wealden Joinery Ltd").toString();
  const tagline = (quoteDefaults?.tagline || "Timber Joinery Specialists • Established 1994").toString();

  const client = quote.lead?.contactName || quote.lead?.email || "Client";
  const projectName = quote.title || `Project for ${client}`;

  const leadCustom: any = (quote.lead?.custom as any) || {};
  const ref = `Q-${quote.id.slice(0, 8).toUpperCase()}`;
  const jobNumber = (leadCustom?.refId as string) || ref;
  const projectReference = typeof leadCustom?.projectReference === "string" ? String(leadCustom.projectReference).trim() : "";
  const surveyTeam = typeof leadCustom?.surveyTeam === "string" ? String(leadCustom.surveyTeam).trim() : "";
  const DEFAULT_COMPLIANCE_NOTE = "PAS 24 / Part Q: Glazing to GGF guidelines.";
  const deliveryAddress = (leadCustom?.deliveryAddress as string) || (leadCustom?.address as string) || "";

  const today = new Date();
  const when = formatDateGB(today);
  const validDays = Number(quoteDefaults?.validDays ?? 14);
  const validUntil = formatDateGB(new Date(today.getTime() + Math.max(0, validDays) * 86400000));

  const specifications = ((quote.meta as any) || {})?.specifications || {};
  const fallbackTimber = (specifications.timber || quoteDefaults?.defaultTimber || "Engineered Redwood").toString();
  const fallbackFinish = (specifications.finish || quoteDefaults?.defaultFinish || "RAL 9016 White (painted)").toString();
  const fallbackGlazing = (specifications.glazing || quoteDefaults?.defaultGlazing || "Low-energy double glazing (Ug 1.1–1.2)").toString();
  const fallbackFittings = (specifications.fittings || quoteDefaults?.defaultFittings || "Polished chrome heritage fittings").toString();
  const fallbackVentilation = (specifications.ventilation || "Trickle vents").toString();
  const compliance = (
    (typeof leadCustom?.compliance === "string" && String(leadCustom.compliance).trim())
      ? String(leadCustom.compliance).trim()
      : (specifications.compliance || quoteDefaults?.compliance || DEFAULT_COMPLIANCE_NOTE)
  ).toString();

  const toNonEmptyStr = (v: any): string => {
    if (v == null) return "";
    if (typeof v === "string") return v.trim();
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    return "";
  };

  const collectLineMetaValues = (keys: string[]): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const ln of quote.lines || []) {
      const metaAny: any = (ln?.meta as any) || {};
      for (const k of keys) {
        const raw = metaAny?.[k];
        if (Array.isArray(raw)) {
          for (const item of raw) {
            const s = toNonEmptyStr(item);
            const norm = s.toLowerCase();
            if (s && !seen.has(norm)) {
              seen.add(norm);
              out.push(s);
            }
          }
          continue;
        }
        const s = toNonEmptyStr(raw);
        const norm = s.toLowerCase();
        if (s && !seen.has(norm)) {
          seen.add(norm);
          out.push(s);
        }
      }
    }
    return out;
  };

  const timberValues = collectLineMetaValues(["wood", "timber", "timberSpecies", "material"]).slice(0, 3);
  const finishValues = collectLineMetaValues(["finish", "paintFinish", "colour", "color"]).slice(0, 3);
  const glazingValues = collectLineMetaValues(["glass", "glazing"]).slice(0, 3);
  const fittingsValues = collectLineMetaValues(["fittings", "hardware", "ironmongery"]).slice(0, 4);
  const ventilationValues = collectLineMetaValues(["ventilation", "vents", "trickleVent"]).slice(0, 3);

  const timber =
    (typeof opts.aiSummary?.timber === "string" && opts.aiSummary.timber.trim())
      ? opts.aiSummary.timber.trim()
      : (timberValues.length ? timberValues.join(" / ") : fallbackTimber);
  const finish =
    (typeof opts.aiSummary?.finish === "string" && opts.aiSummary.finish.trim())
      ? opts.aiSummary.finish.trim()
      : (finishValues.length ? finishValues.join(" / ") : fallbackFinish);
  const glazing =
    (typeof opts.aiSummary?.glazing === "string" && opts.aiSummary.glazing.trim())
      ? opts.aiSummary.glazing.trim()
      : (glazingValues.length ? glazingValues.join(" / ") : fallbackGlazing);
  const fittings =
    (typeof opts.aiSummary?.fittings === "string" && opts.aiSummary.fittings.trim())
      ? opts.aiSummary.fittings.trim()
      : (fittingsValues.length ? fittingsValues.join(", ") : fallbackFittings);
  const ventilation =
    (typeof opts.aiSummary?.ventilation === "string" && opts.aiSummary.ventilation.trim())
      ? opts.aiSummary.ventilation.trim()
      : (ventilationValues.length ? ventilationValues.join(" / ") : fallbackVentilation);

  const scopeHtml =
    (typeof opts.aiSummary?.scopeHtml === "string" && opts.aiSummary.scopeHtml.trim())
      ? opts.aiSummary.scopeHtml.trim()
      : (String(opts.scopeHtml || "").trim() || `<p>${escapeHtml(
          ((quote.meta as any) || {})?.scopeDescription ||
            `Supply of bespoke timber joinery manufactured to specification, factory finished, glazed, and supplied with appropriate ironmongery and ventilation.`,
        )}</p>`);

  // For Christchurch we want delivery broken out explicitly (matches the reference PDF).
  const deliveryExVat = safeMoney(quote.deliveryCost);
  const subtotalExVat = safeMoney(opts.totals.subtotal);
  const totalExVat = subtotalExVat + deliveryExVat;
  const vatRate = Number.isFinite(Number(opts.totals.vatRate)) ? Number(opts.totals.vatRate) : 0.2;
  const showVat = opts.totals.showVat !== false;
  const vatAmount = showVat ? totalExVat * vatRate : 0;
  const grandTotal = totalExVat + vatAmount;

  const parts = chunkLines(quote.lines, 8);
  const totalParts = Math.max(1, parts.length);

  const styles = `
    <style>
      @page { size: A4 portrait; margin: 18mm 16mm; }
      html, body { margin: 0; padding: 0; background: #ffffff; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; color: #0f172a; }

      .page { page-break-after: always; }
      .page:last-child { page-break-after: auto; }

      /* Ensure the on-screen preview renders as A4 portrait too */
      .page {
        width: 210mm;
        height: 297mm;
        box-sizing: border-box;
        padding: 18mm 16mm;
        background: #ffffff;
        overflow: hidden;
        position: relative;
      }

      .page.page-bleed { padding: 0; }

      .header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        border-bottom: 1px solid #e2e8f0;
        padding-bottom: 8mm;
        margin-bottom: 6mm;
      }

      .brand {
        display: flex;
        gap: 10mm;
        align-items: flex-start;
      }

      .brand h1 { margin: 0; font-size: 16pt; letter-spacing: 0.2px; }
      .brand .tagline { margin-top: 2mm; font-size: 9.5pt; color: #475569; }

      .contact {
        text-align: right;
        font-size: 9.5pt;
        color: #334155;
        line-height: 1.4;
      }

      .titleBlock { margin: 6mm 0 4mm 0; text-align: center; }
      .titleBlock .title { font-size: 18pt; font-weight: 700; margin: 0; }
      .titleBlock .sub { margin-top: 2mm; font-size: 10.5pt; color: #334155; }

      /* Updated cover page (more visual) */
      .coverHero { width: 100%; height: 76mm; overflow: hidden; }
      .coverHero img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .coverLogo { display:flex; justify-content:center; align-items:center; margin: 10mm 0 4mm 0; }
      .coverLogo img { max-height: 24mm; width: auto; display: block; }
      .coverBrandName { text-align:center; font-weight: 800; margin-top: 1mm; font-size: 10.5pt; color: #92400e; }
      .coverTagline { text-align:center; margin-top: 1mm; font-size: 9.8pt; color: #334155; }
      .coverTitle { text-align:center; font-size: 21pt; font-weight: 900; margin: 10mm 0 0 0; }
      .coverMeta { text-align:center; margin-top: 4mm; font-size: 10.5pt; color: #334155; }
      .coverFooter { position: absolute; left: 16mm; right: 16mm; bottom: 18mm; text-align: center; font-size: 9.8pt; color: #334155; line-height: 1.55; }

      /* Overview page (page 2) */
      .overviewBleed { width: 210mm; height: 297mm; display: grid; grid-template-columns: 78mm 1fr; }
      .overviewBleed .photo { width: 100%; height: 100%; object-fit: cover; display: block; }
      .overviewBleed .content { padding: 18mm 16mm; box-sizing: border-box; }
      .ovTitle { font-size: 18pt; font-weight: 900; color: #1e3a8a; margin: 0 0 8mm 0; }
      .ovGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; }
      .ovSubTitle { font-size: 12.5pt; font-weight: 900; color: #1e3a8a; margin: 0 0 4mm 0; }
      .ovBlock { margin-bottom: 8mm; }
      .ovScope { margin-top: 6mm; }
      .ovScope p { margin: 0; }

      .overviewWrap { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }

      .panel { border: 1px solid #e2e8f0; border-radius: 6px; padding: 5mm; }
      .panel h3 { margin: 0 0 3mm 0; font-size: 11pt; border-bottom: 1px solid #e2e8f0; padding-bottom: 2mm; }

      .kv { font-size: 9.8pt; line-height: 1.45; }
      .kv .row { display: grid; grid-template-columns: 40mm 1fr; gap: 4mm; margin: 1.5mm 0; }
      .kv .k { color: #475569; }
      .kv .v { color: #0f172a; }

      .highlights ul { margin: 0; padding-left: 16px; }
      .highlights li { margin: 1.2mm 0; }

      .scope { margin-top: 6mm; }
      .scope h3 { margin: 0 0 3mm 0; font-size: 11pt; }
      .scope .body { font-size: 10pt; line-height: 1.6; color: #0f172a; }

      .note { margin-top: 2.5mm; font-size: 9.6pt; color: #334155; }

      .detailHeader { margin-top: 6mm; text-align: center; }
      .detailHeader .h { font-size: 12pt; font-weight: 700; margin: 0; }
      .detailHeader .p { margin: 2mm auto 0 auto; max-width: 160mm; font-size: 9.8pt; color: #334155; line-height: 1.5; }

      table { width: 100%; border-collapse: collapse; margin-top: 3mm; }
      thead th {
        font-size: 9pt;
        text-transform: none;
        text-align: left;
        color: #334155;
        border-bottom: 1px solid #cbd5e1;
        padding: 2mm 2mm;
      }
      tbody td {
        font-size: 9.6pt;
        border-bottom: 1px solid #e2e8f0;
        padding: 2mm 2mm;
        vertical-align: top;
      }
      .col-ref { width: 18mm; }
      .col-qty { width: 20mm; text-align: right; }
      .col-unit { width: 30mm; text-align: right; }
      .col-total { width: 34mm; text-align: right; }
      .desc { white-space: pre-line; }

      .totals { margin-top: 6mm; width: 80mm; margin-left: auto; font-size: 10pt; }
      .totals .r { display: flex; justify-content: space-between; gap: 6mm; padding: 1.2mm 0; }
      .totals .label { color: #334155; }
      .totals .val { font-weight: 600; }
      .totals .grand { border-top: 1px solid #cbd5e1; margin-top: 2mm; padding-top: 2mm; }

      .h2 { font-size: 14pt; font-weight: 800; margin: 0 0 4mm 0; text-align: center; color: #1e3a8a; }
      .para { font-size: 10pt; line-height: 1.6; color: #0f172a; }

      .triple { margin-top: 3mm; }
      .tripleGrid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6mm; margin-top: 4mm; }
      .card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 4mm; background: #f8fafc; }
      .card h4 { margin: 0 0 2mm 0; font-size: 10.5pt; color: #1e3a8a; }
      .card p { margin: 0; font-size: 9.6pt; line-height: 1.55; color: #334155; }

      .warranty { margin-top: 6mm; }
      .wGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm 10mm; margin-top: 3mm; }
      .wItem { font-size: 10pt; }
      .wItem strong { font-weight: 800; }
      .smallNote { margin-top: 2mm; font-size: 9pt; color: #64748b; text-align: center; }

      .aboutGrid { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 10mm; }
      .quote { border-left: 3px solid #e2e8f0; padding-left: 4mm; margin: 0 0 6mm 0; }
      .quote p { margin: 0; font-size: 9.8pt; line-height: 1.6; color: #0f172a; }
      .quote .by { margin-top: 2mm; font-size: 9pt; color: #475569; }

      .accoya { margin-top: 2mm; }
      .accoyaHead { text-align: center; margin-bottom: 3mm; }
      .accoyaHead img { max-height: 18mm; }
      .advGrid { display: grid; grid-template-columns: 1fr; gap: 4mm; }
      .adv { border: 1px solid #e2e8f0; border-radius: 6px; padding: 4mm; background: #f8fafc; }
      .adv h4 { margin: 0 0 1.5mm 0; font-size: 10.5pt; color: #1e3a8a; }
      .adv p { margin: 0; font-size: 9.6pt; line-height: 1.55; color: #334155; }

      .certGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm 8mm; margin-top: 6mm; }
      .cert { display: flex; gap: 4mm; align-items: flex-start; border: 1px solid #e2e8f0; border-radius: 6px; padding: 3mm; background: #f8fafc; }
      .cert img { width: 22mm; height: auto; border-radius: 4px; background: #ffffff; border: 1px solid #e2e8f0; }
      .cert h4 { margin: 0; font-size: 10.5pt; color: #1e3a8a; }
      .cert p { margin: 1mm 0 0 0; font-size: 9.3pt; line-height: 1.5; color: #334155; }

      .termsGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm 10mm; }
      .termCard { border: 1px solid #e2e8f0; border-radius: 6px; padding: 4mm; background: #f8fafc; }
      .termTop { display: flex; gap: 3mm; align-items: baseline; margin-bottom: 2mm; }
      .termNum { font-weight: 900; font-size: 12pt; color: #1e3a8a; }
      .termTitle { font-weight: 800; font-size: 10.5pt; }
      .termBody { font-size: 9.6pt; line-height: 1.55; color: #334155; }

      .contactGrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10mm; margin-top: 6mm; }
      .contactGrid h4 { margin: 0 0 2mm 0; font-size: 10.5pt; }
      .contactGrid .box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 4mm; }
      .contactGrid p { margin: 0; font-size: 9.6pt; line-height: 1.55; color: #334155; }

      .sidebarPhoto { width: 40mm; height: 150mm; object-fit: cover; border-radius: 6px; border: 1px solid #e2e8f0; }
      .overviewWithPhoto { display: grid; grid-template-columns: 1fr 44mm; gap: 8mm; align-items: start; }
    </style>
  `;

  const phone = (ts?.phone || quoteDefaults?.phone || "").toString();
  const email = (quoteDefaults?.email || "").toString();
  const address = (quoteDefaults?.address || "").toString();

  const displayProjectRef = projectReference || projectName || jobNumber;

  const coverPage = `
    <div class="page">
      <div class="coverHero">
        <img src="${img.coverHero || img.logoWide || img.sidebarPhoto}" alt="Project" />
      </div>

      <div class="coverLogo">
        <img src="${img.logoMark}" alt="${escapeHtml(brand)}" />
      </div>
      <div class="coverBrandName">${escapeHtml(brand)}</div>
      <div class="coverTagline">${escapeHtml(tagline)}</div>

      <p class="coverTitle">Project Quotation – ${escapeHtml(displayProjectRef)}</p>
      <div class="coverMeta">Client: ${escapeHtml(client)} • ${escapeHtml(when)}</div>

      <div class="coverFooter">
        ${phone ? `Telephone: ${escapeHtml(phone)}<br/>` : ""}
        ${email ? `Email: ${escapeHtml(email)}<br/>` : ""}
        ${address ? `Address: ${escapeHtml(address)}` : ""}
      </div>
    </div>
  `;

  const overviewPage = `
    <div class="page page-bleed">
      <div class="overviewBleed">
        <img src="${img.sidebarPhoto}" alt="Project" class="photo" />
        <div class="content">
          <h2 class="ovTitle">Project Overview</h2>

          <div class="ovGrid">
            <div class="ovBlock">
              <img src="${img.fensa}" alt="FENSA" />
              <div class="kv">
                <h4>FENSA Approved Installer</h4>
                ${kvRow("Project", displayProjectRef)}
                ${kvRow("Job Number", jobNumber)}
                ${deliveryAddress ? kvRow("Delivery Address", deliveryAddress) : ""}
                ${surveyTeam ? kvRow("Survey Team", surveyTeam) : ""}
                ${kvRow("Date", when)}
              <img src="${img.pas24}" alt="PAS 24" />
            </div>

            <div class="ovBlock">
              <h3 class="ovSubTitle">Specification Highlights</h3>
              <div class="kv highlights">
                <ul>
                  <li><strong>Timber:</strong> ${escapeHtml(timber)}</li>
              <img src="${img.fsc}" alt="FSC" />
                  <li><strong>Glazing:</strong> ${escapeHtml(glazing)}</li>
                  <li><strong>Hardware/Fittings:</strong> ${escapeHtml(fittings)}</li>
                  <li><strong>Ventilation:</strong> ${escapeHtml(ventilation)}</li>
                </ul>
              </div>
            </div>
          </div>
              <img src="${img.ggf}" alt="GGF" />
          <div class="ovScope">
            <h3 class="ovSubTitle">Project Scope</h3>
            <div class="para">${scopeHtml}</div>
            <div class="note" style="margin-top: 4mm;"><strong>Compliance Note:</strong> ${escapeHtml(compliance)}</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const quotationPages = parts.map((chunk, partIndex) => {
    return `
      <div class="page">
        <div class="header">
          <div class="brand">
            <div>
              <h1>${escapeHtml(brand)}</h1>
              <div class="tagline">${escapeHtml(tagline)}</div>
            </div>
          </div>
          <div class="contact">
            ${phone ? `Telephone: ${escapeHtml(phone)}<br/>` : ""}
            ${email ? `Email: ${escapeHtml(email)}<br/>` : ""}
            ${address ? `Address: ${escapeHtml(address)}` : ""}
          </div>
        </div>

        ${renderQuotationPart({
          partIndex,
          totalParts,
          lines: chunk,
          includeIntro: partIndex === 0,
          currencySymbol: sym,
        })}
      </div>
    `;
  });

  const totalsPage = `
    <div class="page">
      <div class="header">
        <div class="brand">
          <div>
            <h1>${escapeHtml(brand)}</h1>
            <div class="tagline">${escapeHtml(tagline)}</div>
          </div>
        </div>
        <div class="contact">
          ${phone ? `Telephone: ${escapeHtml(phone)}<br/>` : ""}
          ${email ? `Email: ${escapeHtml(email)}<br/>` : ""}
          ${address ? `Address: ${escapeHtml(address)}` : ""}
        </div>
      </div>

      <div class="h2" style="margin-top: 6mm;">Total Project Investment</div>
      <div class="para" style="text-align:center;">Summary of the proposed investment for the project.</div>
      ${renderTotals({
        currencySymbol: sym,
        subtotalExVat,
        deliveryExVat,
        vatAmount,
        vatRate,
        grandTotal,
        showVat,
      })}
    </div>
  `;

  const guaranteeAndTestimonialsPage = `
    <div class="page">
      <div class="header">
        <div class="brand">
          <div>
            <h1>${escapeHtml(brand)}</h1>
            <div class="tagline">${escapeHtml(tagline)}</div>
          </div>
        </div>
        <div class="contact">
          ${phone ? `Telephone: ${escapeHtml(phone)}<br/>` : ""}
          ${email ? `Email: ${escapeHtml(email)}<br/>` : ""}
          ${address ? `Address: ${escapeHtml(address)}` : ""}
        </div>
      </div>

      <div class="h2">Wealden Joinery Triple Guarantee</div>
      <div class="para">
        When you choose Wealden Joinery for your timber windows and doors, you receive more than exceptional craftsmanship. You gain complete peace of mind.
        Every order is backed by our comprehensive Triple Guarantee, ensuring a seamless and reliable experience from start to finish:
      </div>

      <div class="triple">
        <div class="tripleGrid">
          <div class="card">
            <h4>Delivered when we say we will.</h4>
            <p>We commit to delivering your order to your site when we say we will. Our meticulous production planning ensures your project remains on schedule, free from costly delays.</p>
          </div>
          <div class="card">
            <h4>No hidden extras</h4>
            <p>The price presented in your quotation is the final price you pay. All costs are transparently agreed upon upfront, eliminating surprise charges or unexpected add-ons.</p>
          </div>
          <div class="card">
            <h4>Always to scope and meeting regulations</h4>
            <p>Each unit is meticulously crafted to your agreed specification and fully compliant with PAS 24, Part Q, and all relevant Building Regulations. You can be confident your joinery is safe, secure, and perfectly fit for purpose.</p>
          </div>
        </div>
      </div>

      <div class="para" style="margin-top:4mm; text-align:center;">
        This Triple Guarantee collectively ensures your project is delivered on time, within budget, and built to the highest standards of quality and compliance.
      </div>

      <div class="warranty">
        <div class="h2" style="font-size: 12.5pt;">Comprehensive Warranty Coverage</div>
        <div class="para" style="text-align:center;">Our commitment to quality extends far beyond delivery, with robust warranties designed to protect your investment for years to come:</div>
        <div class="wGrid">
          <div class="wItem"><strong>10 years</strong> on manufacturing defects</div>
          <div class="wItem"><strong>30 years</strong> on timber rot and decay</div>
          <div class="wItem"><strong>10 years</strong> on paint finish</div>
          <div class="wItem"><strong>5 years</strong> on hardware</div>
        </div>
        <div class="smallNote">Conditions apply. Full warranty details are available upon request.</div>
      </div>

      <div style="margin-top: 8mm;">
        <div class="h2" style="font-size: 12.5pt;">About Wealden Joinery & Client Testimonials</div>

        <div class="aboutGrid">
          <div class="para">
            Wealden Joinery is a leading specialist in bespoke timber windows and doors, renowned for our unwavering commitment to traditional craftsmanship, innovative design, and exceptional customer service.
            With over 30 years of experience, we pride ourselves on creating high-quality, durable joinery solutions that enhance the beauty and integrity of every property we work on, from historical renovations to modern constructions.
          </div>

          <div>
            <div class="quote">
              <p>“I have been using Wealden Joinery since we started in 2007. The quality has always been high and the joinery has always been on time – even on the tightest deadlines.”</p>
              <div class="by">– Tony Palmer, Harlequin Building Company, East Sussex</div>
            </div>

            <div class="quote">
              <p>“I have already recommended Wealden Joinery to other people.”</p>
              <div class="by">– Amy Whapham, Burwash</div>
            </div>

            <div class="quote" style="margin-bottom:0;">
              <p>“We have been using Wealden Joinery since 1995. They have worked on most of the estate properties in Sussex and our London residence… the work has been carried out very well, on time and on budget. We will continue to use Wealden Joinery and would recommend them without hesitation.”</p>
              <div class="by">– Michael Bates, Estate Manager, Mayfield</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const excellencePage = `
    <div class="page">
      <div class="header">
        <div class="brand">
          <div>
            <h1>${escapeHtml(brand)}</h1>
            <div class="tagline">${escapeHtml(tagline)}</div>
          </div>
        </div>
        <div class="contact">
          ${phone ? `Telephone: ${escapeHtml(phone)}<br/>` : ""}
          ${email ? `Email: ${escapeHtml(email)}<br/>` : ""}
          ${address ? `Address: ${escapeHtml(address)}` : ""}
        </div>
      </div>

      <div class="h2">Unparalleled Quality & Certified Excellence</div>
      <div class="para">
        Wealden Joinery proudly uses Accoya wood, renowned for its superior durability, stability, and sustainability.
        This commitment to high-performance timber joinery is matched by rigorous certifications and industry accreditations, ensuring every product meets the highest standards of performance, security, and environmental responsibility.
      </div>

      <div class="accoya">
        <div class="accoyaHead">
          <img src="${img.badge1}" alt="Accoya" />
        </div>

        <div class="advGrid">
          <div class="adv">
            <h4>Unrivaled Durability & Stability</h4>
            <p>Accoya’s superior resistance to rot, insects, and dimensional changes ensures decades of beautiful performance, even in challenging environments.</p>
          </div>
          <div class="adv">
            <h4>Long-Term Value & Low Maintenance</h4>
            <p>A smart investment offering significant long-term value with minimal upkeep, guaranteeing lasting beauty and performance.</p>
          </div>
          <div class="adv">
            <h4>Sustainability & Positive Environmental Impact</h4>
            <p>Responsibly sourced and boasting an extended lifespan, Accoya is a truly sustainable choice.</p>
          </div>
        </div>

        <div class="certGrid">
          <div class="cert">
            <img src="${img.badge2}" alt="Certification" />
            <div>
              <h4>FENSA Certified</h4>
              <p>Ensuring compliance with all building regulations for replacement windows and doors, focusing on energy efficiency and structural integrity.</p>
            </div>
          </div>
          <div class="cert">
            <img src="${img.badge2}" alt="Certification" />
            <div>
              <h4>PAS 24 Security Compliance</h4>
              <p>Meeting police-preferred standards for enhanced security performance, providing robust protection for your property.</p>
            </div>
          </div>
          <div class="cert">
            <img src="${img.badge2}" alt="Certification" />
            <div>
              <h4>FSC Chain of Custody</h4>
              <p>Verification of sustainable timber sourcing, demonstrating our commitment to environmental responsibility and ethical practices.</p>
            </div>
          </div>
          <div class="cert">
            <img src="${img.badge2}" alt="Certification" />
            <div>
              <h4>Glass & Glazing Federation (GGF)</h4>
              <p>Adherence to industry best practices and professional standards for glazing, guaranteeing superior product quality and installation.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const termsAndContactPage = `
    <div class="page">
      <div class="header">
        <div class="brand">
          <div>
            <h1>${escapeHtml(brand)}</h1>
            <div class="tagline">${escapeHtml(tagline)}</div>
          </div>
        </div>
        <div class="contact">
          ${phone ? `Telephone: ${escapeHtml(phone)}<br/>` : ""}
          ${email ? `Email: ${escapeHtml(email)}<br/>` : ""}
          ${address ? `Address: ${escapeHtml(address)}` : ""}
        </div>
      </div>

      <div class="h2">Terms & Conditions</div>

      <div class="termsGrid">
        ${termCard(1, "Quotation Validity", `This comprehensive quotation remains valid for ${validDays} days from ${escapeHtml(when)}. This ensures you have adequate time to review the proposal, while protecting against material cost fluctuations in the current market environment.`)}
        ${termCard(2, "Payment Structure", `A 50% deposit is required with confirmed order + drawings. The balance is due before delivery.`)}
        ${termCard(3, "Delivery Location", `Delivery will be made to ${escapeHtml(pickPropertyName(projectName, leadCustom) || projectName)} at a cost of ${sym}${formatMoney(deliveryExVat)} + VAT.`)}
        ${termCard(4, "Delivery Schedule", `Delivery will be a single batch delivery for all items ordered.`)}
        ${termCard(5, "Installation Requirements", `Delivery and installation are contingent upon clear vehicular access to the property and adequate working space around window openings. Site conditions will be confirmed during our pre-installation survey.`)}
        ${termCard(6, "Standard Conditions", `All work is undertaken according to Wealden Joinery’s standard terms and conditions of sale. Copies are available upon request and will be provided with your order confirmation documentation.`)}
      </div>

      <div style="margin-top: 8mm;">
        <div class="h2" style="font-size: 12.5pt;">Contact Information</div>
        <div class="contactGrid">
          <div class="box">
            <h4>General Inquiries</h4>
            <p>${escapeHtml(brand)}<br/>
              ${escapeHtml(address || "")}${address ? "<br/>" : ""}
              ${phone ? `Phone: ${escapeHtml(phone)}<br/>` : ""}
              ${email ? `Email: ${escapeHtml(email)}` : ""}
            </p>
          </div>
          <div class="box">
            <h4>Business Hours</h4>
            <p>Monday – Friday: 9:00 AM – 5:00 PM<br/>
               Saturday – Sunday: Closed</p>
          </div>
        </div>
      </div>
    </div>
  `;

  const html = `<!doctype html>
  <html>
    <head><meta charset="utf-8" />${styles}</head>
    <body>
      ${coverPage}
      ${overviewPage}
      ${quotationPages.join("\n")}
      ${totalsPage}
      ${guaranteeAndTestimonialsPage}
      ${excellencePage}
      ${termsAndContactPage}
    </body>
  </html>`;

  return html;
}

function renderQuotationPart(opts: {
  partIndex: number;
  totalParts: number;
  lines: QuoteLine[];
  includeIntro: boolean;
  currencySymbol: string;
}): string {
  const { partIndex, totalParts, lines, includeIntro, currencySymbol: sym } = opts;
  const partNum = partIndex + 1;

  const intro = includeIntro
    ? `<div class="detailHeader">
        <p class="h">Detailed Quotation (Part ${partNum} of ${totalParts})</p>
        <p class="p">Following the technical specifications outlined previously, this section provides a comprehensive breakdown of the proposed investment for your project. The quotation details each component, quantity, and dimensions, culminating in the total project cost.</p>
      </div>`
    : `<div class="detailHeader">
        <p class="h">Detailed Quotation (Part ${partNum} of ${totalParts})</p>
      </div>`;

  const rows = (lines || []).map((ln, idx) => {
    const qty = Math.max(1, Number(ln.qty || 1));
    const metaAny: any = (ln.meta as any) || {};
    const ref = `L${partIndex * 8 + idx + 1}`;

    const unit = pickUnitSell(ln, metaAny);
    const total = pickLineSellTotal(ln, metaAny, qty);

    const desc = buildLineDescription(ln, metaAny);

    return `<tr>
      <td class="col-ref">${escapeHtml(ref)}</td>
      <td class="desc">${escapeHtml(desc)}</td>
      <td class="col-qty">${qty}</td>
      <td class="col-unit">${sym}${formatMoney(unit)}</td>
      <td class="col-total">${sym}${formatMoney(total)}</td>
    </tr>`;
  }).join("\n");

  return `
    ${intro}
    <table>
      <thead>
        <tr>
          <th class="col-ref">Reference</th>
          <th>Description</th>
          <th class="col-qty">Quantity</th>
          <th class="col-unit">Unit Price (Ex VAT)</th>
          <th class="col-total">Line Total (Ex VAT)</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function renderTotals(opts: {
  currencySymbol: string;
  subtotalExVat: number;
  deliveryExVat: number;
  vatAmount: number;
  vatRate: number;
  grandTotal: number;
  showVat: boolean;
}): string {
  const { currencySymbol: sym, subtotalExVat, deliveryExVat, vatAmount, vatRate, grandTotal, showVat } = opts;
  const totalExVat = subtotalExVat + deliveryExVat;

  return `
    <div class="totals">
      <div class="r"><div class="label">Subtotal (ex VAT):</div><div class="val">${sym}${formatMoney(subtotalExVat)}</div></div>
      <div class="r"><div class="label">Delivery (ex VAT):</div><div class="val">${sym}${formatMoney(deliveryExVat)}</div></div>
      <div class="r"><div class="label">Total ex VAT:</div><div class="val">${sym}${formatMoney(totalExVat)}</div></div>
      ${showVat ? `<div class="r"><div class="label">VAT (${Math.round(vatRate * 100)}%):</div><div class="val">${sym}${formatMoney(vatAmount)}</div></div>` : ""}
      <div class="r grand"><div class="label">Grand Total (inc VAT):</div><div class="val">${sym}${formatMoney(grandTotal)}</div></div>
    </div>
  `;
}

function termCard(num: number, title: string, body: string): string {
  return `
    <div class="termCard">
      <div class="termTop">
        <div class="termNum">${num}</div>
        <div class="termTitle">${escapeHtml(title)}</div>
      </div>
      <div class="termBody">${escapeHtml(body)}</div>
    </div>
  `;
}

function kvRow(label: string, value: string): string {
  const v = String(value || "").trim();
  if (!v) return "";
  return `<div class="row"><div class="k">${escapeHtml(label)}:</div><div class="v">${escapeHtml(v)}</div></div>`;
}

function pickPropertyName(projectName: string, leadCustom: any): string | null {
  const raw = String(leadCustom?.property || leadCustom?.propertyName || "").trim();
  if (raw) return raw;
  // best-effort: if projectName contains a dash, use right-hand
  const p = String(projectName || "");
  const m = p.split("–");
  if (m.length > 1) return m.slice(1).join("–").trim();
  return null;
}

function chunkLines<T>(items: T[], perPage: number): T[][] {
  const out: T[][] = [];
  const list = Array.isArray(items) ? items : [];
  for (let i = 0; i < list.length; i += perPage) {
    out.push(list.slice(i, i + perPage));
  }
  return out.length ? out : [[]];
}

function buildLineDescription(ln: QuoteLine, metaAny: any): string {
  const desc = String(ln.description || "").trim();
  const dims = String(metaAny?.dimensions || metaAny?.size || "").trim();
  if (dims && !desc.includes(dims)) return `${desc}, ${dims}`;
  return desc;
}

function pickUnitSell(ln: QuoteLine, metaAny: any): number {
  const qty = Math.max(1, Number(ln.qty || 1));
  if (metaAny?.sellUnitGBP != null && Number.isFinite(Number(metaAny.sellUnitGBP))) return Number(metaAny.sellUnitGBP);
  if (metaAny?.sellTotalGBP != null && Number.isFinite(Number(metaAny.sellTotalGBP))) return Number(metaAny.sellTotalGBP) / qty;
  const unit = Number(ln.unitPrice || 0);
  return Number.isFinite(unit) ? unit : 0;
}

function pickLineSellTotal(ln: QuoteLine, metaAny: any, qty: number): number {
  if (metaAny?.sellTotalGBP != null && Number.isFinite(Number(metaAny.sellTotalGBP))) return Number(metaAny.sellTotalGBP);
  if (metaAny?.sellUnitGBP != null && Number.isFinite(Number(metaAny.sellUnitGBP))) return Number(metaAny.sellUnitGBP) * qty;
  const unit = Number(ln.unitPrice || 0);
  const u = Number.isFinite(unit) ? unit : 0;
  return u * qty;
}

function safeMoney(value: any): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateGB(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
