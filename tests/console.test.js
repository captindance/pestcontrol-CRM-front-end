import { test, expect } from '@playwright/test';

const BUSINESS_USER = {
  email: 'captindanceman@yahoo.com',
  password: 'lin48kLIN$*K',
};

const PLATFORM_ADMIN = {
  email: 'captaindanceman@gmail.com',
  password: 'lin48kLIN$*K',
};

test.describe('Browser Console Tests', () => {
  
  test('2.1 No console errors on login page', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Filter out expected errors (if any)
    const criticalErrors = consoleErrors.filter(err => 
      !err.includes('favicon') && 
      !err.includes('DevTools')
    );
    
    expect(criticalErrors.length).toBe(0);
  });

  test('2.2 No console errors after successful login', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.fill('input[type="email"]', BUSINESS_USER.email);
    await page.fill('input[type="password"]', BUSINESS_USER.password);
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(3000);
    
    const criticalErrors = consoleErrors.filter(err => 
      !err.includes('favicon') && 
      !err.includes('DevTools')
    );
    
    expect(criticalErrors.length).toBe(0);
  });

  test('2.3 No secrets logged to console', async ({ page }) => {
    const consoleLogs = [];
    page.on('console', msg => {
      consoleLogs.push(msg.text());
    });
    
    await page.goto('/');
    await page.fill('input[type="email"]', BUSINESS_USER.email);
    await page.fill('input[type="password"]', BUSINESS_USER.password);
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(3000);
    
    // Check that password is never logged
    const passwordLeaks = consoleLogs.filter(log => 
      log.includes(BUSINESS_USER.password) ||
      log.includes('lin48k')
    );
    
    expect(passwordLeaks.length).toBe(0);
  });

  test('2.4 Check for excessive console logging', async ({ page }) => {
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'log') {
        consoleLogs.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.fill('input[type="email"]', BUSINESS_USER.email);
    await page.fill('input[type="password"]', BUSINESS_USER.password);
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(3000);
    
    // Should have reasonable amount of logs (less than 50 for a simple flow)
    expect(consoleLogs.length).toBeLessThan(50);
  });

  test('2.5 Check console warnings', async ({ page }) => {
    const consoleWarnings = [];
    page.on('console', msg => {
      if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.fill('input[type="email"]', BUSINESS_USER.email);
    await page.fill('input[type="password"]', BUSINESS_USER.password);
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(3000);
    
    // Report warnings (not fail, but should be reviewed)
    console.log('Console warnings found:', consoleWarnings.length);
    consoleWarnings.forEach(w => console.log('WARNING:', w));
  });
});
