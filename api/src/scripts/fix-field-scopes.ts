import { prisma } from '../prisma';

async function main() {
  console.log('🔧 Fixing questionnaire field scopes...\n');

  // Manufacturing fields
  const manufacturingKeys = [
    'manufacturing_start_date',
    'manufacturing_end_date',
    'production_notes',
    'installation_date',
    'installation_start_date',
    'installation_end_date',
    'timber_ordered_at',
    'timber_expected_at',
    'timber_received_at',
    'glass_ordered_at',
    'glass_expected_at',
    'glass_received_at',
    'ironmongery_ordered_at',
    'ironmongery_expected_at',
    'ironmongery_received_at',
    'paint_ordered_at',
    'paint_expected_at',
    'paint_received_at',
    'final_width_mm',
    'final_height_mm',
  ];

  const mfgResult = await prisma.questionnaireField.updateMany({
    where: {
      key: { in: manufacturingKeys },
      scope: 'public' as any,
    },
    data: {
      scope: 'manufacturing' as any,
    },
  });
  console.log(`✅ Updated ${mfgResult.count} manufacturing fields`);

  // Fire door schedule fields (project-level)
  const scheduleKeys = [
    'fire_rated',
    'mjs_number',
    'job_location',
    'sign_off_status',
    'date_received',
    'date_required',
    'po_number',
  ];

  const scheduleResult = await prisma.questionnaireField.updateMany({
    where: {
      key: { in: scheduleKeys },
      scope: 'public' as any,
    },
    data: {
      scope: 'fire_door_schedule' as any,
    },
  });
  console.log(`✅ Updated ${scheduleResult.count} fire door schedule fields`);

  // Fire door line item fields (door-level)
  const lineItemKeys = [
    'door_ref',
    'fire_rating',
    'door_set_type',
    'leaf_height_mm',
    'leaf_width_mm',
    'leaf_thickness_mm',
    'glazed_area',
    'acoustic_rating_db',
  ];

  const lineItemResult = await prisma.questionnaireField.updateMany({
    where: {
      key: { in: lineItemKeys },
      scope: 'public' as any,
    },
    data: {
      scope: 'fire_door_line_items' as any,
    },
  });
  console.log(`✅ Updated ${lineItemResult.count} fire door line item fields`);

  // Move spec fields to quote_details
  const quoteDetailsKeys = [
    'materials_grade',
    'glazing_type',
    'has_curves',
    'premium_hardware',
    'custom_finish',
    'window_style',
    'door_type',
    'door_height_mm',
    'door_width_mm',
    'number_of_doors',
    'timber_type',
    'finish',
    'ironmongery_level',
    'quantity',
    'width_mm',
    'height_mm',
  ];

  const quoteDetailsResult = await prisma.questionnaireField.updateMany({
    where: {
      key: { in: quoteDetailsKeys },
      scope: 'public' as any,
    },
    data: {
      scope: 'quote_details' as any,
    },
  });
  console.log(`✅ Updated ${quoteDetailsResult.count} quote details fields`);

  // Show summary
  console.log('\n📊 Field scope summary:');
  const scopes: any = await prisma.$queryRaw`
    SELECT scope, COUNT(*)::int as count
    FROM "QuestionnaireField"
    GROUP BY scope
    ORDER BY scope
  `;
  console.table(scopes);

  console.log('\n✨ Done!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
