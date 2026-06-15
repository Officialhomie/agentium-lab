# Project 2 — Web Research Summarizer

## 1. CONCEPT

### systemPrompt vs the task prompt

Every `query()` call accepts two distinct text inputs: `systemPrompt` and `prompt`.

**`systemPrompt`** is the standing instruction. It is injected before the conversation begins and stays in effect for every turn of the session. Use it to define the agent's *role* (who it is), its *output format* (what structure the final answer must have), and its *epistemic rules* (how it should handle uncertainty). Because it persists, it shapes behavior passively — you set it once and forget it.

**`prompt`** is the task instruction. It is the user message that kicks off the run — the *what to do right now*. It is specific to one invocation and drives the work.

The separation matters because mixing them conflates two different concerns. If you put output-format instructions in the prompt, every future caller has to remember to include them. Put them in `systemPrompt` and they apply automatically, freeing the prompt to stay focused on the actual task.

In this project: `systemPrompt` sets the analyst persona and mandates the SUMMARY / KEY POINTS / SOURCES USED structure. The `prompt` tells the agent what topic to research and how many searches to run.

---

### WebSearch vs WebFetch

**`WebSearch`** issues a query to a search engine and gets back a list of results: titles, snippets, and URLs. It is fast and cheap. Use it to *discover* — to find out what exists before committing to reading anything.

**`WebFetch`** downloads and reads the full content of a specific URL. It is slower and returns much more data. Use it to *read* — once a search has surfaced a page worth examining in detail.

The agent decides the boundary. It runs searches first, evaluates which URLs look most relevant from their titles and snippets, then fetches only those. You do not script this decision — the agent makes it autonomously each run.

---

### Autonomous multi-step reasoning

The prompt in this project describes a goal and a loose procedure ("run 2–3 searches, fetch 1–2 pages, synthesize"). It does not tell the agent exactly what queries to use, which URLs to fetch, or when to stop gathering data.

The agent decides all of that. Each turn, it chooses its next tool call based on what the previous turn returned. When it judges it has enough information, it stops calling tools and writes the final answer. This self-directed loop — `query()` yielding message after message until the agent closes with a text result — is what "agentic" means in practice.

---

## 2. IMPLEMENTATION

| Concept | Location in `src/project2_researcher.ts` |
|---|---|
| `systemPrompt` definition | `const systemPrompt = "You are a research analyst..."` (line 33–36) |
| `systemPrompt` passed to SDK | `options: { ..., systemPrompt }` (line 58) |
| Task prompt separate from system | `const prompt = \`Research the following topic...\`` (line 38–44) |
| WebSearch + WebFetch scoped | `allowedTools: ["WebSearch", "WebFetch"]` (line 57) |
| Autonomous loop | `for await (const message of query(...))` (line 63) — agent decides turns |
| Final result extraction | `if (message.type === "result" && subtype === "success")` (lines 68–75) |
| `=== FINAL REPORT ===` header | `console.log("\n=== FINAL REPORT ===\n")` (line 79) |
| Teaching comment block | Top-of-file JSDoc, lines 1–27 |

The `allowedTools` array is the only hard constraint. The agent cannot call `Bash`, `Read`, or anything else — only search and fetch. This enforces the read-only, web-only contract without requiring any runtime checks in your code.

---

## 3. RUN DATA

| Metric | Value |
|---|---|
| Turns used | 7 of 15 |
| Cost | $0.2675 |
| WebSearch calls | 3 |
| WebFetch calls | 2 |
| `maxTurns` headroom | 8 turns unused |

**Search queries the agent chose (inferred from message sequence):**
1. "Base ecosystem updates June 2026"
2. A second query targeting DeFi or TVL data
3. A third query targeting partnerships or protocol news

**Pages fetched:**
1. KuCoin — Base chain project development summary
2. Fensory Intelligence — Base Network TVL surge March 2026

**Topics surfaced:**
- TVL surge to $7.8B (23% weekly gain, March 2026)
- Base's ~46.6% share of all L2 DeFi TVL
- Institutional lending markets with KYC requirements
- Aave V3 deployment ($890M deposits in 72 hours)
- Potential native token speculation (Polymarket: 69% odds by Dec 2026)
- Mesh payments partnership (June 2, 2026 — the only directly June-dated item found)
- SocialFi, AI agents, and cross-chain liquidity developments

**Note on `maxTurns`:** 15 was appropriate. The agent used 7 turns — the extra headroom caused no cost overhead, just unused capacity. For a heavier research topic (10+ searches, 5+ fetches), 15 would be the right floor.

---

## 4. SELF-ASSESSMENT

**Would someone reading only this file understand `systemPrompt` and the WebSearch/WebFetch distinction without reading the code?**

Mostly yes, but one gap: the CONCEPT section explains the *theory* of the WebSearch → WebFetch pipeline, but does not show a concrete example of what the agent actually decides. A reader might still wonder: does the agent always run searches before fetches? Can it interleave them? What if search results are thin?

**Rewrite of the weak part:**

> The agent's tool-call sequence this run was: `WebSearch` → `WebSearch` → `WebSearch` → `WebFetch` → `WebFetch` → final text. That ordering is not scripted — it emerged from the agent's reasoning. Had the first search returned a directly useful URL, it might have fetched immediately. Had the fetched pages been thin, it might have run a fourth search. The for-await loop keeps running until the agent decides it is done; your code adds no logic to that decision.

---

## 5. FLAGS

### Sourcing concerns

- **Most data is from March 2026, not June 2026.** The agent correctly flagged this with an uncertainty note in its output. The TVL surge ($7.8B, 23% weekly), Aave deposit figures ($890M), and memecoin activity ($300M) are all March 2026 data, not June-specific. Treat these as directional, not current.
- **The Fensory Intelligence domain** (`fensory.com`) is not a widely recognized publication. Figures sourced from it (TVL, revenue share) should be cross-checked against The Block, DeFiLlama, or Dune before being cited.
- **Polymarket probability figures** are market odds, not forecasts. The agent correctly presented them as speculation, but the 23% / 69% split should be verified against current Polymarket data if used.

### Unexpected behaviours

- The agent called `ToolSearch` as its first turn — a meta-call to load the WebSearch/WebFetch schemas before invoking them. This is SDK internal behaviour (deferred tool loading) and not something your code triggered. It consumed one turn.
- `maxTurns: 15` was set based on Project 1 needing 9 turns, but this run finished in 7. The two-tool constraint (no Glob/Read) makes the loop shorter. For web research tasks, 10 would be a reasonable floor, 15 a safe ceiling.
- `ToolSearch` appearing in the stream as an `assistant` → `tool_use` → `user` → `tool_result` cycle means one of your 15 turns is spent on schema loading, not research. Effectively this agent has 14 research turns available.

### Verify against current docs

- `systemPrompt` as a key in `ClaudeAgentOptions` should be confirmed against the `@anthropic-ai/claude-agent-sdk` changelog — field names can change between minor versions.
- The `Extract<SDKMessage, { type: "result"; subtype: "success" }>` pattern for narrowing the result type works but is verbose; check if the SDK exports a named `ResultMessage` type that would be cleaner.
