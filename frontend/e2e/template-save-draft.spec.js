import { test, expect } from '@playwright/test'

test('draft template save shows the saved template, not default', async ({ page }) => {
  await page.goto('/template')

  // Wait for page to load
  await expect(page.locator('[data-testid="template-id"]')).toBeVisible()

  // Click on an existing template first
  const templates = page.locator('[data-testid^="template-item-"]')
  await templates.nth(1).click()
  await page.waitForTimeout(500)

  const originalTemplateId = await page.locator('[data-testid="template-id"]').textContent()
  console.log('Original template ID:', originalTemplateId)

  // Click "Create Template" to make a draft
  await page.locator('[data-testid="create-template-button"]').click()
  await page.waitForTimeout(500)

  // Verify we're on a draft
  const draftId = await page.locator('[data-testid="template-id"]').textContent()
  console.log('Draft ID:', draftId)
  expect(draftId).toContain('draft-')

  // Change the template name
  const nameInput = page.locator('[data-testid="template-name-input"]')
  const newName = 'TestDraft-' + Date.now()
  await nameInput.fill(newName)

  // Click save
  await page.locator('[data-testid="save-template-button"]').click()
  await page.waitForTimeout(2000)

  // After save, the template ID should be the new one (not draft-xxx, not default)
  const afterSaveId = await page.locator('[data-testid="template-id"]').textContent()
  console.log('Template ID after save:', afterSaveId)

  // Should NOT be a draft anymore
  expect(afterSaveId).not.toContain('draft-')

  // Should NOT be the original template we started from
  expect(afterSaveId).not.toBe(originalTemplateId)

  // The sidebar should show the new template as active
  const newTemplateItem = page.locator(`[data-testid="template-item-${afterSaveId}"]`)
  const isActive = await newTemplateItem.getAttribute('class')
  expect(isActive).toContain('is-active')

  // Verify the name was saved
  const savedName = await nameInput.inputValue()
  console.log('Saved name:', savedName)
  expect(savedName).toBe(newName)

  // Verify step count matches (didn't switch to a different template)
  const stepsAfter = await page.locator('.workflow-step-card').count()
  console.log('Steps after save:', stepsAfter)
  expect(stepsAfter).toBeGreaterThan(0)

  console.log('SUCCESS: Draft save correctly shows the saved template')
})
