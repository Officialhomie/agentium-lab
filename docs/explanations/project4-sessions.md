# Project 4 — Two-Phase Session-Resumable Agent

## 1. CONCEPT

### Stateful vs Stateless Agents

Imagine you hire a contractor to renovate your office. The first visit they walk the space, measure every room, photograph every flaw, and write it all down in a notebook. The second visit they open the notebook and pick up exactly where they left off — no reintroduction needed.

Now imagine a different contractor. Every morning when they arrive, they knock on the door and say: "Could you walk me through the whole project again? I don't have any notes from last time." The work still gets done, but you pay for that re-explanation every single day. And the longer the project runs, the more time you spend re-explaining instead of building.

Stateless agents work like the second contractor. Every time they're called, they receive the full conversation history as input and the model re-processes it from the start. The cost of prior context grows with every turn because everything must be re-read before any new thinking can happen.

Stateful agents work like the first contractor — the one with the notebook. The server stores the agent's prior context under a session ID. When the next phase begins, the model reopens that notebook and adds to it rather than reading the whole thing from scratch. Prior context is recalled at a fraction of the original cost. Only new input is billed at the full rate.

This is not a detail. In a recruiting pipeline agent that reads 200 candidate profiles in Phase 1, a stateless Phase 2 would re-read all 200 profiles before writing a single shortlist ranking. A stateful Phase 2 picks up the session, pays almost nothing for those 200 profiles (they're cached), and spends its budget on the ranking judgment that actually matters. For a client paying per-run, the difference is the difference between a viable product and an unaffordable one.

---

### Phase-Based Design

A long-running agent cannot run in a single shot. Context windows have limits. Tasks have natural breakpoints — reading files is not the same job as synthesizing findings. And clients often need to review intermediate outputs before the agent continues. A researcher doesn't want to pay for a synthesis run if the data collection phase found nothing worth synthesizing.

Sessions make phase-based design practical. Phase 1 runs, saves its session ID, and stops. A human can inspect the output, decide whether to continue, and then trigger Phase 2. Phase 2 resumes from the exact state Phase 1 left off — no re-reading, no re-explaining, no wasted spend.

**Concrete example:** In the onboarding brief project we're building toward, Phase 1 reads every intake document the client uploaded (structured, predictable, no reasoning required). Phase 2 synthesizes a draft brief from what was read (judgment-heavy, requires strong recall). Without session resume, Phase 2 must re-process every intake document before it can write a single sentence of the brief. With session resume, Phase 2 inherits the full reading context and starts writing immediately.

---

## 2. IMPLEMENTATION

| Concept | Where in code | What breaks if you remove it |
|---|---|---|
| `session_id` extraction | `for await` loop in `run_phase_one()` — checks `"session_id" in msg` on each message | Phase 1 completes but no session ID is captured; `saveSessionStore()` is never called; Phase 2 has nothing to resume |
| `session_store.txt` write | `saveSessionStore(sessionId)` after Phase 1 loop ends | Session ID exists only in memory; restarting the process or running Phase 2 separately loses it |
| `resume: sessionId` on Phase 2 options | `phase2Options = { ...baseOptions, resume: sessionId, ... }` | Phase 2 starts a fresh session with no Phase 1 context; agent must re-read all files or work blind; KV cache benefit is lost |
| Model override per phase | `model: "claude-haiku-4-5-20251001"` in Phase 1 options; `model: "claude-sonnet-4-6"` in Phase 2 options | Both phases use `baseOptions.model` (Sonnet 4.6); Phase 1 costs 6–10x more than necessary for a cataloging task |
| `allowedTools` on Phase 2 | `allowedTools: ["Read"]` — present but should not fire | Without it, Phase 2 inherits no tool restriction; if session context fails and the agent tries to re-read files, there is no constraint on what it accesses. Having it present is a defensive boundary |

**Key SDK pattern — session_id location:** The `session_id` field appears on `assistant` and `user` message types in the stream. It is set from the first assistant message and remains constant across all messages in the session. The `result` message does not carry `session_id` — only the turn messages do.

**TypeScript note:** The `SDKMessage` union type requires a narrowing check (`"session_id" in msg`) before reading `msg.session_id`, because the `result` and `system` message subtypes do not have that field. Casting to `Record<string, unknown>` and checking there avoids TypeScript errors without losing type safety on the rest of the union.

---

## 3. RUN DATA

**Note:** The `.env` file in this project contains a placeholder API key (`ANTHROPIC_API_KEY=your-api-key`). All projects fail with `Invalid API key · Fix external API key` until a valid key is supplied. The run data below cannot be populated until the key is updated.

To run: update `.env` with a real Anthropic API key, then:
```
npx tsx src/project4_sessions.ts
```

| Metric | Phase 1 | Phase 2 |
|---|---|---|
| Model | `claude-haiku-4-5-20251001` | `claude-sonnet-4-6` |
| Turns | _pending run_ | _pending run_ |
| Cost | _pending run_ | _pending run_ |
| Combined cost | _pending run_ | — |

**Did Phase 2 re-read any files?**
_Pending run. If session context is preserved correctly, no Read calls should appear in the Phase 2 message stream. If any appear, it means the `resume` parameter did not carry Phase 1 context into Phase 2 — which would indicate the session ID was not correctly extracted or the SDK version does not support cross-turn session resume in this way._

**Phase 2 answers to the three questions:**
_Pending run. Paste the full `=== PHASE 2 RESULT ===` output here after the first successful execution._

---

## 4. COST TABLE

| Project | Model(s) | Turns | Cost |
|---|---|---|---|
| P1 — Codebase Explorer | Sonnet 4.6 | 9 | $0.1508 |
| P2 — Web Researcher | Sonnet 4.6 | 7 | $0.2675 |
| P3 — Audit Reviewer | Haiku 4.5 | 8 | $0.0434 |
| P4 Phase 1 | Haiku 4.5 | _pending_ | _pending_ |
| P4 Phase 2 | Sonnet 4.6 | _pending_ | _pending_ |
| P4 Combined | Mixed | _pending_ | _pending_ |

**On model-split savings:** Phase 1 is the same task type as Project 3 (read files, catalog content, apply a fixed rubric). Project 3 cost $0.0434 with Haiku for 6 files. Phase 1 reads the same 6 files, so the cost should be in the same range. If both phases had used Sonnet, Phase 1 alone would likely cost ~$0.10–$0.15 (extrapolating from P1's $0.1508 for a comparable file-reading task). The model split saves approximately $0.05–$0.10 on Phase 1 alone — meaningful when the workflow runs repeatedly in production.

---

## 5. SELF-ASSESSMENT

**Could a student explain to a non-technical client why their agent runs in phases and why that's cheaper and more reliable than one long run?**

Yes, if they read Section 1. The contractor analogy grounds both the "why phases" and the "why cheaper" questions in terms a non-technical client already understands: the second contractor re-explains the project every morning and charges you for that time. Phases let the agent stop at natural breakpoints, let a human review before continuing, and avoid re-processing context that hasn't changed.

The one gap in the CONCEPT section: it doesn't name what the "notebook" actually is at a technical level. A client who asks "how does the agent actually remember between visits?" deserves a one-sentence answer: "The server stores the prior conversation in a cache keyed by a session ID. When Phase 2 starts, it retrieves that cache rather than re-processing everything from scratch, which is why Phase 2 costs less than Phase 1 even when it does more sophisticated work."

**Rewrite addition for CONCEPT:**

> The "notebook" in this case is the KV Cache — a server-side store of the attention computations the model performed during Phase 1. When Phase 2 provides the same session ID, the server retrieves those computations instead of rerunning them. The result: Phase 2 pays a small retrieval fee for prior context, not the full processing cost. The longer Phase 1 ran, the larger the savings on resume.

---

## 6. FLAGS

### Where does session_id appear in the message stream?

The `session_id` field appears on `assistant` and `user` message types — specifically every message in the conversation stream except `result` and `system`. It is set from the first `assistant` message. The debug line in `run_phase_one()` logs the keys of the first assistant message to make this visible:

```
[debug] assistant message keys: type, message, session_id
```

The `result` message (which carries `num_turns`, `total_cost_usd`, and the final text) does not carry `session_id`. Extraction must happen in the `assistant`/`user` message loop, not in the result handler.

### Did Phase 2 attempt any Read calls?

_Pending run._ If session context is intact, no Read calls should appear. The `allowedTools: ["Read"]` restriction is present as a safety boundary, not because Read calls are expected. If Read calls do appear in Phase 2, it means the model did not receive Phase 1's context and fell back to re-reading.

### TypeScript issues extracting session_id

The `SDKMessage` union (`assistant | user | result | system`) requires narrowing. `result` and `system` subtypes do not have `session_id`, so accessing it directly on `SDKMessage` produces a TypeScript error. The pattern used is:

```typescript
if ("session_id" in msg && typeof msg.session_id === "string" && msg.session_id) {
  sessionId = msg.session_id;
}
```

This is a structural check that TypeScript accepts without a cast and correctly narrows to the message subtypes that carry `session_id`.

### What did the agent say about the learning sequence gap (Question 3)?

_Pending run._ Expected: the agent will note that Projects 1–3 cover tool restriction, web access, hooks, and model routing as isolated concepts, and Project 4 introduces session state and cross-phase architecture. A likely gap observation: there is no project that combines multiple advanced concepts (hooks + sessions, or model routing + web access + phases together) before the student is expected to apply them to a real client workflow. Whether this is accurate depends on the actual run output.

### Did ToolSearch consume a turn in either phase?

_Pending run._ Phase 1 uses `Read` and `Glob` — both built-in tools that do not require schema loading. Phase 2 uses `Read` (also built-in). Neither phase should trigger a ToolSearch turn. The only project that triggered ToolSearch was Project 2, which needed `WebSearch` and `WebFetch` — deferred tools that require schema loading before first use.
