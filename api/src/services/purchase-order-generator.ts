import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";
import fetch from "node-fetch";

interface SupplierGroup {
  supplierId: string;
  supplierName: string;
  currency: string;
  items: Array<{
    materialItemId: string;
    description: string;
    quantity: Prisma.Decimal;
    unit: string;
    unitPrice: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
  }>;
}

/**
 * Generate PurchaseOrders from a ShoppingList.
 * Groups items by supplier and creates one PO per supplier.
 * 
 * @param shoppingListId - The shopping list to generate POs from
 * @param tenantId - Tenant ID for multi-tenant safety
 * @returns Array of created PurchaseOrders with their lines
 */
export async function generatePurchaseOrdersFromShoppingList(
  shoppingListId: string,
  tenantId: string
) {
  // 1. Load shopping list with items, joined to MaterialItem and Supplier
  const shoppingList = await prisma.shoppingList.findFirst({
    where: {
      id: shoppingListId,
      tenantId,
    },
    include: {
            quote: {
              select: {
                id: true,
                leadId: true
              }
            },
      items: {
        include: {
          materialItem: {
            include: {
              supplier: true,
            },
          },
        },
      },
    },
  });

  if (!shoppingList) {
    throw new Error(
      `Shopping list ${shoppingListId} not found for tenant ${tenantId}`
    );
  }

  if (shoppingList.status !== "APPROVED") {
    throw new Error(
      `Shopping list ${shoppingListId} must be APPROVED before generating POs (current status: ${shoppingList.status})`
    );
  }

  // 2. Group items by supplier
  const supplierGroups = new Map<string, SupplierGroup>();

  for (const item of shoppingList.items) {
    const supplier = item.materialItem.supplier;

    if (!supplier) {
      console.warn(
        `[purchase-order] Material item ${item.materialItem.code} has no supplier, skipping`
      );
      continue;
    }

    const supplierId = supplier.id;
    const unitPrice = item.materialItem.cost;
    const lineTotal = new Prisma.Decimal(item.quantity.toString()).mul(
      unitPrice.toString()
    );

    if (!supplierGroups.has(supplierId)) {
      supplierGroups.set(supplierId, {
        supplierId,
        supplierName: supplier.name,
        currency: item.materialItem.currency,
        items: [],
      });
    }

    const group = supplierGroups.get(supplierId)!;
    group.items.push({
      materialItemId: item.materialItem.id,
      description:
        item.descriptionOverride || item.materialItem.name,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice,
      lineTotal,
    });
  }

  if (supplierGroups.size === 0) {
    throw new Error(
      `No items with suppliers found in shopping list ${shoppingListId}`
    );
  }

  // 3. Create PurchaseOrders in transaction
  const result = await prisma.$transaction(async (tx) => {
        // Find opportunity if quote is linked
        let opportunityId: string | null = null;
        if (shoppingList.quote?.leadId) {
          const opportunity = await tx.opportunity.findFirst({
            where: {
              tenantId,
              leadId: shoppingList.quote.leadId
            },
            select: { id: true }
          });
          opportunityId = opportunity?.id || null;
        }

    const purchaseOrders = [];

    for (const group of supplierGroups.values()) {
      // Calculate total
      const totalAmount = group.items.reduce(
        (sum, item) => sum.add(item.lineTotal.toString()),
        new Prisma.Decimal(0)
            // Build notes with opportunity link for ML tracking
            const notes = opportunityId 
              ? `Generated from Shopping List ${shoppingListId} (Opportunity: ${opportunityId})`
              : `Generated from Shopping List ${shoppingListId}`;

      );

      // Create PO
      const po = await tx.purchaseOrder.create({
        data: {
          tenantId,
          supplierId: group.supplierId,
          status: "DRAFT",
          currency: group.currency,
          totalAmount,
          notes,
          orderDate: new Date(),
        },
      });

      // Create PO lines
      const lines = await Promise.all(
        group.items.map((item) =>
          tx.purchaseOrderLine.create({
            data: {
              purchaseOrderId: po.id,
              materialItemId: item.materialItemId,
              description: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
            },
            include: {
              materialItem: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  category: true,
                  cost: true,
                  unit: true,
                },
              },
            },
          })
        )
      );

      purchaseOrders.push({
        ...po,
        supplier: {
          id: group.supplierId,
          name: group.supplierName,
        },
        lines,
      });
    }

    // Update shopping list status to ORDERED
    await tx.shoppingList.update({
      where: { id: shoppingListId },
      data: { status: "ORDERED" },
    });

    return purchaseOrders;
  });

  console.log(
    `[purchase-order] Generated ${result.length} POs from shopping list ${shoppingListId}`
  );

  return result;
}

/**
 * Update purchase order status
 */
export async function updatePurchaseOrderStatus(
  purchaseOrderId: string,
  tenantId: string,
  status:
    | "DRAFT"
    | "SENT"
    | "CONFIRMED"
    | "PARTIALLY_RECEIVED"
    | "RECEIVED"
    | "CANCELLED",
  orderNumber?: string
) {
  const updateData: any = { status };

  if (status === "SENT" && orderNumber) {
    updateData.orderNumber = orderNumber;
  }

  if (status === "RECEIVED") {
    updateData.receivedDate = new Date();
  }

  const po = await prisma.purchaseOrder.update({
    where: {
      id: purchaseOrderId,
      tenantId,
    },
    data: updateData,
    include: {
      supplier: true,
      lines: {
        include: {
          materialItem: true,
        },
      },
    },
  });

  console.log(
    `[purchase-order] Updated PO ${purchaseOrderId} status to ${status}`
  );
  return po;
}

