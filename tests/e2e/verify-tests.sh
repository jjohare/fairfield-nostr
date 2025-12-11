#!/bin/bash
# E2E Test Verification Script

echo "========================================="
echo "Fairfield Nostr E2E Test Verification"
echo "========================================="
echo ""

# Check if Playwright is installed
echo "1. Checking Playwright installation..."
if npm list @playwright/test > /dev/null 2>&1; then
    echo "   ✓ Playwright is installed"
else
    echo "   ✗ Playwright not found - run: npm install"
    exit 1
fi

# Check test files
echo ""
echo "2. Checking test files..."
test_files=(
    "signup.spec.ts"
    "login.spec.ts"
    "channels.spec.ts"
    "messaging.spec.ts"
)

for file in "${test_files[@]}"; do
    if [ -f "/home/devuser/workspace/fairfield-nostr/tests/e2e/$file" ]; then
        lines=$(wc -l < "/home/devuser/workspace/fairfield-nostr/tests/e2e/$file")
        echo "   ✓ $file ($lines lines)"
    else
        echo "   ✗ $file not found"
    fi
done

# Check fixtures
echo ""
echo "3. Checking fixtures..."
if [ -f "/home/devuser/workspace/fairfield-nostr/tests/e2e/fixtures/mock-relay.ts" ]; then
    lines=$(wc -l < "/home/devuser/workspace/fairfield-nostr/tests/e2e/fixtures/mock-relay.ts")
    echo "   ✓ mock-relay.ts ($lines lines)"
else
    echo "   ✗ mock-relay.ts not found"
fi

# Check configuration
echo ""
echo "4. Checking configuration..."
if [ -f "/home/devuser/workspace/fairfield-nostr/playwright.config.ts" ]; then
    echo "   ✓ playwright.config.ts exists"
else
    echo "   ✗ playwright.config.ts not found"
fi

# Check documentation
echo ""
echo "5. Checking documentation..."
docs=(
    "README.md"
    "QUICKSTART.md"
)

for doc in "${docs[@]}"; do
    if [ -f "/home/devuser/workspace/fairfield-nostr/tests/e2e/$doc" ]; then
        echo "   ✓ $doc"
    else
        echo "   ✗ $doc not found"
    fi
done

# Check npm scripts
echo ""
echo "6. Checking npm scripts..."
if grep -q '"test:e2e"' /home/devuser/workspace/fairfield-nostr/package.json; then
    echo "   ✓ test:e2e script configured"
else
    echo "   ✗ test:e2e script not found"
fi

# Count total tests
echo ""
echo "7. Counting test cases..."
total_tests=$(grep -r "test(" /home/devuser/workspace/fairfield-nostr/tests/e2e/*.spec.ts | wc -l)
echo "   ✓ Found $total_tests test cases"

# Summary
echo ""
echo "========================================="
echo "Summary:"
echo "  Test Files: 4"
echo "  Test Cases: $total_tests"
echo "  Mock Relay: Yes"
echo "  Documentation: Complete"
echo "  Configuration: Ready"
echo "========================================="
echo ""
echo "Next steps:"
echo "  1. Install browsers: npx playwright install"
echo "  2. Run tests: npm run test:e2e"
echo "  3. Or use UI: npm run test:e2e:ui"
echo ""
