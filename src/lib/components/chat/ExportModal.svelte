<script lang="ts">
  import { onMount } from 'svelte';
  import { db, type DBMessage, type DBChannel, type DBUser } from '$lib/db';
  import {
    exportToJSON,
    exportToCSV,
    exportToText,
    filterMessages,
    processInChunks,
    estimateExportSize,
    type ExportOptions,
    type ExportMessage
  } from '$lib/utils/export';
  import { downloadFile, generateTimestampedFilename, formatFileSize } from '$lib/utils/download';

  export let isOpen = false;
  export let channelId: string | null = null; // null = all channels
  export let onClose: () => void;

  type ExportFormat = 'json' | 'csv' | 'text';

  let format: ExportFormat = 'json';
  let includeMetadata = true;
  let includeDeleted = false;
  let selectedChannels: string[] = [];
  let useDateRange = false;
  let startDate = '';
  let endDate = '';

  let channels: DBChannel[] = [];
  let messageCount = 0;
  let previewMessages: ExportMessage[] = [];
  let isLoading = false;
  let exportProgress = 0;
  let estimatedSize = '';

  // Load channels and count messages
  onMount(async () => {
    channels = await db.channels.toArray();

    if (channelId) {
      selectedChannels = [channelId];
    }

    await updateMessageCount();
  });

  async function updateMessageCount() {
    const options = buildExportOptions();
    let messages = await db.messages.toArray();
    messages = filterMessages(messages, options);
    messageCount = messages.length;

    // Update estimated size
    const sizeBytes = estimateExportSize(messageCount, format);
    estimatedSize = formatFileSize(sizeBytes);

    // Load preview (first 10 messages)
    await loadPreview(messages.slice(0, 10));
  }

  async function loadPreview(messages: DBMessage[]) {
    const enrichedMessages = await enrichMessages(messages);
    previewMessages = enrichedMessages;
  }

  async function enrichMessages(messages: DBMessage[]): Promise<ExportMessage[]> {
    const enriched: ExportMessage[] = [];

    for (const msg of messages) {
      const author = await db.users.get(msg.pubkey);
      const channel = await db.channels.get(msg.channelId);

      enriched.push({
        ...msg,
        authorName: author?.name || author?.displayName || undefined,
        channelName: channel?.name || undefined
      });
    }

    return enriched;
  }

  function buildExportOptions(): ExportOptions {
    const options: ExportOptions = {
      includeMetadata,
      includeDeleted
    };

    if (useDateRange && startDate && endDate) {
      options.dateRange = {
        start: new Date(startDate).getTime() / 1000,
        end: new Date(endDate).getTime() / 1000
      };
    }

    if (selectedChannels.length > 0) {
      options.channelFilter = selectedChannels;
    }

    return options;
  }

  async function handleExport() {
    isLoading = true;
    exportProgress = 0;

    try {
      // Fetch all messages
      let messages = await db.messages.toArray();

      // Filter messages
      const options = buildExportOptions();
      messages = filterMessages(messages, options);

      // Enrich messages in chunks
      const enrichedChunks = await processInChunks(
        messages,
        (chunk) => enrichMessages(chunk),
        500,
        (progress) => {
          exportProgress = progress * 0.7; // 70% for enrichment
        }
      );

      const enrichedMessages = (await Promise.all(enrichedChunks)).flat();

      // Generate export content
      let content: string;
      let filename: string;
      let mimeType: string;

      exportProgress = 75;

      switch (format) {
        case 'json':
          content = exportToJSON(enrichedMessages, options);
          filename = generateTimestampedFilename('fairfield-export', 'json');
          mimeType = 'application/json';
          break;
        case 'csv':
          content = exportToCSV(enrichedMessages, options);
          filename = generateTimestampedFilename('fairfield-export', 'csv');
          mimeType = 'text/csv';
          break;
        case 'text':
          content = exportToText(enrichedMessages, options);
          filename = generateTimestampedFilename('fairfield-export', 'txt');
          mimeType = 'text/plain';
          break;
      }

      exportProgress = 90;

      // Trigger download
      downloadFile(content, filename, mimeType);

      exportProgress = 100;

      // Close modal after brief delay
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      isLoading = false;
    }
  }

  function toggleChannel(channelIdToToggle: string) {
    if (selectedChannels.includes(channelIdToToggle)) {
      selectedChannels = selectedChannels.filter(id => id !== channelIdToToggle);
    } else {
      selectedChannels = [...selectedChannels, channelIdToToggle];
    }
    updateMessageCount();
  }

  function selectAllChannels() {
    selectedChannels = channels.map(c => c.id);
    updateMessageCount();
  }

  function deselectAllChannels() {
    selectedChannels = [];
    updateMessageCount();
  }

  $: if (format || includeMetadata || includeDeleted || useDateRange || startDate || endDate) {
    updateMessageCount();
  }
</script>

