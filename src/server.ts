import { createServer } from 'http';
import app from '@/app';
import config from '@/config';

import { connectDB, disconnectDB } from '@/utils/db';
import { SocketServices } from '@/modules/socket/Socket.service';
import { subscriptionExpireJob } from '@/modules/subscription/Subscription.job';

async function start() {
  // 1) DB connect (once)
  await connectDB();

  // 2) HTTP server start
  const server = createServer(app);
  await new Promise<void>(resolve =>
    server.listen(config.server.port, '0.0.0.0', resolve),
  );
  console.log(`Server running on http://localhost:${config.server.port}`);

  // 3) Start "plugins" (each returns cleanup function)
  const cleanups = [SocketServices.init(server), subscriptionExpireJob()];

  // 4) One shutdown function for everything
  let closing = false;

  const shutdown = async (code: number, reason?: unknown) => {
    if (closing) return;
    closing = true;

    if (reason) console.error(reason);

    // Force exit if graceful shutdown hangs
    const force = setTimeout(() => process.exit(code), 10_000);
    force.unref();

    // Stop accepting new connections
    await new Promise<void>(resolve => server.close(() => resolve()));

    // Stop plugins (socket, cron, queues...)
    await Promise.allSettled(cleanups.map(fn => fn()));

    // Disconnect DB
    await disconnectDB();

    process.exit(code);
  };

  // PM2 uses SIGINT/SIGTERM
  process.once('SIGINT', () => shutdown(0, 'SIGINT'));
  process.once('SIGTERM', () => shutdown(0, 'SIGTERM'));

  // Crashes
  process.once('uncaughtException', err => shutdown(1, err));
  process.once('unhandledRejection', reason => shutdown(1, reason));
}

start().catch(async err => {
  console.error('Startup failed:', err);
  await disconnectDB().catch(() => {});
  process.exit(1);
});
