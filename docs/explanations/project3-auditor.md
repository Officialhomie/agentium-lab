# Project 3 — Audit-Logged Code Reviewer

## 1. CONCEPT

### a) Model Routing

Not every job needs the same worker. A senior consultant is expensive and brings deep judgment — you hire them for complex strategy work. For filing paperwork or running a checklist, you hire someone junior and precise. Using the senior consultant to file paperwork is wasteful and the output is the same.

Model routing applies the same logic to AI agents. Some tasks — research synthesis, multi-domain reasoning, resolving ambiguous requirements — genuinely benefit from a more powerful model. Others — reading files sequentially and applying a fixed rubric — do not. They are deterministic, structured, and low-ambiguity. A faster, cheaper model handles them just as well.

This project uses a lighter model for the audit task because the agent's job is mechanical: find files, read them, match content against a checklist, write findings. There is no judgment call that requires heavy reasoning. Using a more powerful model would not improve the output; it would just cost more and run slower.

The principle: match the model to the cognitive demand of the task, not to the prestige of the project.

---

### b) Hooks

Imagine you hire two contractors to inspect a building. Both do the same work — walk the floors, check the wiring, read the blueprints. The difference: one has a keycard access log. Every door they open is recorded with a timestamp. The other walks in and out with no record.

Both contractors did their job. But only one is auditable. If something goes wrong, or a client asks "did you read section 3B?", only one contractor can prove what happened and when.

Hooks are the keycard access log for agent tool calls. They are functions that fire automatically at defined points in the agent's lifecycle — before a tool runs, after it completes, when the session ends. In this project, every time the agent reads a file, a hook fires and appends a timestamped line to `audit.log`. The agent doesn't know the hook exists; it just reads files as instructed. The accountability layer is separate from the task layer.

---

### c) Why This Matters for Client Work

An agent that reads the wrong files is a privacy problem. An agent that uses an oversized model is a cost problem. An agent with no audit trail is a trust problem — the client cannot verify what happened, and you cannot defend your work if questioned.

Hooks solve the trust problem by making agent behaviour observable after the fact. Model routing solves the cost problem by matching resource spend to task complexity. Together they describe a production-grade agent: one that does the right work, with the right tool, at the right cost, and leaves a record.

---

## 2. IMPLEMENTATION

| Concept | What it is | Where in the code | Why it matters |
|---|---|---|---|
| Model override | Spreads `baseOptions` then sets `model` to Haiku locally | `auditOptions = { ...baseOptions, model: "claude-haiku-4-5-20251001", ... }` (line 63–64) | Routing decision is visible at the call site, not hidden in shared config |
| Hook registration | `hooks: { PostToolUse: [{ matcher: "Read", hooks: [fn] }] }` | `auditOptions.hooks` block (lines 66–100) | Correct SDK shape: `Partial<Record<HookEvent, HookCallbackMatcher[]>>` |
| Hook function signature | `async (input: HookInput, toolUseId, { signal }) => HookJSONOutput` | Lines 71–97 | Must match SDK's `HookCallback` type exactly; returns `{ continue: true }` not `void` |
| Matcher targeting | `matcher: "Read"` filters to only Read tool calls | Line 67 | Glob and Grep pass through silently; only file reads are logged |
| `tool_input` extraction | Casts `input` to `PostToolUseHookInput`, reads `tool_input.file_path` | Lines 75–82 | `input` arrives as `HookInput` union; safe cast needed to access tool-specific fields |
| Audit log write | `appendFile(AUDIT_LOG, logLine)` inside try/catch | Lines 86–93 | append-only; try/catch prevents hook from crashing the agent on I/O failure |
| Console confirmation | `console.log("HOOK FIRED: ...")` | Line 84 | Makes the hook lifecycle visually obvious during development |

**Key API correction from first attempt:** The `options.hooks` field documented in the SDK accepts `type: 'command'` and `type: 'prompt'` shell hooks, which is the Claude Code CLI hook system. Programmatic JS callbacks use a different field: `hooks: Partial<Record<HookEvent, HookCallbackMatcher[]>>` where each matcher's `hooks` array contains `HookCallback` functions. Getting this wrong silently drops the hook without error — it just never fires.

---

## 3. RUN DATA

| Metric | Value |
|---|---|
| Turns used | 8 of 15 |
| Cost | **$0.0434** |
| Hook fires | 6 (one per `.ts` file read) |
| Glob calls | 1 |
| Read calls | 6 |
| `maxTurns` headroom | 7 turns unused |

**Full `audit.log` contents:**
```
[2026-06-16T22:38:14.105Z] AGENT READ: /Users/mac/agentium-lab/src/shared/config.ts
[2026-06-16T22:38:14.303Z] AGENT READ: /Users/mac/agentium-lab/src/shared/utils.ts
[2026-06-16T22:38:14.584Z] AGENT READ: /Users/mac/agentium-lab/src/project1_explorer.ts
[2026-06-16T22:38:14.753Z] AGENT READ: /Users/mac/agentium-lab/src/project2_researcher.ts
[2026-06-16T22:38:14.754Z] AGENT READ: /Users/mac/agentium-lab/src/project3_auditor.ts
[2026-06-16T22:38:14.955Z] AGENT READ: /Users/mac/agentium-lab/src/project4_sessions.ts
```

