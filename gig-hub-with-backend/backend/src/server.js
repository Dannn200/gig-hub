const config = require('./config');
const app = require('./app');
const { startReminderJob } = require('./services/reminders');

const server = app.listen(config.port, () => {
  console.log(`Gig Hub API listening on http://localhost:${config.port}/api  (${config.isProd ? 'production' : 'development'})`);
});
startReminderJob();

const shutdown = (sig) => () => {
  console.log(`${sig} received, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
};
process.on('SIGTERM', shutdown('SIGTERM'));
process.on('SIGINT', shutdown('SIGINT'));
