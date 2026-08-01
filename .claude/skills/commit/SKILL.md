---
name: commit
description: Stage and commit the current changes in this repo with a conventional-commit message. Use when the user asks to commit, save work, or check in changes — and when they want a real, described commit rather than the automatic one the Stop hook makes.
---

# commit

Commits the working tree with a message that describes *what actually changed*.

This is the deliberate counterpart to the Stop hook in `.claude/settings.json`,
which auto-commits every turn with a generic `chore(scope): update N files`
message. Use this skill when the change deserves a real message.

## Steps

1. **Look at what changed** — run these together:

   ```bash
   git status --short && git diff --stat && git diff --cached --stat
   ```

   If nothing is modified, say so and stop. Don't create an empty commit.

2. **Read the actual diff** for anything you're about to describe. `git diff`
   for unstaged, `git diff --cached` for staged. Do not write a message from
   filenames alone — a message that misdescribes the change is worse than a
   generic one.

3. **Check for things that shouldn't be committed.** Scan the file list for
   secrets, `.env` files, credentials, large binaries, or stray scratch files.
   `.gitignore` already covers `.env`, `node_modules`, `dist` and `.next`, but
   check anyway. If something looks wrong, ask before committing.

4. **Recent style** — match the repo:

   ```bash
   git log --oneline -10
   ```

5. **Commit.** Conventional Commits, scoped to the app that changed:

   - `feat(api): add OTP verification endpoint`
   - `fix(web): stop the modal closing on backdrop drag`
   - `refactor(api): move invoice numbering into a counter collection`
   - `chore: bump tailwind to 4.1`

   Scopes in use: `web`, `api`, or omitted for repo-level changes.

   One logical change per commit. If the working tree holds two unrelated
   changes, stage them separately (`git add -p` or per-path) and make two
   commits rather than one mixed one.

   Write the message with a heredoc so multi-line bodies survive:

   ```bash
   git commit -F - <<'EOF'
   feat(api): add OTP verification endpoint

   Verifies the newest unexpired code for a mobile+purpose pair and
   marks it used. Rejects after 5 failed attempts.
   EOF
   ```

6. **Confirm** — print `git log --oneline -1` and the short SHA.

## Rules

- **Never push** unless the user asks. This skill commits locally.
- **Never use `--no-verify`** or skip hooks.
- **Never `git add -A` blindly** if `git status` shows files you didn't touch
  this session — stage what you changed, and mention the rest.
- **Don't amend** an existing commit unless asked; make a new one.
- If a pre-commit hook fails, fix the underlying problem rather than bypassing
  it, and report what failed.
