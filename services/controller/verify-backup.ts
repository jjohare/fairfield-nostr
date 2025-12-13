#!/usr/bin/env ts-node
/**
 * Manual verification script for BackupService
 * Run: npx ts-node services/controller/verify-backup.ts
 */

import { BackupService } from './backup-service';
import { tmpdir } from 'os';
import { join } from 'path';
import { promises as fs } from 'fs';

async function verify() {
  console.log('🔍 Verifying BackupService implementation...\n');

  const testDir = join(tmpdir(), `backup-verify-${Date.now()}`);

  try {
    // Initialize service
    console.log('✓ Creating BackupService instance');
    const service = new BackupService({
      relayUrl: 'ws://localhost:7777',
      backupDir: testDir,
      compressionEnabled: true,
      retentionCount: 5
    });

    console.log('✓ Initializing backup directory');
    await service.initialize();

    // Verify directory created
    const stats = await fs.stat(testDir);
    if (!stats.isDirectory()) {
      throw new Error('Backup directory not created');
    }
    console.log('✓ Backup directory created:', testDir);

    // Test listing empty backups
    console.log('✓ Testing listBackups() with empty directory');
    const emptyList = await service.listBackups();
    if (emptyList.length !== 0) {
      throw new Error('Expected empty backup list');
    }
    console.log('✓ Empty backup list returned correctly');

    // Create mock metadata
    console.log('✓ Creating mock backup metadata');
    const mockId = 'test-backup-123';
    const mockMetadata = {
      id: mockId,
      timestamp: Date.now(),
      eventCount: 42,
      kinds: [0, 1, 3],
      timeRange: { from: 1700000000, to: 1700001000 },
      compressed: true,
      encrypted: false,
      size: 1024
    };

    await fs.writeFile(
      join(testDir, `${mockId}.meta.json`),
      JSON.stringify(mockMetadata, null, 2)
    );
    console.log('✓ Mock metadata file created');

    // Test listing with metadata
    console.log('✓ Testing listBackups() with metadata');
    const backups = await service.listBackups();
    if (backups.length !== 1) {
      throw new Error('Expected 1 backup in list');
    }
    if (backups[0].id !== mockId) {
      throw new Error('Backup ID mismatch');
    }
    console.log('✓ Backup listed correctly:', backups[0].id);

    // Test getBackup
    console.log('✓ Testing getBackup()');
    const backup = await service.getBackup(mockId);
    if (!backup || backup.id !== mockId) {
      throw new Error('getBackup failed');
    }
    console.log('✓ Backup retrieved correctly');

    // Test getBackup with non-existent ID
    console.log('✓ Testing getBackup() with non-existent ID');
    const missing = await service.getBackup('non-existent');
    if (missing !== null) {
      throw new Error('Expected null for non-existent backup');
    }
    console.log('✓ Non-existent backup returned null correctly');

    // Test getBackupFilePath
    console.log('✓ Testing getBackupFilePath()');
    const filePath = service.getBackupFilePath(mockId);
    const expectedPath = join(testDir, `${mockId}.backup.json.gz`);
    if (filePath !== expectedPath) {
      throw new Error(`Path mismatch: ${filePath} !== ${expectedPath}`);
    }
    console.log('✓ Backup file path correct:', filePath);

    // Test scheduled backup configuration
    console.log('✓ Testing scheduleBackup()');
    service.scheduleBackup('daily');
    console.log('✓ Daily schedule configured');

    service.stopScheduledBackup();
    console.log('✓ Schedule stopped');

    service.scheduleBackup('weekly');
    console.log('✓ Weekly schedule configured');

    service.stopScheduledBackup();
    console.log('✓ Schedule stopped');

    service.scheduleBackup(60000);
    console.log('✓ Custom interval (60s) configured');

    service.stopScheduledBackup();
    console.log('✓ Schedule stopped');

    // Test invalid schedule
    console.log('✓ Testing invalid schedule pattern');
    try {
      service.scheduleBackup('invalid');
      throw new Error('Should have thrown error for invalid pattern');
    } catch (err: any) {
      if (!err.message.includes('Unsupported cron pattern')) {
        throw err;
      }
      console.log('✓ Invalid pattern rejected correctly');
    }

    // Cleanup
    service.destroy();
    console.log('✓ Service destroyed');

    await fs.rm(testDir, { recursive: true, force: true });
    console.log('✓ Test directory cleaned up');

    console.log('\n✅ All verifications passed!\n');
    console.log('Summary:');
    console.log('  - BackupService instantiation');
    console.log('  - Directory initialization');
    console.log('  - Metadata reading/writing');
    console.log('  - Backup listing and retrieval');
    console.log('  - File path generation');
    console.log('  - Schedule configuration');
    console.log('  - Error handling');

  } catch (error: any) {
    console.error('\n❌ Verification failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

verify();
