import type { Message } from '$lib/types/channel';

export interface SearchFilters {
  scope: 'all' | 'channel' | 'user';
  dateFrom?: Date;
  dateTo?: Date;
}

/**
 * Highlights matching text in a string
 * @param text - The text to search in
 * @param query - The search query
 * @returns HTML string with highlighted matches
 */
export function highlightMatch(text: string, query: string): string {
  if (!query.trim()) return escapeHtml(text);

  const escapedText = escapeHtml(text);
  const escapedQuery = escapeRegex(query);
  const regex = new RegExp(`(${escapedQuery})`, 'gi');

  return escapedText.replace(regex, '<mark class="bg-warning text-warning-content px-1 rounded">$1</mark>');
}

/**
 * Checks if a message matches the search query
 * @param message - The message to check
 * @param query - The search query
 * @returns true if the message matches
 */
export function matchesSearch(message: Message, query: string): boolean {
  if (!query.trim()) return true;

  const lowerQuery = query.toLowerCase();
  return message.content.toLowerCase().includes(lowerQuery);
}

/**
 * Filters messages based on query and filters
 * @param messages - Array of messages to filter
 * @param query - Search query string
 * @param filters - Additional filter options
 * @param currentUserPubkey - Current user's public key (for 'user' scope filter)
 * @returns Filtered array of messages
 */
export function filterMessages(
  messages: Message[],
  query: string,
  filters: SearchFilters,
  currentUserPubkey?: string
): Message[] {
  return messages.filter(message => {
    // Text search
    if (!matchesSearch(message, query)) {
      return false;
    }

    // Scope filter
    if (filters.scope === 'user' && currentUserPubkey) {
      if (message.authorPubkey !== currentUserPubkey) {
        return false;
      }
    }

    // Date range filter
    if (filters.dateFrom) {
      const messageDate = new Date(message.createdAt * 1000);
      if (messageDate < filters.dateFrom) {
        return false;
      }
    }

    if (filters.dateTo) {
      const messageDate = new Date(message.createdAt * 1000);
      const endOfDay = new Date(filters.dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      if (messageDate > endOfDay) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Escapes HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Escapes regex special characters
 */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Debounces a function call
 * @param func - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}
