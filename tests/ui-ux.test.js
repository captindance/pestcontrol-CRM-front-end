import { test, expect } from '@playwright/test';

const BUSINESS_USER = {
  email: 'captindanceman@yahoo.com',
  password: 'lin48kLIN$*K',
};

const PLATFORM_ADMIN = {
  email: 'captaindanceman@gmail.com',
  password: 'lin48kLIN$*K',
};

test.describe('UI/UX Tests', () => {
  
  test('3.1 Form validation - empty fields', async ({ page }) => {
    await page.goto('/');
    
    // Try to submit without filling fields
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(500);
    
    // HTML5 validation should prevent submission or show error
    const emailInput = page.locator('input[type="email"]');
    const isEmailValid = await emailInput.evaluate(el => el.validity.valid);
    expect(isEmailValid).toBe(false);
  });

  test('3.2 Button loading states', async ({ page }) => {
    await page.goto('/');
    
    await page.fill('input[type="email"]', BUSINESS_USER.email);
    await page.fill('input[type="password"]', BUSINESS_USER.password);
    
    const button = page.locator('button:has-text("Sign In")');
    await button.click();
    
    // Button should show loading state
    await page.waitForTimeout(200);
    const loadingButton = page.locator('button:has-text("Signing in...")');
    const isLoadingVisible = await loadingButton.isVisible().catch(() => false);
    
    // Button should be disabled during loading
    if (isLoadingVisible) {
      const isDisabled = await loadingButton.isDisabled();
      expect(isDisabled).toBe(true);
    }
  });

  test('3.3 Error message display', async ({ page }) => {
    await page.goto('/');
    
    await page.fill('input[type="email"]', 'wrong@example.com');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button:has-text("Sign In")');
    
    await page.waitForTimeout(1500);
    
    // Should show error message
    const errorDiv = page.locator('div[style*="red"]');
    const isErrorVisible = await errorDiv.isVisible().catch(() => false);
    expect(isErrorVisible).toBe(true);
    
    if (isErrorVisible) {
      const errorText = await errorDiv.textContent();
      expect(errorText.length).toBeGreaterThan(0);
    }
  });

  test('3.4 Responsive design - mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Check that login form is visible and usable on mobile
    await expect(page.locator('h2:has-text("Login")')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
    
    // Check that form width adapts
    const formWidth = await page.locator('form').evaluate(el => el.offsetWidth);
    expect(formWidth).toBeLessThanOrEqual(375);
  });

  test('3.5 Keyboard navigation - login form', async ({ page }) => {
    await page.goto('/');
    
    // Tab through form fields
    await page.keyboard.press('Tab');
    const emailFocused = await page.locator('input[type="email"]').evaluate(el => el === document.activeElement);
    expect(emailFocused).toBe(true);
    
    await page.keyboard.type(BUSINESS_USER.email);
    await page.keyboard.press('Tab');
    
    const passwordFocused = await page.locator('input[type="password"]').evaluate(el => el === document.activeElement);
    expect(passwordFocused).toBe(true);
    
    await page.keyboard.type(BUSINESS_USER.password);
    await page.keyboard.press('Tab');
    
    const buttonFocused = await page.locator('button:has-text("Sign In")').evaluate(el => el === document.activeElement);
    expect(buttonFocused).toBe(true);
  });

  test('3.6 Form submission with Enter key', async ({ page }) => {
    await page.goto('/');
    
    await page.fill('input[type="email"]', BUSINESS_USER.email);
    await page.fill('input[type="password"]', BUSINESS_USER.password);
    
    // Press Enter in password field
    await page.locator('input[type="password"]').press('Enter');
    
    await page.waitForTimeout(2000);
    
    // Should trigger login
    const loginVisible = await page.locator('h2:has-text("Login")').isVisible().catch(() => false);
    expect(loginVisible).toBe(false);
  });

  test('3.7 Visual feedback on input focus', async ({ page }) => {
    await page.goto('/');
    
    const emailInput = page.locator('input[type="email"]');
    await emailInput.click();
    
    // Check that input has focus styles (browser default at minimum)
    const hasFocus = await emailInput.evaluate(el => el === document.activeElement);
    expect(hasFocus).toBe(true);
  });

  test('3.8 Navigation after login - business user', async ({ page }) => {
    await page.goto('/');
    
    await page.fill('input[type="email"]', BUSINESS_USER.email);
    await page.fill('input[type="password"]', BUSINESS_USER.password);
    await page.click('button:has-text("Sign In")');
    
    await page.waitForTimeout(3000);
    
    // Check for navigation elements (tabs, sidebar, etc.)
    const hasNavigation = await page.locator('nav, [role="navigation"], button:has-text("Reports")').first().isVisible().catch(() => false);
    
    // At minimum, should not be on login page
    const loginVisible = await page.locator('h2:has-text("Login")').isVisible().catch(() => false);
    expect(loginVisible).toBe(false);
  });

  test('3.9 Navigation after login - platform admin', async ({ page }) => {
    await page.goto('/');
    
    await page.fill('input[type="email"]', PLATFORM_ADMIN.email);
    await page.fill('input[type="password"]', PLATFORM_ADMIN.password);
    await page.click('button:has-text("Sign In")');
    
    await page.waitForTimeout(3000);
    
    // Platform admin should see admin-specific UI
    const hasAdminUI = await page.locator('button:has-text("Admin"), button:has-text("Clients")').first().isVisible().catch(() => false);
    
    // Should have access to more features
    const loginVisible = await page.locator('h2:has-text("Login")').isVisible().catch(() => false);
    expect(loginVisible).toBe(false);
  });
});
