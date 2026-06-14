# Agentium Lab

TypeScript agent learning lab using Claude Agent SDK.

## Running projects

Each `src/project*.ts` file is standalone. Run with:

```bash
npx tsx src/project1_explorer.ts
npx tsx src/project2_researcher.ts
npx tsx src/project3_auditor.ts
npx tsx src/project4_sessions.ts
```

## Shared config

Base options and helpers live in `src/shared/config.ts`.

## Principles

- Never use Zapier or Make — the SDK is the execution layer.
- All agents use `for await...of` loops on `query()`.
