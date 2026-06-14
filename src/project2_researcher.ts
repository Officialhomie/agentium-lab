/**
 * Project 2 — Researcher
 * Gathers information using search and file tools, then summarizes findings.
 */
import { query } from "@anthropic-ai/claude-agent-sdk";
import { baseOptions, printMessage } from "./shared/config.js";

const prompt =
  "Research how the Claude Agent SDK query() function works. Read CLAUDE.md and any relevant source files in src/shared/, then write a short summary of the project setup and how to run each example.";

async function main(): Promise<void> {
  console.log("=== Project 2: Researcher ===\n");

  for await (const message of query({
    prompt,
    options: {
      ...baseOptions,
      maxTurns: 8,
      allowedTools: ["Read", "Glob", "Grep", "WebSearch", "WebFetch"],
    },
  })) {
    printMessage(message);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
