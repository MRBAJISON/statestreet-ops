# Review Checklist

Use this checklist when Claude re-reads its own diff before handoff. It is not a
replacement for an independent reviewer.

## Priority Order

1. Correctness: broken behavior, auth gaps, bad redirects, stale data, bad
   calculations, race conditions, and realistic null/empty states.
2. Scope control: unrelated redesigns, renames, refactors, or product behavior
   changes.
3. Simplicity: unnecessary abstractions, duplicated logic, or code that makes the
   next change harder.
4. Data safety: accidental seed/reset behavior, exposed secrets, unsafe exports,
   destructive scripts, and private data in logs/screenshots.
5. Dead code: unused imports, unreachable branches, orphan helpers, stale docs.

## Do Not Review

- Formatting preferences handled by tools.
- Vague style opinions.
- Hypothetical edge cases that are not likely production or user-facing risks.

## Handoff Format

Start with a one-line status:

```text
Ready with one noted risk.
```

Then list concrete issues or risks:

```text
### [Risk | Follow-up] - Short title
Where: path/to/file.ts:42
Issue: What is wrong and why it matters.
Suggestion: Concrete fix.
```

End with:

```text
Verified: commands and browser checks run
Not verified: anything skipped or impossible to check
```

## Review Rules

- Read the diff line by line.
- Pull adjacent files when a change touches shared auth, metrics, data entry,
  exports, or setup.
- Verify commands that matter; do not infer health from a green dev server.
- Keep unrelated findings in a separate "Flags" section instead of mixing them
  into the current task review.
