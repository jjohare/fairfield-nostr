<script lang="ts">
  import { db, type DBMessage, type DBChannel } from '$lib/db';
  import ExportModal from '../chat/ExportModal.svelte';
  import { downloadFile, generateTimestampedFilename } from '$lib/utils/download';

  let showExportModal = false;
  let isExporting = false;
  let exportStats = {
    messages: 0,
    channels: 0,
    users: 0
  };

  async function loadStats() {
    exportStats.messages = await db.messages.count();
    exportStats.channels = await db.channels.count();
    exportStats.users = await db.users.count();
  }

  loadStats();

  function handleBulkExport() {
    showExportModal = true;
  }

  async function handleDatabaseBackup() {
    isExporting = true;

    try {
      // Export entire database as JSON
      const [messages, channels, users, deletions] = await Promise.all([
        db.messages.toArray(),
        db.channels.toArray(),
        db.users.toArray(),
        db.deletions.toArray()
      ]);

      const backup = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        database: 'MinimoomaNoirDB',
        data: {
          messages,
          channels,
          users,
          deletions
        },
        stats: exportStats
      };

      const content = JSON.stringify(backup, null, 2);
      const filename = generateTimestampedFilename('fairfield-database-backup', 'json');
      downloadFile(content, filename, 'application/json');
    } catch (error) {
      console.error('Database backup failed:', error);
      alert('Database backup failed. Please try again.');
    } finally {
      isExporting = false;
    }
  }

  async function handleChannelExport(channelId: string) {
    // Export specific channel
    const messages = await db.messages.where('channelId').equals(channelId).toArray();
    const channel = await db.channels.get(channelId);

    const exportData = {
      channel,
      messages,
      exportDate: new Date().toISOString()
    };

    const content = JSON.stringify(exportData, null, 2);
    const filename = generateTimestampedFilename(`channel-${channel?.name || channelId}`, 'json');
    downloadFile(content, filename, 'application/json');
  }
</script>

<div class="admin-export">
  <h2>Admin Export & Backup</h2>
  <p class="description">Bulk export and database backup tools</p>

  <div class="stats-section">
    <h3>Database Statistics</h3>
    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-value">{exportStats.messages.toLocaleString()}</div>
        <div class="stat-label">Messages</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{exportStats.channels.toLocaleString()}</div>
        <div class="stat-label">Channels</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">{exportStats.users.toLocaleString()}</div>
        <div class="stat-label">Cached Users</div>
      </div>
    </div>
  </div>

  <div class="export-section">
    <h3>Bulk Export Options</h3>

    <div class="export-card">
      <div class="export-card-header">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
          <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
        </svg>
        <div>
          <h4>Export All Messages</h4>
          <p>Export all messages with filtering options (JSON, CSV, or Text)</p>
        </div>
      </div>
      <button class="btn btn-primary" on:click={handleBulkExport}>
        Export Messages
      </button>
    </div>

    <div class="export-card">
      <div class="export-card-header">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd" />
        </svg>
        <div>
          <h4>Database Backup</h4>
          <p>Complete database backup including all tables (messages, channels, users)</p>
        </div>
      </div>
      <button class="btn btn-secondary" on:click={handleDatabaseBackup} disabled={isExporting}>
        {isExporting ? 'Exporting...' : 'Backup Database'}
      </button>
    </div>
  </div>

  <div class="warning-section">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
    </svg>
    <div>
      <strong>Admin Notice:</strong>
      <p>
        Database backups include all user data and should be handled securely.
        Ensure compliance with privacy policies when exporting user data.
      </p>
    </div>
  </div>
</div>

<ExportModal
  isOpen={showExportModal}
  channelId={null}
  onClose={() => showExportModal = false}
/>

<style>
  .admin-export {
    padding: 1.5rem;
  }

  h2 {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  h3 {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  h4 {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
  }

  .description {
    color: #6b7280;
    margin-bottom: 2rem;
  }

  .stats-section {
    margin-bottom: 2rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }

  .stat-item {
    text-align: center;
    padding: 1.5rem;
    background: #f9fafb;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
  }

  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: #111827;
  }

  .stat-label {
    font-size: 0.875rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  .export-section {
    margin-bottom: 2rem;
  }

  .export-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    margin-bottom: 1rem;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  }

  .export-card-header {
    display: flex;
    gap: 1rem;
    flex: 1;
  }

  .export-card-header svg {
    color: #3b82f6;
    flex-shrink: 0;
  }

  .export-card-header p {
    font-size: 0.875rem;
    color: #6b7280;
    margin: 0.25rem 0 0 0;
  }

  .btn {
    padding: 0.625rem 1.25rem;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }

  .btn-secondary {
    background: white;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #f9fafb;
  }

  .warning-section {
    display: flex;
    gap: 0.75rem;
    padding: 1rem;
    background: #fef3c7;
    border: 1px solid #fbbf24;
    border-radius: 6px;
    color: #92400e;
  }

  .warning-section svg {
    flex-shrink: 0;
    margin-top: 0.125rem;
  }

  .warning-section strong {
    display: block;
    margin-bottom: 0.25rem;
  }

  .warning-section p {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.5;
  }
</style>
