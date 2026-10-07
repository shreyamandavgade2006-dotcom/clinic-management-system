'use strict';

const env = require('./config/env');
const app = require('./app');
const { connectDatabase, disconnectDatabase } = require('./config/db');
const { startScheduler } = require('./jobs/attendanceAlertJob');

async function bootstrap() {
  const mode = await connectDatabase();

  // First run without a database → seed the demo data so the UI is not empty.
  if (env.autoSeed) {
    try {
      const { ensureSeedData } = require('./seed/seedData');
      const result = await ensureSeedData();
      if (result.seeded) {
        console.log(
          `\x1b[32m✔\x1b[0m Demo data seeded — ${result.counts.students} students, ${result.counts.teachers} teachers, ` +
            `${result.counts.subjects} subjects, ${result.counts.attendanceRecords} attendance records.`
        );
        console.log(
          `   Teacher login: \x1b[36mpriya.sharma@ssms.edu\x1b[0m / ${env.seedPasswordTeacher}\n` +
            `   Student login: \x1b[36maarav.patil@ssms.edu\x1b[0m / ${env.seedPasswordStudent}`
        );
      }
    } catch (error) {
      console.warn('⚠ Automatic seeding skipped:', error.message);
    }
  }

  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log('');
    console.log('  \x1b[35m🎓 Smart Student Management System API\x1b[0m');
    console.log(`  → URL      : http://localhost:${env.port}/api`);
    console.log(`  → Health   : http://localhost:${env.port}/api/health`);
    console.log(`  → Storage  : ${mode === 'mongodb' ? 'MongoDB' : 'in-memory demo store'}`);
    console.log(`  → AI       : ${env.aiProvider} (set GEMINI_API_KEY / OPENAI_API_KEY for live generation)`);
    console.log(`  → WhatsApp : ${env.whatsappProvider} (attendance threshold ${env.attendanceThreshold}%)`);
    console.log('');
  });

  const scheduler = startScheduler();

  const shutdown = async (signal) => {
    console.log(`\n${signal} received — shutting down…`);
    scheduler.stop();
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  console.error('✖ Failed to start the API:', error);
  process.exit(1);
});
