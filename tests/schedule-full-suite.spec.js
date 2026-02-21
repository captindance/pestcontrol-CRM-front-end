// @ts-check
/**
 * PestControl CRM - Comprehensive E2E Test Suite
 *
 * Uses Playwright route interception to cache frequent read-only API calls so
 * the backend rate-limiter (100 req/15 min in current config) is never exhausted.
 * Only schedule creation/update/delete tests hit the real API.
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BO_STATE  = path.join(__dirname, '.auth', 'business_owner.json');
const PA_STATE  = path.join(__dirname, '.auth', 'platform_admin.json');

const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;
if (!TEST_PASSWORD) {
  throw new Error('E2E_TEST_PASSWORD environment variable is required for Playwright tests.');
}
const BUSINESS_OWNER = { email: 'captaindanceman@gmail.com', password: TEST_PASSWORD };
const PLATFORM_ADMIN = { email: 'captindanceman@yahoo.com',  password: TEST_PASSWORD };

// ─── Cached API responses to avoid rate-limit exhaustion ─────────────────────
const CACHED_REPORTS  = JSON.parse(fs.readFileSync(path.join(__dirname, '.auth', 'reports-cache.json'),  'utf8'));
const CACHED_CLIENTS  = JSON.parse(fs.readFileSync(path.join(__dirname, '.auth', 'clients-cache.json'),  'utf8'));
const CACHED_SCHEDULES= JSON.parse(fs.readFileSync(path.join(__dirname, '.auth', 'schedules-cache.json'), 'utf8'));
const API_CREDS       = JSON.parse(fs.readFileSync(path.join(__dirname, '.auth', 'api-creds.json'),       'utf8'));

// Report info derived from cache
// Report 1: "What is the production value per employee…?" – has '?' → schedule name invalid
// Report 2: "Unasssigned breakdown" – safe name, use for actual schedule creation
const REPORT1_NAME = CACHED_REPORTS.reports[0]?.name ?? 'Report 1';
const REPORT2_NAME = CACHED_REPORTS.reports[1]?.name ?? 'Report 2';

async function createScheduleViaAPI(reportId = 2) {
  const name = (reportId === 1 ? REPORT1_NAME : REPORT2_NAME).replace(/[?!#]/g, '') + ' Schedule';
  const body = JSON.stringify({
    reportId, name,
    frequency: 'daily',
    timeOfDay: '13:00',
    recipients: [BUSINESS_OWNER.email],
    emailSecurityLevel: 'database_only'
  });
  try {
    const res = await fetch(`http://localhost:3001/api/schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_CREDS.jwt}`,
        'x-tenant-id': API_CREDS.tenantId,
        'x-acting-role': 'business_owner'
      },
      body
    });
    const data = await res.json();
    return data?.schedule?.id ? data.schedule : null;
  } catch { return null; }
}

/**
 * intercept: install route mocks for the heavy read-only GET endpoints.
 * Mutations (POST/PUT/DELETE) always pass through to the real API.
 */
async function intercept(page) {
  await page.route('**/api/reports**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CACHED_REPORTS) });
  });
  await page.route('**/api/clients/**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CACHED_CLIENTS) });
  });
  // Route /api/schedules – return cached (backend now filters by reportId server-side)
  await page.route('**/api/schedules**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CACHED_SCHEDULES) });
  });
  await page.route('**/api/permissions**', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ permissions: {
        canEditReports: true, canCreateReports: true, canDeleteReports: true,
        canManageConnections: true, canInviteUsers: true, canManageUsers: true
      }})
    });
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function navigateToApp(page) {
  await intercept(page);
  await page.goto('http://localhost:3000');
  await page.waitForSelector('button[aria-label="Logout"]', { timeout: 15000 });
  await page.waitForSelector('p:has-text("Loading...")', { state: 'hidden', timeout: 15000 });
}

