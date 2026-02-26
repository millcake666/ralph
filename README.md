# Ralph

![Ralph](ralph.webp)

Ralph is a minimal, file‑based agent loop for autonomous coding. Each iteration starts fresh, reads the same on‑disk state, and commits work for one story at a time.

## How it works

Ralph treats **files and git** as memory, not the model context:

- **PRD (JSON)** defines stories, gates, and status
- **Loop** executes one story per iteration
- **State** persists in `.ralph/`

![Ralph architecture](diagram.svg)

## Installation

### Quick Install (Recommended)

```bash
curl -sL https://raw.githubusercontent.com/millcake666/ralph/main/install.sh | sh
```

This will:
- Detect your OS (Linux/macOS) and architecture
- Install Ralph globally via npm
- Make `ralph` available from anywhere

### Alternative: Install from GitHub

```bash
npm install -g github:millcake666/ralph
```

### Alternative: Install from npm

```bash
npm install -g @iannuttall/ralph
```

### Update Ralph

```bash
# If installed via install.sh or npm
npm update -g @iannuttall/ralph

# If installed from GitHub
npm install -g github:millcake666/ralph
```

## Global CLI (recommended)

Once installed, run Ralph from anywhere:

```bash
ralph prd # launches an interactive prompt
ralph build 1 # one Ralph run
```

### Template hierarchy

Ralph will look for templates in this order:

1. `.agents/ralph/` in the current project (if present)
2. Bundled defaults shipped with this repo

State and logs always go to `.ralph/` in the project.

### Install templates into a project (optional overrides)

```bash
ralph install
```

This creates `.agents/ralph/` in the current repo so you can customize prompts and loop behavior. During install, you’ll be asked if you want to add the required skills.

### Install required skills (optional)

```bash
ralph install --skills
```

You'll be prompted for agent (codex/claude/droid/opencode/qwen) and local vs global install. Skills installed: **commit**, **dev-browser**, **prd**.
If you skipped skills during `ralph install`, you can run `ralph install --skills` anytime.

## Quick start (project)

1) Create your PRD (JSON) or generate one:
```
ralph prd
```
Requires the **prd** skill (install via `ralph install --skills`).

Example prompt text:
```
A lightweight uptime monitor (Hono app), deployed on Cloudflare, with email alerts via AWS SES
```

Default output (agent chooses a short filename in `.agents/tasks/`):
```
.agents/tasks/prd-<short>.json
```

2) Run one build iteration:
```
ralph build 1 # one Ralph run
```

## PRD Command: Interactive Flow

### `ralph prd --agent qwen`

The PRD command launches an interactive prompt that collects your feature request and invokes an agent to generate a Product Requirements Document (PRD) in JSON format.

**Expected Flow:**

1. **Request Input**: You'll see a prompt:
   ```
   Ralph PRD
   Describe the feature you want a PRD for
   Example: A lightweight uptime monitor with email alerts
   > 
   ```

2. **Edit Before Submit**: Type your request. You can:
   - Use arrow keys to move the cursor
   - Use backspace/delete to edit text
   - Press Enter to submit when ready

3. **Agent Interview** (qwen interactive mode): The agent may ask clarifying questions:
   ```
   Question 1: Who is the primary user?
   > [your answer]
   Question 2: What is the deadline?
   > [your answer]
   ```

4. **PRD Generation**: After the interview, the agent writes the PRD JSON and displays:
   ```
   PRD JSON saved to .agents/tasks/prd-<name>.json
   Close this chat and run `ralph build`.
   ```

**Working Command Example:**

```bash
ralph prd --agent qwen
```

**Expected Interview Sequence:**

```
$ ralph prd --agent qwen
Ralph PRD
Describe the feature you want a PRD for
Example: A lightweight uptime monitor with email alerts
> Incident workflow dashboard for operations

Question 1: Who is the primary user?
> Ops team leads

Question 2: What is the deadline?
> End of Q2

PRD JSON saved to .agents/tasks/prd-incident.json
Close this chat and run `ralph build`.
```

### Request Input Editing Behavior

The interactive prompt uses Node.js `readline` module with full TTY support:

- **Cursor Movement**: Left/right arrows move the cursor within the input line
- **Text Editing**: Backspace deletes characters; you can insert text at any position
- **Submit**: Press Enter to submit the final edited text
- **Cancel**: Press Ctrl+C to abort (exits with cancellation message)

The captured request is the **final edited text** after all modifications, not the initial typing.

## Troubleshooting

### Premature Exit (Qwen Interview Mode)

If the qwen agent exits before saving the PRD, you'll see:

```
Qwen PRD session ended before PRD save confirmation.
Troubleshooting:
- Stay in the same interactive terminal and answer every follow-up question.
- Ensure the output path is writable: .agents/tasks/
- Retry with explicit output: ralph prd --agent qwen --out .agents/tasks/prd-<name>.json
- Verify your qwen CLI supports interactive interview mode.
```

**Common Causes:**

1. **Non-Interactive Terminal**: The agent requires stdin/stdout to be a TTY (interactive terminal).
2. **Piped Input**: Interview mode does **not** work when input is piped or redirected.
3. **Agent Configuration**: Your `AGENT_QWEN_INTERACTIVE_CMD` may not support interactive mode.
4. **Shell Context**: Running in a subshell, CI/CD, or automated script without TTY allocation.

