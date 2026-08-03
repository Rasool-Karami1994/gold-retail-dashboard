#!/usr/bin/env bash
#
# Commits whatever changed in the working tree.
#
# Used two ways:
#   - by the Stop hook in .claude/settings.json, which fires when Claude
#     finishes responding
#   - by the /commit skill, when you ask for a commit explicitly
#
# It never fails the turn: every path exits 0, and errors are reported through
# the JSON systemMessage rather than a non-zero status.
#
# Set GDASH_AUTOCOMMIT_PUSH=1 to also push to origin. Off by default -- a
# commit is local and easy to undo, a push is neither.

set -uo pipefail

# Hooks receive JSON on stdin. We don't need it, but leaving it unread can
# give the caller a broken pipe.
[ -t 0 ] || cat >/dev/null 2>&1

# Emits the hook's JSON output. Escapes the two characters that can break a
# JSON string literal, and flattens newlines so the message stays one line.
say() {
  local s=${1//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/ }
  s=${s//$'\r'/ }
  printf '{"systemMessage": "%s"}\n' "$s"
}

root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root" || exit 0

# Don't touch a repo mid-surgery -- committing during a merge or rebase would
# either abort the operation or create a bogus commit.
if [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ] ||
   [ -f .git/MERGE_HEAD ] || [ -f .git/CHERRY_PICK_HEAD ] || [ -f .git/BISECT_LOG ]; then
  say "auto-commit skipped: a merge/rebase/bisect is in progress."
  exit 0
fi

# Detached HEAD means committing would strand the commit. Bail loudly.
if ! branch=$(git symbolic-ref --quiet --short HEAD 2>/dev/null); then
  say "auto-commit skipped: HEAD is detached."
  exit 0
fi

git add -A >/dev/null 2>&1

# The message file is scaffolding for this commit, not part of it. .gitignore
# already excludes it, but unstage it explicitly so the script stays correct if
# this setup is copied to a repo without that entry -- otherwise the file gets
# committed and then its deletion shows up as a spurious follow-up commit.
git reset -q -- .claude/commit-msg >/dev/null 2>&1

# Nothing staged after `add -A` means nothing changed. Silent no-op: this is
# the common case on turns that only read files.
if git diff --cached --quiet 2>/dev/null; then
  exit 0
fi

files=$(git diff --cached --name-only)
count=$(printf '%s\n' "$files" | grep -c . )

# ---------------------------------------------------------------------------
# Preferred path: a message Claude wrote during the turn.
#
# A shell script can describe *what* files moved but never *why*, which is the
# only part of a commit message worth reading later. So Claude writes the real
# message to .claude/commit-msg before finishing, and we use it verbatim.
# The generated message below is the fallback for turns where that didn't
# happen.
#
# The file is consumed (deleted) on use, so a message can never be reused for a
# later, unrelated commit.
# ---------------------------------------------------------------------------
msgfile=".claude/commit-msg"

use_msgfile=0
if [ -s "$msgfile" ] && [ -n "$(head -n1 "$msgfile" | tr -d '[:space:]')" ]; then
  # Guard against a stale file left behind by a crashed or interrupted turn:
  # anything older than 4 hours describes work that is already committed.
  if [ -z "$(find "$msgfile" -mmin +240 2>/dev/null)" ]; then
    use_msgfile=1
  else
    rm -f "$msgfile"
    say "auto-commit: ignored a stale .claude/commit-msg (older than 4h)."
  fi
fi

if [ "$use_msgfile" = "1" ]; then
  subject=$(head -n1 "$msgfile")
  if ! out=$(git commit -q -F "$msgfile" 2>&1); then
    say "auto-commit failed: ${out}"
    exit 0
  fi
  rm -f "$msgfile"

  sha=$(git rev-parse --short HEAD)
  msg="committed ${sha} on ${branch}: ${subject}"

  if [ "${GDASH_AUTOCOMMIT_PUSH:-0}" = "1" ] && git remote get-url origin >/dev/null 2>&1; then
    if push_out=$(git push -q origin "$branch" 2>&1); then
      msg="${msg} (pushed)"
    else
      msg="${msg} (push failed: ${push_out})"
    fi
  fi

  say "$msg"
  exit 0
fi

# Scope the message by where the changes landed, so `git log --oneline` stays
# readable: apps/web -> web, apps/api -> api, mixed or root -> repo.
scopes=$(printf '%s\n' "$files" \
  | sed -n 's#^apps/\([^/]*\)/.*#\1#p' \
  | sort -u | paste -sd, -)
if [ -z "$scopes" ]; then
  scope="repo"
elif [ "$(printf '%s' "$scopes" | tr ',' '\n' | grep -c .)" -gt 2 ]; then
  scope="repo"
else
  scope="$scopes"
fi

if [ "$count" -eq 1 ]; then
  summary="update $(printf '%s' "$files" | head -1)"
else
  summary="update $count files"
fi

# Fallback subject. Deliberately generic: with no idea what the change was
# for, a specific-sounding message would just be a confident guess. If you are
# seeing these in `git log`, Claude isn't writing .claude/commit-msg -- see
# .claude/skills/commit/SKILL.md.
subject="chore(${scope}): ${summary}"

# Keep the body short; the diff is the real record.
body=$(printf '%s\n' "$files" | head -20)
if [ "$count" -gt 20 ]; then
  body=$(printf '%s\n... and %d more\n' "$body" "$((count - 20))")
fi

if ! out=$(git commit -q -F - <<EOF 2>&1
$subject

Committed automatically when the turn finished.

$body
EOF
); then
  say "auto-commit failed: ${out}"
  exit 0
fi

sha=$(git rev-parse --short HEAD)
msg="auto-committed ${sha} on ${branch}: ${subject}"

if [ "${GDASH_AUTOCOMMIT_PUSH:-0}" = "1" ] && git remote get-url origin >/dev/null 2>&1; then
  if push_out=$(git push -q origin "$branch" 2>&1); then
    msg="${msg} (pushed)"
  else
    msg="${msg} (push failed: ${push_out})"
  fi
fi

say "$msg"
exit 0