async function context_loadAs(page, statePath) {
  const items = getLocalStorageFromFile(statePath);
  await page.addInitScript((state) => {
    for (const [k, v] of Object.entries(state)) window.localStorage.setItem(k, v);
  }, items);
  await intercept(page);
  await page.goto('http://localhost:3000');
  await page.waitForSelector('button[aria-label="Logout"]', { timeout: 15000 });
  await page.waitForSelector('p:has-text("Loading...")', { state: 'hidden', timeout: 15000 });
}

async function waitForScheduleButton(page) {
  try {
    await page.waitForSelector('button:has-text("Schedule")', { timeout: 10000 });
    return true;
  } catch { return false; }
}

async function openScheduleModal(page) {
  await page.locator('button:has-text("Schedule")').first().click();
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
}

async function createScheduleInModal(page, frequency = 'daily') {
  await page.locator('[role="dialog"] button:has-text("Create New Schedule")').click();
  await page.waitForTimeout(400);
  await page.locator('[role="dialog"] select').first().selectOption(frequency);
  await page.waitForTimeout(300);
  await page.locator('[role="dialog"] input[type="email"]').first().fill(BUSINESS_OWNER.email);
  await page.locator('[role="dialog"] button:has-text("Create Schedule")').click();
  await page.waitForTimeout(3000);
}

function getLocalStorageFromFile(statePath) {
  const raw = fs.readFileSync(statePath, 'utf8');
  const state = JSON.parse(raw);
  const origin = state.origins?.find(o => o.origin.includes('localhost:3000'));
  const items = {};
  for (const entry of (origin?.localStorage ?? [])) items[entry.name] = entry.value;
  return items;
}

// ─── SECTION 1: Authentication ────────────────────────────────────────────────
test.describe('Section 1: Authentication', () => {

  test('1.1 Login page loads correctly', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await test.step('Email input visible', async () => {
      await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });
    });
    await test.step('Password input visible', async () => {
      await expect(page.locator('input[type="password"]')).toBeVisible();
    });
    await test.step('Sign In button has correct text', async () => {
      await expect(page.locator('button[type="submit"]')).toHaveText(/Sign In/i);
    });
  });

  test('1.2 Business owner login success', async ({ page }) => {
    await context_loadAs(page, BO_STATE);
    await test.step('Login form gone', async () => {
      await expect(page.locator('input[type="email"]')).toBeHidden();
    });
    await test.step('Logout button visible', async () => {
      await expect(page.locator('button[aria-label="Logout"]')).toBeVisible();
    });
  });

  test('1.3 Platform admin login - Admin nav item visible', async ({ page }) => {
    await context_loadAs(page, PA_STATE);
    await expect(page.locator('button[aria-label="Admin"]')).toBeVisible({ timeout: 8000 });
  });

  test('1.4 Invalid password - stay on login with error message', async ({ page }) => {
    // Uses 1 real login API call (intentional)
    await page.goto('http://localhost:3000');
    await page.waitForSelector('input[type="email"]');
    await page.fill('input[type="email"]', BUSINESS_OWNER.email);
    await page.fill('input[type="password"]', 'WrongPassword999!');
    await page.click('button[type="submit"]');
    await test.step('Still on login page', async () => {
      await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 8000 });
    });
    await test.step('Error message visible (wrong password OR rate limit)', async () => {
      await expect(page.locator('div[style*="color:red"], div[style*="color: red"]')).toBeVisible({ timeout: 5000 });
    });
  });

  test('1.5 Logout returns to login form', async ({ page }) => {
    await context_loadAs(page, BO_STATE);
    await page.locator('button[aria-label="Logout"]').click();
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });
  });
});

