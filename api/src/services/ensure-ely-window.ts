import { prisma } from "../prisma";
import { ELY_F47_CUTLIST_ITEMS, type ElyF47CutlistItem } from "./ely-f47-cutlist";

type ProductOption = {
  id: string;
  label: string;
  description?: string;
  imagePath?: string;
  imageDataUrl?: string;
  svg?: string;
  sceneConfig?: any;
  productParams?: any;
};

type ProductTypeJson = {
  type: string;
  label: string;
  options: ProductOption[];
};

type ProductCategoryJson = {
  id: string;
  label: string;
  types: ProductTypeJson[];
};

const ELY_OPTION_ID = "ely-window";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function ensureElyWindowInSettingsProductTypes(existing: unknown): {
  next: ProductCategoryJson[];
  changed: boolean;
} {
  const catalog: ProductCategoryJson[] = Array.isArray(existing)
    ? (deepClone(existing) as any)
    : [];

  let changed = false;

  let windows = catalog.find((c) => c?.id === "windows");
  if (!windows) {
    windows = { id: "windows", label: "Windows", types: [] };
    catalog.push(windows);
    changed = true;
  }

  if (!Array.isArray(windows.types)) {
    windows.types = [];
    changed = true;
  }

  let elyType = windows.types.find((t) => t?.type === "ely");
  if (!elyType) {
    elyType = { type: "ely", label: "Ely Window", options: [] };
    windows.types.unshift(elyType);
    changed = true;
  }

  if (!Array.isArray(elyType.options)) {
    elyType.options = [];
    changed = true;
  }

  if (!elyType.options.some((o) => o?.id === ELY_OPTION_ID)) {
    elyType.options.push({ id: ELY_OPTION_ID, label: "Ely Window" });
    changed = true;
  }

  return { next: catalog, changed };
}

