import { test, expect } from '@playwright/test'

test('kanban view for project 4 shows seeded blog tasks', async ({ page }) => {
  await page.goto('/kanban/4')

  await expect(page.getByText('blog-helloworld')).toBeVisible()
  await expect(page.getByText('【需求】新建HelloWorld.py')).toBeVisible()
  await expect(page.getByText('test')).toBeVisible()
  await expect(page.getByText('待处理')).toBeVisible()
  await expect(page.getByText('已完成')).toBeVisible()
})
