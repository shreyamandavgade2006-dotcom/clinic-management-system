'use strict';

/**
 * WhatsApp attendance alert job.
 *
 * Two ways to run it:
 *   1. In-process scheduler (started automatically by the API when WHATSAPP_ALERT_CRON=true)
 *   2. Standalone:  npm run alerts --prefix server   [--class=TE-A] [--threshold=75] [--dry]
 */

const env = require('../config/env');
const { connectDatabase, disconnectDatabase } = require('../config/db');
const { runAttendanceAlerts } = require('../services/attendanceAlertService');

const ONE_HOUR = 3600 * 1000;

async function execute({ className, threshold, dryRun, force } = {}) {
  const startedAt = Date.now();
  const result = await runAttendanceAlerts({
    className,
    threshold: threshold ? Number(threshold) : env.attendanceThreshold,
    dryRun: !!dryRun,
    force: !!force,
  });

  console.log(
    `\x1b[36m📣 Attendance alert run\x1b[0m — scanned ${result.scanned} defaulter(s) below ${result.threshold}% ` +
      `· sent ${result.sent} · skipped ${result.skippedNoPhone + result.skippedOptOut + result.skippedCooldown} · failed ${result.failed} ` +
      `(${Date.now() - startedAt} ms, provider: ${result.provider})`
  );
  return result;
}

/**
 * Starts an interval-based scheduler. Default: every 6 hours.
 * Enable with WHATSAPP_ALERT_CRON=true and tune with WHATSAPP_ALERT_INTERVAL_HOURS.
 */
function startScheduler({ intervalHours = Number(process.env.WHATSAPP_ALERT_INTERVAL_HOURS || 6) } = {}) {
  if (String(process.env.WHATSAPP_ALERT_CRON || '').toLowerCase() !== 'true') {
    return { stop: () => {}, enabled: false };
  }

  const run = async () => {
    try {
      await execute({});
    } catch (error) {
      console.error('✖ Attendance alert job failed:', error.message);
    }
  };

  run(); // run once at startup
  const timer = setInterval(run, Math.max(1, intervalHours) * ONE_HOUR);
  console.log(`⏰ WhatsApp attendance alert scheduler started (every ${intervalHours}h)`);
  return { stop: () => clearInterval(timer), enabled: true };
}

/* ----------------------------- CLI entry ----------------------------- */

if (require.main === module) {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [key, ...rest] = arg.replace(/^--?/, '').split('=');
      return [key.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), rest.join('=') || true];
    })
  );

  (async () => {
    await connectDatabase();
    await execute({
      className: args.class || args.className,
      threshold: args.threshold,
      dryRun: args.dry || args.dryRun,
      force: args.force,
    });
    await disconnectDatabase();
    process.exit(0);
  })().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { execute, startScheduler };
