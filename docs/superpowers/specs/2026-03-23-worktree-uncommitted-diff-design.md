# Worktree Uncommitted Diff Design

## Summary

Adjust `/api/git/worktrees/:taskId/diff` so it returns the current worktree's uncommitted changes relative to `HEAD`, instead of comparing two branches. The endpoint must include tracked modifications, staged additions, unstaged changes, deletions, and untracked files that have not been committed yet.

The response shape remains unchanged:

```json
{
  "success": true,
  "data": {
    "files": [
      {
        "path": "pom.xml",
        "additions": 3,
        "deletions": 1,
        "status": "modified"
      }
    ],
    "diffs": {
      "pom.xml": "diff --git ..."
    }
  }
}
```

## Intent

The original product intent of the diff view is to show what has changed inside a task worktree and has not yet been committed on that worktree's current branch. It is not intended to compare the task branch against `master` or any other branch.

This design restores that intended behavior.

## Endpoint Behavior

### Route

`GET /api/git/worktrees/:taskId/diff?projectId=<id>`

### Meaning

The endpoint returns the current task worktree's uncommitted diff against the worktree branch `HEAD`.

### Scope of included changes

Included:
- tracked file modifications
- staged changes
- unstaged changes
- deletions
- untracked files

Excluded:
- committed differences between branches
- branch-to-branch comparisons via `source` / `target`

### Query parameter compatibility

The route should ignore `source` and `target` if callers still send them.

Reasoning:
- existing callers currently pass these params
- this route's meaning is being narrowed to uncommitted worktree diff only
- silently reusing `source` / `target` for branch comparison would preserve the current bug

This route should not reject those params during this change. It should simply ignore them and return the worktree's uncommitted diff.

### Response fields

#### `files`

Array of changed files in the worktree. Each item contains:
- `path`: repository-relative file path
- `additions`: number of added lines in the uncommitted diff view
- `deletions`: number of deleted lines in the uncommitted diff view
- `status`: one of:
  - `modified`
  - `added`
  - `deleted`
  - `untracked`

#### `diffs`

Object keyed by file path. Each value is the rendered diff text for that file.

## Data Collection Strategy

The endpoint should execute from `task.worktree_path`, not the parent repository path.

### Step 1: enumerate changed files

Use a NUL-safe porcelain format such as `git status --porcelain -z` to enumerate all uncommitted files.

Plain line-based porcelain output is not sufficient for correctness because valid Git paths can contain spaces, tabs, quotes, backslashes, and other characters that become ambiguous in non-NUL-delimited parsing.

The implementation should parse the NUL-delimited entries and derive repository-relative paths from that output.




This provides the canonical file set for:
- tracked modified files
- added files
- deleted files
- untracked files (`??`)

Rename entries are out of scope for this change unless they already fall out of existing porcelain parsing without extra handling. If encountered and not cleanly supported by the current parser, they may be treated as unsupported and surfaced as ordinary per-file failures without failing the whole endpoint.

Path parsing must continue to work for filenames with spaces and common special characters.

Unsupported rename or copy entries must still be consumed safely from NUL-delimited porcelain output so one unsupported entry cannot corrupt parsing of later entries.

For shell-safe git invocation, path arguments must always be passed after `--`.

### Step 2: build per-file diff text

For each changed file:

#### tracked files
Use:

```bash
git diff HEAD -- <file>
```

This gives the complete uncommitted view relative to `HEAD`, including the combined effect of staged and unstaged changes.

#### untracked files
Because untracked files are not returned by normal `git diff`, the backend should synthesize a diff from an empty file to the current file contents.

The generated diff should be Git-like so current UI rendering continues to work. At minimum it should include:
- `diff --git`
- `--- /dev/null`
- `+++ b/<path>`
- hunk header for text content
- added lines prefixed with `+` for text content

Special cases must be defined explicitly:
- untracked text file: render a normal added-file patch from `/dev/null` to `b/<path>`
- untracked empty file: render an added-file diff with headers and no added body lines; `additions = 0`, `deletions = 0`, `status = 'untracked'`
- untracked binary file: render a Git-like binary diff marker such as `Binary files /dev/null and b/<path> differ`; `additions = 0`, `deletions = 0`, `status = 'untracked'`

A simple content heuristic may be used to distinguish text from binary when synthesizing untracked diffs.

## Status Mapping

Status should be derived for the uncommitted worktree view.

Recommended mapping:
- file exists in porcelain as untracked (`??`) → `untracked`
- file is newly staged and tracked as added → `added`
- file is deleted in worktree or index → `deleted`
- otherwise → `modified`

If a file has both staged and unstaged changes, it should still appear once and should resolve to `modified` unless it is clearly an `added` or `deleted` case.

## Stats Calculation

`additions` and `deletions` must reflect the final diff text shown to the user.

Recommended approach:
- derive counts from the produced diff content for each file
- count lines beginning with `+` and `-`
- exclude diff metadata lines such as `+++`, `---`, and hunk headers

This keeps the file stats aligned with the visible patch content, including synthesized untracked diffs.

## Error Handling

Preserve current endpoint-level behavior:
- task not found → 404
- task has no worktree → 400
- invalid or missing worktree path / not a git repository → existing wrapped error behavior

Per-file failures should not fail the whole endpoint.

If diff generation fails for an individual file:
- keep the file in `files`
- set `diffs[file.path] = ''`
- continue processing remaining files

## Frontend Compatibility

The endpoint should continue returning `{ files, diffs }` so consumers of `GET /api/git/worktrees/:taskId/diff` can keep the same response contract.

### Compatible consumer with parameter cleanup needed
- `frontend/src/components/CommitDialog.vue` already expects `{ files, diffs }`, but it still sends `source` and `target`; implementation should keep this consumer working by ignoring those query params on the backend, and the frontend may later be cleaned up to stop sending them.

### Compatible consumer
- `frontend/src/components/GitWorktreePanel.vue` already stores `response.data` directly and can continue working with the unchanged `{ files, diffs }` payload.

### Known incompatible consumer
- `frontend/src/components/TaskDetail.vue` currently reads `response.data.content`, which does not match the endpoint contract and should be corrected during implementation.

### Adjacent but separate flow
- `frontend/src/components/DiffViewer.vue` uses `/api/tasks/:id/worktree/diff`, not `/api/git/worktrees/:taskId/diff`. It is not a direct consumer of this route, but the duplicate backend route should be reviewed during implementation so the product does not keep two conflicting diff semantics.

## Testing Strategy

Add or update backend tests to cover at least:

1. tracked modified file returns diff and `modified`
2. staged new file returns diff and `added`
3. untracked new file returns synthesized diff and `untracked`
4. tracked deleted file returns diff and `deleted`
5. tracked file with both staged and unstaged changes returns combined diff against `HEAD`
6. no changes returns empty `files` and empty `diffs`
7. untracked empty file returns synthesized diff with zero additions and deletions
8. untracked binary file returns a binary diff marker with zero additions and deletions
9. unusual valid path names are handled safely by NUL-delimited parsing and `-- <file>` git invocation
10. task without worktree returns 400

If frontend tests already cover the diff viewer contract, they should continue passing because the response shape remains unchanged.

## Out of Scope

Not included in this change:
- introducing a new branch comparison endpoint
- preserving `source` / `target` branch comparison behavior on this route
- redesigning diff UI rendering
- broad git API cleanup unrelated to uncommitted diff behavior
