---
name: playwright
description: End-to-end browser testing with Playwright. Provides guidance on writing, running, and debugging Playwright tests.
---

# Playwright Testing Skill

You are working with Playwright for end-to-end browser testing. Follow these guidelines when writing or modifying tests.

## Project Setup Detection

1. Check if Playwright is already installed:
   - Look for `playwright` in `package.json` dependencies or devDependencies
   - Look for `playwright.config.ts` or `playwright.config.js` in the project root
2. If not installed, install it: `npm init playwright@latest` or `npm install -D @playwright/test`
3. Install browser binaries if needed: `npx playwright install`

## Writing Tests

### File Organization
- Place test files under the project's test directory (typically `tests/`, `e2e/`, or `__tests__/`)
- Name test files with `.spec.ts` or `.test.ts` suffix
- One test file per feature or page

### Basic Test Structure
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/path');
    await expect(page.locator('h1')).toHaveText('Expected Title');
  });
});
```

### Locators (prefer these in order)
1. `page.getByRole()` - accessibility-based, most resilient
2. `page.getByTestId()` - explicit test anchors
3. `page.getByText()` - text content matching
4. `page.getByLabel()` - form labels
5. `page.getByPlaceholder()` - input placeholders
6. CSS selectors only as last resort

### Assertions
- Use `expect(locator).toHaveText()` for visible text
- Use `expect(locator).toBeVisible()` for element presence
- Use `expect(page).toHaveURL()` for navigation checks
- Use `expect(locator).toHaveCount()` for list length
- Prefer auto-retrying assertions over manual `waitFor` calls

### Page Interactions
- `await page.click('selector')` - click element
- `await page.fill('selector', 'value')` - fill input
- `await page.selectOption('selector', 'value')` - select dropdown
- `await page.check('selector')` - check checkbox
- `await page.waitForSelector('selector')` - wait for element

## Running Tests

```bash
# Run all tests
npx playwright test

# Run a specific test file
npx playwright test tests/example.spec.ts

# Run tests in headed mode (visible browser)
npx playwright test --headed

# Run with specific browser
npx playwright test --project=chromium

# Debug mode
npx playwright test --debug

# Generate trace for failed tests
npx playwright test --trace on-first-retry

# Show HTML report
npx playwright show-report
```

## Best Practices

1. **No hardcoded waits**: Never use `page.waitForTimeout()`. Use `waitForSelector`, `waitForNavigation`, or auto-retrying assertions.
2. **Isolate tests**: Each test should be independent. Use `beforeEach`/`afterEach` for setup/teardown.
3. **Test user behavior**: Test what the user sees and does, not implementation details.
4. **Use test IDs**: Add `data-testid` attributes in components for stable test selectors.
5. **Handle async properly**: Every Playwright operation returns a promise. Always `await`.
6. **Screenshots on failure**: Configure `use: { screenshot: 'only-on-failure' }` in config.
7. **Trace on failure**: Configure `use: { trace: 'on-first-retry' }` for debugging.

## Configuration Reference

Typical `playwright.config.ts`:
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```
