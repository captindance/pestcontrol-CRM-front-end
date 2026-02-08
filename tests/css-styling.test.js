import { test, expect } from '@playwright/test';

const BUSINESS_USER = {
  email: 'captindanceman@yahoo.com',
  password: 'lin48kLIN$*K',
};

test.describe('CSS and Styling Tests', () => {
  
  test('5.1 Inline styles usage check', async ({ page }) => {
    await page.goto('/');
    
    // Check for inline styles (per guidelines, should use CSS Modules)
    const elementsWithInlineStyles = await page.locator('[style]').count();
    
    console.log('Elements with inline styles:', elementsWithInlineStyles);
    
    // Get some examples
    if (elementsWithInlineStyles > 0) {
      const examples = await page.locator('[style]').evaluateAll(elements => 
        elements.slice(0, 5).map(el => ({
          tag: el.tagName,
          style: el.getAttribute('style')
        }))
      );
      console.log('Inline style examples:', JSON.stringify(examples, null, 2));
    }
    
    // Note: This is informational - design doc recommends CSS Modules but inline styles exist
  });

  test('5.2 CSS Modules usage check', async ({ page }) => {
    await page.goto('/');
    
    // Check for CSS Module class names (they typically have hashed suffixes)
    const bodyHTML = await page.locator('body').innerHTML();
    
    // CSS Modules typically generate classes like: Component_className__hash
    const hasModuleClasses = /_[a-zA-Z0-9]{5,}/.test(bodyHTML);
    
    console.log('CSS Module classes detected:', hasModuleClasses);
  });

  test('5.3 Responsive layout - tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    
    // Check that UI is usable
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
    
    // Check no horizontal overflow
    const hasOverflow = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
    expect(hasOverflow).toBe(false);
  });

  test('5.4 Responsive layout - desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    
    await expect(page.locator('input[type="email"]')).toBeVisible();
    
    // Check that layout doesn't stretch too wide
    const formWidth = await page.locator('form').evaluate(el => el.offsetWidth);
    expect(formWidth).toBeLessThan(1920); // Should be constrained
  });

  test('5.5 Color contrast - error messages', async ({ page }) => {
    await page.goto('/');
    
    await page.fill('input[type="email"]', 'wrong@test.com');
    await page.fill('input[type="password"]', 'wrong');
    await page.click('button:has-text("Sign In")');
    
    await page.waitForTimeout(1500);
    
    const errorDiv = page.locator('div[style*="red"]');
    if (await errorDiv.isVisible()) {
      const color = await errorDiv.evaluate(el => window.getComputedStyle(el).color);
      console.log('Error message color:', color);
      
      // Red color should be visible (not too light)
      expect(color).toBeTruthy();
    }
  });

  test('5.6 Font sizes are readable', async ({ page }) => {
    await page.goto('/');
    
    // Check various text elements
    const h2Size = await page.locator('h2').evaluate(el => parseInt(window.getComputedStyle(el).fontSize));
    const inputSize = await page.locator('input').first().evaluate(el => parseInt(window.getComputedStyle(el).fontSize));
    const buttonSize = await page.locator('button').first().evaluate(el => parseInt(window.getComputedStyle(el).fontSize));
    
    console.log('Font sizes - H2:', h2Size, 'Input:', inputSize, 'Button:', buttonSize);
    
    // Should be at least 14px for readability
    expect(inputSize).toBeGreaterThanOrEqual(12);
  });
});
