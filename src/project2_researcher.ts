/**
 * Project 2 — Web Research Summarizer
 *
 * Teaching goals:
 *
 * 1. systemPrompt vs task prompt
 *    systemPrompt is set once and persists for the entire agent session — it
 *    shapes WHO the agent is and HOW it behaves (persona, output format,
 *    epistemic rules). The prompt is the WHAT: the specific task for this run.
 *    Separating them keeps format/persona stable while the task stays flexible.
 *    Think of systemPrompt as the job description and prompt as the daily brief.
 *
 * 2. WebSearch vs WebFetch
 *    WebSearch returns a list of result titles/snippets/URLs for a query — it
 *    is cheap and fast, used to discover what exists. WebFetch retrieves the
 *    full content of a specific URL — used after a search narrows down which
 *    pages are worth reading in full. The agent decides which URLs deserve a
 *    fetch; you don't hard-code that choice.
 *
 * 3. Autonomous multi-step reasoning
 *    The prompt describes the end-goal, not every step. The agent decides how
 *    many searches to run, which URLs to fetch, and when it has enough signal
 *    to synthesize. This is the core of agentic behaviour: the loop drives
 *    itself until the agent emits a final text answer.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { baseOptions, printMessage } from "./shared/config.js";

const RESEARCH_TOPIC = "Base ecosystem updates June 2026";

const systemPrompt =
  "You are a research analyst. Structure your final output with three sections: " +
  "SUMMARY, KEY POINTS, and SOURCES USED. " +
  "Never state unverified claims as facts — explicitly flag anything uncertain.";

const prompt = `Research the following topic: "${RESEARCH_TOPIC}"

Steps:
1. Run 2–3 distinct WebSearch queries to get broad coverage of the topic.
2. WebFetch the 1–2 most relevant pages you find.
3. Synthesize everything into a structured report using the three sections
   defined in your system instructions: SUMMARY, KEY POINTS, and SOURCES USED.`;

async function main(): Promise<void> {
  console.log("=== Project 2: Web Research Summarizer ===\n");
  console.log(`Topic: ${RESEARCH_TOPIC}\n`);

  let finalResult: string | undefined;

  for await (const message of query({
    prompt,
    options: {
      ...baseOptions,
      maxTurns: 15,
      allowedTools: ["WebSearch", "WebFetch"],
      systemPrompt,
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
