/**
 * Project 3 — Audit-Logged Code Reviewer
 *
 * Teaching goals:
 *
 * 1. MODEL ROUTING
 *    This project overrides shared/config.ts's Sonnet default with Haiku for
 *    the audit task. The task is structured file analysis: find a set of files,
 *    read them sequentially, apply a fixed rubric, write a report. There is no
 *    multi-step reasoning, no ambiguity to resolve, no synthesis across many
 *    domains. Haiku handles this cleanly at ~10x lower cost per token than
 *    Sonnet. Sonnet stays in shared config for tasks that genuinely need heavier
 *    reasoning (research synthesis, session planning, multi-agent orchestration).
 *
 *    The pattern: spread baseOptions, then override model locally. The routing
 *    decision is visible in this file rather than buried in shared config. When
 *    a future reader asks "why is this cheaper?", the answer is right here.
 *
 * 2. HOOKS LIFECYCLE
 *    Every tool call follows this sequence:
 *      PreToolUse → [tool executes] → PostToolUse
 *    At session end: Stop fires.
 *    Programmatic hooks use: hooks: Partial<Record<HookEvent, HookCallbackMatcher[]>>
 *    Each HookCallbackMatcher has an optional matcher string and a hooks array of
 *    async callbacks typed as (input: HookInput, toolUseId, { signal }) => HookJSONOutput.
 *
 * 3. PreToolUse vs PostToolUse
 *    PreToolUse fires before the tool runs. It can inspect inputs and, if
 *    needed, signal cancellation before anything happens — use it to gate.
 *    PostToolUse fires after the tool has already executed. It cannot undo
 *    what ran — use it to observe and record. This project uses PostToolUse
 *    because we want an append-only audit log of what was read, not a gate
 *    that blocks reads.
 *
 * 4. MATCHER TARGETING
 *    The HookCallbackMatcher is registered under PostToolUse with matcher: "Read".
 *    Glob and Grep calls pass through without triggering it. File reads are
 *    the risk surface in a read-only agent — those are what you audit. Logging
 *    every tool call would produce noise; targeting Read produces signal.
 *
 * 5. PRODUCTION PRINCIPLE
 *    An agent without observability is a liability. A client has no way to
 *    verify what an autonomous agent accessed unless there is a record. Hooks
 *    are the mechanism for building accountability into the agent loop. The
 *    audit.log this project writes is the minimal viable audit trail for a
 *    read-only agent operating on a client's codebase.
 */

import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  SDKMessage,
  HookInput,
  HookJSONOutput,
  PostToolUseHookInput,
} from "@anthropic-ai/claude-agent-sdk";
import { baseOptions, printMessage } from "./shared/config.js";

const AUDIT_LOG = join(process.cwd(), "audit.log");

const auditOptions = {
  ...baseOptions,
  model: "claude-haiku-4-5-20251001",
  allowedTools: ["Glob", "Grep", "Read"],
  maxTurns: 15,
  hooks: {
    PostToolUse: [
      {
        matcher: "Read",
        hooks: [
          async (
            input: HookInput,
            _toolUseId: string | undefined,
            _opts: { signal: AbortSignal }
          ): Promise<HookJSONOutput> => {
            const readInput = input as PostToolUseHookInput;
            const toolInput = readInput.tool_input as Record<string, unknown>;
            const filepath =
              typeof toolInput?.file_path === "string"
                ? toolInput.file_path
                : JSON.stringify(toolInput);

            const timestamp = new Date().toISOString();
            const logLine = `[${timestamp}] AGENT READ: ${filepath}\n`;

            console.log(`HOOK FIRED: ${filepath}`);

            try {
              await appendFile(AUDIT_LOG, logLine, "utf8");
            } catch (err) {
              console.error("audit.log write failed:", err);
            }

            return { continue: true };
          },
        ],
      },
    ],
  },
};

const prompt = `You are performing a structured code review of a TypeScript project.

Steps:
1. Use Glob to find all .ts files in src/ (pattern: "src/**/*.ts").
2. Read each file found.
3. For each file, identify:
   - Potential bugs or unhandled edge cases
   - Hardcoded values that should be config or env vars
   - Missing error handling (try/catch, null checks)
   - Any security concerns (exposed keys, unsafe operations)
4. Produce a structured review report with one section per file.
5. End with a PRIORITY FINDINGS section ranking the top 3 issues across all files.

Format each file section as:
### <filename>
- Finding: <description>

Format the summary as:
### PRIORITY FINDINGS
1. [CRITICAL/HIGH/MEDIUM] <issue> — <file>
2. ...
3. ...`;

async function main(): Promise<void> {
  console.log("=== Project 3: Audit-Logged Code Reviewer ===\n");
  console.log(`Audit log: ${AUDIT_LOG}\n`);

  let finalResult: string | undefined;

  for await (const message of query({
    prompt,
    options: auditOptions,
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
