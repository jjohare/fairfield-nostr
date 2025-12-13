<script lang="ts">
  import { db } from '$lib/db';
  import ExportModal from '../chat/ExportModal.svelte';

  let showExportModal = false;
  let totalMessages = 0;
  let totalChannels = 0;

  async function loadStats() {
    totalMessages = await db.messages.count();
    totalChannels = await db.channels.count();
  }

  loadStats();

  function handleExportAll() {
    showExportModal = true;
  }
</script>

<div class="export-settings">
  <h2>Export Data</h2>
  <p class="description">Export your message history in various formats</p>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-icon">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
          <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
        </svg>
      </div>
      <div class="stat-content">
        <div class="stat-value">{totalMessages.toLocaleString()}</div>
        <div class="stat-label">Total Messages</div>
      </div>
    </div>

    <div class="stat-card">
      <div class="stat-icon">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clip-rule="evenodd" />
          <path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z" />
        </svg>
      </div>
      <div class="stat-content">
        <div class="stat-value">{totalChannels.toLocaleString()}</div>
        <div class="stat-label">Total Channels</div>
      </div>
    </div>
  </div>

  <div class="export-actions">
    <button class="btn btn-primary" on:click={handleExportAll}>
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
      Export All Data
    </button>
  </div>

  <div class="export-formats">
    <h3>Available Formats</h3>
    <ul>
      <li>
        <strong>JSON:</strong> Full data export with all metadata, signatures, and tags
      </li>
      <li>
        <strong>CSV:</strong> Spreadsheet-compatible format for analysis
      </li>
      <li>
        <strong>Plain Text:</strong> Human-readable chat log format
      </li>
    </ul>
  </div>

  <div class="export-note">
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
    </svg>
    <p>
      Exports are processed locally in your browser. Large exports may take several seconds to complete.
      For exports with 10,000+ messages, progress will be shown.
    </p>
  </div>
</div>

<ExportModal
  isOpen={showExportModal}
  channelId={null}
  onClose={() => showExportModal = false}
/>

<style>
  .export-settings {
    padding: 1.5rem;
  }

  h2 {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .description {
    color: #6b7280;
    margin-bottom: 2rem;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    display: flex;
    gap: 1rem;
    padding: 1.5rem;
    background: #f9fafb;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
  }

  .stat-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background: #3b82f6;
    color: white;
    border-radius: 8px;
  }

  .stat-content {
    flex: 1;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #111827;
  }

  .stat-label {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .export-actions {
    margin-bottom: 2rem;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover {
    background: #2563eb;
  }

  .export-formats {
    margin-bottom: 2rem;
  }

  .export-formats h3 {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .export-formats ul {
    list-style: none;
    padding: 0;
  }

  .export-formats li {
    padding: 0.75rem;
    margin-bottom: 0.5rem;
    background: #f9fafb;
    border-radius: 4px;
    border-left: 3px solid #3b82f6;
  }

  .export-note {
    display: flex;
    gap: 0.75rem;
    padding: 1rem;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 6px;
    color: #1e40af;
  }

  .export-note svg {
    flex-shrink: 0;
    margin-top: 0.125rem;
  }

  .export-note p {
    margin: 0;
    font-size: 0.875rem;
    line-height: 1.5;
  }
</style>
