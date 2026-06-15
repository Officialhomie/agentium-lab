/**
 * Project 1 — Codebase Explorer
 *
 * Teaching goals:
 *   1. query() async iterator pattern — every SDK message arrives as a
 *      yielded value; the loop drives the agent turn by turn.
 *   2. allowedTools scoping — passing ["Glob", "Grep", "Read"] keeps this
 *      agent strictly read-only; it cannot run Bash or write files.
 *   3. Streamed message types — the for..of loop receives:
 *        - "assistant" messages containing text, tool_use, or thinking blocks
 *        - "user" messages containing tool_result blocks (tool output fed back)
 *        - "result" (final) with subtype "success" | "error", cost, and turn count
 *        - "system" lifecycle events (init, hook_started, etc.)
 *      printMessage() handles all of these and logs them to stdout.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { baseOptions, printMessage } from "./shared/config.js";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

const prompt = `
You are a codebase explorer. Analyze the project's src/ directory using only the tools provided.

Step 1 — Discovery: Use Glob to list every .ts file under src/ (pattern: "src/**/*.ts").
Step 2 — TODO scan: Use Grep to search all .ts files in src/ for the pattern "TODO|FIXME". Record every match with its file path and line number.
Step 3 — Read files: Read each .ts file you found in Step 1.
Step 4 — Final report: Produce a structured summary with three sections:

### File List
For each file: path + one-sentence purpose.

### TODOs / FIXMEs
For each match: file path, line number, and the comment text. If none found, say "None found."

### Summary
One sentence describing the overall project structure and purpose.
`.trim();

async function main(): Promise<void> {
  console.log("=== Project 1: Codebase Explorer ===\n");

  let finalResult: string | undefined;

  for await (const message of query({
    prompt,
    options: {
      ...baseOptions,
      maxTurns: 15,
      allowedTools: ["Glob", "Grep", "Read"],
    },
  })) {
    printMessage(message);

    if (
      (message as SDKMessage).type === "result" &&
      (message as Extract<SDKMessage, { type: "result" }>).subtype === "success"
    ) {
      finalResult = (
        message as Extract<SDKMessage, { type: "result"; subtype: "success" }>
      ).result;
    }
  }

  if (finalResult) {
    console.log("\n=== FINAL REPORT ===\n");
    console.log(finalResult);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
