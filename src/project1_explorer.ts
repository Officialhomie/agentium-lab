/**
 * Project 1 — Explorer
 * Uses Read/Glob/Grep to inspect the local project structure.
 */
import { query } from "@anthropic-ai/claude-agent-sdk";
import { baseOptions, printMessage } from "./shared/config.js";

const prompt =
  "Explore this TypeScript project. List the top-level files and describe what each src/project*.ts file is for. Keep it brief.";

async function main(): Promise<void> {
  console.log("=== Project 1: Explorer ===\n");

  for await (const message of query({
    prompt,
    options: {
      ...baseOptions,
      maxTurns: 5,
      allowedTools: ["Read", "Glob", "Grep"],
    },
  })) {
    printMessage(message);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
