# E2E Tests Quick Start

## Installation

```bash
# Install all dependencies including Playwright
npm install

# Install Playwright browsers (chromium, firefox, webkit)
npx playwright install
```

## Running Tests

### Run all E2E tests
```bash
npm run test:e2e
```

### Run specific test file
```bash
npx playwright test signup.spec.ts
npx playwright test login.spec.ts
npx playwright test channels.spec.ts
npx playwright test messaging.spec.ts
```

### Run with UI mode (recommended for development)
```bash
npm run test:e2e:ui
```

### Run in headed mode (see browser)
```bash
npm run test:e2e:headed
```

### Debug mode
```bash
npm run test:e2e:debug
```

### Run on specific browser
```bash
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit
```

## Test Coverage

### 1. Signup Tests (signup.spec.ts)
- ✅ Homepage loads
- ✅ Create account generates mnemonic
- ✅ Copy mnemonic button
- ✅ Checkbox enables continue
- ✅ Keys stored in localStorage
- ✅ Redirect to pending approval
- ✅ Security warnings
- ✅ Unique key generation
- ✅ Mnemonic validation

### 2. Login Tests (login.spec.ts)
- ✅ Login page accessible
- ✅ Restore from valid mnemonic
- ✅ Invalid mnemonic errors
- ✅ Empty mnemonic validation
- ✅ Successful login redirect
- ✅ Whitespace normalization
- ✅ Case normalization
- ✅ Key derivation verification
- ✅ Accessibility
- ✅ Loading states

### 3. Channel Tests (channels.spec.ts)
- ✅ Channel list display
- ✅ Channel information (name, description, member count)
- ✅ Cohort filtering (business, moomaa-tribe, all)
- ✅ Request to join button
- ✅ Member vs non-member UI
- ✅ Channel selection
- ✅ Encryption indicators
- ✅ Empty states
- ✅ Search filtering
- ✅ Visibility badges

### 4. Messaging Tests (messaging.spec.ts)
- ✅ Send messages
- ✅ Receive messages
- ✅ Delete own messages
- ✅ Cannot delete others' messages
- ✅ Message timestamps
- ✅ Auto-scroll to bottom
- ✅ Message input clearing
- ✅ Send button states
- ✅ Enter key to send
- ✅ Mock relay integration

## Files Created

```
/home/devuser/workspace/fairfield-nostr/
├── playwright.config.ts              # Playwright configuration
├── package.json                      # Updated with E2E scripts
└── tests/e2e/
    ├── .gitignore                   # Test artifacts exclusion
    ├── README.md                    # Comprehensive documentation
    ├── QUICKSTART.md                # This file
    ├── signup.spec.ts               # Signup flow tests (267 lines)
    ├── login.spec.ts                # Login flow tests (299 lines)
    ├── channels.spec.ts             # Channel management tests (330 lines)
    ├── messaging.spec.ts            # Messaging tests (404 lines)
    └── fixtures/
        └── mock-relay.ts            # Mock Nostr relay (316 lines)
```

**Total: 1,300+ lines of test code**

## Key Features

### Mock Relay
- Full Nostr protocol simulation
- WebSocket server
- Event storage and retrieval
- Subscription management
- NIP-42 AUTH support
- Filter matching

### Test Data
- Consistent BIP-39 test mnemonic
- Deterministic key generation
- Mock channel data
- Realistic message scenarios

### Best Practices
- Clean state per test
- Proper element waiting
- Data-testid selectors
- Accessibility testing
- Parallel execution
- Screenshot on failure
- Trace on retry

## Troubleshooting

### Tests fail to start
```bash
# Reinstall Playwright browsers
npx playwright install --force
```

### Port already in use
The mock relay uses port 8081. If it's in use:
1. Stop the process using port 8081
2. Or modify `mock-relay.ts` to use a different port

### Application not loading
Ensure the dev server is running:
```bash
npm run dev
```

### Browser not opening in headed mode
Check that you have installed browsers:
```bash
npx playwright install chromium firefox webkit
```

## Next Steps

1. **Integrate with CI/CD**: Add tests to GitHub Actions or other CI
2. **Add more tests**: Expand coverage for edge cases
3. **Performance testing**: Add tests for load and performance
4. **Visual regression**: Add screenshot comparison tests
5. **API mocking**: Enhance mock relay with more scenarios

## Support

For issues or questions:
- Check [Playwright Documentation](https://playwright.dev)
- Review test logs in `test-results/`
- View HTML report: `npx playwright show-report`
- Use debug mode: `npm run test:e2e:debug`
