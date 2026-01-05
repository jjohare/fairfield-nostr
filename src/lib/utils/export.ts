import type { DBMessage } from '$lib/db';

export interface ExportOptions {
  includeMetadata?: boolean;
  dateRange?: {
    start: number;
    end: number;
  };
  channelFilter?: string[];
  includeDeleted?: boolean;
}

export type ExportMessage = DBMessage & {
  authorName?: string;
  channelName?: string;
}

/**
 * Filter messages based on export options
 */
export function filterMessages(
  messages: DBMessage[],
  options: ExportOptions
): DBMessage[] {
  let filtered = messages;

  // Filter by date range
  if (options.dateRange) {
    filtered = filtered.filter(
      msg => msg.created_at >= options.dateRange!.start && msg.created_at <= options.dateRange!.end
    );
  }

  // Filter by channel
  if (options.channelFilter && options.channelFilter.length > 0) {
    filtered = filtered.filter(msg => options.channelFilter!.includes(msg.channelId));
  }

  // Filter deleted messages
  if (!options.includeDeleted) {
    filtered = filtered.filter(msg => !msg.deleted);
  }

  return filtered;
}

/**
 * Export messages to JSON format
 */
export function exportToJSON(messages: ExportMessage[], options: ExportOptions): string {
  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    messageCount: messages.length,
    options: {
      includeMetadata: options.includeMetadata ?? true,
      dateRange: options.dateRange,
      channelFilter: options.channelFilter
    },
    messages: options.includeMetadata
      ? messages
      : messages.map(msg => ({
          id: msg.id,
          channelId: msg.channelId,
          pubkey: msg.pubkey,
          content: msg.content,
          created_at: msg.created_at,
          authorName: msg.authorName,
          channelName: msg.channelName
        }))
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * Export messages to CSV format
 */
export function exportToCSV(messages: ExportMessage[], options: ExportOptions): string {
  const headers = [
    'Timestamp',
    'Date',
    'Channel',
    'Author',
    'Author Pubkey',
    'Content',
    'Message ID'
  ];

  if (options.includeMetadata) {
    headers.push('Encrypted', 'Deleted', 'Kind', 'Signature');
  }

  const rows = messages.map(msg => {
    const date = new Date(msg.created_at * 1000);
    const row = [
      msg.created_at.toString(),
      date.toISOString(),
      escapeCSV(msg.channelName || msg.channelId),
      escapeCSV(msg.authorName || 'Unknown'),
      msg.pubkey,
      escapeCSV(msg.content),
      msg.id
    ];

    if (options.includeMetadata) {
      row.push(
        msg.encrypted.toString(),
        msg.deleted.toString(),
        msg.kind.toString(),
        msg.sig
      );
    }

    return row;
  });

  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

/**
 * Escape CSV special characters
 */
function escapeCSV(value: string): string {
  if (!value) return '';
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * Export messages to plain text format (chat log style)
 */
export function exportToText(messages: ExportMessage[], options: ExportOptions): string {
  const lines: string[] = [];

  // Header
  lines.push('='.repeat(80));
  lines.push('Nostr BBS Message Export');
  lines.push(`Export Date: ${new Date().toISOString()}`);
  lines.push(`Total Messages: ${messages.length}`);

  if (options.dateRange) {
    const start = new Date(options.dateRange.start * 1000).toISOString();
    const end = new Date(options.dateRange.end * 1000).toISOString();
    lines.push(`Date Range: ${start} to ${end}`);
  }

  lines.push('='.repeat(80));
  lines.push('');

  // Group messages by channel
  const messagesByChannel = messages.reduce((acc, msg) => {
    const channelKey = msg.channelName || msg.channelId;
    if (!acc[channelKey]) {
      acc[channelKey] = [];
    }
    acc[channelKey].push(msg);
    return acc;
  }, {} as Record<string, ExportMessage[]>);

  // Format each channel's messages
  for (const [channelName, channelMessages] of Object.entries(messagesByChannel)) {
    lines.push('');
    lines.push(`Channel: ${channelName}`);
    lines.push('-'.repeat(80));
    lines.push('');

    for (const msg of channelMessages) {
      const date = new Date(msg.created_at * 1000);
      const timestamp = date.toLocaleString();
      const author = msg.authorName || msg.pubkey.slice(0, 8);

      lines.push(`[${timestamp}] ${author}:`);
      lines.push(`  ${msg.content}`);

      if (options.includeMetadata) {
        lines.push(`  (ID: ${msg.id.slice(0, 16)}... | Encrypted: ${msg.encrypted} | Deleted: ${msg.deleted})`);
      }

      lines.push('');
    }
  }

  lines.push('');
  lines.push('='.repeat(80));
  lines.push(`End of Export - ${messages.length} total messages`);
  lines.push('='.repeat(80));

  return lines.join('\n');
}

/**
 * Process messages in chunks to avoid blocking UI
 */
export async function processInChunks<T, R>(
  items: T[],
  processor: (chunk: T[]) => R,
  chunkSize: number = 500,
  onProgress?: (progress: number) => void
): Promise<R[]> {
  const results: R[] = [];
  const totalChunks = Math.ceil(items.length / chunkSize);

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const result = processor(chunk);
    results.push(result);

    if (onProgress) {
      const progress = Math.min(((i + chunkSize) / items.length) * 100, 100);
      onProgress(progress);
    }

    // Allow UI to update between chunks
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return results;
}

/**
 * Estimate export file size
 */
export function estimateExportSize(messageCount: number, format: 'json' | 'csv' | 'text'): number {
  const avgMessageSize = {
    json: 500,  // JSON with full metadata
    csv: 200,   // CSV row
    text: 150   // Plain text line
  };

  return messageCount * avgMessageSize[format];
}