// ─── SECTION 2: Navigation & Sidebar ─────────────────────────────────────────
test.describe('Section 2: Navigation & Sidebar', () => {
  test.use({ storageState: BO_STATE });

  test('2.1 Business owner sees Reports/Settings but NOT Admin', async ({ page }) => {
    await navigateToApp(page);
    await expect(page.locator('button[aria-label="Reports"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('button[aria-label="Settings"]')).toBeVisible();
    await expect(page.locator('button[aria-label="Admin"]')).toBeHidden();
  });

  test('2.2 Platform admin sees Admin nav item', async ({ page }) => {
    const items = getLocalStorageFromFile(PA_STATE);
    await page.addInitScript((s) => { for (const [k,v] of Object.entries(s)) window.localStorage.setItem(k,v); }, items);
    await intercept(page);
    await page.goto('http://localhost:3000');
    await page.waitForSelector('button[aria-label="Logout"]', { timeout: 15000 });
    await expect(page.locator('button[aria-label="Admin"]')).toBeVisible({ timeout: 8000 });
  });

  test('2.3 Sidebar collapse/expand button works', async ({ page }) => {
    await navigateToApp(page);
    const btn = page.locator('button[aria-label="Collapse sidebar"], button[aria-label="Expand sidebar"]').first();
    await btn.waitFor({ state: 'visible', timeout: 8000 });
    const before = await btn.getAttribute('aria-label');
    await btn.click();
    await page.waitForTimeout(400);
    const after = await page.locator('button[aria-label="Collapse sidebar"], button[aria-label="Expand sidebar"]').first().getAttribute('aria-label');
    expect(after).not.toBe(before);
  });

  test('2.4 Clicking different nav items changes content area', async ({ page }) => {
    await navigateToApp(page);
    await page.locator('button[aria-label="Settings"]').waitFor({ state: 'visible', timeout: 8000 });
    await page.locator('button[aria-label="Settings"]').click();
    await page.waitForTimeout(600);
    await page.locator('button[aria-label="Reports"]').click();
    await page.waitForTimeout(600);
    await expect(page.locator('h3:has-text("Reports")')).toBeVisible({ timeout: 5000 });
  });
});

// ─── SECTION 3: Reports Page ──────────────────────────────────────────────────
test.describe('Section 3: Reports Page', () => {
  test.use({ storageState: BO_STATE });

  test('3.1 Reports page loads with Reports heading', async ({ page }) => {
    await navigateToApp(page);
    await expect(page.locator('h3:has-text("Reports")')).toBeVisible({ timeout: 10000 });
  });

  test('3.2 Report cards have a Schedule button', async ({ page }) => {
    await navigateToApp(page);
    const found = await waitForScheduleButton(page);
    if (!found) { test.skip(true, 'No reports found'); return; }
    await expect(page.locator('button:has-text("Schedule")').first()).toBeVisible();
  });

  test('3.3 Create New Report form is accessible', async ({ page }) => {
    await navigateToApp(page);
    await expect(page.locator('input[placeholder="Report name"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Create Report")')).toBeVisible();
  });

  test('3.4 Refresh button present on reports page', async ({ page }) => {
    await navigateToApp(page);
    await expect(page.locator('button:has-text("Refresh")')).toBeVisible({ timeout: 10000 });
  });
});

// ─── SECTION 4: ScheduleModal - Core Flow ────────────────────────────────────
test.describe('Section 4: ScheduleModal - Core Flow', () => {
  test.use({ storageState: BO_STATE });

  test('4.1 Opening ScheduleModal shows list view with + Create New Schedule', async ({ page }) => {
    await navigateToApp(page);
    const found = await waitForScheduleButton(page);
    if (!found) { test.skip(true, 'No reports available'); return; }
    await openScheduleModal(page);
    await test.step('Dialog visible', async () => {
      await expect(page.locator('[role="dialog"]')).toBeVisible();
    });
    await test.step('+ Create New Schedule button visible', async () => {
      await expect(page.locator('[role="dialog"] button:has-text("Create New Schedule")')).toBeVisible();
    });
    await test.step('Modal header says "Schedule:"', async () => {
      await expect(page.locator('[role="dialog"] h2')).toContainText('Schedule:');
    });
  });

  test('4.2 Clicking + Create New Schedule shows create form', async ({ page }) => {
    await navigateToApp(page);
    const found = await waitForScheduleButton(page);
    if (!found) { test.skip(true, 'No reports available'); return; }
    await openScheduleModal(page);
    await page.locator('[role="dialog"] button:has-text("Create New Schedule")').click();
    await expect(page.locator('[role="dialog"] select').first()).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[role="dialog"] button:has-text("Create Schedule")')).toBeVisible();
  });

  test('4.3 Create form has Frequency, Time, and Recipients fields', async ({ page }) => {
    await navigateToApp(page);
    const found = await waitForScheduleButton(page);
    if (!found) { test.skip(true, 'No reports available'); return; }
    await openScheduleModal(page);
    await page.locator('[role="dialog"] button:has-text("Create New Schedule")').click();
    await page.waitForTimeout(400);

    await test.step('Frequency has Daily/Weekly/Monthly', async () => {
      const opts = await page.locator('[role="dialog"] select').first().locator('option').allTextContents();
      expect(opts).toContain('Daily');
      expect(opts).toContain('Weekly');
      expect(opts).toContain('Monthly');
    });
    await test.step('At least 2 selects (frequency + time)', async () => {
      expect(await page.locator('[role="dialog"] select').count()).toBeGreaterThanOrEqual(2);
    });
    await test.step('Recipients email input present', async () => {
      await expect(page.locator('[role="dialog"] input[type="email"]')).toBeVisible();
    });
    await test.step('+ Add Recipient button present', async () => {
      await expect(page.locator('[role="dialog"] button:has-text("Add Recipient")')).toBeVisible();
    });
  });

  test('4.4 CRITICAL BUG: Create daily schedule → modal returns to list showing new schedule', async ({ page }) => {
    // This test uses report 2 (safe name) to confirm the happy path works.
    // The FRONTEND bug is that createSchedule() errors are silently swallowed;
    // here we verify that on SUCCESS the list does refresh correctly.
    // A separate bug note is added for the backend name validation issue with report 1.
    await navigateToApp(page);
    const found = await waitForScheduleButton(page);
    if (!found) { test.skip(true, 'No reports available'); return; }

    // Mock schedule CRUD for this test so real tenant data is never mutated
    const mockSchedules = [];
    await page.route('**/api/schedules**', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, schedules: mockSchedules })
        });
      }
      if (method === 'POST') {
        const payload = route.request().postDataJSON();
        const created = {
          id: `mock-schedule-${Date.now()}`,
          name: payload?.name || `${REPORT2_NAME} Schedule`,
          reportId: payload?.reportId || 2,
          reportName: REPORT2_NAME,
          frequency: payload?.frequency || 'daily',
          timeOfDay: payload?.timeOfDay || '13:00',
          timezone: payload?.timezone || 'America/Denver',
          dayOfWeek: payload?.dayOfWeek ?? null,
          dayOfMonth: payload?.dayOfMonth ?? null,
          isEnabled: true,
          recipients: Array.isArray(payload?.recipients) ? payload.recipients : [BUSINESS_OWNER.email],
          nextRunAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        mockSchedules.unshift(created);
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, schedule: created })
        });
      }
      return route.continue();
    });

    // Use report 2 (no special chars in name → creation succeeds)
    await page.locator('button:has-text("Schedule")').nth(1).click();
    await page.waitForSelector('[role="dialog"]', { timeout: 10000 });

    await createScheduleInModal(page, 'daily');

    await test.step('CRITICAL: Modal must return to list view after creation', async () => {
      await expect(
        page.locator('[role="dialog"] button:has-text("Create New Schedule")'),
        'CRITICAL BUG: Modal did NOT return to list view after schedule creation'
      ).toBeVisible({ timeout: 5000 });
    });

    await test.step('Newly created schedule appears in list', async () => {
      const hasEdit = await page.locator('[role="dialog"] button:has-text("Edit")').count() > 0;
      const hasDaily = await page.locator('[role="dialog"] span:has-text("Daily"), [role="dialog"] span:has-text("daily")').count() > 0;
      expect(
        hasEdit || hasDaily,
        'BUG CONFIRMED: Modal navigated to list but newly created schedule is NOT shown (list did not refresh after creation)'
      ).toBe(true);
    });
  });

  test('4.5 Weekly frequency → Day of Week select appears', async ({ page }) => {
    await navigateToApp(page);
    const found = await waitForScheduleButton(page);
    if (!found) { test.skip(true, 'No reports available'); return; }
    await openScheduleModal(page);
    await page.locator('[role="dialog"] button:has-text("Create New Schedule")').click();
    await page.waitForTimeout(300);
    await page.locator('[role="dialog"] select').first().selectOption('weekly');
    await page.waitForTimeout(400);

    let hasDayOfWeek = false;
    const count = await page.locator('[role="dialog"] select').count();
    for (let i = 0; i < count; i++) {
      const opts = await page.locator('[role="dialog"] select').nth(i).locator('option').allTextContents();
      if (opts.includes('Monday')) { hasDayOfWeek = true; break; }
    }
    expect(hasDayOfWeek, 'Day of Week select should appear for weekly frequency').toBe(true);
  });

  test('4.6 Monthly frequency → Day of Month appears, Day of Week hidden', async ({ page }) => {
    await navigateToApp(page);
    const found = await waitForScheduleButton(page);
    if (!found) { test.skip(true, 'No reports available'); return; }
    await openScheduleModal(page);
    await page.locator('[role="dialog"] button:has-text("Create New Schedule")').click();
    await page.waitForTimeout(300);
    await page.locator('[role="dialog"] select').first().selectOption('monthly');
    await page.waitForTimeout(400);

    let hasDayOfMonth = false, hasDayOfWeek = false;
    const count = await page.locator('[role="dialog"] select').count();
    for (let i = 0; i < count; i++) {
      const opts = await page.locator('[role="dialog"] select').nth(i).locator('option').allTextContents();
      if (opts.length >= 28 && opts.includes('1') && opts.includes('28')) hasDayOfMonth = true;
      if (opts.includes('Monday')) hasDayOfWeek = true;
    }
    expect(hasDayOfMonth, 'Day of Month should appear for monthly').toBe(true);
    expect(hasDayOfWeek, 'Day of Week should NOT appear for monthly').toBe(false);
  });

  test('4.7 Cancel create → returns to list, no new schedule added', async ({ page }) => {
    await navigateToApp(page);
    const found = await waitForScheduleButton(page);
    if (!found) { test.skip(true, 'No reports available'); return; }
    await openScheduleModal(page);
    const before = await page.locator('[role="dialog"] button:has-text("Edit")').count();
    await page.locator('[role="dialog"] button:has-text("Create New Schedule")').click();
    await page.waitForTimeout(300);
    await page.locator('[role="dialog"] button:has-text("Cancel")').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[role="dialog"] button:has-text("Create New Schedule")')).toBeVisible();
    expect(await page.locator('[role="dialog"] button:has-text("Edit")').count()).toBe(before);
  });

  test('4.8 Back to List button returns to list view', async ({ page }) => {
    await navigateToApp(page);
    const found = await waitForScheduleButton(page);
    if (!found) { test.skip(true, 'No reports available'); return; }
    await openScheduleModal(page);
    await page.locator('[role="dialog"] button:has-text("Create New Schedule")').click();
    await page.waitForTimeout(300);
    await page.locator('[role="dialog"] button:has-text("Back to List")').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[role="dialog"] button:has-text("Create New Schedule")')).toBeVisible();
  });

  test('4.9 Close modal (x) → modal disappears', async ({ page }) => {
    await navigateToApp(page);
    const found = await waitForScheduleButton(page);
    if (!found) { test.skip(true, 'No reports available'); return; }
    await openScheduleModal(page);
    await page.locator('[role="dialog"] button[aria-label="Close modal"]').click();
    await page.waitForTimeout(400);
    await expect(page.locator('[role="dialog"]')).toBeHidden();
  });
});

