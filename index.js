const config = require('./src/config');
const db = require('./src/database/db');
const client = require('./src/platform/client');
const autoBehavior = require('./src/agent/autoBehavior');
const app = require('./src/server/app');

async function bootstrap() {
  console.log('========================================================');
  console.log('🚀 Starting Sabu Business Agent (സാബു ബിസിനസ്സ് ഏജന്റ്)');
  console.log('========================================================');

  // 1. Initialize Database
  try {
    await db.init();
  } catch (err) {
    console.warn('[Bootstrap] Database initialization warning:', err.message);
  }

  // 2. Connect to ProChat Platform
  try {
    await client.login();
    client.connectSocket();
  } catch (err) {
    console.error('❌ [Bootstrap] Failed initial platform connection:', err.message);
    console.log('ℹ️ [Bootstrap] Will keep trying to connect in background...');
    // Retry login periodically if initial fails
    setInterval(async () => {
      if (!client.isConnected && !client.token) {
        try {
          await client.login();
          client.connectSocket();
        } catch (e) {
          // Retry silently
        }
      }
    }, 15000);
  }

  // 3. Initialize Autonomous Behavior
  autoBehavior.init();

  // 4. Start Web Server & Dashboard
  const server = app.listen(config.port, () => {
    console.log(`\n========================================================`);
    console.log(`🌐 Sabu Live Dashboard running on http://localhost:${config.port}`);
    console.log(`   Health check endpoint: http://localhost:${config.port}/health`);
    console.log(`========================================================\n`);
  });

  // Graceful shutdown handling
  const shutdown = () => {
    console.log('\nStopping Sabu Agent gracefully...');
    if (client.socket) client.socket.disconnect();
    server.close(() => {
      console.log('Sabu Agent stopped.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch(err => {
  console.error('Fatal bootstrap error:', err);
});

