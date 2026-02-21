// Global setup: login once per user and save storage state.
// This avoids triggering the backend rate-limiter (max 5 logins per 15 min in prod)
// on every test. We skip re-login if the saved token is still valid.
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD;
if (!TEST_PASSWORD) {
  throw new Error('E2E_TEST_PASSWORD environment variable is required for Playwright global setup.');
}
const BUSINESS_OWNER = { email: 'captaindanceman@gmail.com', password: TEST_PASSWORD };
const PLATFORM_ADMIN = { email: 'captindanceman@yahoo.com', password: TEST_PASSWORD };

const AUTH_DIR = path.join(__dirname, '.auth');
const BO_STATE = path.join(AUTH_DIR, 'business_owner.json');
const PA_STATE = path.join(AUTH_DIR, 'platform_admin.json');

// Returns true if the saved state contains a JWT that won't expire for at least 1 hour
function isStateValid(statePath) {
  try {
    const raw = fs.readFileSync(statePath, 'utf8');
    const state = JSON.parse(raw);
    const origin = state.origins?.find(o => o.origin.includes('localhost:3000'));
    const jwtEntry = origin?.localStorage?.find(e => e.name === 'jwt');
    if (!jwtEntry?.value) return false;
    // Decode JWT payload (base64url) to check exp
    const payloadB64 = jwtEntry.value.split('.')[1];
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    const expiresIn = payload.exp - Math.floor(Date.now() / 1000);
    return expiresIn > 3600; // valid for at least 1 more hour
  } catch {
    return false;
  }
}

async function loginAndSave(browser, user, statePath) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto('http://localhost:3000');
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]');
    // Wait for the app to load (login form disappears)
    await page.waitForSelector('input[type="email"]', { state: 'hidden', timeout: 15000 });
    // Wait for React to settle and reports to start loading
    await page.waitForTimeout(2000);
    await context.storageState({ path: statePath });
    console.log(`[global-setup] Saved auth state for ${user.email}`);
  } finally {
    await context.close();
  }
}

export default async function globalSetup() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const needsBO = !isStateValid(BO_STATE);
  const needsPA = !isStateValid(PA_STATE);

  if (!needsBO && !needsPA) {
    console.log('[global-setup] Existing auth states are still valid — skipping login.');
    return;
  }

  const browser = await chromium.launch();
  try {
    if (needsBO) await loginAndSave(browser, BUSINESS_OWNER, BO_STATE);
    else console.log('[global-setup] business_owner state still valid — skipping login.');

    if (needsPA) await loginAndSave(browser, PLATFORM_ADMIN, PA_STATE);
    else console.log('[global-setup] platform_admin state still valid — skipping login.');
  } finally {
    await browser.close();
  }
}