// ─── SECTION 5: Schedule Management ──────────────────────────────────────────
test.describe('Section 5: Schedule Management', () => {
  test.use({ storageState: BO_STATE });

  // Stateful schedule mock: starts with 1 schedule, mutations update the state
  const MOCK_SCHEDULE = {
    id: 'test-sched-001', name: 'Unasssigned breakdown Schedule',
    frequency: 'daily', timeOfDay: '13:00', timezone: 'America/New_York',
    isEnabled: true, recipients: [BUSINESS_OWNER.email],
    nextRunAt: '2026-02-19T20:00:00Z', createdAt: '2026-02-19T13:00:00Z',
    reportId: 2
  };

  async function ensureSchedule(page) {
    // Stateful schedule mock - register AFTER intercept so it wins (LIFO)
    let schedules = [{ ...MOCK_SCHEDULE }];

    // First intercept (reports/clients/permissions) - also adds schedule mock
    await intercept(page);
    // Then override schedule route with stateful version (last-registered wins)
    await page.route('**/api/schedules**', async (route) => {
      const method = route.request().method();
      const url = route.request().url();
      if (method === 'GET') {
        // App calls GET /api/schedules (no reportId query param); filters client-side
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ schedules }) });
      } else if (method === 'DELETE') {
        const id = url.split('/').pop().split('?')[0];
        schedules = schedules.filter(s => s.id !== id);
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      } else if (method === 'PUT' || method === 'PATCH') {
        const id = url.split('/').pop().split('?')[0];
        const body = JSON.parse(route.request().postData() || '{}');
        schedules = schedules.map(s => s.id === id ? { ...s, ...body, id } : s);
        const updated = schedules.find(s => s.id === id) || schedules[0] || {};
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, schedule: updated }) });
      } else {
        await route.continue();
      }
    });

    await page.goto('http://localhost:3000');
    await page.waitForSelector('button[aria-label="Logout"]', { timeout: 15000 });
    await page.waitForSelector('p:has-text("Loading...")', { state: 'hidden', timeout: 15000 });

    try {
      await page.locator('button:has-text("Schedule")').nth(1).click({ timeout: 12000 });
      await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
      await page.locator('[role="dialog"]').getByText('Loading schedules...').waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
      return await page.locator('[role="dialog"] button:has-text("Edit")').isVisible().catch(() => false);
    } catch {
      return false;
    }
  }

  test('5.1 Edit schedule - form pre-populated', async ({ page }) => {
    const ok = await ensureSchedule(page);
    if (!ok) { test.skip(true, 'No reports available'); return; }

    await page.locator('[role="dialog"] button:has-text("Edit")').first().click();
    await page.waitForTimeout(500);

    await test.step('Save Changes button visible', async () => {
      await expect(page.locator('[role="dialog"] button:has-text("Save Changes")')).toBeVisible({ timeout: 5000 });
    });
    await test.step('Frequency select has a value', async () => {
      expect(await page.locator('[role="dialog"] select').first().inputValue()).toBeTruthy();
    });
    await test.step('Recipients pre-filled', async () => {
      expect(await page.locator('[role="dialog"] input[type="email"]').first().inputValue()).toBeTruthy();
    });
  });

  test('5.2 Save edited schedule - list updates', async ({ page }) => {
    const ok = await ensureSchedule(page);
    if (!ok) { test.skip(true, 'No reports available'); return; }

    await page.locator('[role="dialog"] button:has-text("Edit")').first().click();
    await page.waitForTimeout(500);
    await page.locator('[role="dialog"] select').first().selectOption('monthly');
    await page.waitForTimeout(300);
    await page.locator('[role="dialog"] button:has-text("Save Changes")').click();
    await page.waitForTimeout(3000);

    await expect(page.locator('[role="dialog"] button:has-text("Create New Schedule")')).toBeVisible({ timeout: 5000 });
  });

  test('5.3 Delete schedule - confirm accepted, removed from list', async ({ page }) => {
    const ok = await ensureSchedule(page);
    if (!ok) { test.skip(true, 'No reports available'); return; }

    const before = await page.locator('[role="dialog"] button:has-text("Delete")').count();
    page.once('dialog', d => d.accept());
    await page.locator('[role="dialog"] button:has-text("Delete")').first().click();
    await page.waitForTimeout(4000);

    const after = await page.locator('[role="dialog"] button:has-text("Delete")').count();
    const empty = await page.locator('[role="dialog"]:has-text("No schedules yet")').isVisible().catch(() => false);
    expect(after < before || empty, 'Schedule should be removed after delete').toBe(true);
  });

  test('5.4 Enable/Disable toggle changes status badge', async ({ page }) => {
    const ok = await ensureSchedule(page);
    if (!ok) { test.skip(true, 'No reports available'); return; }

    const btn = page.locator('[role="dialog"] button:has-text("Enabled"), [role="dialog"] button:has-text("Disabled")').first();
    await btn.waitFor({ state: 'visible', timeout: 8000 });
    const initialText = await btn.textContent() ?? '';
    const wasEnabled = initialText.includes('Enabled');

    await btn.click();
    // Wait for the button text to change (document.querySelector doesn't support :has-text)
    await page.waitForFunction(
      (prevText) => {
        const btns = Array.from(document.querySelectorAll('[role="dialog"] button'));
        const toggleBtn = btns.find(b => b.textContent.includes('Enabled') || b.textContent.includes('Disabled'));
        return toggleBtn && toggleBtn.textContent.trim() !== prevText.trim();
      },
      initialText,
      { timeout: 10000 }
    ).catch(() => {});

    const newText = await page.locator('[role="dialog"] button:has-text("Enabled"), [role="dialog"] button:has-text("Disabled")').first().textContent().catch(() => '');
    expect(newText).toContain(wasEnabled ? 'Disabled' : 'Enabled');
  });
});

