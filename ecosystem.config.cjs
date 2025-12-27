/**
 * PM2 process file for running Kaburlu Media Backend in production.
 *
 * Best practice: run API + background worker as separate processes.
 *
 * Usage:
 *  1) npm run build
 *  2) npx pm2 start ecosystem.config.cjs
 *  3) npx pm2 save
 *  4) npx pm2 logs
 */

module.exports = {
  apps: [
    {
      name: 'kaburlu-api',
      script: 'dist/index.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 2000,
      time: true,
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'kaburlu-ai-cron',
      script: 'dist/jobs/aiQueue.cron.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 2000,
      time: true,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
