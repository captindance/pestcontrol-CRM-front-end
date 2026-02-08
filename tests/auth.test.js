import { test, expect } from '@playwright/test';

const BUSINESS_USER = {
  email: 'captindanceman@yahoo.com',
  password: 'lin48kLIN$*K',
};

const PLATFORM_ADMIN = {
  email: 'captaindanceman@gmail.com',
  password: 'lin48kLIN$*K',
};

test.describe('Authentication Flow Tests', () => {
  
  test('1.1 Login page loads correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h2:has-text("Login")')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
  });

  test('1.2 Business user login - valid credentials', async ({ page }) => {
    await page.goto('/');
    
    // Fill login form
    await page.fill('input[type="email"]', BUSINESS_USER.email);
    await page.fill('input[type="password"]', BUSINESS_USER.password);
    
    // Click login button
    await page.click('button:has-text("Sign In")');
    
    // Wait for redirect after successful login
    await page.waitForTimeout(2000);
    
    // Check that we're no longer on login page
    const loginVisible = await page.locator('h2:has-text("Login")').isVisible().catch(() => false);
    expect(loginVisible).toBe(false);
    
    // Check that JWT token is stored
    const jwt = await page.evaluate(() => localStorage.getItem('jwt'));
    expect(jwt).toBeTruthy();
    expect(jwt).not.toContain('demo_signature');
  });

  test('1.3 Platform admin login - valid credentials', async ({ page }) => {
    await page.goto('/');
    
    await page.fill('input[type="email"]', PLATFORM_ADMIN.email);
    await page.fill('input[type="password"]', PLATFORM_ADMIN.password);
    await page.click('button:has-text("Sign In")');
    
    await page.waitForTimeout(2000);
    
    const loginVisible = await page.locator('h2:has-text("Login")').isVisible().catch(() => false);
    expect(loginVisible).toBe(false);
    
    const jwt = await page.evaluate(() => localStorage.getItem('jwt'));
    expect(jwt).toBeTruthy();
    
    const roles = await page.evaluate(() => localStorage.getItem('roles'));
    expect(roles).toContain('platform_admin');
  });

  test('1.4 Login with invalid credentials', async ({ page }) => {
    await page.goto('/');
    
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button:has-text("Sign In")');
    
    // Should show error message
    await page.waitForTimeout(1000);
    const errorDiv = page.locator('div[style*="red"]');
    await expect(errorDiv).toBeVisible();
  });

  test('1.5 Token storage validation', async ({ page }) => {
    await page.goto('/');
    
    await page.fill('input[type="email"]', BUSINESS_USER.email);
    await page.fill('input[type="password"]', BUSINESS_USER.password);
    await page.click('button:has-text("Sign In")');
    
    await page.waitForTimeout(2000);
    
    // Check localStorage for proper token storage
    const storageKeys = await page.evaluate(() => Object.keys(localStorage));
    expect(storageKeys).toContain('jwt');
    expect(storageKeys).toContain('roles');
    
    // Verify no sensitive data beyond tokens
    const sensitiveKeys = storageKeys.filter(k => 
      k.toLowerCase().includes('password') || 
      k.toLowerCase().includes('secret') ||
      k.toLowerCase().includes('key') && k !== 'demo_jwt'
    );
    expect(sensitiveKeys.length).toBe(0);
  });

  test('1.6 Logout functionality', async ({ page }) => {
    await page.goto('/');
    
    // Login first
    await page.fill('input[type="email"]', BUSINESS_USER.email);
    await page.fill('input[type="password"]', BUSINESS_USER.password);
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(2000);
    
    // Find and click logout
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Log out")').first();
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForTimeout(1000);
      
      // Should be back on login page
      await expect(page.locator('h2:has-text("Login")')).toBeVisible();
      
      // Check that tokens are cleared
      const jwt = await page.evaluate(() => localStorage.getItem('jwt'));
      expect(jwt).toBeNull();
    }
  });

  test('1.7 Session persistence check', async ({ page, context }) => {
    await page.goto('/');
    
    // Login
    await page.fill('input[type="email"]', BUSINESS_USER.email);
    await page.fill('input[type="password"]', BUSINESS_USER.password);
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(2000);
    
    const jwt = await page.evaluate(() => localStorage.getItem('jwt'));
    expect(jwt).toBeTruthy();
    
    // Open new page in same context
    const page2 = await context.newPage();
    await page2.goto('/');
    
    // Check if token persists
    const jwt2 = await page2.evaluate(() => localStorage.getItem('jwt'));
    expect(jwt2).toBe(jwt);
    
    await page2.close();
  });
});
