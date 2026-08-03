---
name: commit
description: Stage and commit the current changes in this repo with a conventional-commit message. Use when the user asks to commit, save work, or check in changes — and when they want a real, described commit rather than the automatic one the Stop hook makes.
---

# commit

Commits the working tree with a message that describes *what actually changed*.

## Two ways a commit happens here

**Every turn that touches files gets committed**, by the Stop hook in
`.claude/settings.json` → `.claude/scripts/auto-commit.sh`. That is not
optional and not something to work around.

What *is* in your control is the message. The script uses, in order:

1. **`.claude/commit-msg`**, if you wrote one during the turn — used verbatim,
   then deleted.
2. A generated `chore(scope): update N files` fallback, if you didn't.

A shell script can list which files moved but can never say why, and *why* is
the only part of a commit message worth reading six months later. So:

> **Write `.claude/commit-msg` before you finish any turn that changed files.**
> Not only when the user runs `/commit` — every time. A `git log` full of
> `chore(api): update 12 files` is a log nobody can use.

The file is gitignored and consumed on use, so it can never leak into a commit
or be reused for a later one.

## Writing the message

### Format

Conventional Commits, scoped to the app that changed:

```
feat(api): add OTP verification endpoint
fix(web): stop the modal closing on backdrop drag
refactor(api): move invoice numbering into a counter collection
chore: bump tailwind to 4.1
```

- **Types**: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `chore`.
- **Scopes**: `web`, `api`, or omitted for repo-level changes. A change spanning
  both apps takes no scope.
- **Subject**: imperative mood ("add", not "added" or "adds"), lowercase after
  the colon, no trailing period, 72 characters or fewer.

### Body

Skip it for genuinely trivial changes. Write one whenever a reader would
otherwise have to reconstruct your reasoning. Wrap at 72 characters.

Say **why**, not what — the diff already says what:

- the constraint that forced the approach
- the alternative you rejected, and what was wrong with it
- anything surprising, load-bearing, or easy to "clean up" into a bug later
- behaviour changes a caller would notice

Good:

```
refactor(api): move invoice numbering into a counter collection

Counting today's invoices and adding one races: two cashiers in the same
second both read N, both write N+1, and one insert dies on the unique
index. $inc with upsert is a single atomic update, so each caller gets a
distinct number.
```

Useless:

```
refactor(api): update transaction model

Updated the transaction model and added a counter model.
```

### Scope of one commit

One logical change per commit. If a turn produced two unrelated changes, say so
in your response and stage them separately (`git add -p` or per-path) rather
than describing both in one message.

## When the user runs `/commit` explicitly

1. **Look at what changed:**

   ```bash
   git status --short && git diff --stat && git diff --cached --stat
   ```

   If the tree is clean, the Stop hook has already committed this turn. Say so,
   show what landed in `HEAD`, and **do not create an empty commit**. If that
   commit carries a generated fallback message, offer to reword it — check
   `git status -sb` first, because rewording something already pushed needs a
   force-push and is the user's call.

2. **Read the actual diff** for anything you describe — `git diff`, and
   `git diff --cached` for staged. A message that misdescribes a change is
   worse than a generic one.

3. **Check what you're about to commit.** Scan for secrets, `.env` files,
   credentials, large binaries, stray scratch files. `.gitignore` covers
   `.env`, `node_modules`, `dist` and `.next`, but verify rather than assume:

   ```bash
   git check-ignore -v apps/api/.env apps/web/.env.local
   ```

   If something looks wrong, ask before committing.

4. **Match the repo's style:**

   ```bash
   git log --oneline -10
   ```

5. **Commit** with a heredoc so multi-line bodies survive:

   ```bash
   git commit -F - <<'EOF'
   feat(api): add OTP verification endpoint

   Verifies the newest unexpired code for a mobile+purpose pair and marks
   it used. Rejects after 5 failed attempts.
   EOF
   ```

6. **Confirm** — print `git log --oneline -1` and the short SHA.

## Rules

- **Never push** unless the user asks. This skill commits locally.
- **Never use `--no-verify`** or skip hooks.
- **Never `git add -A` blindly** if `git status` shows files you didn't touch
  this session — stage what you changed, and mention the rest.
- **Don't amend or rebase** an existing commit unless asked. Rewording a pushed
  commit rewrites shared history; confirm first.
- If a pre-commit hook fails, fix the underlying problem rather than bypassing
  it, and report what failed.
