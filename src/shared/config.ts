import { config as loadEnv } from "dotenv";
import type { Options, SDKMessage } from "@anthropic-ai/claude-agent-sdk";

loadEnv();

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY is not set — add it to your .env file");
}

export const baseOptions: Pick<Options, "model" | "maxTurns"> = {
  model: "claude-sonnet-4-6",
  maxTurns: 10,
};

export function printMessage(message: SDKMessage): void {
  switch (message.type) {
    case "assistant": {
      console.log(`\n[assistant] session=${message.session_id}`);
      for (const block of message.message.content) {
        if (typeof block === "string") {
          console.log(`  [text] ${block}`);
          continue;
        }
        if (block.type === "text") {
          console.log(`  [text] ${block.text}`);
        } else if (block.type === "tool_use") {
          console.log(`  [tool_use] ${block.name} (id=${block.id})`);
        } else if (block.type === "thinking") {
          console.log(`  [thinking] (${block.thinking.length} chars)`);
        } else {
          console.log(`  [${block.type}]`);
        }
      }
      break;
    }
    case "user": {
      console.log(`\n[user] session=${message.session_id}`);
      const content = message.message.content;
      const blocks = typeof content === "string" ? [content] : content;
      for (const block of blocks) {
        if (typeof block === "string") {
          console.log(`  [text] ${block}`);
          continue;
        }
        if (block.type === "text") {
          console.log(`  [text] ${block.text}`);
        } else if (block.type === "tool_result") {
          console.log(`  [tool_result] tool_use_id=${block.tool_use_id}`);
        } else {
          console.log(`  [${block.type}]`);
        }
      }
      break;
    }
    case "result": {
      if (message.subtype === "success") {
        console.log(
          `\n[result:success] turns=${message.num_turns} cost=$${message.total_cost_usd.toFixed(4)}`
        );
        console.log(message.result);
      } else {
        console.log(`\n[result:error] ${message.errors.join(", ")}`);
      }
      break;
    }
    case "system":
      console.log(`\n[system:${message.subtype}]`);
      break;
    default:
      console.log(`\n[${message.type}]`);
  }
}
