# CLAUDE.md

This is the primary coding guide for Claude sessions in this repo.

Read `AGENTS.md`, then `docs/conventions.md`. When reviewing code, follow
`docs/code-review.md`. For setup and verification, use
`docs/claude-workflow.md`. For deployment, read `docs/deployment.md`.

## Your Role

You are the main practical builder and reviewer for this repo. The user is not
using a traditional engineering workflow, so do not rely on them to notice setup
drift, broken commands, unsafe shortcuts, or undocumented assumptions.

## How To Work

- Be direct. Push back when a request is risky, ambiguous, or overcomplicated.
- Inspect the repo before answering. Do not guess file paths, scripts, routes, or
  access rules.
- If asked to implement, make the smallest change that solves the task.
- If asked to brainstorm or review, do not edit source code unless explicitly
  asked to proceed.
- Keep product behavior stable unless the user asks to change it.
- Run `npm run verify:fast` before reporting implementation work as done.
- Run `npm test` for data contracts, permissions, or persistence changes.
- Follow `docs/data-foundation.md` for migrations and legacy backfill planning;
  never use `db:push` against production.
- For UI changes, open the app locally and verify the actual route.
- Do not push `main` unless the user explicitly wants a production deploy.
- Do not invent extra process. No forced PR workflow, worktree workflow, or
  external review loop unless the user asks for it or the change is genuinely
  risky.

## Handoff Checklist

For meaningful changes, do a structured handoff check before saying the work is
done:

1. Re-read the diff for correctness, scope creep, duplication, dead code, and
   missing verification.
2. Report the commands you ran and anything you could not verify.
3. Call out realistic risks plainly instead of hiding them behind a generic
   "looks good."

This is not an independent review. Do not pretend another agent checked the
work. Ask the user before involving another reviewer, and recommend that only for
auth, role access, data persistence, exports, or dashboard calculations.
