// api/src/lib/seedStandardFields.ts
/**
 * Helper function to seed standard questionnaire fields for a tenant
 * Used during tenant creation to ensure all tenants have ML-optimized fields
 */

import { prisma } from "../prisma";
import { STANDARD_FIELDS } from "./standardQuestionnaireFields";

export async function seedStandardFieldsForTenant(tenantId: string): Promise<{
  questionnaire: { id: string; name: string };
  fieldsCreated: number;
  fieldsSkipped: number;
}> {
  // Get or create default questionnaire for this tenant
  let questionnaire = await prisma.questionnaire.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  if (!questionnaire) {
    questionnaire = await prisma.questionnaire.create({
      data: {
        tenantId,
        name: "Default Quote Request Form",
        description: "Standard questionnaire with ML-optimized fields",
        isActive: true,
      },
    });
  }

  // Check which standard fields already exist
  const existingFields = await prisma.questionnaireField.findMany({
    where: {
      tenantId,
      questionnaireId: questionnaire.id,
      isStandard: true,
    },
    select: { key: true },
  });

  const existingKeys = new Set(existingFields.map((f) => f.key));
  const fieldsToCreate = STANDARD_FIELDS.filter((f) => !existingKeys.has(f.key));

  if (fieldsToCreate.length === 0) {
    return {
      questionnaire: { id: questionnaire.id, name: questionnaire.name },
      fieldsCreated: 0,
      fieldsSkipped: existingKeys.size,
    };
  }

  // Create missing standard fields
  let created = 0;
  for (const field of fieldsToCreate) {
    try {
      await prisma.questionnaireField.create({
        data: {
          tenantId,
          questionnaireId: questionnaire.id,
          key: field.key,
          label: field.label,
          type: field.type,
          options: field.options || undefined,
          required: field.required,
          costingInputKey: field.costingInputKey || null,
          helpText: field.helpText || null,
          placeholder: field.placeholder || null,
          sortOrder: field.sortOrder,
          scope: field.scope,
          isStandard: true,
          isActive: true,
          isHidden: false, // All fields visible in forms
          requiredForCosting: !!field.costingInputKey,
        },
      });
      created++;
    } catch (error: any) {
      console.error(`Failed to create standard field ${field.key} for tenant ${tenantId}:`, error.message);
    }
  }

  return {
    questionnaire: { id: questionnaire.id, name: questionnaire.name },
    fieldsCreated: created,
    fieldsSkipped: existingKeys.size,
  };
}
