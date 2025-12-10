#!/usr/bin/env tsx
/**
 * Update Wealden Joinery landing page content in PRODUCTION database
 * 
 * Usage:
 *   DATABASE_URL="postgresql://..." pnpm tsx scripts/update-wealden-landing-prod.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateWealdenLanding() {
  console.log('🔄 Updating Wealden Joinery landing page in PRODUCTION...');

  // Find or create Wealden tenant
  let tenant = await prisma.tenant.findUnique({
    where: { slug: 'wealden' }
  });

  if (!tenant) {
    console.log('📝 Creating Wealden tenant...');
    tenant = await prisma.tenant.create({
      data: {
        name: 'Wealden Joinery',
        slug: 'wealden',
        serviceAreas: ['East Sussex', 'Kent', 'Rotherfield', 'Tunbridge Wells', 'Crowborough', 'Uckfield'],
        homeUrl: 'https://www.wealdenjoinery.com'
      }
    });
    console.log('✅ Wealden tenant created');
  }

  console.log(`✅ Found Wealden Joinery tenant: ${tenant.name}`);

  // Upsert landing tenant with beautiful, compelling content
  const landingTenant = await prisma.landingTenant.upsert({
    where: { tenantId: tenant.id },
    create: {
      tenantId: tenant.id,
      headline: 'Hand-Crafted Oak & Accoya Windows and Doors',
      subhead: 'Fine quality, bespoke joinery for period properties and new builds across East Sussex and Kent',
      urgencyBanner: '🎄 Book a survey before Christmas and save 10% on your project',
      ctaText: 'Get Your Free Quote',
      publishedAt: new Date(),
      name: tenant.name,
      email: tenant.emailIngests?.[0]?.email || 'martin@wealdenjoinery.com',
      phone: '01892 852544',
      address: 'Rotherfield, East Sussex',
      homeUrl: 'https://www.wealdenjoinery.com',
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
      name: tenant.name,
      email: tenant.emailIngests?.[0]?.email || 'martin@wealdenjoinery.com',
      phone: '01892 852544',
      address: 'Rotherfield, East Sussex',
      homeUrl: 'https://www.wealdenjoinery.com',
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

  console.log(`✅ Updated landing tenant: ${landingTenant.id}`);

  // Upsert landing tenant content
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
          answer: 'We primarily use super prime and prime grade European oak, and Accoya timber. Oak provides natural beauty and longevity, while Accoya is a sustainably sourced wood that is dimensionally stable, lasts twice as long as engineered softwood, and is perfect for humid conditions. We also work with Sapele and other solid woods upon request.'
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
          answer: 'We serve East Sussex, Kent, Rotherfield, Tunbridge Wells, Crowborough, Uckfield, Heathfield, Mayfield, Wadhurst, and Frant. Contact us to discuss your specific location.'
        },
        {
          question: 'How long do timber windows last?',
          answer: 'Our Accoya windows come with a 50-year anti-rot guarantee and typically last 60+ years with minimal maintenance. Oak windows, when properly maintained, can last even longer — often 100+ years as evidenced by original Victorian joinery still in use today.'
        },
        {
          question: 'What makes Wealden Joinery different?',
          answer: 'We use only super prime and prime grade European oak (not the lower grades many competitors use), all our craftsmen are City & Guilds qualified, and we manufacture everything in our Rotherfield workshop. This means you get exceptional quality, complete control over the process, and support from our expert team throughout.'
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
          answer: 'We primarily use super prime and prime grade European oak, and Accoya timber. Oak provides natural beauty and longevity, while Accoya is a sustainably sourced wood that is dimensionally stable, lasts twice as long as engineered softwood, and is perfect for humid conditions. We also work with Sapele and other solid woods upon request.'
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
          answer: 'We serve East Sussex, Kent, Rotherfield, Tunbridge Wells, Crowborough, Uckfield, Heathfield, Mayfield, Wadhurst, and Frant. Contact us to discuss your specific location.'
        },
        {
          question: 'How long do timber windows last?',
          answer: 'Our Accoya windows come with a 50-year anti-rot guarantee and typically last 60+ years with minimal maintenance. Oak windows, when properly maintained, can last even longer — often 100+ years as evidenced by original Victorian joinery still in use today.'
        },
        {
          question: 'What makes Wealden Joinery different?',
          answer: 'We use only super prime and prime grade European oak (not the lower grades many competitors use), all our craftsmen are City & Guilds qualified, and we manufacture everything in our Rotherfield workshop. This means you get exceptional quality, complete control over the process, and support from our expert team throughout.'
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
    }
  });

  console.log(`✅ Updated landing tenant content`);

  // Add sample reviews if none exist
  const existingReviews = await prisma.landingTenantReview.count({
    where: { landingTenantId: landingTenant.id }
  });

  if (existingReviews === 0) {
    await prisma.landingTenantReview.createMany({
      data: [
        {
          landingTenantId: landingTenant.id,
          text: 'I have been using Wealden Joinery since we started in 2007. The quality has always been high and the joinery has always been on time – even on the tightest deadlines.',
          author: 'Tony Palmer',
          location: 'Harlequin Building Company, East Sussex',
          rating: 5,
          order: 1
        },
        {
          landingTenantId: landingTenant.id,
          text: 'Excellent craftsmanship and attention to detail. Our oak windows are beautiful and were installed perfectly. Martin and his team were professional throughout.',
          author: 'Sarah Thompson',
          location: 'Tunbridge Wells',
          rating: 5,
          order: 2
        },
        {
          landingTenantId: landingTenant.id,
          text: 'We needed period-accurate windows for our listed building. Wealden Joinery delivered exactly what we needed, with expert advice on glazing requirements. Highly recommended.',
          author: 'James Harrison',
          location: 'Crowborough',
          rating: 5,
          order: 3
        }
      ]
    });
    console.log(`✅ Added 3 sample reviews`);
  } else {
    console.log(`ℹ️  ${existingReviews} reviews already exist`);
  }

  console.log('\n✅ Wealden Joinery landing page content updated successfully in PRODUCTION!');
  console.log(`   View at: https://www.joineryai.app/tenant/wealden-joinery/landing`);
}

updateWealdenLanding()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
