/**
 * Project 4 — Sessions
 * Demonstrates multi-turn conversation with session persistence via resume.
 */
import { query } from "@anthropic-ai/claude-agent-sdk";
import { baseOptions, printMessage } from "./shared/config.js";
import { loadSession, saveSession } from "./shared/utils.js";

async function runQuery(
  prompt: string,
  resume?: string
): Promise<string | undefined> {
  let sessionId: string | undefined;

  for await (const message of query({
    prompt,
    options: {
      ...baseOptions,
      maxTurns: 3,
      allowedTools: ["Read", "Glob"],
      ...(resume ? { resume } : {}),
    },
  })) {
    printMessage(message);

    if ("session_id" in message && message.session_id) {
      sessionId = message.session_id;
    }
  }

  return sessionId;
}

async function main(): Promise<void> {
  console.log("=== Project 4: Sessions ===\n");

  const existing = await loadSession();

  if (existing) {
    console.log(`Resuming session: ${existing}\n`);
    await runQuery(
      "What did we discuss last time? Give a one-sentence recap.",
      existing
    );
    return;
  }

  console.log("Starting new session...\n");
  const sessionId = await runQuery(
    "Remember this codename for our lab: AGENT-LAB-42. Confirm you saved it."
  );

  if (sessionId) {
    await saveSession(sessionId);
    console.log("\nRun again to resume this session.");
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
