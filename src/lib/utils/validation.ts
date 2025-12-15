/**
 * Input Validation Utilities
 *
 * Provides validation for Nostr events and user input to prevent
 * injection attacks and malformed data.
 */

/**
 * Maximum allowed content length for messages
 */
const MAX_CONTENT_LENGTH = 64000; // 64KB

/**
 * Maximum allowed tags per event
 */
const MAX_TAGS = 2000;

/**
 * Maximum tag value length
 */
const MAX_TAG_VALUE_LENGTH = 1024;

/**
 * Pubkey validation regex (64 hex chars)
 */
const PUBKEY_REGEX = /^[0-9a-f]{64}$/i;

/**
 * Event ID validation regex (64 hex chars)
 */
const EVENT_ID_REGEX = /^[0-9a-f]{64}$/i;

/**
 * Signature validation regex (128 hex chars)
 */
const SIGNATURE_REGEX = /^[0-9a-f]{128}$/i;

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a pubkey format
 */
export function isValidPubkey(pubkey: string): boolean {
  return PUBKEY_REGEX.test(pubkey);
}

/**
 * Validate an event ID format
 */
export function isValidEventId(eventId: string): boolean {
  return EVENT_ID_REGEX.test(eventId);
}

/**
 * Validate a signature format
 */
export function isValidSignature(sig: string): boolean {
  return SIGNATURE_REGEX.test(sig);
}

/**
 * Validate message content
 */
export function validateContent(content: string): ValidationResult {
  const errors: string[] = [];

  if (typeof content !== 'string') {
    errors.push('Content must be a string');
    return { valid: false, errors };
  }

  if (content.length > MAX_CONTENT_LENGTH) {
    errors.push(`Content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters`);
  }

  // Check for null bytes (potential injection)
  if (content.includes('\0')) {
    errors.push('Content contains null bytes');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate event tags
 */
export function validateTags(tags: string[][]): ValidationResult {
  const errors: string[] = [];

  if (!Array.isArray(tags)) {
    errors.push('Tags must be an array');
    return { valid: false, errors };
  }

  if (tags.length > MAX_TAGS) {
    errors.push(`Too many tags (max: ${MAX_TAGS})`);
  }

  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];

    if (!Array.isArray(tag)) {
      errors.push(`Tag at index ${i} is not an array`);
      continue;
    }

    for (let j = 0; j < tag.length; j++) {
      const value = tag[j];

      if (typeof value !== 'string') {
        errors.push(`Tag value at [${i}][${j}] is not a string`);
        continue;
      }

      if (value.length > MAX_TAG_VALUE_LENGTH) {
        errors.push(`Tag value at [${i}][${j}] exceeds max length`);
      }

      if (value.includes('\0')) {
        errors.push(`Tag value at [${i}][${j}] contains null bytes`);
      }
    }

    // Validate specific tag types
    const tagType = tag[0];
    if (tagType === 'p' && tag[1] && !isValidPubkey(tag[1])) {
      errors.push(`Invalid pubkey in 'p' tag at index ${i}`);
    }

    if (tagType === 'e' && tag[1] && !isValidEventId(tag[1])) {
      errors.push(`Invalid event ID in 'e' tag at index ${i}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate a complete Nostr event
 */
export function validateEvent(event: {
  id?: string;
  pubkey?: string;
  created_at?: number;
  kind?: number;
  tags?: string[][];
  content?: string;
  sig?: string;
}): ValidationResult {
  const errors: string[] = [];

  // Required fields
  if (!event.pubkey) {
    errors.push('Event missing pubkey');
  } else if (!isValidPubkey(event.pubkey)) {
    errors.push('Invalid pubkey format');
  }

  if (event.created_at === undefined) {
    errors.push('Event missing created_at');
  } else if (!Number.isInteger(event.created_at) || event.created_at < 0) {
    errors.push('Invalid created_at timestamp');
  }

  if (event.kind === undefined) {
    errors.push('Event missing kind');
  } else if (!Number.isInteger(event.kind) || event.kind < 0 || event.kind > 65535) {
    errors.push('Invalid event kind');
  }

  if (event.content === undefined) {
    errors.push('Event missing content');
  } else {
    const contentResult = validateContent(event.content);
    errors.push(...contentResult.errors);
  }

  if (event.tags !== undefined) {
    const tagsResult = validateTags(event.tags);
    errors.push(...tagsResult.errors);
  }

  // Optional but must be valid if present
  if (event.id && !isValidEventId(event.id)) {
    errors.push('Invalid event ID format');
  }

  if (event.sig && !isValidSignature(event.sig)) {
    errors.push('Invalid signature format');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize user input for display
 * Removes potentially dangerous characters while preserving readability
 */
export function sanitizeForDisplay(text: string): string {
  if (typeof text !== 'string') return '';

  return text
    // Remove null bytes
    .replace(/\0/g, '')
    // Normalize unicode (prevent homograph attacks)
    .normalize('NFKC')
    // Limit length
    .substring(0, MAX_CONTENT_LENGTH);
}

/**
 * Validate channel name
 */
export function validateChannelName(name: string): ValidationResult {
  const errors: string[] = [];

  if (typeof name !== 'string') {
    errors.push('Channel name must be a string');
    return { valid: false, errors };
  }

  if (name.length < 1) {
    errors.push('Channel name cannot be empty');
  }

  if (name.length > 100) {
    errors.push('Channel name too long (max 100 characters)');
  }

  // Only allow alphanumeric, spaces, hyphens, and common punctuation
  if (!/^[\w\s\-'.!?]+$/u.test(name)) {
    errors.push('Channel name contains invalid characters');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
