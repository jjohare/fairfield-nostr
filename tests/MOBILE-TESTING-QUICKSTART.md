# Mobile Chat Testing - Quick Start Guide

## Prerequisites

```bash
cd /home/devuser/workspace/nostr-BBS
npm install
npx playwright install chromium
```

## Start Development Server

```bash
# Terminal 1: Start dev server
npm run dev

# Wait for server to be ready at http://localhost:5173
```

## Run Mobile Tests

### All Mobile Chat Tests
```bash
npm run test:e2e -- tests/e2e/mobile-chat.spec.ts --project="Mobile Chrome"
```

### Specific Test Categories

**Authentication Only**
```bash
npm run test:e2e -- tests/e2e/mobile-chat.spec.ts --project="Mobile Chrome" -g "Authentication"
```

**Message Composition**
```bash
npm run test:e2e -- tests/e2e/mobile-chat.spec.ts --project="Mobile Chrome" -g "Message Composition"
```

**Message Display**
```bash
npm run test:e2e -- tests/e2e/mobile-chat.spec.ts --project="Mobile Chrome" -g "Message Display"
```

**Channel Switching**
```bash
npm run test:e2e -- tests/e2e/mobile-chat.spec.ts --project="Mobile Chrome" -g "Channel Switching"
```

**Real-time Updates**
```bash
npm run test:e2e -- tests/e2e/mobile-chat.spec.ts --project="Mobile Chrome" -g "Real-time Updates"
```

**Performance & UX**
```bash
npm run test:e2e -- tests/e2e/mobile-chat.spec.ts --project="Mobile Chrome" -g "Performance"
```

## Interactive Mode

### UI Mode (Recommended)
```bash
npm run test:e2e -- tests/e2e/mobile-chat.spec.ts --project="Mobile Chrome" --ui
```

Features:
- Visual test runner
- Step-by-step debugging
- Screenshot viewer
- Time travel debugging

### Debug Mode
```bash
npm run test:e2e -- tests/e2e/mobile-chat.spec.ts --project="Mobile Chrome" --debug
```

Features:
- Playwright Inspector
- Pause and step through
- Selector playground
- Live debugging

### Headed Mode (Watch Tests Run)
```bash
npm run test:e2e -- tests/e2e/mobile-chat.spec.ts --project="Mobile Chrome" --headed
```

## View Reports

### HTML Report
```bash
npx playwright show-report
```

Automatically opens browser with:
- Test results summary
- Failed test details
- Screenshots and videos
- Trace viewer

### Generate Report Manually
```bash
npx playwright test --reporter=html
```

## Test Artifacts

All test artifacts are saved in:
- **Screenshots**: `test-results/` (on failure)
- **Videos**: `test-results/` (on failure)
- **Traces**: `test-results/` (on retry)
- **HTML Report**: `playwright-report/`

## Common Commands

### Run Single Test
```bash
npm run test:e2e -- tests/e2e/mobile-chat.spec.ts --project="Mobile Chrome" -g "tap input field"
```

### Update Snapshots
```bash
npm run test:e2e -- tests/e2e/mobile-chat.spec.ts --project="Mobile Chrome" --update-snapshots
```

### Run with Retries
```bash
npm run test:e2e -- tests/e2e/mobile-chat.spec.ts --project="Mobile Chrome" --retries=2
```

### Run with Custom Timeout
```bash
npm run test:e2e -- tests/e2e/mobile-chat.spec.ts --project="Mobile Chrome" --timeout=120000
```

## Device Configurations

### Current: Pixel 5
- **Viewport**: 393x851
- **User Agent**: Android Chrome
- **Touch**: Enabled
- **Mobile**: True

### Test Other Devices

**iPhone 12**
```bash
npm run test:e2e -- tests/e2e/mobile-chat.spec.ts --project="Mobile Safari"
```

**Custom Viewport**
```bash
npm run test:e2e -- tests/e2e/mobile-chat.spec.ts --project="Mobile Chrome" --viewport-size=375,667
```

## Troubleshooting

### Tests Timing Out
Increase timeout:
```bash
npm run test:e2e -- tests/e2e/mobile-chat.spec.ts --project="Mobile Chrome" --timeout=120000
```

### Server Not Running
Check dev server is running:
```bash
curl http://localhost:5173
```

### Playwright Browser Issues
Reinstall browsers:
```bash
npx playwright install --force chromium
```

### Port Already in Use
Change port in test or kill process:
```bash
lsof -ti:5173 | xargs kill -9
npm run dev -- --port 5174
```

## Test Results Interpretation

### ✅ Pass
All assertions passed, no errors

### ❌ Fail
Assertion failed or error occurred
- Check screenshot in report
- Review error message
- Check trace if available

### ⚠️ Flaky
Test passes sometimes, fails others
- May need increased timeout
- May need better wait conditions
- May indicate real bug

### ⏭️ Skipped
Test marked as skip or disabled

## Best Practices

1. **Always start dev server first**
2. **Use --ui mode for development**
3. **Use --headed to watch tests**
4. **Check HTML reports for failures**
5. **Run specific categories during development**
6. **Run full suite before committing**

## Quick Test Workflow

```bash
# 1. Start dev server
npm run dev

# 2. Run tests in UI mode (new terminal)
npm run test:e2e -- tests/e2e/mobile-chat.spec.ts --project="Mobile Chrome" --ui

# 3. Select tests to run
# 4. Click "Watch mode" to re-run on changes
# 5. Debug failures with time travel
# 6. View screenshots and traces

# 7. Before committing, run full suite
npm run test:e2e -- tests/e2e/mobile-chat.spec.ts --project="Mobile Chrome"

# 8. Check report
npx playwright show-report
```

## Environment Variables

Tests respect these environment variables:
- `BASE_URL` - Override base URL (default: http://localhost:5173)
- `CI` - CI mode (affects retries and workers)

Example:
```bash
BASE_URL=http://localhost:3000 npm run test:e2e -- tests/e2e/mobile-chat.spec.ts --project="Mobile Chrome"
```

## Getting Help

- **Playwright Docs**: https://playwright.dev
- **Test File**: `tests/e2e/mobile-chat.spec.ts`
- **QA Report**: `tests/MOBILE-CHAT-QA-REPORT.md`
- **Project README**: `README.md`

## Next Steps

1. Run authentication tests first
2. Verify all tests pass
3. Report any failures
4. Run on real devices if possible
5. Test on iOS (Mobile Safari)
6. Performance profiling
7. Accessibility audit
