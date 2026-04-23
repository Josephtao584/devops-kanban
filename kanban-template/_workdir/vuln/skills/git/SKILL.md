---
name: git
description: Git version control best practices for AI coding agents. Covers branching, committing, conflict resolution, worktree management, and safe git operations.
---

# Git Skill

You are working with Git in an automated workflow context. Follow these guidelines for all Git operations.

## General Principles

1. **Never force push** to shared branches (main, master, develop).
2. **Never use `git push --force`** unless explicitly instructed.
3. **Never skip hooks** (`--no-verify`) unless explicitly instructed.
4. **Always commit before switching branches** if there are uncommitted changes.
5. **Check current branch** before any commit or push operation.
6. **Prefer creating new commits over amending** existing ones, unless explicitly told to amend.

## Branch Management

### Creating Branches
```bash
# Create and switch to a new branch
git checkout -b <branch-name>

# Branch naming conventions
# Feature: feature/<ticket-id>-<short-description>
# Bugfix: bugfix/<ticket-id>-<short-description>
# Hotfix: hotfix/<ticket-id>-<short-description>
```

### Checking State
```bash
# Always check before acting
git status
git branch -a          # List all branches
git log --oneline -10  # Recent history
git diff --stat        # What changed
```

## Committing

### Commit Messages
Follow the repository's existing commit message convention. Check `git log --oneline -10` first.

If no clear convention exists, use:
```
<type>(<scope>): <description>

[optional body]
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `style`, `perf`

### Committing Workflow
```bash
# 1. Review what will be committed
git status
git diff
git diff --staged

# 2. Stage specific files (avoid git add -A or git add .)
git add path/to/file1.ts path/to/file2.ts

# 3. Commit with a meaningful message
git commit -m "type(scope): description of change"

# 4. Verify the commit
git log --oneline -1
git show --stat HEAD
```

### What NOT to Commit
- `.env` files or any file containing secrets/tokens/credentials
- `node_modules/` or build output directories
- IDE-specific files (`.idea/`, `.vscode/`) unless already tracked
- Large binary files
- Database files (`.db`, `.sqlite`)

## Working with Worktrees

In this project, workflows use Git worktrees for isolation.

```bash
# List worktrees
git worktree list

# Create a worktree
git worktree add <path> -b <branch-name>

# Remove a worktree after work is done
git worktree remove <path>

# Force remove if unclean
git worktree remove --force <path>
```

### Worktree Best Practices
- Each worktree gets its own branch. Do not reuse branches across worktrees.
- Clean up worktrees when workflow runs complete.
- Check `git worktree list` before creating to avoid path conflicts.

## Merging and Rebasing

### Prefer Merge over Rebase
- Use `git merge` for integrating branches. It preserves full history.
- Only use `git rebase` when explicitly instructed and on local-only branches.
- Never rebase shared/public branches.

### Conflict Resolution
```bash
# 1. See which files have conflicts
git status

# 2. Open each conflicted file and look for <<<<<<< markers
# 3. Resolve by choosing the correct code (never blindly accept ours or theirs)
# 4. Stage the resolved file
git add <resolved-file>

# 5. Continue the merge
git merge --continue

# If you need to abort
git merge --abort
```

## Stashing
```bash
# Save current work temporarily
git stash push -m "description of stash"

# List stashes
git stash list

# Apply most recent stash
git stash pop

# Apply specific stash
git stash apply stash@{0}
```

## Syncing with Remote

```bash
# Fetch without merging
git fetch origin

# Pull with rebase (safer for linear history)
git pull --rebase origin <branch>

# Push current branch
git push origin <branch>

# Push and set upstream for new branch
git push -u origin <branch>
```

## Undoing Changes (Safe Methods)

```bash
# Unstage a file (keeps working directory changes)
git restore --staged <file>

# Discard unstaged changes to a file (DESTRUCTIVE - confirm first)
git restore <file>

# Undo last commit (keeps changes staged)
git reset --soft HEAD~1

# View a specific commit
git show <commit-hash>
```

## Pre-commit and Hooks

- **Never skip pre-commit hooks** (`--no-verify`) unless explicitly instructed.
- If a hook fails, investigate and fix the underlying issue.
- Pre-commit hooks often run linting, formatting, or type checks.
