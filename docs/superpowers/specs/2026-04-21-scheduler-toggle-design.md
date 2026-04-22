# Scheduler Global Toggle Design

## Context

The devops-kanban board has an automated scheduling system (SchedulerService) that periodically dispatches workflows for eligible TODO tasks. Currently, the scheduler starts automatically on server boot with no way to pause it from the UI. Users need a global on/off switch to control whether automatic dispatch is active, with the default being **off** for new projects.

## Requirements

- Global toggle to enable/disable the workflow dispatch scheduler
- **Default state: OFF** (`scheduler.enabled = false`)
- Soft stop: when disabled, cron stops but running workflows continue; manual trigger still works
- UI toggle in existing SchedulerConfig panel (top position)
- When disabled, other scheduler config fields appear dimmed/readonly

## Design

### Data Layer

Add `scheduler.enabled` key to existing settings store (default: `'false'`).

**SettingsService** (`backend/src/services/settingsService.ts`):
- Add `getSchedulerEnabled(): Promise<boolean>` — returns `(await this.get('scheduler.enabled')) === 'true'`

### Backend Logic

**SchedulerService** (`backend/src/services/schedulerService.ts`):

- `initialize()`: check `scheduler.enabled` before registering dispatch job. If false, skip registration.
- New `enable(cronExpression: string): void` — registers the dispatch cron job
- New `disable(): void` — stops the dispatch cron job (sets `this.dispatchJob` to null after stopping)
- Sync jobs (per-task-source) are **not** affected by this toggle

**Settings Routes** (`backend/src/routes/settings.ts`):

- In `PUT /api/settings`: when `scheduler.enabled` changes to `'true'`, read current cron from settings and call `scheduler.enable(cron)`. When changes to `'false'`, call `scheduler.disable()`.

### Frontend

**SchedulerConfig.vue** (`frontend/src/components/SchedulerConfig.vue`):

- Add `schedulerEnabled` ref (boolean)
- Add el-switch at top of panel, before "当前运行中" row
- Load value from settings on panel open
- On toggle change: call `updateSettings({ 'scheduler.enabled': String(value) })`
- When disabled: dim/disable cron, concurrency, and batch-size fields via `:disabled` binding
- Manual trigger button remains enabled regardless of toggle state

**i18n**: Add key `notification.scheduler.enabled` / `notification.scheduler.disabled` labels.

## Files to Modify

| File | Change |
|------|--------|
| `backend/src/services/settingsService.ts` | Add `getSchedulerEnabled()` |
| `backend/src/services/schedulerService.ts` | Add `enable()`, `disable()`, modify `initialize()` |
| `backend/src/routes/settings.ts` | Handle `scheduler.enabled` in PUT handler |
| `frontend/src/components/SchedulerConfig.vue` | Add toggle switch UI + logic |
| `frontend/src/locales/zh-CN.json` | Add toggle label |
| `frontend/src/locales/en.json` | Add toggle label |

## Verification

1. Start backend with fresh data — verify scheduler is OFF by default (no dispatch cron registered)
2. Open SchedulerConfig panel — verify toggle is OFF, other fields are dimmed
3. Toggle ON — verify cron config becomes editable, dispatch job registers
4. Toggle OFF — verify dispatch job stops, running workflows unaffected
5. Manual trigger button works in both states
6. Restart server — verify toggle state persists
