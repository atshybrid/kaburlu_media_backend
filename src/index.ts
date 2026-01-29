// dotenv is loaded inside config/env
import 'reflect-metadata';
import app from './app';
import http from 'http';
import { config } from './config/env';
import prisma from './lib/prisma';
import { ensureCoreSeeds } from './lib/bootstrap';
import { runAIStartupDiagnostics } from './lib/aiDiagnostics';

const port = config.port;

async function start() {
  try {
    const allowStartWithoutDb = String(process.env.ALLOW_START_WITHOUT_DB).toLowerCase() === 'true';
    if (process.env.DATABASE_URL) {
      // Retry connect a few times to tolerate transient network/DB issues
      const maxAttempts = Number(process.env.DB_CONNECT_RETRIES || 5);
      const baseDelayMs = Number(process.env.DB_CONNECT_BACKOFF_MS || 1000);
      let attempt = 0;
      let connected = false;
      while (attempt < maxAttempts && !connected) {
        try {
          attempt++;
          await prisma.$connect();
          connected = true;
          console.log('Prisma connected');
          // Run core seeds only after successful DB connect (with timeout to prevent blocking startup)
          // Skip seeding if SKIP_SEED=true (for production where data is already seeded)
          const skipSeed = String(process.env.SKIP_SEED).toLowerCase() === 'true';
          if (skipSeed) {
            console.log('[Bootstrap] Skipping core seeds (SKIP_SEED=true)');
          } else {
            try {
              const seedTimeout = Number(process.env.SEED_TIMEOUT_MS || 30000);
              await Promise.race([
                ensureCoreSeeds(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Seed timeout')), seedTimeout))
              ]);
              console.log('[Bootstrap] Core seeds complete');
            } catch (e: any) {
              console.warn('[Bootstrap] Core seed issue (non-blocking):', e?.message || e);
            }
          }
        } catch (e) {
          console.warn(`Prisma connect failed (attempt ${attempt}/${maxAttempts}):`, (e as any)?.message || e);
          if (attempt >= maxAttempts) {
            if (allowStartWithoutDb) {
              console.warn('Starting without DB connection due to ALLOW_START_WITHOUT_DB=true');
              break;
            }
            throw e;
          }
          const delay = baseDelayMs * attempt;
          await new Promise(r => setTimeout(r, delay));
        }
      }
    } else {
      console.log('DATABASE_URL not set — skipping Prisma connect');
    }

    const server = http.createServer(app);

    server.on('error', (err: any) => {
      if (err?.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Set PORT in .env or stop the other process.`);
        process.exit(1);
      }
      console.error('Server error:', err);
      process.exit(1);
    });

    server.listen(port, () => {
      console.log(`[Bootstrap] Server running (env=${config.env}) http://localhost:${port}`);
      console.log(`[Bootstrap] Swagger: http://localhost:${port}/api/docs`);
      // Optional: verify AI provider keys on startup (dev-safe, controlled by env flag)
      runAIStartupDiagnostics().catch(() => void 0);
    });

    // graceful shutdown
    const graceful = async (signal?: string) => {
      console.log(`\nReceived ${signal ?? 'signal'}, shutting down...`);
      const disconnectAndExit = async (exitCode: number) => {
        try {
          await prisma.$disconnect();
          console.log('Prisma disconnected');
        } catch (e) {
          console.error('Error during Prisma disconnect:', e);
          exitCode = 1;
        }
        process.exit(exitCode);
      };

      if (!server.listening) {
        await disconnectAndExit(0);
        return;
      }

      server.close(async (err) => {
        if (err) {
          console.error('Error while closing server:', err);
          await disconnectAndExit(1);
          return;
        }
        await disconnectAndExit(0);
      });
      // if server doesn't close in 10s, force exit
      setTimeout(() => {
        console.warn('Forcing shutdown after 10s');
        process.exit(1);
      }, 10_000).unref();
    };

    process.on('SIGINT', () => graceful('SIGINT'));
    process.on('SIGTERM', () => graceful('SIGTERM'));

    // handle unexpected errors
    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled Rejection:', reason);
    });
    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err);
      // try to shutdown gracefully
      graceful('uncaughtException');
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    try {
      await prisma.$disconnect();
    } catch (e) {
      // ignore
    }
    process.exit(1);
  }
}

start();