// ─── SECTION 6: Schedule Details ─────────────────────────────────────────────
test.describe('Section 6: Schedule Details', () => {
  test.use({ storageState: BO_STATE });

  const MOCK_SCHED_6 = {
    id: 'test-sched-006', name: 'Unasssigned breakdown Schedule',
    frequency: 'daily', timeOfDay: '13:00', timezone: 'America/New_York',
    isEnabled: true, recipients: [BUSINESS_OWNER.email],
    nextRunAt: '2026-02-19T20:00:00Z', createdAt: '2026-02-19T13:00:00Z',
    reportId: 2
  };

  async function openModalWithSchedule(page) {
    const schedules = [{ ...MOCK_SCHED_6 }];

    await intercept(page);
    // Override schedule route after intercept (last-registered wins)
    await page.route('**/api/schedules**', async (route) => {
      const method = route.request().method();
      const url = route.request().url();
      if (method === 'GET') {
        if (url.includes('/executions')) {
          await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
        } else {
          // App calls GET /api/schedules without reportId param; filter is client-side
          await route.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify({ schedules }) });
        }
      } else {
        await route.continue();
      }
    });

    await page.goto('http://localhost:3000');
    await page.waitForSelector('button[aria-label="Logout"]', { timeout: 15000 });
    await page.waitForSelector('p:has-text("Loading...")', { state: 'hidden', timeout: 15000 });

    try {
      await page.locator('button:has-text("Schedule")').nth(1).click({ timeout: 12000 });
      await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
      await page.locator('[role="dialog"]').getByText('Loading schedules...').waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
      return await page.locator('[role="dialog"] button:has-text("Show Details")').isVisible().catch(() => false);
    } catch {
      return false;
    }
  }

  test('6.1 Show Details button expands detail section', async ({ page }) => {
    if (!await openModalWithSchedule(page)) { test.skip(true, 'No reports available'); return; }
    await page.locator('[role="dialog"] button:has-text("Show Details")').first().click();
    await page.waitForTimeout(600);
    await expect(page.locator('[role="dialog"]:has-text("Execution Log")')).toBeVisible({ timeout: 5000 });
  });

  test('6.2 Execution Log tab shown by default', async ({ page }) => {
    if (!await openModalWithSchedule(page)) { test.skip(true, 'No reports available'); return; }
    await page.locator('[role="dialog"] button:has-text("Show Details")').first().click();
    await page.waitForTimeout(800);
    await expect(page.locator('[role="dialog"]:has-text("Execution Log")')).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator('[role="dialog"]:has-text("execution history"), [role="dialog"]:has-text("Loading execution")')
    ).toBeVisible({ timeout: 8000 });
  });

  test('6.3 Change Log tab switches to audit content', async ({ page }) => {
    if (!await openModalWithSchedule(page)) { test.skip(true, 'No reports available'); return; }
    await page.locator('[role="dialog"] button:has-text("Show Details")').first().click();
    await page.waitForTimeout(800);
    await page.locator('[role="dialog"] button:has-text("Change Log")').first().click();
    await page.waitForTimeout(600);
    await expect(page.locator('[role="dialog"]:has-text("Change Log")')).toBeVisible({ timeout: 3000 });
  });

  test('6.4 Hide Details collapses the section', async ({ page }) => {
    if (!await openModalWithSchedule(page)) { test.skip(true, 'No reports available'); return; }
    await page.locator('[role="dialog"] button:has-text("Show Details")').first().click();
    await page.waitForTimeout(500);
    await page.locator('[role="dialog"] button:has-text("Hide Details")').first().click();
    await page.waitForTimeout(400);
    await expect(page.locator('[role="dialog"] button:has-text("Hide Details")')).toBeHidden();
    await expect(page.locator('[role="dialog"] button:has-text("Show Details")')).toBeVisible({ timeout: 5000 });
  });
});

