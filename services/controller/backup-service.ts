import { WebSocket } from 'ws';
import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { join, basename } from 'path';
import { createGzip, createGunzip } from 'zlib';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { pipeline } from 'stream/promises';

// Event kinds to backup
const ALL_EVENT_KINDS = [0, 1, 3, 4, 5, 6, 7, 9000, 9001, 30023, 30024, 31922, 31923, 31924, 31925];

interface NostrEvent {
  id: string;
  kind: number;
  pubkey: string;
  created_at: number;
  tags: string[][];
  content: string;
  sig: string;
}

interface BackupConfig {
  relayUrl: string;
  backupDir: string;
  encryptionKey?: string;
  retentionCount?: number;
  compressionEnabled?: boolean;
}

interface BackupMetadata {
  id: string;
  timestamp: number;
  eventCount: number;
  kinds: number[];
  timeRange: {
    from: number;
    to: number;
  };
  compressed: boolean;
  encrypted: boolean;
  size: number;
  checksum?: string;
}

interface BackupFilter {
  kinds?: number[];
  since?: number;
  until?: number;
  authors?: string[];
  limit?: number;
}

export class BackupService {
  private config: BackupConfig;
  private ws: WebSocket | null = null;
  private scheduledBackup: NodeJS.Timeout | null = null;

  constructor(config: BackupConfig) {
    this.config = {
      retentionCount: 10,
      compressionEnabled: true,
      ...config
    };
  }

  /**
   * Initialize backup service
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.config.backupDir, { recursive: true });
    console.log(`[BackupService] Initialized at ${this.config.backupDir}`);
  }

  /**
   * Export relay events to JSON backup file
   */
  async exportEvents(filter: BackupFilter = {}): Promise<BackupMetadata> {
    const backupId = `backup-${Date.now()}`;
    const events: NostrEvent[] = [];

    console.log(`[BackupService] Starting export with filter:`, filter);

    // Connect to relay and fetch events
    await this.connectToRelay();
    const fetchedEvents = await this.fetchEvents(filter);
    events.push(...fetchedEvents);

    console.log(`[BackupService] Fetched ${events.length} events`);

    // Create backup file
    const metadata = await this.createBackupFile(backupId, events, filter);

    // Apply retention policy
    await this.applyRetentionPolicy();

    console.log(`[BackupService] Export complete: ${metadata.id}`);
    return metadata;
  }