### TTY Checks

The `ralph prd` command automatically detects interactive terminal mode:

```javascript
const interactiveTerminal = Boolean(process.stdin.isTTY && process.stdout.isTTY);
```

- **Interactive (TTY)**: Uses `AGENT_*_INTERACTIVE_CMD` for two-way dialogue
- **Non-Interactive (Pipe/Redirect)**: Uses `AGENT_*_CMD` for one-shot execution

**Verify your terminal is interactive:**

```bash
# Should print "1" if interactive
test -t 0 && echo 1 || echo 0
```

### Command Override

Override the agent command in `.agents/ralph/config.sh`:

```bash
# Interactive mode (recommended for qwen PRD)
AGENT_QWEN_INTERACTIVE_CMD="qwen {prompt}"

# Headless mode (no interview, one-shot PRD)
AGENT_QWEN_CMD="qwen exec --yolo -"
```

Or per-run override:

```bash
ralph prd --agent=qwen
```

### Non-Interactive stdin Limitations

**Important**: The PRD interview flow **requires** an interactive terminal.

**Does NOT work with:**

```bash
# Piped input - interview mode disabled
echo "my feature request" | ralph prd --agent qwen

# Redirected input - interview mode disabled
ralph prd --agent qwen < request.txt

# CI/CD without TTY allocation
# Subshells without TTY
```

**Why?** When stdin is not a TTY:
- The `readline` prompt cannot capture interactive input
- The agent cannot ask clarifying questions and wait for answers
- Ralph falls back to headless mode (if configured) or fails fast

**Workarounds for Automation:**

1. Use `--prompt` file mode instead of interactive input
2. Configure a headless agent command that doesn't require interview
3. Allocate TTY in CI/CD (e.g., `docker run -t`, `script -q /dev/null`)

### Empty Input Validation

If you press Enter without typing a request:

```
No description provided.
```

The command exits with a non-zero code and does **not** invoke the agent.

No‑commit dry run:
```
ralph build 1 --no-commit # one Ralph run
```

Override PRD output for `ralph prd`:
```
ralph prd --out .agents/tasks/prd-api.json
```
Optional human overview (generated from JSON):
```
ralph overview
```
This writes a tiny overview alongside the PRD: `prd-<slug>.overview.md`.

PRD story status fields are updated automatically by the loop:
- `open` → selectable
- `in_progress` → locked by a running loop (with `startedAt`)
- `done` → completed (with `completedAt`)

If a loop crashes and a story stays `in_progress`, you can set `STALE_SECONDS` in `.agents/ralph/config.sh` to allow Ralph to automatically reopen stalled stories.

## Override PRD paths

You can point Ralph at a different PRD JSON file via CLI flags:

```bash
ralph build 1 --prd .agents/tasks/prd-api.json # one Ralph run
```

Optional progress override:

```bash
ralph build 1 --progress .ralph/progress-api.md # one Ralph run
```

If multiple PRD JSON files exist in `.agents/tasks/` and you omit `--prd`, Ralph will prompt you to choose.

Optional config file (if you installed templates):

```
.agents/ralph/config.sh
```

## Choose the agent runner

Set `AGENT_CMD` in `.agents/ralph/config.sh` to switch agents:

```
AGENT_CMD="codex exec --yolo -"
AGENT_CMD="claude -p --dangerously-skip-permissions \"\$(cat {prompt})\""
AGENT_CMD="droid exec --skip-permissions-unsafe -f {prompt}"
AGENT_CMD="opencode run \"$(cat {prompt})\""
AGENT_CMD="qwen exec --yolo -"
```

Or override per run:

```
ralph prd --agent=codex
ralph build 1 --agent=codex # one Ralph run
ralph build 1 --agent=claude # one Ralph run
ralph build 1 --agent=droid # one Ralph run
ralph build 1 --agent=opencode # one Ralph run
ralph build 1 --agent=qwen # one Ralph run
```

If the CLI isn't installed, Ralph prints install hints:

```
codex    -> npm i -g @openai/codex
claude   -> curl -fsSL https://claude.ai/install.sh | bash
droid    -> curl -fsSL https://app.factory.ai/cli | sh
opencode -> curl -fsSL https://opencode.ai/install.sh | bash
qwen     -> Follow instructions at https://qwen.ai
```

## State files (.ralph/)

- `progress.md` — append‑only progress log
- `guardrails.md` — “Signs” (lessons learned)
- `activity.log` — activity + timing log
- `errors.log` — repeated failures and notes
- `runs/` — raw run logs + summaries

## Notes

- `.agents/ralph` is portable and can be copied between repos.
- `.ralph` is per‑project state.
- Use `{prompt}` in `AGENT_CMD` when agent needs a file path instead of stdin.
- Examples: see `examples/commands.md`.
- **OpenCode server mode**: For faster performance with OpenCode, run `opencode serve` in a separate terminal and uncomment the `AGENT_OPENCODE_CMD` lines in `.agents/ralph/agents.sh` to use `--attach http://localhost:4096`. This avoids cold boot on every run.

## Tests

Dry-run smoke tests (no agent required):

```bash
npm test
```

Fast agent health check (real agent call, minimal output):

```bash
npm run test:ping
```

Optional integration test (requires agents installed):

```bash
RALPH_INTEGRATION=1 npm test
```

Full real-agent loop test:

```bash
npm run test:real
```
