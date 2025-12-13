/**
 * Local Identicon Generator
 * Generates deterministic avatar images from pubkeys without external API calls
 * Protects user privacy by keeping pubkey data local
 */

/**
 * Hash a string to get deterministic values
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Get a deterministic color from a pubkey
 */
function getColor(pubkey: string, index: number): string {
  const hash = hashCode(pubkey + index.toString());
  const hue = hash % 360;
  const saturation = 65 + (hash % 20);
  const lightness = 45 + (hash % 20);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Get background color (lighter version)
 */
function getBackgroundColor(pubkey: string): string {
  const hash = hashCode(pubkey);
  const hue = hash % 360;
  return `hsl(${hue}, 30%, 90%)`;
}

/**
 * Generate a 5x5 symmetric pattern from pubkey
 */
function generatePattern(pubkey: string): boolean[][] {
  const pattern: boolean[][] = [];
  const hash = hashCode(pubkey);

  for (let y = 0; y < 5; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < 3; x++) {
      const index = y * 3 + x;
      const charCode = pubkey.charCodeAt(index % pubkey.length);
      const bit = ((hash >> (index % 32)) ^ charCode) & 1;
      row.push(bit === 1);
    }
    // Mirror for symmetry
    row.push(row[1]);
    row.push(row[0]);
    pattern.push(row);
  }

  return pattern;
}

/**
 * Generate an identicon SVG string from a pubkey
 */
export function generateIdenticonSvg(pubkey: string, size: number = 64): string {
  const pattern = generatePattern(pubkey);
  const foreground = getColor(pubkey, 0);
  const background = getBackgroundColor(pubkey);
  const cellSize = size / 5;

  let paths = '';

  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      if (pattern[y][x]) {
        const px = x * cellSize;
        const py = y * cellSize;
        paths += `<rect x="${px}" y="${py}" width="${cellSize}" height="${cellSize}" fill="${foreground}"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="${background}"/>
    ${paths}
  </svg>`;
}

/**
 * Generate a data URL for an identicon
 */
export function generateIdenticonDataUrl(pubkey: string, size: number = 64): string {
  const svg = generateIdenticonSvg(pubkey, size);
  const encoded = btoa(svg);
  return `data:image/svg+xml;base64,${encoded}`;
}

/**
 * Generate identicon using canvas (for non-SVG contexts)
 */
export function generateIdenticonCanvas(
  pubkey: string,
  size: number = 64
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  const pattern = generatePattern(pubkey);
  const foreground = getColor(pubkey, 0);
  const background = getBackgroundColor(pubkey);
  const cellSize = size / 5;

  // Draw background
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, size, size);

  // Draw pattern
  ctx.fillStyle = foreground;
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      if (pattern[y][x]) {
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }

  return canvas;
}

/**
 * Get avatar URL - use local generation instead of external API
 */
export function getAvatarUrl(pubkey: string, size: number = 64): string {
  return generateIdenticonDataUrl(pubkey, size);
}
