---
name: pockets-flow
description: Orchestrated delivery flow for Pockets. The session model plans, owns design and reviews; cheap worker agents (pockets-quick / pockets-builder / pockets-heavy) implement; the project's reviewer agents check the result and ship-check deploys it. Invoke with /pockets-flow <task>. Use only for features or fixes big enough to split into several tasks.
disable-model-invocation: true
argument-hint: <task description>
---

# Pockets flow

You are the **orchestrator**. You read, plan, decide design and review. Workers write the code. Never write feature code yourself, and never let a worker make a design decision you didn't give it.

Task from the owner: $ARGUMENTS

## 1. Understand and plan
1. Read `CLAUDE.md`, the relevant parts of `docs/progress.md`, `docs/decisions.md` and `docs/gotchas.md`, and the files the task touches. Don't read whole folders.
2. If the task is small (one or two files, obvious change), say so and do it the normal way instead: build it, then `ship-check`. The flow costs more than it saves on small work.
3. Split the work into numbered tasks. Each task has:
   - a self-contained brief: what, which files, constraints, definition of done, how to verify (which vitest tests, which `scripts/lib.cjs` places to look at);
   - dependencies on other tasks;
   - a tier (section 3).
4. Show the plan to the owner in a compact list (number, title, tier, depends on) and wait for "go". If a request could mean materially different things, ask first. Explain in plain words, the owner is learning.

## 2. Design (never delegated)
Anything users see (layout, copy, colors, flows) is decided by you before delegating:
- Small UI: write the exact spec in the brief (structure, states, which `ui/bits.tsx` pieces to reuse, English copy).
- New screens or flows: show a mockup in chat and get the owner's reaction first.
Copy rules from CLAUDE.md apply: warm, simple, Colombian context, one whole sentence per string.

## 3. Tiers (cheapest that gets it right the first time)
| Agent | Model | For |
| --- | --- | --- |
| `pockets-quick` | Haiku | mechanical edits, renames, adding `es.ts` lines, config, small isolated fixes |
| `pockets-builder` | Sonnet | standard feature work and bugs with a known cause, a few files |
| `pockets-heavy` | Opus | hard bugs with unclear cause, tricky money logic, multi-file refactors. Use rarely. |

Run independent tasks in parallel only when they touch different files.

## 4. Delegate
Each brief includes: the task paragraph, the files, the design spec if any, the relevant rules from CLAUDE.md and docs (quote the lines, don't say "read the docs"), and "Do not commit. Report changed files, what you ran and the results in under 10 lines."

## 5. Review (you)
For each returned task:
1. Read the diff (`git diff`). Check it does exactly the brief, follows CLAUDE.md rules and gotchas, and breaks nothing nearby.
2. Run `cd app && npx tsc --noEmit -p . && npx vitest run 2>&1 | tail -15`.
3. If it's wrong, send it back to the same tier once with precise feedback. If it fails twice, move it up one tier.

## 6. Checks and ship
After all tasks are accepted, use the project's agents in this order:
1. `money-logic-reviewer` if anything touched money math (the files listed in CLAUDE.md).
2. `spanish-gaps` if user-facing text changed.
3. `security-auditor` only if auth, sync, social, push, the service worker, backup, lock or logout changed.
4. `ship-check` with the places to photograph and the full commit message with its footer.
Look at the screenshots ship-check lists before telling the owner it's done.

## 7. Close
- Update `docs/progress.md` (and `decisions.md` / `gotchas.md` if something new was learned) and include them in the shipped commit.
- Tell the owner in plain words what was built, how it works, and anything they need to do (console steps, testing on the phone).
