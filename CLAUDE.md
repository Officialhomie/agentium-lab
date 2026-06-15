# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run any project directly
npx tsx src/project1_explorer.ts
npx tsx src/project2_researcher.ts
npx tsx src/project3_auditor.ts
npx tsx src/project4_sessions.ts

# Or via npm scripts
npm run project1
npm run project2
npm run project3
npm run project4
```

Requires a `.env` file with `ANTHROPIC_API_KEY` set. `dotenv` is loaded in `src/shared/config.ts`.

## Architecture

Each `src/project*.ts` is a self-contained agent script. All use the same pattern:

```typescript
for await (const message of query({ prompt, options })) {
  printMessage(message);
}
```

**`src/shared/config.ts`** — shared `baseOptions` (`model`, `maxTurns`) and `printMessage()` which formats all `SDKMessage` types (assistant, user, result, system) to stdout.

**`src/shared/utils.ts`** — `saveSession()` / `loadSession()` persist a session ID to `.session-id` in the project root, enabling session resume across process runs.

## Project Overview

| File | Purpose | Tools granted |
|------|---------|---------------|
| `project1_explorer.ts` | Read-only codebase exploration | Read, Glob, Grep |
| `project2_researcher.ts` | Research with web access | Read, Glob, Grep, WebSearch, WebFetch |
| `project3_auditor.ts` | Read-only audit, appends findings to `audit.log` | Read, Glob, Grep |
| `project4_sessions.ts` | Multi-turn session persistence via `resume` option | Read, Glob |

## Key SDK Patterns

- Tool access is restricted per-agent via `allowedTools` in `options`.
- Session resume: pass `resume: sessionId` in options to continue a prior conversation.
- The `result` message (final turn) carries `message.result` (the text answer), `message.num_turns`, and `message.total_cost_usd`.
- New agents inherit `baseOptions` with spread: `{ ...baseOptions, maxTurns: N, allowedTools: [...] }`.

## Principles

- Never use Zapier or Make — the SDK is the execution layer.
- All agents use `for await...of` loops on `query()`.
- Agents are read-only by default; write access is granted explicitly via `allowedTools`.