All 6 files read in under one second. `project2_researcher.ts` and `project3_auditor.ts` were read in parallel (timestamps 14.753Z and 14.754Z — 1ms apart).

**Top 3 PRIORITY FINDINGS from the agent:**
1. **[CRITICAL]** Missing `ANTHROPIC_API_KEY` validation at startup — `src/shared/config.ts`. The SDK will fail obscurely if the key is absent; should throw at load time with a clear message.
2. **[HIGH]** Multiple hardcoded config values across the project — `RESEARCH_TOPIC`, `AUDIT_LOG` path, model names, `SESSION_FILE`, `maxTurns`. Production deployments need these as env vars.
3. **[HIGH]** Silent error handling in audit hook and session persistence — `src/project3_auditor.ts` and `src/shared/utils.ts`. I/O failures are caught and logged but execution continues, masking failures.

---

## 4. COST COMPARISON

| Project | Model | Turns | Cost |
|---|---|---|---|
| Project 1 — Codebase Explorer | Sonnet 4.6 | 9 | $0.1508 |
| Project 2 — Web Researcher | Sonnet 4.6 | 7 | $0.2675 |
| Project 3 — Audit Reviewer | Haiku 4.5 | 8 | $0.0434 |

**Reading the numbers:** Project 3 ran one more turn than Project 2 and produced more detailed output (per-file sections + priority ranking vs. three summary sections), yet cost 83% less. The task type matters more than turn count. Web research with Sonnet is expensive because each turn involves synthesis and judgment. File analysis with Haiku is cheap because each turn is a read-and-classify loop against a fixed rubric.

Project 2 also used WebFetch which returns large page contents — more tokens in context per turn. Project 3 read source files which are short, so token counts per turn are lower regardless of model.

---

## 5. SELF-ASSESSMENT

**Does the CONCEPT section explain WHY model routing exists, not just what it is?**

Yes. The contractor analogy grounds it in a real-world resource allocation decision. A student reading only the CONCEPT section could explain to a client: "We use a lighter model for tasks that follow a checklist and a more powerful one for tasks that require judgment — same reason you don't pay a consultant to file paperwork."

The one gap: the CONCEPT section doesn't mention cost numbers. A client will ask "how much cheaper?" The RUN DATA section has the answer ($0.04 vs $0.27), but those sections may be read separately. Adding one sentence to the MODEL ROUTING concept would close it:

> **Rewrite addition:** "In practice this means audit-style tasks can run at roughly one-sixth the cost of research tasks, without any reduction in finding quality — because the quality ceiling for checklist work is set by the rubric, not the model."

---

## 6. FLAGS

### Quality: Did Haiku handle the task as well as Sonnet would have?

Yes, for this task type. The findings were specific, correctly line-referenced, and the PRIORITY FINDINGS section correctly ranked the most impactful issues. The CRITICAL finding (missing API key validation) is genuinely the right top pick. No obvious misses compared to what a Sonnet run would likely surface.

One subtle difference: Haiku's findings were slightly more mechanical ("should be configurable via env var") and less nuanced than Sonnet tends to be. Sonnet might have noted *why* each hardcoded value is risky in context (e.g., audit log path on read-only filesystems). Haiku flags the pattern without always explaining the consequence. Acceptable for a first-pass audit; not sufficient for a final security review of production code.

### Hook type signature

No TypeScript errors. The correct types — `HookInput`, `HookJSONOutput`, `PostToolUseHookInput` — are all exported from `@anthropic-ai/claude-agent-sdk`. Returning `{ continue: true }` satisfies `HookJSONOutput` (which is `AsyncHookJSONOutput | SyncHookJSONOutput`).

**What broke in the first attempt:** Using `options.hooks` as a nested object with tool names as keys and JS functions as values. The SDK accepted this without a TypeScript error (the field is loosely typed for the command/prompt hook shape), but the callbacks never fired. The programmatic callback API lives under `HookCallbackMatcher[]` per event name, not as a key-value map of tool names to functions.

### ToolSearch turn

No — this run did not trigger a `ToolSearch` turn. The allowed tools (`Glob`, `Grep`, `Read`) are built-in and always available. `ToolSearch` only appeared in Project 2 because `WebSearch`/`WebFetch` are deferred tools that require schema loading before first use.

### Tools outside allowedTools

None attempted. The agent stayed strictly within Glob → Read, as expected.

### Findings worth actually fixing

Two are worth acting on immediately:
1. **Missing API key validation** in `src/shared/config.ts` — a one-liner that saves confusing SDK error messages.
2. **Bare catch in `loadSession`** in `src/shared/utils.ts` — should check `(err as NodeJS.ErrnoException).code === 'ENOENT'` and only suppress that; rethrow everything else.
