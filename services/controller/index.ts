import { WhitelistSync } from './whitelist-sync';
import { PushNotifier } from './push-notifier';
import { BackupService } from './backup-service';
import { resolve } from 'path';
import { createServer } from 'http';

// Configuration
const RELAY_URL = process.env.RELAY_URL || 'ws://relay:7777';
const WHITELIST_PATH = process.env.WHITELIST_PATH || resolve(__dirname, '../../relay/whitelist.json');
const BACKUP_DIR = process.env.BACKUP_DIR || resolve(__dirname, '../../backups');
const BACKUP_ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY;
const BACKUP_RETENTION = parseInt(process.env.BACKUP_RETENTION || '10');
const CONTROLLER_PORT = parseInt(process.env.CONTROLLER_PORT || '8080');

// Start Whitelist Sync Service
const whitelistSync = new WhitelistSync(RELAY_URL, WHITELIST_PATH);
whitelistSync.start();

// Initialize Backup Service
const backupService = new BackupService({
  relayUrl: RELAY_URL,
  backupDir: BACKUP_DIR,
  encryptionKey: BACKUP_ENCRYPTION_KEY,
  retentionCount: BACKUP_RETENTION,
  compressionEnabled: true
});

backupService.initialize().then(() => {
  // Schedule daily backups if enabled
  if (process.env.BACKUP_SCHEDULE) {
    backupService.scheduleBackup(process.env.BACKUP_SCHEDULE);
  }
});

// Create HTTP server for backup endpoints
const server = createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    const url = new URL(req.url || '', `http://localhost:${CONTROLLER_PORT}`);
    const path = url.pathname;

    // POST /backup - Trigger manual backup
    if (path === '/backup' && req.method === 'POST') {
      const body = await readBody(req);
      const filter = body ? JSON.parse(body) : {};

      const metadata = await backupService.exportEvents(filter);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, backup: metadata }));
      return;
    }

    // GET /backups - List available backups
    if (path === '/backups' && req.method === 'GET') {
      const backups = await backupService.listBackups();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, backups }));
      return;
    }

    // GET /backups/:id - Get backup metadata
    if (path.match(/^\/backups\/[^/]+$/) && req.method === 'GET') {
      const backupId = path.split('/')[2];
      const backup = await backupService.getBackup(backupId);

      if (!backup) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Backup not found' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, backup }));
      return;
    }

    // GET /backups/:id/download - Download backup file
    if (path.match(/^\/backups\/[^/]+\/download$/) && req.method === 'GET') {
      const backupId = path.split('/')[2];
      const backup = await backupService.getBackup(backupId);

      if (!backup) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Backup not found' }));
        return;
      }

      const filePath = backupService.getBackupFilePath(backupId);
      const fs = await import('fs');

      res.writeHead(200, {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${backupId}.backup.json.gz"`
      });

      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // POST /restore - Restore from backup
    if (path === '/restore' && req.method === 'POST') {
      const body = await readBody(req);
      const { backupId } = JSON.parse(body || '{}');

      if (!backupId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'backupId required' }));
        return;
      }

      const restoredCount = await backupService.restoreFromBackup(backupId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, restoredCount }));
      return;
    }

    // DELETE /backups/:id - Delete backup
    if (path.match(/^\/backups\/[^/]+$/) && req.method === 'DELETE') {
      const backupId = path.split('/')[2];
      await backupService.deleteBackup(backupId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // GET /health - Health check
    if (path === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        status: 'healthy',
        services: {
          whitelist: 'active',
          backup: 'active'
        }
      }));
      return;
    }

    // Not found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Not found' }));

  } catch (error: any) {
    console.error('[Controller] Request error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: error.message || 'Internal server error'
    }));
  }
});

// Helper to read request body
function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Start HTTP server
server.listen(CONTROLLER_PORT, () => {
  console.log(`[Controller] HTTP server listening on port ${CONTROLLER_PORT}`);
  console.log('[Controller] Services started');
  console.log(`[Controller] Backup directory: ${BACKUP_DIR}`);
  console.log(`[Controller] Backup retention: ${BACKUP_RETENTION} backups`);
});

// Keep process alive and cleanup
process.on('SIGINT', () => {
  console.log('[Controller] Shutting down...');
  backupService.destroy();
  server.close();
  process.exit(0);
});