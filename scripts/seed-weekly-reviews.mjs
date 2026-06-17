// One-off: seed sample Store Manager Weekly Reviews (dev only).
//   node scripts/seed-weekly-reviews.mjs
import { neon } from '@neondatabase/serverless';
import './load-env.mjs';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}
const sql = neon(url);

const CATS = ['Luxury Suits', 'Business Suits', 'Formal Shirts', 'Sneakers', 'Oxford Shoes', 'Watches', 'Fragrances', 'Leather Belts'];

function buildCategories(seed) {
  const out = {};
  CATS.forEach((c, i) => {
    const units = 4 + ((seed * 3 + i * 7) % 18);
    const price = 400 + ((i * 137) % 1600);
    const ratingPick = ['Good', 'Fair', 'Poor'][(seed + i) % 3];
    const atRisk = (seed + i) % 4 === 0 ? (i + 1) * 1500 : 0;
    out[c] = {
      openingStock: 30 + i * 5,
      unitsSold: String(units),
      revenue: String(units * price),
      currentStock: 20 + i * 4,
      rating: ratingPick,
      comments: '',
      overstocked: atRisk ? 'Y' : 'N',
      slowMoving: atRisk ? 'Y' : 'N',
      weeksNoMove: atRisk ? '3' : '0',
      valueAtRisk: String(atRisk),
      corrective: atRisk ? 'Markdown 20%' : '',
      salesTargetUnits: String(units + 5),
      revenueTarget: String((units + 5) * price),
      keyActivity: 'Window feature + advisor push',
      planAdvisor: 'A. Mensah',
      assignedAdvisor: 'A. Mensah',
      weeklyUnitTarget: String(units + 5),
      actualUnits: String(units),
      achievement: String(Math.round((units / (units + 5)) * 1000) / 10),
      mgrComments: '',
    };
  });
  return out;
}

const WEEKS = [
  { weekEnd: '2026-05-18', store: 'east-legon-men', target: 220000, actual: 168000 },
  { weekEnd: '2026-05-25', store: 'east-legon-men', target: 220000, actual: 201000 },
  { weekEnd: '2026-06-01', store: 'east-legon-men', target: 230000, actual: 244000 },
];

for (let i = 0; i < WEEKS.length; i++) {
  const w = WEEKS[i];
  const payload = {
    store: w.store,
    manager: 'Kwabena Asante',
    weekEnd: w.weekEnd,
    weeklySalesTarget: String(w.target),
    actualSales: String(w.actual),
    achievement: Math.round((w.actual / w.target) * 1000) / 10,
    categories: buildCategories(i + 1),
    ceo: {
      q1: `Watches, Luxury Suits and Fragrances drove the most revenue in the week ending ${w.weekEnd} — strong walk-in demand and two corporate orders.`,
      q2: `Oxford Shoes and Leather Belts concern me — slow movement and ageing stock.`,
      q3: `Marketing should amplify Fragrances ahead of the weekend.`,
      q4: `Ageing formal footwear represents the greatest commercial risk right now.`,
      q5: `Re-merchandise the entrance and brief advisors on suit cross-sell.`,
      q6: `1) Clear ageing shoes via a targeted promo 2) Re-train on add-on selling 3) Tighten replenishment on Watches.`,
    },
    declaration: { confirmed: ['My category performance', 'My inventory position'], manager: 'Kwabena Asante', signature: 'K. Asante', date: w.weekEnd },
  };
  await sql`INSERT INTO entries (department, form_type, payload) VALUES ('commercial', 'weekly-review', ${JSON.stringify(payload)}::jsonb)`;
  console.log(`seeded weekly-review for week ending ${w.weekEnd} (achievement ${payload.achievement}%)`);
}
console.log('done');
