import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "bin", "ralph");
const loopTemplatePath = path.join(repoRoot, ".agents", "ralph", "loop.sh");

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

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function tclQuote(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function setupProject(mockScriptContent) {
  const projectRoot = mkdtempSync(path.join(tmpdir(), "ralph-prd-interview-"));
  const agentsDir = path.join(projectRoot, ".agents", "ralph");
  mkdirSync(agentsDir, { recursive: true });
  mkdirSync(path.join(projectRoot, ".ralph"), { recursive: true });

  const loopPath = path.join(agentsDir, "loop.sh");
  copyFileSync(loopTemplatePath, loopPath);
  chmodSync(loopPath, 0o755);

  const mockPath = path.join(projectRoot, "mock-qwen.sh");
  writeFileSync(mockPath, mockScriptContent, "utf-8");
  chmodSync(mockPath, 0o755);

  const mockedCmd = `${mockPath} {prompt}`;
  writeFileSync(
    path.join(agentsDir, "agents.sh"),
    `#!/bin/bash
AGENT_QWEN_INTERACTIVE_CMD=${shellQuote(mockedCmd)}
AGENT_QWEN_CMD=${shellQuote(mockedCmd)}
`,
    "utf-8",
  );
  return projectRoot;
}

function runInterviewInPseudoTty({ cwd, outPath, request, answers }) {
  const expectFile = path.join(cwd, ".ralph", "interview.exp");
  const expectScript = [
    "set timeout 20",
    "log_user 1",
    `cd ${tclQuote(cwd)}`,
    'set env(RALPH_SKIP_UPDATE_CHECK) "1"',
    `set cmd [list ${tclQuote(process.execPath)} ${tclQuote(cliPath)} "prd" "--agent" "qwen" "--out" ${tclQuote(outPath)}]`,
    "eval spawn $cmd",
    'expect "> "',
    `send -- ${tclQuote(request)}`,
    'send -- "\\r"',
    'expect "Question 1:"',
    `send -- ${tclQuote(answers[0])}`,
    'send -- "\\r"',
    'expect "Question 2:"',
    `send -- ${tclQuote(answers[1])}`,
    'send -- "\\r"',
    "expect eof",
    "set wait_status [wait]",
    "set exit_code [lindex $wait_status 3]",
    "exit $exit_code",
  ].join("\n");

  writeFileSync(expectFile, `${expectScript}\n`, "utf-8");
  return spawnSync("expect", ["-f", expectFile], {
    encoding: "utf-8",
    env: { ...process.env },
    timeout: 45000,
  });
}

const successMock = `#!/bin/bash
set -euo pipefail
root="$(pwd)"
mkdir -p "$root/.ralph"
printf '%s\\n' "$1" > "$root/.ralph/mock-prompt.txt"
echo "Question 1: Who is the primary user?"
read -r answer_one
printf '%s\\n' "$answer_one" > "$root/.ralph/answer-one.txt"
echo "Question 2: What is the deadline?"
read -r answer_two
printf '%s\\n' "$answer_two" > "$root/.ralph/answer-two.txt"
mkdir -p "$(dirname "$PRD_PATH")"
cat > "$PRD_PATH" <<'JSON'
{
  "version": 1,
  "project": "mock-prd",
  "qualityGates": [],
  "stories": []
}
JSON
echo "PRD JSON saved to $PRD_PATH. Close this chat and run \`ralph build\`."
`;

const failureMock = `#!/bin/bash
set -euo pipefail
root="$(pwd)"
mkdir -p "$root/.ralph"
printf '%s\\n' "$1" > "$root/.ralph/mock-prompt.txt"
echo "Question 1: Who is the primary user?"
read -r answer_one
printf '%s\\n' "$answer_one" > "$root/.ralph/answer-one.txt"
echo "Question 2: What is the deadline?"
read -r answer_two
printf '%s\\n' "$answer_two" > "$root/.ralph/answer-two.txt"
echo "Interview ended unexpectedly without saving."
`;

if (!commandExists("expect")) {
  console.log("Skipping PRD interview regression test (missing expect command).");
  process.exit(0);
}

{
  const projectRoot = setupProject(successMock);
  const request = "Incident workflow dashboard for operations";
  const outPath = ".agents/tasks/prd-interview-success.json";
  const answers = ["Ops team leads", "End of Q2"];
  try {
    const result = runInterviewInPseudoTty({
      cwd: projectRoot,
      outPath,
      request,
      answers,
    });
    const output = `${result.stdout || ""}${result.stderr || ""}`;
    assert(result.status === 0, `Interactive qwen interview should succeed.\n${output}`);
    assert(output.includes("Question 1:"), "First clarifying question was not shown.");
    assert(output.includes("Question 2:"), "Second clarifying question was not shown.");
    assert(output.includes("PRD JSON saved to"), "Missing final PRD save message.");
    const promptText = readFileSync(path.join(projectRoot, ".ralph", "mock-prompt.txt"), "utf-8");
    assert(
      promptText.includes(`User request:\n${request}`),
      "Captured request was not forwarded to the qwen interview prompt.",
    );
    assert(
      readFileSync(path.join(projectRoot, ".ralph", "answer-one.txt"), "utf-8").trim() === answers[0],
      "First interview answer was not captured by the mock qwen command.",
    );
    assert(
      readFileSync(path.join(projectRoot, ".ralph", "answer-two.txt"), "utf-8").trim() === answers[1],
      "Second interview answer was not captured by the mock qwen command.",
    );
    const prdOutPath = path.join(projectRoot, outPath);
    assert(existsSync(prdOutPath), "PRD output file was not created in success flow.");
    assert(readFileSync(prdOutPath, "utf-8").includes('"project": "mock-prd"'), "PRD output was not written.");
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
}

{
  const projectRoot = setupProject(failureMock);
  const request = "Incident workflow dashboard for operations";
  const outPath = ".agents/tasks/prd-interview-failure.json";
  const answers = ["Ops team leads", "End of Q2"];
  try {
    const result = runInterviewInPseudoTty({
      cwd: projectRoot,
      outPath,
      request,
      answers,
    });
    const output = `${result.stdout || ""}${result.stderr || ""}`;
    assert(result.status !== 0, "Interview without save confirmation should fail.");
    assert(output.includes("Question 1:"), "First clarifying question was not shown in failure flow.");
    assert(output.includes("Question 2:"), "Second clarifying question was not shown in failure flow.");
    assert(
      output.includes("Qwen PRD session ended before PRD save confirmation."),
      "Missing clear qwen troubleshooting failure message.",
    );
    assert(output.includes("Troubleshooting:"), "Missing troubleshooting output on qwen failure.");
    assert(
      readFileSync(path.join(projectRoot, ".ralph", "answer-one.txt"), "utf-8").trim() === answers[0],
      "First interview answer was not captured in failure flow.",
    );
    assert(
      readFileSync(path.join(projectRoot, ".ralph", "answer-two.txt"), "utf-8").trim() === answers[1],
      "Second interview answer was not captured in failure flow.",
    );
    assert(!existsSync(path.join(projectRoot, outPath)), "Failure flow should not create a PRD output file.");
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
}

console.log("PRD qwen interview regression tests passed.");
