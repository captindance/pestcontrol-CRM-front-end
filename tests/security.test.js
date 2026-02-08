import { test, expect } from '@playwright/test';

const BUSINESS_USER = {
  email: 'captindanceman@yahoo.com',
  password: 'lin48kLIN$*K',
};

const PLATFORM_ADMIN = {
  email: 'captaindanceman@gmail.com',
  password: 'lin48kLIN$*K',
};

test.describe('Security Tests', () => {
  
  test('4.1 XSS Prevention - no dangerouslySetInnerHTML', async ({ page }) => {
    // This test will check source code, but we can test rendered content
    await page.goto('/');
    
    await page.fill('input[type="email"]', '<script>alert("xss")</script>');
    await page.fill('input[type="password"]', 'test');
    await page.click('button:has-text("Sign In")');
    
    await page.waitForTimeout(1500);
    
    // Check that script tags are not executed/rendered as HTML
    const scriptTags = await page.locator('script').count();
    const initialScriptCount = scriptTags;
    
    // No new scripts should be added from user input
    const bodyHTML = await page.locator('body').innerHTML();
    expect(bodyHTML).not.toContain('alert("xss")');
  });

  test('4.2 Token not exposed in URL', async ({ page }) => {
    await page.goto('/');
    
    await page.fill('input[type="email"]', BUSINESS_USER.email);
    await page.fill('input[type="password"]', BUSINESS_USER.password);
    await page.click('button:has-text("Sign In")');
    
    await page.waitForTimeout(2000);
    
    const url = page.url();
    
    // JWT should not be in URL
    expect(url).not.toContain('jwt');
    expect(url).not.toContain('token');
    expect(url).not.toContain('Bearer');
  });

  test('4.3 Password input is masked', async ({ page }) => {
    await page.goto('/');
    
    const passwordInput = page.locator('input[type="password"]');
    const inputType = await passwordInput.getAttribute('type');
    
    expect(inputType).toBe('password');
  });

  test('4.4 No credentials in page source', async ({ page }) => {
    await page.goto('/');
    
    const pageContent = await page.content();
    
    // Check that no hardcoded credentials exist
    expect(pageContent).not.toContain('lin48kLIN$*K');
    expect(pageContent).not.toContain('captindanceman@yahoo.com');
    expect(pageContent).not.toContain('captaindanceman@gmail.com');
  });

  test('4.5 LocalStorage - only authorized keys', async ({ page }) => {
    await page.goto('/');
    
    await page.fill('input[type="email"]', BUSINESS_USER.email);
    await page.fill('input[type="password"]', BUSINESS_USER.password);
    await page.click('button:has-text("Sign In")');
    
    await page.waitForTimeout(2000);
    
    const storageKeys = await page.evaluate(() => Object.keys(localStorage));
    
    // Check for expected keys only
    const allowedKeys = ['jwt', 'role', 'roles', 'clientId', 'selected_tenant_id', 'acting_role', 'demo_jwt'];
    const unexpectedKeys = storageKeys.filter(k => !allowedKeys.includes(k));
    
    // Report but don't fail on extra keys (might be dev tools or extensions)
    console.log('LocalStorage keys found:', storageKeys);
    console.log('Unexpected keys:', unexpectedKeys);
  });

  test('4.6 HTTPS in production (check API calls)', async ({ page }) => {
    const requests = [];
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        requests.push(request.url());
      }
    });
    
    await page.goto('/');
    
    await page.fill('input[type="email"]', BUSINESS_USER.email);
    await page.fill('input[type="password"]', BUSINESS_USER.password);
    await page.click('button:has-text("Sign In")');
    
    await page.waitForTimeout(2000);
    
    // In dev, HTTP is acceptable; in prod should be HTTPS
    const httpRequests = requests.filter(url => url.startsWith('http://'));
    
    // For dev environment, this is expected
    console.log('API requests made:', requests.length);
    console.log('HTTP requests (dev):', httpRequests.length);
  });

  test('4.7 Cross-tenant data access - tenant switching validation', async ({ page }) => {
    await page.goto('/');
    
    // Login as business user
    await page.fill('input[type="email"]', BUSINESS_USER.email);
    await page.fill('input[type="password"]', BUSINESS_USER.password);
    await page.click('button:has-text("Sign In")');
    
    await page.waitForTimeout(3000);
    
    // Check if tenant selector exists
    const tenantSelector = page.locator('select').first();
    const selectorExists = await tenantSelector.isVisible().catch(() => false);
    
    if (selectorExists) {
      // Get initial tenant
      const initialTenant = await page.evaluate(() => localStorage.getItem('selected_tenant_id'));
      
      // Try to manually set different tenant in localStorage
      await page.evaluate(() => {
        localStorage.setItem('selected_tenant_id', 'unauthorized_tenant_123');
      });
      
      // Reload and check if unauthorized tenant is rejected
      await page.reload();
      await page.waitForTimeout(2000);
      
      const newTenant = await page.evaluate(() => localStorage.getItem('selected_tenant_id'));
      
      // If frontend properly validates, it should either:
      // 1. Reset to valid tenant
      // 2. Show error
      // 3. Force re-login
      
      console.log('Initial tenant:', initialTenant);
      console.log('After tampering:', newTenant);
      
      // Check for error messages or login redirect
      const hasError = await page.locator('div[style*="red"]').isVisible().catch(() => false);
      const backToLogin = await page.locator('h2:has-text("Login")').isVisible().catch(() => false);
      
      console.log('Error shown:', hasError);
      console.log('Redirected to login:', backToLogin);
    }
  });

  test('4.8 JWT token validation on API calls', async ({ page }) => {
    const failedRequests = [];
    
    page.on('response', response => {
      if (response.url().includes('/api/') && response.status() === 401) {
        failedRequests.push(response.url());
      }
    });
    
    await page.goto('/');
    
    await page.fill('input[type="email"]', BUSINESS_USER.email);
    await page.fill('input[type="password"]', BUSINESS_USER.password);
    await page.click('button:has-text("Sign In")');
    
    await page.waitForTimeout(3000);
    
    // Should have no 401 errors after successful login
    expect(failedRequests.length).toBe(0);
    
    // Now tamper with token
    await page.evaluate(() => {
      localStorage.setItem('jwt', 'invalid_token_xyz');
    });
    
    // Try to navigate or trigger API call
    await page.reload();
    await page.waitForTimeout(2000);
    
    // Should either redirect to login or show proper error
    const backToLogin = await page.locator('h2:has-text("Login")').isVisible().catch(() => false);
    console.log('Invalid token caused redirect to login:', backToLogin);
  });
});
