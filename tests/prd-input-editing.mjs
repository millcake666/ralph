import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "bin", "ralph");

function assert(condition, message) {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
}

function commandExists(cmd) {
  const check = spawnSync(`command -v ${cmd}`, { shell: true, stdio: "ignore" });
  return check.status === 0;
}

function tclQuote(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function runInPseudoTty(options) {
  const expectScript = [
    "set timeout 20",
    "log_user 1",
    `cd ${tclQuote(options.cwd)}`,
    'set env(RALPH_SKIP_UPDATE_CHECK) "1"',
    `set cmd [list ${tclQuote(process.execPath)} ${tclQuote(cliPath)} "prd" "--agent" "qwen"]`,
    "eval spawn $cmd",
    ...options.sendLines,
    "expect eof",
    "set wait_status [wait]",
    "set exit_code [lindex $wait_status 3]",
    "exit $exit_code",
  ].join("\n");
  return spawnSync("expect", ["-c", expectScript], {
    encoding: "utf-8",
    env: { ...process.env },
  });
}

function setupProject() {
  const projectRoot = mkdtempSync(path.join(tmpdir(), "ralph-prd-input-"));
  mkdirSync(path.join(projectRoot, ".agents", "ralph"), { recursive: true });
  mkdirSync(path.join(projectRoot, ".ralph"), { recursive: true });
  const loopPath = path.join(projectRoot, ".agents", "ralph", "loop.sh");
  writeFileSync(
    loopPath,
    `#!/bin/bash
set -euo pipefail

root="$(pwd)"
count_file="$root/.ralph/loop-count.txt"
count=0
if [[ -f "$count_file" ]]; then
  count="$(cat "$count_file")"
fi
printf '%s\\n' "$((count + 1))" > "$count_file"

if [[ "\${1:-}" == "prd" && "\${2:-}" == "--prompt" && -n "\${3:-}" ]]; then
  cat "$3" > "$root/.ralph/captured-request.txt"
fi
`,
    "utf-8",
  );
  chmodSync(loopPath, 0o755);
  return projectRoot;
}

if (!commandExists("expect")) {
  console.log("Skipping PRD input editing test (missing expect command).");
  process.exit(0);
}

{
  const projectRoot = setupProject();
  try {
    const result = runInPseudoTty({
      cwd: projectRoot,
      sendLines: [
        'send -- "вот мои текст!\\177"',
        "for {set i 0} {$i < 7} {incr i} { send -- \"\\033\\[D\" }",
        'send -- "\\033\\[3~"',
        'send -- "й\\r"',
      ],
    });
    const output = `${result.stdout || ""}${result.stderr || ""}`;
    assert(result.status === 0, `Interactive PRD submit failed.\n${output}`);
    const countPath = path.join(projectRoot, ".ralph", "loop-count.txt");
    assert(existsSync(countPath), "Loop invocation count was not recorded.");
    assert(readFileSync(countPath, "utf-8").trim() === "1", "PRD loop should run exactly once.");
    const capturedPath = path.join(projectRoot, ".ralph", "captured-request.txt");
    assert(existsSync(capturedPath), "Captured request file missing.");
    assert(
      readFileSync(capturedPath, "utf-8") === "вот мой текст\n",
      "Captured request does not match edited input.",
    );
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
}

{
  const projectRoot = setupProject();
  try {
    const result = runInPseudoTty({
      cwd: projectRoot,
      sendLines: ['send -- "\\r"'],
    });
    const output = `${result.stdout || ""}${result.stderr || ""}`;
    assert(result.status !== 0, "Empty PRD input should fail with non-zero exit.");
    assert(output.includes("No description provided."), "Missing empty-input error message.");
    const countPath = path.join(projectRoot, ".ralph", "loop-count.txt");
    assert(!existsSync(countPath), "PRD loop must not run for empty input.");
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
}

console.log("PRD input editing tests passed.");
