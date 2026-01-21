#!/usr/bin/env tsx
/**
 * Copy Wealden landing page content to ACME Ltd tenant
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

async function copyToAcme() {
  console.log('🔄 Copying Wealden content to ACME Ltd...');

  // Find ACME tenant
  const acme = await prisma.tenant.findUnique({
    where: { slug: 'acme-ltd' }
  });

  if (!acme) {
    console.error('❌ ACME Ltd tenant not found');
    process.exit(1);
  }

  console.log(`✅ Found ACME Ltd: ${acme.name}`);

  // Update or create landing tenant for ACME
  const landingTenant = await prisma.landingTenant.upsert({
    where: { tenantId: acme.id },
    create: {
      tenantId: acme.id,
      headline: 'Hand-Crafted Oak & Accoya Windows and Doors',
      subhead: 'Fine quality, bespoke joinery for period properties and new builds across East Sussex and Kent',
      urgencyBanner: '🎄 Book a survey before Christmas and save 10% on your project',
      ctaText: 'Get Your Free Quote',
      publishedAt: new Date(),
      name: 'ACME Ltd',
      email: 'info@acme-ltd.com',
      phone: '01892 852544',
      address: 'Rotherfield, East Sussex',
      homeUrl: 'https://www.acme-ltd.com',
      brandColor: '#8B4513',
      guarantees: [
        '50-year anti-rot guarantee on Accoya timber',
        'Super prime and prime grade European oak',
        'All craftsmen City & Guilds qualified',
        'FSC certified sustainable timber',
        'Listed building specialists',
        'Made in our Rotherfield workshop'
      ],
    },
    update: {
      headline: 'Hand-Crafted Oak & Accoya Windows and Doors',
      subhead: 'Fine quality, bespoke joinery for period properties and new builds across East Sussex and Kent',
      urgencyBanner: '🎄 Book a survey before Christmas and save 10% on your project',
      ctaText: 'Get Your Free Quote',
      name: 'ACME Ltd',
      email: 'info@acme-ltd.com',
      phone: '01892 852544',
      address: 'Rotherfield, East Sussex',
      homeUrl: 'https://www.acme-ltd.com',
      brandColor: '#8B4513',
      guarantees: [
        '50-year anti-rot guarantee on Accoya timber',
        'Super prime and prime grade European oak',
        'All craftsmen City & Guilds qualified',
        'FSC certified sustainable timber',
        'Listed building specialists',
        'Made in our Rotherfield workshop'
      ],
      publishedAt: new Date()
    }
  });

  console.log(`✅ Updated landing tenant for ACME`);

  // Upsert content
  await prisma.landingTenantContent.upsert({
    where: { tenantId: landingTenant.id },
    create: {
      tenantId: landingTenant.id,
      headline: 'Hand-Crafted Oak & Accoya Windows and Doors',
      subhead: 'Fine quality, bespoke joinery for period properties and new builds across East Sussex and Kent',
      priceFromText: 'From £POA',
      priceRange: 'Custom quotes for all projects',
      guarantees: JSON.stringify({
        bullets: [
          '50-year anti-rot guarantee on Accoya timber',
          'Super prime and prime grade European oak — longer life, less shrinkage',
          'All craftsmen City & Guilds qualified',
          'FSC certified sustainable timber from High Weald',
          'Listed building and period property specialists',
          'Made to measure in our Rotherfield workshop',
          'Expert glazing advice and installation',
          'Excellent on-time delivery record'
        ],
        riskReversal: 'If you\'re not completely satisfied with your quote, we\'ll work with you to get it right.',
      }),
      urgency: JSON.stringify({
        text: '🎄 Book a survey before Christmas and save 10%',
        sub: 'Limited December slots available',
      }),
      faqJson: JSON.stringify([
        {
          question: 'What types of wood do you use?',
          answer: 'We primarily use super prime and prime grade European oak, and Accoya timber. Oak provides natural beauty and longevity, while Accoya is a sustainably sourced wood that is dimensionally stable, lasts twice as long as engineered softwood, and is perfect for humid conditions.'
        },
        {
          question: 'Can you match existing period features?',
          answer: 'Absolutely. We specialize in heritage joinery and can replicate Victorian, Georgian, and Edwardian designs to match your existing windows. Our craftsmen use traditional techniques combined with modern materials to ensure your new windows blend seamlessly with period architecture.'
        },
        {
          question: 'Do you work on listed buildings?',
          answer: 'Yes, we have extensive experience working with listed buildings and conservation areas. We understand planning requirements and work closely with conservation officers to ensure all joinery meets heritage standards while providing modern performance.'
        },
        {
          question: 'What areas do you cover?',
          answer: 'We serve East Sussex, Kent, Rotherfield, Tunbridge Wells, Crowborough, Uckfield, and surrounding areas. Contact us to discuss your specific location.'
        },
        {
          question: 'How long do timber windows last?',
          answer: 'Our Accoya windows come with a 50-year anti-rot guarantee and typically last 60+ years with minimal maintenance. Oak windows, when properly maintained, can last even longer — often 100+ years.'
        },
        {
          question: 'What makes us different?',
          answer: 'We use only super prime and prime grade European oak, all our craftsmen are City & Guilds qualified, and we manufacture everything in our workshop. This means you get exceptional quality, complete control over the process, and support from our expert team throughout.'
        }
      ]),
      serviceAreas: JSON.stringify([
        'East Sussex',
        'Kent',
        'Rotherfield',
        'Tunbridge Wells',
        'Crowborough',
        'Uckfield',
        'Heathfield',
        'Mayfield',
        'Wadhurst',
        'Frant'
      ]),
      published: true
    },
    update: {
      headline: 'Hand-Crafted Oak & Accoya Windows and Doors',
      subhead: 'Fine quality, bespoke joinery for period properties and new builds across East Sussex and Kent',
      guarantees: JSON.stringify({
        bullets: [
          '50-year anti-rot guarantee on Accoya timber',
          'Super prime and prime grade European oak — longer life, less shrinkage',
          'All craftsmen City & Guilds qualified',
          'FSC certified sustainable timber from High Weald',
          'Listed building and period property specialists',
          'Made to measure in our Rotherfield workshop',
          'Expert glazing advice and installation',
          'Excellent on-time delivery record'
        ],
        riskReversal: 'If you\'re not completely satisfied with your quote, we\'ll work with you to get it right.',
      }),
      published: true
    }
  });

  console.log(`✅ Updated landing content for ACME`);

  // Add reviews if they don't exist
  const existingReviews = await prisma.landingTenantReview.count({
    where: { landingTenantId: landingTenant.id }
  });

  if (existingReviews === 0) {
    await prisma.landingTenantReview.createMany({
      data: [
        {
          landingTenantId: landingTenant.id,
          text: 'Excellent craftsmanship and attention to detail. Our oak windows are beautiful and were installed perfectly. The team was professional throughout.',
          author: 'Sarah Thompson',
          location: 'Tunbridge Wells',
          rating: 5,
          order: 1
        },
        {
          landingTenantId: landingTenant.id,
          text: 'We needed period-accurate windows for our listed building. They delivered exactly what we needed, with expert advice on glazing requirements. Highly recommended.',
          author: 'James Harrison',
          location: 'Crowborough',
          rating: 5,
          order: 2
        },
        {
          landingTenantId: landingTenant.id,
          text: 'Outstanding quality and service. The windows have transformed our home and the 50-year guarantee gives us complete peace of mind.',
          author: 'Michael Roberts',
          location: 'East Sussex',
          rating: 5,
          order: 3
        }
      ]
    });
    console.log(`✅ Added 3 reviews`);
  }

  console.log('\n✅ ACME Ltd landing page updated successfully!');
  console.log(`   View at: https://www.joineryai.app/tenant/acme-ltd/landing`);
  console.log(`   Or: https://www.joineryai.app/acme-ltd/landing`);
}

copyToAcme()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