  /**
   * List all available backups
   */
  async listBackups(): Promise<BackupMetadata[]> {
    const files = await fs.readdir(this.config.backupDir);
    const metadataFiles = files.filter(f => f.endsWith('.meta.json'));

    const backups: BackupMetadata[] = [];
    for (const file of metadataFiles) {
      try {
        const content = await fs.readFile(join(this.config.backupDir, file), 'utf8');
        backups.push(JSON.parse(content));
      } catch (err) {
        console.error(`[BackupService] Error reading metadata ${file}:`, err);
      }
    }

    return backups.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get specific backup metadata
   */
  async getBackup(backupId: string): Promise<BackupMetadata | null> {
    try {
      const metaPath = join(this.config.backupDir, `${backupId}.meta.json`);
      const content = await fs.readFile(metaPath, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      return null;
    }
  }

  /**
   * Get backup file path for download
   */
  getBackupFilePath(backupId: string): string {
    return join(this.config.backupDir, `${backupId}.backup.json.gz`);
  }

  /**
   * Restore events from backup file
   */
  async restoreFromBackup(backupId: string): Promise<number> {
    const metadata = await this.getBackup(backupId);
    if (!metadata) {
      throw new Error(`Backup ${backupId} not found`);
    }

    console.log(`[BackupService] Restoring from ${backupId}`);

    // Read and decompress backup file
    const events = await this.readBackupFile(backupId, metadata);

    // Connect to relay and publish events
    await this.connectToRelay();
    let restored = 0;

    for (const event of events) {
      try {
        await this.publishEvent(event);
        restored++;
        if (restored % 100 === 0) {
          console.log(`[BackupService] Restored ${restored}/${events.length} events`);
        }
      } catch (err) {
        console.error(`[BackupService] Failed to restore event ${event.id}:`, err);
      }
    }

    console.log(`[BackupService] Restore complete: ${restored}/${events.length} events`);
    return restored;
  }

  /**
   * Delete old backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    const backupPath = this.getBackupFilePath(backupId);
    const metaPath = join(this.config.backupDir, `${backupId}.meta.json`);

    await Promise.all([
      fs.unlink(backupPath).catch(() => {}),
      fs.unlink(metaPath).catch(() => {})
    ]);

    console.log(`[BackupService] Deleted backup ${backupId}`);
  }

  /**
   * Schedule automatic backups using cron-like pattern
   * @param cronPattern - Simple patterns: 'daily', 'weekly', or interval in ms
   */
  scheduleBackup(cronPattern: string | number): void {
    if (this.scheduledBackup) {
      clearInterval(this.scheduledBackup);
    }

    let interval: number;
    if (typeof cronPattern === 'number') {
      interval = cronPattern;
    } else if (cronPattern === 'daily') {
      interval = 24 * 60 * 60 * 1000; // 24 hours
    } else if (cronPattern === 'weekly') {
      interval = 7 * 24 * 60 * 60 * 1000; // 7 days
    } else {
      throw new Error(`Unsupported cron pattern: ${cronPattern}`);
    }

    this.scheduledBackup = setInterval(async () => {
      try {
        console.log(`[BackupService] Running scheduled backup`);
        await this.exportEvents({});
      } catch (err) {
        console.error(`[BackupService] Scheduled backup failed:`, err);
      }
    }, interval);

    console.log(`[BackupService] Scheduled backup every ${interval}ms`);
  }

  /**
   * Stop scheduled backups
   */
  stopScheduledBackup(): void {
    if (this.scheduledBackup) {
      clearInterval(this.scheduledBackup);
      this.scheduledBackup = null;
      console.log(`[BackupService] Stopped scheduled backups`);
    }
  }

  // Private methods

  private async connectToRelay(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.relayUrl);

      this.ws.on('open', () => {
        console.log(`[BackupService] Connected to ${this.config.relayUrl}`);
        resolve();
      });

      this.ws.on('error', (err) => {
        console.error(`[BackupService] WebSocket error:`, err);
        reject(err);
      });

      setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });
  }

  private async fetchEvents(filter: BackupFilter): Promise<NostrEvent[]> {
    return new Promise((resolve, reject) => {
      const events: NostrEvent[] = [];
      const subscriptionId = `backup-${Date.now()}`;

      const relayFilter: any = {
        kinds: filter.kinds || ALL_EVENT_KINDS,
      };

      if (filter.since) relayFilter.since = filter.since;
      if (filter.until) relayFilter.until = filter.until;
      if (filter.authors) relayFilter.authors = filter.authors;
      if (filter.limit) relayFilter.limit = filter.limit;

      const timeout = setTimeout(() => {
        this.ws?.send(JSON.stringify(['CLOSE', subscriptionId]));
        resolve(events);
      }, 30000); // 30 second timeout

      const messageHandler = (data: any) => {
        try {
          const msg = JSON.parse(data.toString());
          if (Array.isArray(msg)) {
            if (msg[0] === 'EVENT' && msg[1] === subscriptionId) {
              events.push(msg[2]);
            } else if (msg[0] === 'EOSE' && msg[1] === subscriptionId) {
              clearTimeout(timeout);
              this.ws?.off('message', messageHandler);
              this.ws?.send(JSON.stringify(['CLOSE', subscriptionId]));
              resolve(events);
            }
          }
        } catch (err) {
          console.error(`[BackupService] Error parsing message:`, err);
        }
      };

      this.ws?.on('message', messageHandler);
      this.ws?.send(JSON.stringify(['REQ', subscriptionId, relayFilter]));
    });
  }

  private async createBackupFile(
    backupId: string,
    events: NostrEvent[],
    filter: BackupFilter
  ): Promise<BackupMetadata> {
    const backupPath = this.getBackupFilePath(backupId);
    const metaPath = join(this.config.backupDir, `${backupId}.meta.json`);

    // Prepare backup data
    const backupData = JSON.stringify(events, null, 2);

    // Compression
    let finalPath = backupPath;
    if (this.config.compressionEnabled) {
      await this.compressFile(backupData, backupPath);
    } else {
      await fs.writeFile(backupPath, backupData);
    }

    // Encryption (optional)
    if (this.config.encryptionKey) {
      const encryptedPath = `${backupPath}.enc`;
      await this.encryptFile(backupPath, encryptedPath, this.config.encryptionKey);
      await fs.unlink(backupPath);
      finalPath = encryptedPath;
    }

    // Get file stats
    const stats = await fs.stat(finalPath);

    // Create metadata
    const kindsSet = new Set(events.map(e => e.kind));
    const kinds = Array.from(kindsSet);
    const timestamps = events.map(e => e.created_at);
    const metadata: BackupMetadata = {
      id: backupId,
      timestamp: Date.now(),
      eventCount: events.length,
      kinds: kinds.sort((a, b) => a - b),
      timeRange: {
        from: Math.min(...timestamps),
        to: Math.max(...timestamps)
      },
      compressed: this.config.compressionEnabled || false,
      encrypted: !!this.config.encryptionKey,
      size: stats.size
    };

    // Save metadata
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));

    return metadata;
  }

  private async compressFile(data: string, outputPath: string): Promise<void> {
    const gzip = createGzip({ level: 9 });
    const source = Buffer.from(data);
    const destination = createWriteStream(outputPath);

    await pipeline(
      async function* () {
        yield source;
      },
      gzip,
      destination
    );
  }

  private async encryptFile(inputPath: string, outputPath: string, password: string): Promise<void> {
    const algorithm = 'aes-256-cbc';
    const salt = randomBytes(16);
    const key = scryptSync(password, salt, 32);
    const iv = randomBytes(16);

    const cipher = createCipheriv(algorithm, key, iv);
    const input = createReadStream(inputPath);
    const output = createWriteStream(outputPath);

    // Write salt and IV first
    output.write(salt);
    output.write(iv);

    await pipeline(input, cipher, output);
  }

  private async readBackupFile(backupId: string, metadata: BackupMetadata): Promise<NostrEvent[]> {
    let backupPath = this.getBackupFilePath(backupId);

    // Handle encryption
    if (metadata.encrypted) {
      if (!this.config.encryptionKey) {
        throw new Error('Encryption key required to restore encrypted backup');
      }
      backupPath = `${backupPath}.enc`;
      const decryptedPath = `${backupPath}.dec`;
      await this.decryptFile(backupPath, decryptedPath, this.config.encryptionKey);
      backupPath = decryptedPath;
    }

    // Handle compression
    let data: string;
    if (metadata.compressed) {
      data = await this.decompressFile(backupPath);
    } else {
      data = await fs.readFile(backupPath, 'utf8');
    }

    // Cleanup decrypted file if created
    if (metadata.encrypted) {
      await fs.unlink(backupPath).catch(() => {});
    }

    return JSON.parse(data);
  }

  private async decompressFile(inputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const gunzip = createGunzip();
      const input = createReadStream(inputPath);

      gunzip.on('data', (chunk) => chunks.push(chunk));
      gunzip.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      gunzip.on('error', reject);

      input.pipe(gunzip);
    });
  }

  private async decryptFile(inputPath: string, outputPath: string, password: string): Promise<void> {
    const algorithm = 'aes-256-cbc';
    const input = createReadStream(inputPath);

    // Read salt and IV
    const salt = await this.readBytes(input, 16);
    const iv = await this.readBytes(input, 16);
    const key = scryptSync(password, salt, 32);

    const decipher = createDecipheriv(algorithm, key, iv);
    const output = createWriteStream(outputPath);

    await pipeline(input, decipher, output);
  }

  private async readBytes(stream: any, length: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const onReadable = () => {
        const chunk = stream.read(length);
        if (chunk) {
          stream.off('readable', onReadable);
          stream.off('error', onError);
          resolve(chunk);
        }
      };
      const onError = (err: Error) => {
        stream.off('readable', onReadable);
        stream.off('error', onError);
        reject(err);
      };
      stream.on('readable', onReadable);
      stream.on('error', onError);
      onReadable();
    });
  }

  private async publishEvent(event: NostrEvent): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Publish timeout')), 5000);

      const messageHandler = (data: any) => {
        try {
          const msg = JSON.parse(data.toString());
          if (Array.isArray(msg) && msg[0] === 'OK' && msg[1] === event.id) {
            clearTimeout(timeout);
            this.ws?.off('message', messageHandler);
            if (msg[2]) {
              resolve();
            } else {
              reject(new Error(msg[3] || 'Event rejected'));
            }
          }
        } catch (err) {
          // Ignore parse errors
        }
      };

      this.ws?.on('message', messageHandler);
      this.ws?.send(JSON.stringify(['EVENT', event]));
    });
  }

  private async applyRetentionPolicy(): Promise<void> {
    const backups = await this.listBackups();
    const toDelete = backups.slice(this.config.retentionCount || 10);

    for (const backup of toDelete) {
      try {
        await this.deleteBackup(backup.id);
        console.log(`[BackupService] Deleted old backup ${backup.id} (retention policy)`);
      } catch (err) {
        console.error(`[BackupService] Failed to delete backup ${backup.id}:`, err);
      }
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopScheduledBackup();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
