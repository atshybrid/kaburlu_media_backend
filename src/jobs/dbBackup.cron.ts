/**
 * Database Backup Cron Job
 * Runs daily at midnight (12:00 AM) to backup PostgreSQL database to Bunny Storage
 * 
 * Usage:
 *   npm run jobs:db-backup       # Run once
 *   npm run jobs:db-backup-cron  # Run as cron (every day at midnight)
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import cron from 'node-cron';

// Load environment
import '../config/env';

const {
  DATABASE_URL_DIRECT,
  DATABASE_URL,
  BUNNY_STORAGE_ZONE_NAME,
  BUNNY_STORAGE_API_KEY,
  DB_BACKUP_CRON = '0 0 * * *', // Default: midnight every day
  DB_BACKUP_RETENTION_DAYS = '30', // Keep backups for 30 days
} = process.env;

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const BUNNY_STORAGE_HOST = 'storage.bunnycdn.com';

interface BackupResult {
  success: boolean;
  filename?: string;
  size?: number;
  bunnyUrl?: string;
  error?: string;
}

/**
 * Create database dump using pg_dump
 */
async function createDatabaseDump(): Promise<{ filename: string; filepath: string }> {
  // Use direct URL (non-pooler) for pg_dump
  const dbUrl = DATABASE_URL_DIRECT || DATABASE_URL;
  
  if (!dbUrl) {
    throw new Error('DATABASE_URL_DIRECT or DATABASE_URL is required');
  }

  // Ensure backup directory exists
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `kaburlu_backup_${timestamp}.sql.gz`;
  const filepath = path.join(BACKUP_DIR, filename);

  console.log(`[DB Backup] Creating dump: ${filename}`);

  try {
    // Use pg_dump with gzip compression
    // Note: pg_dump must be installed on the system
    execSync(`pg_dump "${dbUrl}" | gzip > "${filepath}"`, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 600000, // 10 minute timeout
    });

    const stats = fs.statSync(filepath);
    console.log(`[DB Backup] Dump created: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

    return { filename, filepath };
  } catch (error: any) {
    // If pg_dump not available, try alternative approach with node
    console.warn('[DB Backup] pg_dump not available, trying alternative...');
    throw new Error(`pg_dump failed: ${error.message}. Install PostgreSQL client tools.`);
  }
}

/**
 * Upload file to Bunny Storage
 */
async function uploadToBunny(filepath: string, filename: string): Promise<string> {
  if (!BUNNY_STORAGE_ZONE_NAME || !BUNNY_STORAGE_API_KEY) {
    throw new Error('BUNNY_STORAGE_ZONE_NAME and BUNNY_STORAGE_API_KEY are required');
  }

  const fileBuffer = fs.readFileSync(filepath);
  const bunnyPath = `/db-backups/${filename}`;
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BUNNY_STORAGE_HOST,
      port: 443,
      path: `/${BUNNY_STORAGE_ZONE_NAME}${bunnyPath}`,
      method: 'PUT',
      headers: {
        'AccessKey': BUNNY_STORAGE_API_KEY,
        'Content-Type': 'application/gzip',
        'Content-Length': fileBuffer.length,
      },
    };

    console.log(`[DB Backup] Uploading to Bunny Storage: ${bunnyPath}`);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 201 || res.statusCode === 200) {
          const url = `https://${BUNNY_STORAGE_ZONE_NAME}.b-cdn.net${bunnyPath}`;
          console.log(`[DB Backup] Upload successful: ${url}`);
          resolve(url);
        } else {
          reject(new Error(`Bunny upload failed: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });
}

/**
 * Clean up old local backups
 */
function cleanupLocalBackups(): void {
  if (!fs.existsSync(BACKUP_DIR)) return;

  const files = fs.readdirSync(BACKUP_DIR);
  const now = Date.now();
  const retentionMs = parseInt(DB_BACKUP_RETENTION_DAYS) * 24 * 60 * 60 * 1000;

  for (const file of files) {
    const filepath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filepath);
    
    if (now - stats.mtimeMs > retentionMs) {
      fs.unlinkSync(filepath);
      console.log(`[DB Backup] Deleted old backup: ${file}`);
    }
  }
}

/**
 * Clean up old backups from Bunny Storage
 */
async function cleanupBunnyBackups(): Promise<void> {
  if (!BUNNY_STORAGE_ZONE_NAME || !BUNNY_STORAGE_API_KEY) return;

  const retentionDays = parseInt(DB_BACKUP_RETENTION_DAYS);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  return new Promise((resolve, reject) => {
    // List files in db-backups folder
    const options = {
      hostname: BUNNY_STORAGE_HOST,
      port: 443,
      path: `/${BUNNY_STORAGE_ZONE_NAME}/db-backups/`,
      method: 'GET',
      headers: {
        'AccessKey': BUNNY_STORAGE_API_KEY,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', async () => {
        if (res.statusCode !== 200) {
          console.warn(`[DB Backup] Could not list Bunny backups: ${res.statusCode}`);
          resolve();
          return;
        }

        try {
          const files = JSON.parse(data);
          for (const file of files) {
            const fileDate = new Date(file.LastChanged || file.DateCreated);
            if (fileDate < cutoffDate) {
              await deleteBunnyFile(`/db-backups/${file.ObjectName}`);
              console.log(`[DB Backup] Deleted old Bunny backup: ${file.ObjectName}`);
            }
          }
          resolve();
        } catch (e) {
          console.warn('[DB Backup] Could not parse Bunny file list');
          resolve();
        }
      });
    });

    req.on('error', () => resolve());
    req.end();
  });
}

/**
 * Delete a file from Bunny Storage
 */
async function deleteBunnyFile(filepath: string): Promise<void> {
  return new Promise((resolve) => {
    const options = {
      hostname: BUNNY_STORAGE_HOST,
      port: 443,
      path: `/${BUNNY_STORAGE_ZONE_NAME}${filepath}`,
      method: 'DELETE',
      headers: {
        'AccessKey': BUNNY_STORAGE_API_KEY!,
      },
    };

    const req = https.request(options, () => resolve());
    req.on('error', () => resolve());
    req.end();
  });
}

/**
 * Run the full backup process
 */
async function runBackup(): Promise<BackupResult> {
  const startTime = Date.now();
  console.log(`\n[DB Backup] Starting backup at ${new Date().toISOString()}`);

  try {
    // Step 1: Create database dump
    const { filename, filepath } = await createDatabaseDump();
    const stats = fs.statSync(filepath);

    // Step 2: Upload to Bunny Storage
    const bunnyUrl = await uploadToBunny(filepath, filename);

    // Step 3: Cleanup old backups
    cleanupLocalBackups();
    await cleanupBunnyBackups();

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[DB Backup] Completed in ${duration}s\n`);

    return {
      success: true,
      filename,
      size: stats.size,
      bunnyUrl,
    };
  } catch (error: any) {
    console.error(`[DB Backup] Failed:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Main execution
const args = process.argv.slice(2);
const isCronMode = args.includes('--cron') || process.env.DB_BACKUP_CRON_MODE === 'true';

if (isCronMode) {
  console.log(`[DB Backup] Cron mode enabled: ${DB_BACKUP_CRON}`);
  console.log(`[DB Backup] Retention: ${DB_BACKUP_RETENTION_DAYS} days`);
  
  // Validate cron expression
  if (!cron.validate(DB_BACKUP_CRON)) {
    console.error(`[DB Backup] Invalid cron expression: ${DB_BACKUP_CRON}`);
    process.exit(1);
  }

  // Schedule the backup job
  cron.schedule(DB_BACKUP_CRON, async () => {
    await runBackup();
  });

  console.log('[DB Backup] Cron job scheduled. Waiting for next run...');
} else {
  // Run once immediately
  runBackup().then((result) => {
    if (!result.success) {
      process.exit(1);
    }
  });
}
