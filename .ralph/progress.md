# Progress Log
Started: Thu Feb 26 16:27:01 +05 2026

## Codebase Patterns
- (add reusable patterns here)

---
## [2026-02-26 16:35:35 +0500] - US-001: Fix initial PRD request input editing
Thread: 61068
Run: 20260226-162701-90447 (iteration 1)
Run log: /Users/kamaliev/pet-projects/ralph/.ralph/runs/run-20260226-162701-90447-iter-1.log
Run summary: /Users/kamaliev/pet-projects/ralph/.ralph/runs/run-20260226-162701-90447-iter-1.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 08a0c78 fix(prd): restore editable initial request input
- Post-commit status: .agents/ralph/README.md, .agents/ralph/diagram.svg, .agents/ralph/ralph.webp, .agents/tasks/, .idea/
- Verification:
  - Command: npm test -> PASS
  - Command: npm run test:ping -> FAIL
- Files changed:
  - bin/ralph
  - package.json
  - tests/prd-input-editing.mjs
  - .ralph/progress.md
- What was implemented
  - Replaced PRD interactive request prompt with Node readline input to preserve native terminal editing (typing, cursor movement, backspace/delete) before submit.
  - Kept submit behavior single-shot and unchanged downstream: Enter writes one request file and invokes PRD loop once.
  - Added regression coverage for edited Cyrillic input and empty-enter validation using an expect-driven pseudo-TTY harness.
- **Learnings for future iterations:**
  - Patterns discovered
  - `expect` is reliable for pseudo-TTY key-sequence testing in this repo, while `script` failed under this execution environment.
  - Gotchas encountered
  - `npm run test:ping` can fail if an installed agent CLI exists but does not return the expected sentinel output.
  - Useful context
  - Set `RALPH_SKIP_UPDATE_CHECK=1` for interactive CLI tests to avoid update-check prompts interfering with deterministic input flows.
---
## [2026-02-26 16:46:08 +0500] - US-002: Keep qwen PRD interview session interactive
Thread: 
Run: 20260226-162701-90447 (iteration 2)
Run log: /Users/kamaliev/pet-projects/ralph/.ralph/runs/run-20260226-162701-90447-iter-2.log
Run summary: /Users/kamaliev/pet-projects/ralph/.ralph/runs/run-20260226-162701-90447-iter-2.md
- Guardrails reviewed: yes
- No-commit run: false
- Commit: 195abc3 fix(prd): keep qwen PRD interview interactive
- Post-commit status: .agents/ralph/README.md, .agents/ralph/diagram.svg, .agents/ralph/ralph.webp, .agents/tasks/, .idea/
- Verification:
  - Command: npm test -> PASS
  - Command: npm run test:ping -> FAIL
- Files changed:
  - bin/ralph
  - tests/prd-input-editing.mjs
  - .ralph/activity.log
  - .ralph/progress.md
- What was implemented
  - Added a qwen PRD interactive-session guard that keeps TTY invocation for dialogue and then validates that a PRD JSON file was created or updated before returning success.
  - Added actionable troubleshooting guidance and non-zero exit when qwen exits early without producing a saved PRD artifact.
  - Updated the pseudo-TTY PRD input fixture to emit a mock PRD JSON file so existing interactive input tests stay aligned with the new qwen save-confirmation contract.
- **Learnings for future iterations:**
  - Patterns discovered
  - PRD-mode success checks can be enforced at the CLI boundary by snapshotting output paths before and after agent execution.
  - Gotchas encountered
  - Existing tests with mocked PRD loops must create/update expected output artifacts once save-confirmation checks are introduced.
  - Useful context
  - `npm run test:ping` can fail in local environments where a detected agent CLI is installed but does not return the expected ping sentinel.
---
