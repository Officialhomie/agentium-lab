/**
 * Project 4 — Two-Phase Session-Resumable Agent
 *
 * Teaching goals:
 *
 * 1. STATEFUL vs STATELESS AGENTS
 *    Stateless: every run starts from zero. The full conversation context
 *    is re-processed on every call. Cost grows linearly with conversation
 *    length because the model must re-read everything each time.
 *    Stateful: a session_id preserves the KV Cache server-side. Phase 2
 *    inherits Phase 1 context without re-processing any of it. The cost
 *    of prior context approaches zero on resume — only new tokens are
 *    billed at the full rate.
 *    Real-world analogy: a contractor who keeps detailed notes between
 *    visits vs one who asks you to re-explain the entire project every
 *    morning. The stateless contractor is expensive and slow.
 *
 * 2. KV CACHE — what it actually is
 *    During Phase 1 prefill, the model computes attention matrices (keys
 *    and values) for every token in the input. These are stored server-side
 *    as the KV Cache. On Phase 2 resume, instead of recomputing all of
 *    that, the model reuses the cache and only processes the new prompt.
 *    You pay for the cache read at a reduced rate, not the full prefill
 *    again. This is what makes session resume dramatically cheaper than
 *    resending the entire conversation.
 *
 * 3. PHASE-BASED AGENT DESIGN
 *    Long-running workflows cannot run in a single shot — context windows
 *    have limits, tasks have natural breakpoints, and humans need to review
 *    between phases. Sessions make phase-based design practical. This is
 *    the pattern behind every production multi-step agent: a pipeline of
 *    phases where each inherits state from the last without paying to
 *    re-read prior context.
 *
 * 4. MODEL ROUTING ACROSS PHASES
 *    Phase 1 is cataloging: structured, predictable, no complex reasoning.
 *    Haiku handles it cleanly at a fraction of Sonnet's cost per token.
 *    Phase 2 is synthesis and judgment: strong recall, cross-file reasoning,
 *    qualitative answers. Sonnet earns its cost here.
 *    Same workflow. Two models. Each doing what they are priced for.
 *    The model strings are intentionally visible in this file — the
 *    contrast is the teaching point.
 *
 * 5. SESSION FORKING (conceptual, not implemented here)
 *    Once you have a session_id, you can fork it: pass the same session_id
 *    to two separate Phase 2 calls with different prompts. Both inherit the
 *    same Phase 1 context but explore different analytical paths. This is
 *    how you run debate-pattern agents: same context, divergent instructions
 *    per fork. One fork critiques, another defends, a third synthesizes.
 */

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { baseOptions, printMessage } from "./shared/config.js";

const SESSION_STORE = join(process.cwd(), "session_store.txt");

async function saveSessionStore(sessionId: string): Promise<void> {
  await writeFile(SESSION_STORE, sessionId, "utf8");
}

async function loadSessionStore(): Promise<string> {
  return (await readFile(SESSION_STORE, "utf8")).trim();
}

// ─── Phase 1 ───────────────────────────────────────────────────────────────

async function run_phase_one(): Promise<void> {
  console.log("=== STARTING PHASE 1 (Haiku — reading + cataloging) ===\n");

  const phase1Options = {
    ...baseOptions,
    model: "claude-haiku-4-5-20251001",
    maxTurns: 15,
    allowedTools: ["Read", "Glob"],
  };

  const prompt =
    "Read and fully understand every .ts file in the src/ folder. " +
    "For each file: identify its purpose, the SDK concepts it demonstrates, " +
    "the tools it uses, and any patterns or issues worth noting. " +
    "Do not produce a final report yet — just understand everything thoroughly.";

  let sessionId: string | undefined;
  let turns: number | undefined;
  let cost: number | undefined;

  for await (const message of query({ prompt, options: phase1Options })) {
    printMessage(message);

    const msg = message as SDKMessage;

    // Log raw message shape on first pass so session_id location is clear
    if (msg.type === "assistant" && sessionId === undefined) {
      const raw = msg as Record<string, unknown>;
      const keys = Object.keys(raw);
      console.log(`  [debug] assistant message keys: ${keys.join(", ")}`);
    }

    // session_id appears on assistant and user messages
    if ("session_id" in msg && typeof msg.session_id === "string" && msg.session_id) {
      sessionId = msg.session_id;
    }

    if (msg.type === "result" && msg.subtype === "success") {
      turns = msg.num_turns;
      cost = msg.total_cost_usd;
    }
  }

  if (!sessionId) {
    throw new Error("Phase 1 did not return a session_id — cannot continue.");
  }

  await saveSessionStore(sessionId);

  console.log(`\n=== PHASE 1 COMPLETE. Session saved: ${sessionId} ===`);
  console.log(`    Turns: ${turns ?? "unknown"}`);
  console.log(`    Cost:  $${cost !== undefined ? cost.toFixed(4) : "unknown"}\n`);
}

// ─── Phase 2 ───────────────────────────────────────────────────────────────

async function run_phase_two(): Promise<void> {
  console.log("=== STARTING PHASE 2 (Sonnet — recall + synthesis) ===\n");

  const sessionId = await loadSessionStore();
  console.log(`Resuming session: ${sessionId}\n`);

  const phase2Options = {
    ...baseOptions,
    model: "claude-sonnet-4-6",
    maxTurns: 10,
    allowedTools: ["Read"], // present but should NOT fire if session context is intact
    resume: sessionId,
  };

  const prompt =
    "Based only on what you already read and understood — do not read any files again — " +
    "answer these three questions:\n" +
    "1. What is the most important SDK concept demonstrated across all the project files, " +
    "and which file demonstrates it best?\n" +
    "2. What is the single biggest code quality issue you noticed across all files?\n" +
    "3. If a student worked through all four projects in order, what would the natural " +
    "progression of difficulty feel like, and is there any gap in the learning sequence?";

  let turns: number | undefined;
  let cost: number | undefined;
  let finalResult: string | undefined;

  for await (const message of query({ prompt, options: phase2Options })) {
    printMessage(message);

    const msg = message as SDKMessage;

    if (msg.type === "result" && msg.subtype === "success") {
      turns = msg.num_turns;
      cost = msg.total_cost_usd;
      finalResult = msg.result;
    }
  }

  console.log("\n=== PHASE 2 RESULT ===");
  if (finalResult) {
    console.log(finalResult);
  }
  console.log(`\n    Turns: ${turns ?? "unknown"}`);
  console.log(`    Cost:  $${cost !== undefined ? cost.toFixed(4) : "unknown"}\n`);
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("=== Project 4: Two-Phase Session-Resumable Agent ===\n");

  await run_phase_one();
  await run_phase_two();

  console.log("=== ALL PHASES COMPLETE ===");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
