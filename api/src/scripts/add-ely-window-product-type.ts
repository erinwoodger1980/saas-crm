import prisma from "../db";

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

type ProductType = {
	type: string;
	label: string;
	options: ProductOption[];
};

type ProductCategory = {
	id: string;
	label: string;
	types: ProductType[];
};

function parseArgs(argv: string[]) {
	const getArg = (flag: string, def?: string) => {
		const idx = argv.findIndex((a) => a === flag || a === `--${flag}`);
		if (idx === -1) return def;
		const value = argv[idx + 1];
		return value && !value.startsWith("-") ? value : def;
	};

	return {
		tenantId: getArg("tenantId") || getArg("tenant-id"),
		slug: getArg("slug"),
		sourceOptionId: getArg("sourceOptionId", "casement-single") || "casement-single",
		targetOptionId: getArg("targetOptionId", "ely-window") || "ely-window",
	};
}

function ensureElyWindowInCatalog(
	existing: unknown,
	targetOptionId: string
): { next: ProductCategory[]; changed: boolean } {
	const catalog: ProductCategory[] = Array.isArray(existing) ? (existing as any) : [];
	const next: ProductCategory[] = JSON.parse(JSON.stringify(catalog.length ? catalog : []));

	let changed = false;

	let windows = next.find((c) => c?.id === "windows");
	if (!windows) {
		windows = { id: "windows", label: "Windows", types: [] };
		next.push(windows);
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

	const existingOption = elyType.options.find((o) => o?.id === targetOptionId);
	if (!existingOption) {
		elyType.options.push({ id: targetOptionId, label: "Ely Window" });
		changed = true;
	}

	return { next, changed };
}

async function main() {
	const argv = process.argv.slice(2);
	const { tenantId, slug, sourceOptionId, targetOptionId } = parseArgs(argv);

	if (!tenantId && !slug) {
		console.error(
			"Usage: pnpm ts-node api/src/scripts/add-ely-window-product-type.ts --tenantId <id> [--sourceOptionId casement-single] [--targetOptionId ely-window]"
		);
		console.error(
			"   or: pnpm ts-node api/src/scripts/add-ely-window-product-type.ts --slug <tenant-slug> [--sourceOptionId casement-single]"
		);
		process.exit(1);
	}

	const tenant = tenantId
		? await prisma.tenant.findFirst({ where: { id: tenantId }, select: { id: true, slug: true } })
		: await prisma.tenant.findFirst({ where: { slug: slug as string }, select: { id: true, slug: true } });

	if (!tenant) {
		console.error("Tenant not found");
		process.exit(1);
	}

	console.log(`[add-ely-window] Tenant: ${tenant.slug} (${tenant.id})`);
	console.log(`[add-ely-window] Source option: ${sourceOptionId}`);
	console.log(`[add-ely-window] Target option: ${targetOptionId}`);

	const settings = await prisma.tenantSettings.findFirst({
		where: { tenantId: tenant.id },
		select: { tenantId: true, productTypes: true },
	});

	const { next: nextCatalog, changed } = ensureElyWindowInCatalog(
		(settings as any)?.productTypes,
		targetOptionId
	);

	if (changed) {
		await prisma.tenantSettings.upsert({
			where: { tenantId: tenant.id },
			update: { productTypes: nextCatalog as any },
			create: {
				tenantId: tenant.id,
				slug: tenant.slug,
				brandName: tenant.slug,
				introHtml: "<p>Thank you for your enquiry. Please tell us a little more below.</p>",
				links: [],
				taskPlaybook: {},
				questionnaireEmailSubject: null,
				questionnaireEmailBody: null,
				questionnaire: [],
				productTypes: nextCatalog as any,
			} as any,
		});

		console.log("[add-ely-window] Added/ensured Ely Window in tenantSettings.productTypes");
	} else {
		console.log("[add-ely-window] Ely Window already present in tenantSettings.productTypes");
	}

	const sourceComponents = await prisma.componentLookup.findMany({
		where: { tenantId: tenant.id, productTypes: { has: sourceOptionId } },
		select: { id: true, code: true, productTypes: true },
	});

	if (sourceComponents.length === 0) {
		console.warn(
			`[add-ely-window] No components found linked to '${sourceOptionId}'. Ely Window will exist but have no linked components.`
		);
		return;
	}

	let updatedCount = 0;
	for (const component of sourceComponents) {
		const current = Array.isArray(component.productTypes) ? component.productTypes : [];
		if (current.includes(targetOptionId)) continue;

		await prisma.componentLookup.update({
			where: { id: component.id },
			data: { productTypes: [...current, targetOptionId] },
		});

		updatedCount++;
	}

	console.log(
		`[add-ely-window] Linked ${updatedCount}/${sourceComponents.length} components from '${sourceOptionId}' -> '${targetOptionId}'.`
	);
}

main()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});