/**
 * Record receipt of materials against a PO line
 */
export async function recordPurchaseOrderLineReceipt(
  lineId: string,
  tenantId: string,
  receivedQuantity: Prisma.Decimal
) {
  const result = await prisma.$transaction(async (tx) => {
    // Update line
    const line = await tx.purchaseOrderLine.update({
      where: { id: lineId },
      data: { receivedQuantity },
      include: {
        purchaseOrder: {
          include: {
            lines: true,
          },
        },
        materialItem: true,
      },
    });

    // Check if PO should verify tenant
    if (line.purchaseOrder.tenantId !== tenantId) {
      throw new Error("Unauthorized: PO line does not belong to tenant");
    }

    // Update material stock
    await tx.materialItem.update({
      where: { id: line.materialItemId },
      data: {
        stockQuantity: {
          increment: receivedQuantity,
        },
      },
    });

    // Check if all lines are fully received
    const allLinesReceived = line.purchaseOrder.lines.every((l) => {
      if (l.id === lineId) {
        return new Prisma.Decimal(receivedQuantity.toString()).gte(
          l.quantity.toString()
        );
      }
      return (
        l.receivedQuantity &&
        new Prisma.Decimal(l.receivedQuantity.toString()).gte(
          l.quantity.toString()
        )
      );
    });

    const anyLinesPartiallyReceived = line.purchaseOrder.lines.some((l) => {
      const received =
        l.id === lineId
          ? receivedQuantity
          : l.receivedQuantity || new Prisma.Decimal(0);
      return (
        new Prisma.Decimal(received.toString()).gt(0) &&
        new Prisma.Decimal(received.toString()).lt(l.quantity.toString())
      );
    });

    // Update PO status
    let newStatus = line.purchaseOrder.status;
    if (allLinesReceived) {
      newStatus = "RECEIVED";
    } else if (anyLinesPartiallyReceived) {
      newStatus = "PARTIALLY_RECEIVED";
    }

    if (newStatus !== line.purchaseOrder.status) {
      await tx.purchaseOrder.update({
        where: { id: line.purchaseOrder.id },
        data: {
          status: newStatus,
          receivedDate: newStatus === "RECEIVED" ? new Date() : null,
        },
      });
    }

    return { ...line, purchaseOrder: { ...line.purchaseOrder, status: newStatus } };
  });

  console.log(
    `[purchase-order] Recorded receipt of ${receivedQuantity} ${result.unit} for line ${lineId}`
  
    // Trigger ML actuals capture if PO just became RECEIVED and has opportunityId
    if (result.purchaseOrder.status === "RECEIVED" && result.purchaseOrder.notes?.includes("Opportunity:")) {
      const opportunityId = result.purchaseOrder.notes.match(/Opportunity:\s*([a-zA-Z0-9_-]+)/)?.[1];
      if (opportunityId) {
        const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
        // Non-blocking call to capture actuals
        fetch(`${API_URL}/api/ml-actuals/capture-from-po/${result.purchaseOrder.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
          .then((r) => {
            if (r.ok) {
              console.log(`[ml-actuals] Triggered actuals capture for opportunity ${opportunityId} from PO ${result.purchaseOrder.id}`);
            } else {
              console.warn(`[ml-actuals] Failed to trigger actuals capture: ${r.status}`);
            }
          })
          .catch((e) => console.warn("[ml-actuals] Error triggering actuals capture:", e?.message));
      }
    }
  
  );
  return result;
}

/**
 * Get purchase order with lines (tenant-scoped)
 */
export async function getPurchaseOrder(purchaseOrderId: string, tenantId: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: {
      id: purchaseOrderId,
      tenantId,
    },
    include: {
      supplier: true,
      lines: {
        include: {
          materialItem: true,
        },
        orderBy: {
          materialItem: {
            category: "asc",
          },
        },
      },
    },
  });

  if (!po) {
    throw new Error(
      `Purchase order ${purchaseOrderId} not found for tenant ${tenantId}`
    );
  }

  return po;
}

/**
 * Get all purchase orders for a tenant
 */
export async function getPurchaseOrdersForTenant(
  tenantId: string,
  filters?: {
    supplierId?: string;
    status?:
      | "DRAFT"
      | "SENT"
      | "CONFIRMED"
      | "PARTIALLY_RECEIVED"
      | "RECEIVED"
      | "CANCELLED";
    fromDate?: Date;
    toDate?: Date;
  }
) {
  const where: any = { tenantId };

  if (filters?.supplierId) {
    where.supplierId = filters.supplierId;
  }

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.fromDate || filters?.toDate) {
    where.orderDate = {};
    if (filters.fromDate) where.orderDate.gte = filters.fromDate;
    if (filters.toDate) where.orderDate.lte = filters.toDate;
  }

  const pos = await prisma.purchaseOrder.findMany({
    where,
    include: {
      supplier: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      lines: {
        include: {
          materialItem: {
            select: {
              id: true,
              code: true,
              name: true,
              category: true,
            },
          },
        },
      },
    },
    orderBy: {
      orderDate: "desc",
    },
  });

  return pos;
}
