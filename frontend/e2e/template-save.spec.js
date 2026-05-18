import { test, expect } from '@playwright/test'

test('template save shows the saved template, not default', async ({ page }) => {
  // Go to template config page
  await page.goto('/template')

  // Wait for the page to load
  await expect(page.locator('[data-testid="template-id"]')).toBeVisible()

  // Record the currently visible template ID
  const initialTemplateId = await page.locator('[data-testid="template-id"]').textContent()
  console.log('Initial template ID:', initialTemplateId)

  // Select a non-default template if available
  const templates = page.locator('[data-testid^="template-item-"]')
  const templateCount = await templates.count()
  console.log('Total templates:', templateCount)

  // Click on the second template (not the default)
  if (templateCount > 1) {
    const secondTemplate = templates.nth(1)
    const testid = await secondTemplate.getAttribute('data-testid')
    const secondTemplateId = testid ? testid.replace('template-item-', '') : ''
    console.log('Selecting template:', secondTemplateId)
    await secondTemplate.click()
    await page.waitForTimeout(500)

    const selectedId = await page.locator('[data-testid="template-id"]').textContent()
    console.log('Selected template ID after click:', selectedId)

    // Record the step count before edit
    const stepsBefore = await page.locator('.workflow-step-card').count()
    console.log('Steps before edit:', stepsBefore)

    // Edit the template name
    const nameInput = page.locator('[data-testid="template-name-input"]')
    await nameInput.fill('Test-Save-' + Date.now())

    // Click save
    await page.locator('[data-testid="save-template-button"]').click()
    await page.waitForTimeout(1000)

    // After save, the template ID should still be the one we edited
    const afterSaveId = await page.locator('[data-testid="template-id"]').textContent()
    console.log('Template ID after save:', afterSaveId)

    // The template should NOT have switched to the default
    expect(afterSaveId).toContain(secondTemplateId)

    // The template should still be selected in the sidebar
    const isActive = await page.locator(`[data-testid="template-item-${secondTemplateId}"]`).getAttribute('class')
    expect(isActive).toContain('is-active')

    // Verify step count is the same (not switched to a different template)
    const stepsAfter = await page.locator('.workflow-step-card').count()
    console.log('Steps after save:', stepsAfter)
    expect(stepsAfter).toBe(stepsBefore)

    console.log('SUCCESS: Template save correctly maintained selection')
  } else {
    console.log('Not enough templates to test')
  }
})
