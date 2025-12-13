import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BackupService } from './backup-service';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('BackupService', () => {
  let backupService: BackupService;
  let testBackupDir: string;

  beforeEach(async () => {
    // Create temporary backup directory
    testBackupDir = join(tmpdir(), `backup-test-${Date.now()}`);
    await fs.mkdir(testBackupDir, { recursive: true });

    backupService = new BackupService({
      relayUrl: 'ws://localhost:7777',
      backupDir: testBackupDir,
      compressionEnabled: true,
      retentionCount: 5
    });

    await backupService.initialize();
  });

  afterEach(async () => {
    // Cleanup
    backupService.destroy();
    try {
      await fs.rm(testBackupDir, { recursive: true, force: true });
    } catch (err) {
      // Ignore cleanup errors
    }
  });

  it('should initialize backup directory', async () => {
    const stats = await fs.stat(testBackupDir);
    expect(stats.isDirectory()).toBe(true);
  });

  it('should list empty backups initially', async () => {
    const backups = await backupService.listBackups();
    expect(backups).toEqual([]);
  });

  it('should create backup metadata structure', async () => {
    // Mock backup creation by manually creating metadata
    const backupId = 'test-backup-123';
    const metadata = {
      id: backupId,
      timestamp: Date.now(),
      eventCount: 10,
      kinds: [0, 1, 3],
      timeRange: {
        from: 1700000000,
        to: 1700001000
      },
      compressed: true,
      encrypted: false,
      size: 1024
    };

    const metaPath = join(testBackupDir, `${backupId}.meta.json`);
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));

    const backups = await backupService.listBackups();
    expect(backups).toHaveLength(1);
    expect(backups[0].id).toBe(backupId);
    expect(backups[0].eventCount).toBe(10);
  });

  it('should get specific backup metadata', async () => {
    const backupId = 'test-backup-456';
    const metadata = {
      id: backupId,
      timestamp: Date.now(),
      eventCount: 5,
      kinds: [1],
      timeRange: {
        from: 1700000000,
        to: 1700001000
      },
      compressed: true,
      encrypted: false,
      size: 512
    };

    const metaPath = join(testBackupDir, `${backupId}.meta.json`);
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));

    const backup = await backupService.getBackup(backupId);
    expect(backup).not.toBeNull();
    expect(backup?.id).toBe(backupId);
    expect(backup?.eventCount).toBe(5);
  });

  it('should return null for non-existent backup', async () => {
    const backup = await backupService.getBackup('non-existent');
    expect(backup).toBeNull();
  });

  it('should delete backup files', async () => {
    const backupId = 'test-backup-delete';
    const metaPath = join(testBackupDir, `${backupId}.meta.json`);
    const backupPath = join(testBackupDir, `${backupId}.backup.json.gz`);

    await fs.writeFile(metaPath, JSON.stringify({ id: backupId }));
    await fs.writeFile(backupPath, 'test data');

    await backupService.deleteBackup(backupId);

    // Verify files are deleted
    await expect(fs.access(metaPath)).rejects.toThrow();
    await expect(fs.access(backupPath)).rejects.toThrow();
  });

  it('should sort backups by timestamp descending', async () => {
    // Create multiple backups with different timestamps
    const backups = [
      { id: 'backup-1', timestamp: 1000 },
      { id: 'backup-2', timestamp: 3000 },
      { id: 'backup-3', timestamp: 2000 }
    ];

    for (const backup of backups) {
      const metaPath = join(testBackupDir, `${backup.id}.meta.json`);
      await fs.writeFile(metaPath, JSON.stringify({
        ...backup,
        eventCount: 0,
        kinds: [],
        timeRange: { from: 0, to: 0 },
        compressed: false,
        encrypted: false,
        size: 0
      }));
    }

    const listed = await backupService.listBackups();
    expect(listed).toHaveLength(3);
    expect(listed[0].timestamp).toBe(3000);
    expect(listed[1].timestamp).toBe(2000);
    expect(listed[2].timestamp).toBe(1000);
  });

  it('should handle scheduled backup configuration', () => {
    // Daily schedule
    expect(() => {
      backupService.scheduleBackup('daily');
    }).not.toThrow();

    backupService.stopScheduledBackup();

    // Weekly schedule
    expect(() => {
      backupService.scheduleBackup('weekly');
    }).not.toThrow();

    backupService.stopScheduledBackup();

    // Custom interval
    expect(() => {
      backupService.scheduleBackup(60000); // 1 minute
    }).not.toThrow();

    backupService.stopScheduledBackup();
  });

  it('should reject invalid cron patterns', () => {
    expect(() => {
      backupService.scheduleBackup('invalid');
    }).toThrow();
  });

  it('should return correct backup file path', () => {
    const backupId = 'test-backup';
    const filePath = backupService.getBackupFilePath(backupId);
    expect(filePath).toBe(join(testBackupDir, `${backupId}.backup.json.gz`));
  });
});
