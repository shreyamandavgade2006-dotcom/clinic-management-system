'use strict';

/**
 * Usage:
 *   npm run seed          → seeds only when the database is empty
 *   npm run seed:fresh    → wipes and reseeds everything
 */

const env = require('../config/env');
const { connectDatabase, disconnectDatabase } = require('../config/db');
const { seedDatabase, ensureSeedData } = require('./seedData');

(async () => {
  const fresh = process.argv.includes('--fresh') || process.argv.includes('-f');

  await connectDatabase();
  console.log(fresh ? '🌱 Seeding fresh demo data…' : '🌱 Checking seed state…');

  const started = Date.now();
  const result = fresh ? { seeded: true, counts: await seedDatabase({ fresh: true }) } : await ensureSeedData();

  if (!result.seeded) {
    console.log('✔ Database already contains data — nothing to do. Use `npm run seed:fresh` to reset.');
  } else {
    console.log('✔ Seed complete in', Date.now() - started, 'ms');
    console.table(result.counts);
    console.log('\n🔑 Demo logins');
    console.log('   Teacher : priya.sharma@ssms.edu  /', env.seedPasswordTeacher);
    console.log('   Teacher : rahul.deshmukh@ssms.edu /', env.seedPasswordTeacher);
    console.log('   Student : aarav.patil@ssms.edu   /', env.seedPasswordStudent);
    console.log('   Student : rohan.jadhav@ssms.edu  /', env.seedPasswordStudent, '(low attendance demo)');
  }

  await disconnectDatabase();
  process.exit(0);
})().catch((error) => {
  console.error('✖ Seeding failed:', error);
  process.exit(1);
});
