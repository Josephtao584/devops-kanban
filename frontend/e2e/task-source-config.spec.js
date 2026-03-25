import { test, expect } from '@playwright/test'

test('task source config for project 4 shows the seeded GitHub source', async ({ page }) => {
  await page.goto('/task-sources/4')

  await expect(page.getByRole('heading', { name: '任务源配置' })).toBeVisible()
  await expect(page.getByText('blog-helloworld')).toBeVisible()
  await expect(page.getByText('github')).toBeVisible()
  await expect(page.getByText('GITHUB · GitHub')).toBeVisible()
  await expect(page.getByText('已启用')).toBeVisible()
})
