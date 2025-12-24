# Mobile Bug Report Template

## Bug Information

**Bug ID**: MOBILE-XXX
**Date Reported**: YYYY-MM-DD
**Reporter**: [Your Name]
**Severity**: [Critical | High | Medium | Low]
**Status**: [New | In Progress | Fixed | Won't Fix]

---

## Summary
Brief one-line description of the issue

---

## Environment

**Device**: Pixel 5 (emulated) / Real Device
**OS**: Android [version]
**Browser**: Chrome Mobile [version]
**App Version**: [commit hash or version]
**Viewport**: 393x851px
**Network**: [WiFi | 4G | 3G | Offline]

---

## Test Case
**Test File**: tests/e2e/mobile-chat.spec.ts
**Test Name**: [exact test name]
**Category**: [Authentication | Message Composition | Display | Navigation | Real-time | Performance]

---

## Steps to Reproduce

1. Navigate to [URL/page]
2. Tap [element]
3. Enter [text/data]
4. Observe [behavior]

**Preconditions**:
- User logged in: Yes/No
- Channel joined: Yes/No
- Messages present: Yes/No

---

## Expected Behavior
What should happen according to requirements

---

## Actual Behavior
What actually happens (be specific)

---

## Mobile-Specific Details

### Touch Interaction Issue?
- [ ] Touch target too small (< 44x44px)
- [ ] Tap not registering
- [ ] Long press not working
- [ ] Swipe gesture failing
- [ ] Multiple taps required

### Virtual Keyboard Issue?
- [ ] Keyboard not appearing
- [ ] Input hidden by keyboard
- [ ] Keyboard dismissal problem
- [ ] Text entry failing

### Layout Issue?
- [ ] Horizontal scroll present
- [ ] Content overflow
- [ ] Elements off-screen
- [ ] Viewport not responsive

### Performance Issue?
- [ ] Slow rendering
- [ ] Janky scrolling
- [ ] Touch delay
- [ ] Loading timeout

---

## Screenshots

**Before Action**:
![screenshot](path/to/before.png)

**After Action**:
![screenshot](path/to/after.png)

**Expected**:
![screenshot](path/to/expected.png)

---

## Video/Screen Recording
[Link to video or attach file]

---

## Console Logs
```
[paste relevant console errors/warnings]
```

---

## Network Logs
```
[paste relevant network requests/failures]
```

---

## Playwright Trace
**Trace File**: test-results/[test-name]/trace.zip
**View**: Open in Playwright Trace Viewer

Key frames:
- Frame 1: [description]
- Frame 2: [description]
- Frame 3: [description]

---

## Error Message
```
[exact error message from test or console]
```

---

## Code Location
**File**: `src/[file-path]`
**Line**: [line number]
**Function**: [function name]

Suspected code:
```typescript
// paste relevant code snippet
```

---

## Impact Assessment

### User Impact
- [ ] Blocks critical functionality
- [ ] Degrades user experience
- [ ] Minor inconvenience
- [ ] Edge case only

### Frequency
- [ ] Happens every time (100%)
- [ ] Happens frequently (>50%)
- [ ] Happens sometimes (<50%)
- [ ] Rare (<10%)

### Scope
- [ ] Affects all mobile users
- [ ] Affects specific devices
- [ ] Affects specific browsers
- [ ] Affects specific conditions

---

## Accessibility Impact

### WCAG Violations
- [ ] Touch target too small (2.5.5)
- [ ] Insufficient contrast (1.4.3)
- [ ] Missing focus indicator (2.4.7)
- [ ] Keyboard trap (2.1.2)
- [ ] No text alternative (1.1.1)

### Screen Reader Impact
- [ ] VoiceOver (iOS)
- [ ] TalkBack (Android)
- [ ] Not tested

---

## Related Issues
- Related to: #XXX
- Blocks: #YYY
- Depends on: #ZZZ

---

## Workaround
Is there a temporary workaround?
- [ ] Yes: [describe workaround]
- [ ] No

---

## Root Cause Analysis
[If known, describe the underlying cause]

---

## Proposed Fix
[If known, describe potential solution]

---

## Testing Notes

### How to Verify Fix
1. [step 1]
2. [step 2]
3. [expected result]

### Regression Testing Required
- [ ] Test on other mobile devices
- [ ] Test on desktop (ensure no regression)
- [ ] Test all message types
- [ ] Test all channels
- [ ] Performance testing

---

## Priority Justification

**Critical**: App unusable on mobile
**High**: Core functionality broken
**Medium**: Degrades UX significantly
**Low**: Minor issue or edge case

Justification:
[Explain why this severity level]

---

## Additional Context
Any other relevant information

---

## Attachments
- [ ] Screenshots attached
- [ ] Video recorded
- [ ] Trace file available
- [ ] Console logs included
- [ ] Network HAR file

---

## Example: Touch Target Too Small

**Bug ID**: MOBILE-001
**Severity**: High
**Summary**: Send button too small on mobile (32x32px)

**Steps to Reproduce**:
1. Navigate to any channel on Pixel 5
2. Type message in input
3. Inspect send button dimensions
4. Attempt to tap send button

**Expected**: Send button should be at least 44x44px (WCAG 2.1)
**Actual**: Send button is 32x32px, difficult to tap accurately

**Mobile-Specific**: Touch target too small

**Impact**: Users frequently miss tap, have to tap multiple times

**WCAG Violation**: Yes - Success Criterion 2.5.5 (Target Size)

**Proposed Fix**:
```css
.send-button {
  min-width: 44px;
  min-height: 44px;
  padding: 8px;
}
```

---

## Example: Virtual Keyboard Hides Input

**Bug ID**: MOBILE-002
**Severity**: Critical
**Summary**: Virtual keyboard covers message input field

**Steps to Reproduce**:
1. Open channel on iPhone 12
2. Tap message input
3. Virtual keyboard appears
4. Observe input field position

**Expected**: Input field should scroll into view above keyboard
**Actual**: Input field hidden behind virtual keyboard

**Mobile-Specific**: Virtual keyboard issue

**Impact**: Users cannot see what they're typing

**Proposed Fix**:
- Implement viewport-fit or scrollIntoView
- Add fixed positioning for input
- Detect keyboard height and adjust layout

---

**Template Version**: 1.0
**Last Updated**: 2025-12-23