{#if isOpen}
  <div class="modal-overlay" on:click={onClose} on:keydown={(e) => e.key === 'Escape' && onClose()}>
    <div class="modal-content" on:click|stopPropagation on:keydown|stopPropagation>
      <div class="modal-header">
        <h2>Export Messages</h2>
        <button class="close-btn" on:click={onClose} aria-label="Close">×</button>
      </div>

      <div class="modal-body">
        <!-- Format Selection -->
        <div class="form-group">
          <label>Export Format</label>
          <div class="format-options">
            <label class="radio-label">
              <input type="radio" bind:group={format} value="json" />
              <span>JSON (Full Data)</span>
            </label>
            <label class="radio-label">
              <input type="radio" bind:group={format} value="csv" />
              <span>CSV (Spreadsheet)</span>
            </label>
            <label class="radio-label">
              <input type="radio" bind:group={format} value="text" />
              <span>Plain Text (Chat Log)</span>
            </label>
          </div>
        </div>

        <!-- Channel Selection -->
        {#if !channelId}
          <div class="form-group">
            <label>Channels</label>
            <div class="channel-actions">
              <button class="link-btn" on:click={selectAllChannels}>Select All</button>
              <button class="link-btn" on:click={deselectAllChannels}>Deselect All</button>
            </div>
            <div class="channel-list">
              {#each channels as channel}
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedChannels.includes(channel.id)}
                    on:change={() => toggleChannel(channel.id)}
                  />
                  <span>{channel.name}</span>
                </label>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Date Range -->
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={useDateRange} />
            <span>Filter by Date Range</span>
          </label>
          {#if useDateRange}
            <div class="date-range">
              <input type="datetime-local" bind:value={startDate} placeholder="Start Date" />
              <span>to</span>
              <input type="datetime-local" bind:value={endDate} placeholder="End Date" />
            </div>
          {/if}
        </div>

        <!-- Options -->
        <div class="form-group">
          <label>Options</label>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={includeMetadata} />
            <span>Include Metadata (signatures, tags, etc.)</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={includeDeleted} />
            <span>Include Deleted Messages</span>
          </label>
        </div>

        <!-- Export Info -->
        <div class="export-info">
          <p><strong>Messages to export:</strong> {messageCount.toLocaleString()}</p>
          <p><strong>Estimated size:</strong> {estimatedSize}</p>
        </div>

        <!-- Preview -->
        <div class="preview-section">
          <h3>Preview (First 10 Messages)</h3>
          <div class="preview-content">
            {#if previewMessages.length > 0}
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Channel</th>
                    <th>Author</th>
                    <th>Content</th>
                  </tr>
                </thead>
                <tbody>
                  {#each previewMessages as msg}
                    <tr>
                      <td>{new Date(msg.created_at * 1000).toLocaleString()}</td>
                      <td>{msg.channelName || msg.channelId.slice(0, 8)}</td>
                      <td>{msg.authorName || msg.pubkey.slice(0, 8)}</td>
                      <td>{msg.content.slice(0, 50)}{msg.content.length > 50 ? '...' : ''}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            {:else}
              <p class="no-messages">No messages to export with current filters</p>
            {/if}
          </div>
        </div>

        <!-- Progress Bar -->
        {#if isLoading}
          <div class="progress-section">
            <div class="progress-bar">
              <div class="progress-fill" style="width: {exportProgress}%"></div>
            </div>
            <p>Exporting... {Math.round(exportProgress)}%</p>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={onClose} disabled={isLoading}>
          Cancel
        </button>
        <button class="btn btn-primary" on:click={handleExport} disabled={isLoading || messageCount === 0}>
          {isLoading ? 'Exporting...' : `Export ${messageCount.toLocaleString()} Messages`}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-content {
    background: white;
    border-radius: 8px;
    width: 90%;
    max-width: 800px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: #6b7280;
    padding: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: #f3f4f6;
    color: #111827;
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-group label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #374151;
  }

  .format-options {
    display: flex;
    gap: 1rem;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: normal;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: normal;
    margin-bottom: 0.5rem;
  }

  .channel-actions {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .link-btn {
    background: none;
    border: none;
    color: #3b82f6;
    cursor: pointer;
    font-size: 0.875rem;
    padding: 0;
  }

  .link-btn:hover {
    text-decoration: underline;
  }

  .channel-list {
    max-height: 150px;
    overflow-y: auto;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    padding: 0.75rem;
  }

  .date-range {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .date-range input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 4px;
  }

  .export-info {
    background: #f3f4f6;
    padding: 1rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .export-info p {
    margin: 0.25rem 0;
  }

  .preview-section {
    margin-top: 1.5rem;
  }

  .preview-section h3 {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
  }

  .preview-content {
    border: 1px solid #e5e7eb;
    border-radius: 4px;
    max-height: 300px;
    overflow: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th {
    background: #f9fafb;
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    border-bottom: 2px solid #e5e7eb;
    position: sticky;
    top: 0;
  }

  td {
    padding: 0.75rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .no-messages {
    padding: 2rem;
    text-align: center;
    color: #6b7280;
  }

  .progress-section {
    margin-top: 1.5rem;
  }

  .progress-bar {
    height: 8px;
    background: #e5e7eb;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 0.5rem;
  }

  .progress-fill {
    height: 100%;
    background: #3b82f6;
    transition: width 0.3s ease;
  }

  .progress-section p {
    text-align: center;
    color: #6b7280;
    font-size: 0.875rem;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid #e5e7eb;
  }

  .btn {
    padding: 0.625rem 1.25rem;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background: white;
    color: #374151;
    border: 1px solid #d1d5db;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #f9fafb;
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #2563eb;
  }
</style>
