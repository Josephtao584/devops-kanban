import { test, expect } from '@playwright/test'

test('project list shows blog-helloworld sample project', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: '项目' })).toBeVisible()
  await expect(page.getByText('blog-helloworld')).toBeVisible()
})
