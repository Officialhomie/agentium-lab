# Agentium Lab — Explanations Index

A running index of every project in this learning lab. Each entry links to a deeper explanation file covering concepts, implementation mapping, run data, and caveats.

| # | File | What it teaches | Explanation |
|---|------|----------------|-------------|
| 1 | `src/project1_explorer.ts` | `query()` async iterator pattern, `allowedTools` scoping (read-only: Glob/Grep/Read), streaming message types (assistant / tool_use / tool_result / result / system) | [project1-explorer.md](project1-explorer.md) |
| 2 | `src/project2_researcher.ts` | `systemPrompt` vs task prompt, WebSearch (discover) vs WebFetch (read), autonomous multi-step reasoning — the agent decides how many calls to make | [project2-researcher.md](project2-researcher.md) |
| 3 | `src/project3_auditor.ts` | Model routing (Haiku for structured tasks vs Sonnet for reasoning), `PostToolUse` programmatic hooks with `HookCallbackMatcher`, append-only audit logging — observability and cost control for production agents | [project3-auditor.md](project3-auditor.md) |
| 4 | `src/project4_sessions.ts` | Stateful agents via `session_id` resume, KV cache economics, two-phase workflow design, cross-phase model routing (Haiku cataloging → Sonnet synthesis), and the conceptual foundation for session forking | [project4-sessions.md](project4-sessions.md) |
