# E2E Tests for Fairfield Nostr

Comprehensive end-to-end tests using Playwright for testing the Fairfield Nostr chat application.

## Test Structure

### Test Files

1. **signup.spec.ts** - User signup flow
   - Homepage loading
   - Account creation
   - Mnemonic generation and display
   - Mnemonic copy functionality
   - Confirmation checkbox
   - localStorage key storage
   - Redirect to pending approval

2. **login.spec.ts** - User login flow
   - Mnemonic restoration
   - Invalid mnemonic error handling
   - Input normalization (whitespace, case)
   - Successful login redirect
   - Key restoration verification

3. **channels.spec.ts** - Channel management
   - Channel list display
   - Cohort filtering (business, moomaa-tribe, all)
   - Join request functionality
   - Channel selection
   - Member vs non-member UI
   - Encryption indicators

4. **messaging.spec.ts** - Messaging with mock relay
   - Send messages
   - Receive messages
   - Delete own messages
   - Message timestamps
   - Auto-scroll behavior
   - Keyboard shortcuts (Enter to send)

### Fixtures

- **mock-relay.ts** - Mock Nostr relay implementation
  - WebSocket server simulation
  - Event storage and retrieval
  - Subscription management
  - NIP-42 AUTH support
  - Filter matching logic

## Running Tests

### Install Dependencies

```bash
npm install
npx playwright install
```

### Run All E2E Tests

```bash
npm run test:e2e
```

### Run Specific Test File

```bash
npx playwright test signup.spec.ts
npx playwright test login.spec.ts
npx playwright test channels.spec.ts
npx playwright test messaging.spec.ts
```

### Run Tests in UI Mode

```bash
npx playwright test --ui
```

### Run Tests in Headed Mode

```bash
npx playwright test --headed
```

### Run Tests in Specific Browser

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Configuration

Configuration is in `playwright.config.ts`:

- **Base URL**: `http://localhost:5173` (default Vite dev server)
- **Timeout**: 60 seconds per test
- **Retries**: 2 on CI, 0 locally
- **Screenshot**: Only on failure
- **Video**: Retained on failure
- **Trace**: Collected on first retry

### Environment Variables

- `BASE_URL` - Override base URL for tests
- `CI` - Set to enable CI-specific behavior

## Mock Relay

The mock relay (`tests/e2e/fixtures/mock-relay.ts`) provides:

- **WebSocket Server**: Simulates Nostr relay protocol
- **Event Storage**: In-memory event database
- **Subscriptions**: Filter-based event subscriptions
- **Authentication**: Optional NIP-42 AUTH support
- **Broadcasting**: Relay events to subscribers

### Mock Relay Usage

```typescript
import { MockNostrRelay } from './fixtures/mock-relay';

let mockRelay: MockNostrRelay;

test.beforeAll(async () => {
  mockRelay = new MockNostrRelay({
    port: 8081,
    requireAuth: false
  });
  await mockRelay.start();
});

test.afterAll(async () => {
  await mockRelay.stop();
});
```

### Adding Test Events

```typescript
mockRelay.addEvent({
  id: 'event-1',
  pubkey: 'test-pubkey',
  created_at: Math.floor(Date.now() / 1000),
  kind: 1,
  tags: [],
  content: 'Test message',
  sig: 'mock-signature'
});
```

## Test Data

### Test Mnemonic

A consistent BIP-39 mnemonic is used across tests:

```
abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about
```

This mnemonic generates deterministic keys for testing.

### Test Channels

The messaging tests create mock channels with:
- Channel ID: `test-channel-id`
- Name: `Test Channel`
- Cohort: `business`
- Kind: 39000 (NIP-29 group metadata)

## Best Practices

### 1. Clean State

Each test starts with a clean state:

```typescript
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});
```

### 2. Wait for Elements

Use proper waiting strategies:

```typescript
// Wait for specific element
await page.waitForSelector('[data-testid="element"]');

// Wait for URL change
await page.waitForURL(/pattern/);

// Wait for network idle
await page.waitForLoadState('networkidle');
```

### 3. Assertions

Use Playwright's expect assertions:

```typescript
// Visibility
await expect(element).toBeVisible();

// Text content
await expect(element).toHaveText('Expected text');

// Attributes
await expect(element).toHaveAttribute('data-attr', 'value');

// State
await expect(button).toBeEnabled();
await expect(checkbox).toBeChecked();
```

### 4. Data Test IDs

Use `data-testid` attributes for reliable element selection:

```html
<div data-testid="channel-list">...</div>
<button data-testid="send-button">Send</button>
```

```typescript
const element = page.locator('[data-testid="channel-list"]');
```

### 5. Parallel Execution

Tests are configured for parallel execution:

```typescript
// In playwright.config.ts
fullyParallel: true,
workers: process.env.CI ? 1 : undefined,
```

## Debugging Tests

### 1. Playwright Inspector

```bash
npx playwright test --debug
```

### 2. VS Code Debugging

Use the Playwright Test extension for VS Code.

### 3. Trace Viewer

```bash
npx playwright show-trace trace.zip
```

### 4. Screenshots

Screenshots are automatically captured on failure in `test-results/`.

### 5. Console Logs

View browser console in test output:

```typescript
page.on('console', msg => console.log(msg.text()));
```

## Coverage

Tests cover:

- ✅ User signup flow (10 tests)
- ✅ User login flow (12 tests)
- ✅ Channel management (13 tests)
- ✅ Messaging functionality (10 tests)

**Total: 45+ E2E tests**

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Troubleshooting

### Port Conflicts

If port 8081 is in use, change mock relay port:

```typescript
const mockRelay = new MockNostrRelay({
  port: 8082, // Different port
  requireAuth: false
});
```

### Flaky Tests

Add explicit waits:

```typescript
await page.waitForTimeout(1000); // Last resort
await page.waitForLoadState('networkidle'); // Better
await page.waitForSelector('[data-testid="element"]'); // Best
```

### Browser Issues

Clear browser state:

```typescript
await page.context().clearCookies();
await page.evaluate(() => localStorage.clear());
await page.evaluate(() => sessionStorage.clear());
```

## Contributing

When adding new tests:

1. Follow existing test structure
2. Use descriptive test names
3. Add data-testid attributes to components
4. Clean up state in beforeEach
5. Use proper assertions
6. Document complex test scenarios

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Nostr Protocol (NIPs)](https://github.com/nostr-protocol/nips)
- [NIP-29: Relay-based Groups](https://github.com/nostr-protocol/nips/blob/master/29.md)
- [BIP-39: Mnemonic Code](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
