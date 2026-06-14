/**
 * Project 3 — Auditor
 * Reviews project files and appends findings to audit.log.
 */
import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { baseOptions, printMessage } from "./shared/config.js";

const AUDIT_LOG = join(process.cwd(), "audit.log");

const prompt = `Audit this learning lab project for:
1. Missing error handling in the project scripts
2. Whether shared/config.ts loads environment variables correctly
3. Any security concerns (e.g. secrets in code)

Write a concise audit report. Do not modify source files.`;

async function main(): Promise<void> {
  console.log("=== Project 3: Auditor ===\n");

  let report = "";

  for await (const message of query({
    prompt,
    options: {
      ...baseOptions,
      maxTurns: 6,
      allowedTools: ["Read", "Glob", "Grep"],
    },
  })) {
    printMessage(message);

    if (message.type === "result" && message.subtype === "success") {
      report = message.result;
    }
  }

  if (report) {
    const entry = `\n--- Audit ${new Date().toISOString()} ---\n${report}\n`;
    await appendFile(AUDIT_LOG, entry, "utf8");
    console.log(`\nAudit appended to ${AUDIT_LOG}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
