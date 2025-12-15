export class Whitelist {
  private allowedPubkeys: Set<string>;

  constructor() {
    this.allowedPubkeys = new Set();
    this.loadWhitelist();
  }

  private loadWhitelist(): void {
    const whitelistEnv = process.env.WHITELIST_PUBKEYS || '';
    const pubkeys = whitelistEnv.split(',').map(pk => pk.trim()).filter(pk => pk.length > 0);

    for (const pubkey of pubkeys) {
      this.allowedPubkeys.add(pubkey);
    }

    console.log(`Whitelist loaded with ${this.allowedPubkeys.size} pubkeys`);
  }

  isAllowed(pubkey: string): boolean {
    // If whitelist is empty, allow all (development mode)
    if (this.allowedPubkeys.size === 0) {
      console.warn('WARNING: Empty whitelist - allowing all pubkeys (development mode)');
      return true;
    }

    return this.allowedPubkeys.has(pubkey);
  }

  add(pubkey: string): void {
    this.allowedPubkeys.add(pubkey);
  }

  remove(pubkey: string): void {
    this.allowedPubkeys.delete(pubkey);
  }

  list(): string[] {
    return Array.from(this.allowedPubkeys);
  }
}