export async function ensureElyWindowForTenant(tenantId: string): Promise<{
  ok: boolean;
  settingsUpdated: boolean;
  componentsUpserted: number;
  productTypeCreated: boolean;
  assignmentsCreated: number;
}> {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId },
    select: { id: true, slug: true },
  });

  if (!tenant) {
    return {
      ok: false,
      settingsUpdated: false,
      componentsUpserted: 0,
      productTypeCreated: false,
      assignmentsCreated: 0,
    };
  }

  // 1) Ensure TenantSettings + productTypes JSON has Ely Window option
  const existingSettings = await prisma.tenantSettings.findFirst({
    where: { tenantId },
    select: { tenantId: true, slug: true, brandName: true, productTypes: true },
  });

  const { next: nextProductTypes, changed: settingsChanged } =
    ensureElyWindowInSettingsProductTypes(existingSettings?.productTypes);

  if (!existingSettings) {
    await prisma.tenantSettings.create({
      data: {
        tenantId,
        slug: tenant.slug,
        brandName: tenant.slug,
        productTypes: nextProductTypes as any,
      },
    });
  } else if (settingsChanged) {
    await prisma.tenantSettings.update({
      where: { tenantId },
      data: { productTypes: nextProductTypes as any },
    });
  }

  // 2) Upsert real ComponentLookup rows for Ely Window (derived from the supplier PDF cutlist)
  const componentSpecs: Array<{
    code: string;
    name: string;
    componentType: string;
    description?: string;
    cutlist: ElyF47CutlistItem;
  }> = ELY_F47_CUTLIST_ITEMS.map((it) => {
    const section = String(it.section || '').trim();
    const safeSection = section ? section.replace(/\s+/g, '') : 'UNKNOWN';
    const code = `ELY-F47-${it.codeStem}-${safeSection}`.toUpperCase();

    // Map to existing “known” types where possible, but remain flexible
    const componentType = ((): string => {
      if (it.kind === 'jamb') return 'FRAME';
      if (it.kind === 'head') return 'FRAME';
      if (it.kind === 'cill') return 'FRAME';
      if (it.kind === 'transom') return 'FRAME';
      if (it.kind === 'sash_bottom_rail') return 'FRAME';
      return 'FRAME';
    })();

    return {
      code,
      name: `Ely F47 – ${it.name}`,
      componentType,
      description: `Imported from F47 Ely cutlist (finish sizes). Section ${section}.`,
      cutlist: it,
    };
  });

  let componentsUpserted = 0;
  const componentIds: Array<{ id: string; cutlist: ElyF47CutlistItem }> = [];

  for (const spec of componentSpecs) {
    const existing = await prisma.componentLookup.findFirst({
      where: { tenantId, code: spec.code },
      select: { id: true, productTypes: true, metadata: true },
    });

    const currentProductTypes = Array.isArray(existing?.productTypes)
      ? (existing?.productTypes as string[])
      : [];
    const nextTypes = currentProductTypes.includes(ELY_OPTION_ID)
      ? currentProductTypes
      : [...currentProductTypes, ELY_OPTION_ID];

    const component = existing
      ? await prisma.componentLookup.update({
          where: { id: existing.id },
          data: {
            name: spec.name,
            componentType: spec.componentType,
            description: spec.description ?? null,
            productTypes: nextTypes,
            isActive: true,
            metadata: {
              ...(typeof existing.metadata === "object" && existing.metadata ? (existing.metadata as any) : {}),
              elyCutlist: {
                sourcePdf: 'docs/ely/Ely Cut list.pdf',
                ref: 'Ely F47',
                section: spec.cutlist.section,
                shoulderLengthMm: spec.cutlist.shoulderLengthMm,
                roughLengthMm: spec.cutlist.roughLengthMm,
                quantityPerWindow: spec.cutlist.quantity,
              },
            } as any,
          },
          select: { id: true },
        })
      : await prisma.componentLookup.create({
          data: {
            tenantId,
            productTypes: [ELY_OPTION_ID],
            componentType: spec.componentType,
            code: spec.code,
            name: spec.name,
            description: spec.description ?? null,
            unitOfMeasure: "EA",
            basePrice: 0,
            leadTimeDays: 0,
            isActive: true,
            metadata: {
              elyCutlist: {
                sourcePdf: 'docs/ely/Ely Cut list.pdf',
                ref: 'Ely F47',
                section: spec.cutlist.section,
                shoulderLengthMm: spec.cutlist.shoulderLengthMm,
                roughLengthMm: spec.cutlist.roughLengthMm,
                quantityPerWindow: spec.cutlist.quantity,
              },
            },
          },
          select: { id: true },
        });

    componentsUpserted++;
    componentIds.push({ id: component.id, cutlist: spec.cutlist });
  }

  // 3) Ensure canonical ProductType rows exist (category -> type -> option)
  const ensureNode = async (args: {
    code: string;
    name: string;
    level: "category" | "type" | "option";
    parentId?: string | null;
  }): Promise<{ id: string; created: boolean } | null> => {
    const existing = await prisma.productType.findFirst({
      where: { tenantId, code: args.code },
      select: { id: true, level: true },
    });

    if (existing) {
      // Avoid clobbering if some tenant uses the same code differently
      if (existing.level !== args.level) return { id: existing.id, created: false };
      return { id: existing.id, created: false };
    }

    const created = await prisma.productType.create({
      data: {
        tenantId,
        code: args.code,
        name: args.name,
        level: args.level,
        parentId: args.parentId ?? null,
        isActive: true,
        sortOrder: 0,
      },
      select: { id: true },
    });

    return { id: created.id, created: true };
  };

  const category = await ensureNode({
    code: "windows",
    name: "Windows",
    level: "category",
    parentId: null,
  });

  const type = category
    ? await ensureNode({
        code: "ely",
        name: "Ely Window",
        level: "type",
        parentId: category.id,
      })
    : null;

  const option = type
    ? await ensureNode({
        code: ELY_OPTION_ID,
        name: "Ely Window",
        level: "option",
        parentId: type.id,
      })
    : null;

  const productTypeCreated = Boolean(option?.created);

  // 4) Link components to canonical option node via ProductTypeComponentAssignment
  let assignmentsCreated = 0;
  if (option?.id) {
    // If the Ely option previously existed with placeholder components (ELY-WIN-*),
    // unlink them so the option's linked list reflects the F47 cutlist.
    const legacyAssignments = await (prisma as any).productTypeComponentAssignment.findMany({
      where: {
        tenantId,
        productTypeId: option.id,
      },
      include: {
        component: {
          select: { id: true, code: true, productTypes: true },
        },
      },
    });

    const legacyComponentIds: string[] = legacyAssignments
      .filter((a: any) => typeof a?.component?.code === "string" && a.component.code.startsWith("ELY-WIN-"))
      .map((a: any) => a.componentId);

    if (legacyComponentIds.length > 0) {
      await (prisma as any).productTypeComponentAssignment.deleteMany({
        where: {
          tenantId,
          productTypeId: option.id,
          componentId: { in: legacyComponentIds },
        },
      });

      for (const a of legacyAssignments) {
        const code = a?.component?.code;
        if (typeof code !== "string" || !code.startsWith("ELY-WIN-")) continue;
        const currentTypes: string[] = Array.isArray(a.component.productTypes)
          ? a.component.productTypes
          : [];
        if (!currentTypes.includes(ELY_OPTION_ID)) continue;
        await prisma.componentLookup.update({
          where: { id: a.component.id },
          data: {
            productTypes: currentTypes.filter((t) => t !== ELY_OPTION_ID),
          },
        });
      }
    }

    const existing = await (prisma as any).productTypeComponentAssignment.findMany({
      where: { tenantId, productTypeId: option.id },
      select: { componentId: true },
    });
    const existingIds = new Set(existing.map((r: any) => r.componentId));

    const rows = componentIds
      .filter((c) => !existingIds.has(c.id))
      .map((c, idx) => ({
        tenantId,
        productTypeId: option.id,
        componentId: c.id,
        sortOrder: idx,
        isRequired: true,
        isDefault: true,
        quantityFormula: String(c.cutlist.quantity),
        metadata: {
          elyCutlist: {
            section: c.cutlist.section,
            shoulderLengthMm: c.cutlist.shoulderLengthMm,
            roughLengthMm: c.cutlist.roughLengthMm,
            quantityPerWindow: c.cutlist.quantity,
          },
        },
      }));

    if (rows.length > 0) {
      await (prisma as any).productTypeComponentAssignment.createMany({
        data: rows,
        skipDuplicates: true,
      });
      assignmentsCreated = rows.length;
    }
  }

  return {
    ok: true,
    settingsUpdated: !existingSettings || settingsChanged,
    componentsUpserted,
    productTypeCreated,
    assignmentsCreated,
  };
}

export const ELY_WINDOW_OPTION_ID = ELY_OPTION_ID;
