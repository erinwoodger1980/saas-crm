import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";

/**
 * Placeholder helper: Given a quote line, returns the materials needed.
 * In a real implementation, this would analyze the line's meta, description, SKU
 * and look up bill-of-materials (BOM) rules, door construction specs, etc.
 * 
 * For now, returns an empty array (stub).
 */
function getMaterialsForLine(lineItem: {
  id: string;
  description: string;
  qty: Prisma.Decimal;
  meta?: Prisma.JsonValue;
}): Array<{ materialItemId: string; quantity: number; unit: string }> {
  // TODO: Implement BOM logic
  // Example logic might parse lineItem.meta for door specs:
  // - Door blank based on size/fire rating
  // - Lipping based on door perimeter
  // - Ironmongery from pack selection
  // - Glass from glazing specs
  
  return [];
}

interface MaterialAggregate {
  materialItemId: string;
  quantity: number;
  unit: string;
  sourceQuoteLineIds: string[];
}

/**
 * Generate a ShoppingList from a quote.
 * 
 * @param quoteId - The quote to generate shopping list from
 * @param tenantId - Tenant ID for multi-tenant safety
 * @returns Created ShoppingList with items
 */
export async function generateShoppingListForQuote(
  quoteId: string,
  tenantId: string
) {
  // 1. Load quote with lines (tenant-scoped)
  const quote = await prisma.quote.findFirst({
    where: {
      id: quoteId,
      tenantId,
    },
    include: {
      lines: {
        orderBy: { id: "asc" },
      },
    },
  });

  if (!quote) {
    throw new Error(`Quote ${quoteId} not found for tenant ${tenantId}`);
  }

  // 2. Generate materials from each line
  const materialsMap = new Map<string, MaterialAggregate>();

  for (const line of quote.lines) {
    const materials = getMaterialsForLine({
      id: line.id,
      description: line.description,
      qty: line.qty,
      meta: line.meta,
    });

    for (const mat of materials) {
      const key = `${mat.materialItemId}:${mat.unit}`;
      const existing = materialsMap.get(key);

      if (existing) {
        existing.quantity += mat.quantity;
        existing.sourceQuoteLineIds.push(line.id);
      } else {
        materialsMap.set(key, {
          materialItemId: mat.materialItemId,
          quantity: mat.quantity,
          unit: mat.unit,
          sourceQuoteLineIds: [line.id],
        });
      }
    }
  }

  // 3. Create ShoppingList and items in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create shopping list
    const shoppingList = await tx.shoppingList.create({
      data: {
        tenantId,
        quoteId,
        status: "DRAFT",
        notes: `Generated from Quote ${quote.title || quoteId}`,
      },
    });

    // Create shopping list items
    const items = await Promise.all(
      Array.from(materialsMap.values()).map((mat) =>
        tx.shoppingListItem.create({
          data: {
            shoppingListId: shoppingList.id,
            materialItemId: mat.materialItemId,
            quantity: mat.quantity,
            unit: mat.unit,
            // Link to first source quote line (could be enhanced to track all)
            sourceQuoteLineId: mat.sourceQuoteLineIds[0] || null,
            notes:
              mat.sourceQuoteLineIds.length > 1
                ? `Combined from ${mat.sourceQuoteLineIds.length} quote lines`
                : undefined,
          },
          include: {
            materialItem: {
              select: {
                id: true,
                code: true,
                name: true,
                category: true,
                supplierId: true,
                cost: true,
                currency: true,
                unit: true,
              },
            },
          },
        })
      )
    );

    return {
      ...shoppingList,
      items,
    };
  });

  console.log(
    `[shopping-list] Generated list ${result.id} with ${result.items.length} items for quote ${quoteId}`
  );

  return result;
}

/**
 * Update shopping list status
 */
export async function updateShoppingListStatus(
  shoppingListId: string,
  tenantId: string,
  status: "DRAFT" | "APPROVED" | "ORDERED" | "RECEIVED" | "CANCELLED"
) {
  const list = await prisma.shoppingList.update({
    where: {
      id: shoppingListId,
      tenantId,
    },
    data: {
      status,
    },
    include: {
      items: {
        include: {
          materialItem: true,
        },
      },
    },
  });

  console.log(`[shopping-list] Updated list ${shoppingListId} status to ${status}`);
  return list;
}

/**
 * Get shopping list with items (tenant-scoped)
 */
export async function getShoppingList(shoppingListId: string, tenantId: string) {
  const list = await prisma.shoppingList.findFirst({
    where: {
      id: shoppingListId,
      tenantId,
    },
    include: {
      items: {
        include: {
          materialItem: {
            include: {
              supplier: true,
            },
          },
        },
        orderBy: {
          materialItem: {
            category: "asc",
          },
        },
      },
      quote: {
        select: {
          id: true,
          title: true,
          status: true,
        },
      },
    },
  });

  if (!list) {
    throw new Error(`Shopping list ${shoppingListId} not found for tenant ${tenantId}`);
  }

  return list;
}