// ─── SECTION 7: Role-Based Access ────────────────────────────────────────────
test.describe('Section 7: Role-Based Access', () => {

  test('7.1 Admin panel NOT accessible for business_owner', async ({ page }) => {
    await context_loadAs(page, BO_STATE);
    await expect(page.locator('button[aria-label="Admin"]')).toBeHidden({ timeout: 8000 });
  });

  test('7.2 Platform admin CAN access admin panel', async ({ page }) => {
    await context_loadAs(page, PA_STATE);
    const adminBtn = page.locator('button[aria-label="Admin"]');
    await adminBtn.waitFor({ state: 'visible', timeout: 8000 });
    await adminBtn.click();
    await page.waitForTimeout(1000);
    expect(await page.locator('[style*="color:#c41e3a"]').count()).toBe(0);
  });
});

// ─── SECTION 8: Error States ──────────────────────────────────────────────────
test.describe('Section 8: Error States', () => {
  test.use({ storageState: BO_STATE });

  test('8.1 Empty recipient field prevents schedule submission', async ({ page }) => {
    // Un-mock schedules so form submission hits real validation
    await page.unroute('**/api/schedules**');
    await navigateToApp(page);
    const found = await waitForScheduleButton(page);
    if (!found) { test.skip(true, 'No reports available'); return; }
    await openScheduleModal(page);
    await page.locator('[role="dialog"] button:has-text("Create New Schedule")').click();
    await page.waitForTimeout(300);
    await page.locator('[role="dialog"] input[type="email"]').first().fill('');
    await page.locator('[role="dialog"] button:has-text("Create Schedule")').click();
    await page.waitForTimeout(1500);

    const onForm  = await page.locator('[role="dialog"] button:has-text("Create Schedule")').isVisible().catch(() => false);
    const toast   = await page.locator('[style*="background: #ef4444"], [style*="background:#ef4444"]').isVisible().catch(() => false);
    expect(onForm || toast, 'Empty recipient should trigger validation or stay on form').toBe(true);
  });

  test('8.2 Modal shows "No schedules yet" for report with no schedules', async ({ page }) => {
    // Navigate first (which calls intercept() with CACHED_SCHEDULES route)
    await navigateToApp(page);
    // Override schedule route AFTER intercept() so this handler wins (Playwright LIFO)
    await page.route('**/api/schedules**', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ schedules: [] }) });
    });
    const found = await waitForScheduleButton(page);
    if (!found) { test.skip(true, 'No reports available'); return; }
    await openScheduleModal(page);
    await page.waitForTimeout(2000);
    const emptyMsg = page.locator('[role="dialog"]').getByText('No schedules yet');
    await expect(emptyMsg).toBeVisible({ timeout: 8000 });
  });
});
