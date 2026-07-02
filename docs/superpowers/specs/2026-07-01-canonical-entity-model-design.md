# Canonical Entity Model — Design

- **Date:** 2026-07-01
- **Status:** Approved (design) — grounded in a cross-tool research sweep (Claude Code, Cursor, Windsurf, GitHub Copilot, OpenAI Codex CLI, Zed, Cody, Aider, Continue.dev, AGENTS.md standard) verified against official docs, mid-2026. Pending an implementation plan.
- **Author:** Odenir Gomes (with Claude)
- **Scope:** Replace the polymorphic `Customization` model with a tool-agnostic **`Entity`** contract plus concrete per-entity types (`Skill`, `Agent`, `Mcp`, `Instruction`, `Hook`) and a **serializer-per-tool** layer. The goal is *a common representation for working with AI*: every AI-tool integration and every entity follows one uniform pattern, so adding a tool (Cursor, Windsurf, …) or reasoning about an entity is always the same mental model.

> Written in English to match the existing `docs/reference/*.md` and `docs/superpowers/specs/*.md`
> convention. The brainstorming conversation that produced it was in pt-BR.

> **Supersedes** the model portions of `2026-07-01-cursor-adapter-design.md`: the Cursor adapter
> becomes a consumer of this model (Phase 2 below) and its `Customization` references must be
> updated to `Entity`.

---

## 1. Context and goal

Today the app models skills/agents/commands/global-instructions as one polymorphic `Customization`
(`{ id, frontmatter, body }`) whose frontmatter schema **is** the Claude on-disk format — the domain
model is coupled to one tool's file format. Hooks and MCP live *outside* that model as special
services (hook → `.claude/settings.json`; MCP → live-config broker over `~/.claude.json` / `.mcp.json`).

This refactor establishes **one canonical, tool-agnostic representation** — an `Entity` contract with
concrete per-entity types — and makes **adapters into serializers** that project each entity into any
tool's format. The uniformity *is* the "common representation": one contract, one sync/health/settings
pipeline, one mental model across Claude, Cursor, and future tools.

## 2. Decisions locked during brainstorming

1. **Delete `Customization`** / `CustomizationFrontmatter` and the deprecated `customization-service`
   umbrella. They are replaced by the `Entity` contract + concrete types.
2. **Common contract is named `Entity`** (not `AiEntity`); concrete types `Skill`/`Agent`/`Mcp`/
   `Instruction`/`Hook` extend it.
3. **Every entity carries a `urn`**, format **`urn:{kind}:{id}`** (e.g. `urn:skill:code-review`,
   `urn:mcp:figma`, `urn:hook:pre-commit`). Self-describing → uniqueness is per-kind and the URN routes
   to the right serializer. It is the stable, tool-agnostic identity that ties the same entity across
   its per-tool projections.
4. **Final entity set = 5** (see §3 audit): `skill`, `agent`, `mcp`, `instruction`, `hook`.
5. **`command` is removed** → folded into `skill` with `explicitOnly` (Cursor/Claude
   `disable-model-invocation: true`). No separate UI view. Existing `commands/*.md` migrate to skills.
6. **`global-instruction` → `instruction`**, broadened: serializes to **`CLAUDE.md` + `AGENTS.md`**, and
   gains an `activation` field (`always | glob | agent-requested | manual`) that **absorbs "rule"**
   (scoped guidance) without a separate entity.
7. **`hook` stays first-class and cross-tool** (corrected after research: hooks converge across 5/7
   tools, not Claude-only).
8. **Model approach = canonical core, per-entity storage** (see §6). For `.md`-backed entities the
   workspace stays the source of truth in Claude `.md` format (symlink identity for Claude); hook/mcp
   keep their live-config-broker storage.
9. **enable/disable and scoping are emitter-side concerns**, not fields on the entity (that is where
   tools diverge most — §7).
10. **Scope = the adapter+service seam, all entities now** (skill/agent/mcp/instruction/hook), delivered
    in phases (§8). The refactor lands **before** the Cursor adapter is implemented.

## 3. Entity audit (why exactly these five)

A concept earns *canonical* status only if ≥2–3 tools model it similarly. Verified against official
docs (mid-2026):

| Entity | Cross-tool reality | Verdict |
|---|---|---|
| **skill** | `SKILL.md` open standard; neutral dir `.agents/skills/` read by Cursor/Windsurf/Copilot/Zed/Codex; most also read `.claude/skills/`. `name`+`description` the only universal fields. | **Core** |
| **command** | A skill with `disable-model-invocation: true`. Claude merged `.claude/commands/`→skills (skill wins on name clash); Cursor `/migrate-to-skills`. | **Remove → skill** |
| **agent** | File-persona agents in 5 tools (Claude/Cursor/Copilot/Codex/Continue); `.claude/agents/` is the de-facto lingua franca (Cursor + Copilot read it). Distinct from skill: *delegates* (own subagent context) vs *injects*. | **Core** |
| **mcp** | Universal (every tool has MCP config). stdio `command/args/env` + remote `url/headers`. | **Core** |
| **instruction** | Always-on guidance is universal (CLAUDE.md/AGENTS.md); scoped rules (`.mdc`/`.instructions.md`) are a distinct activation mode. | **Core** (absorbs rule via `activation`) |
| **hook** | Converges across 5/7 tools (Claude/Cursor/Windsurf/Codex/Copilot): JSON event-keyed config, JSON-on-stdin, `exit 2` = block, PreToolUse veto. Codex+Copilot adopted Claude's vocabulary; Copilot reads `.claude/settings.json`. Inert for Zed (proposal)/Continue (none). | **Core (tool-specific reach: 5/7)** |

**rule ≠ hook.** A rule is passive natural-language guidance the model *may* follow (context
injection); a hook is executable code that runs at lifecycle events and *deterministically* blocks or
rewrites tool calls (out-of-model enforcement). Rule is a sibling of `instruction`, folded in via
`activation`.

## 4. The `Entity` contract + concrete types

```ts
type EntityKind = 'skill' | 'agent' | 'mcp' | 'instruction' | 'hook';
type Scope = 'personal' | 'project';

interface Entity {
  urn: string;              // urn:{kind}:{id}
  kind: EntityKind;
  name: string;             // universal
  description: string;      // universal (drives model auto-selection for skill/agent)
  scopes: Scope[];
  metadata: {               // neutral bookkeeping + extensible
    version: string;        // NB: in SKILL.md the version lives under metadata, not top-level
    tags?: string[];
    createdAt: string;
    updatedAt: string;
  };
  ext?: Record<string, unknown>;  // per-tool fields that don't generalize (namespaced pass-through)
}

interface Skill extends Entity {
  kind: 'skill';
  content: string;                 // SKILL.md body
  explicitOnly?: boolean;          // disable-model-invocation (a "command")
  // resources: skill directory carries scripts/ references/ assets/ (symlinked, preserved)
}

interface Agent extends Entity {
  kind: 'agent';
  systemPrompt: string;            // markdown body
  model?: string;                  // + 'inherit' sentinel
  tools?: string[];                // allowlist
  deniedTools?: string[];
}

interface Mcp extends Entity {
  kind: 'mcp';
  transport: 'stdio' | 'http' | 'sse' | 'websocket';
  command?: string; args?: string[]; env?: Record<string,string>;   // stdio
  url?: string; headers?: Record<string,string>;                    // remote
  // auth normalized under ext/oauth; secrets never inlined
}

interface Instruction extends Entity {
  kind: 'instruction';
  content: string;
  activation: 'always' | 'glob' | 'agent-requested' | 'manual';
  globs?: string[];                // for activation='glob'
}

interface Hook extends Entity {
  kind: 'hook';
  event: HookEvent;                // canonical enum, mapped to per-tool names
  matcher?: string;                // '*' when absent; synthesized into event name for Windsurf
  handlerType: 'command' | 'prompt' | 'http' | 'mcp_tool' | 'agent';  // 'command' universal
  command: string;
  timeout?: number;
}
```

**Universal vs tool-specific.** Only `name` + `description` are universal across *all* entities;
each type has a small universal core (above) and a large **tool-specific tail** carried in `ext`
(e.g. skill `allowed-tools`/`paths`/`license`/`user-invocable`; agent `permissionMode`/`sandboxMode`/
`background`/`isolation`/`memory`/`color`/`handoffs`; mcp `oauth`/`enabledTools`/`startupTimeout`;
hook `statusMessage`/`failClosed`/`platformOverride`/`async`). The rule: promote a field to the core
only when ≥2 tools share it; otherwise it is namespaced pass-through in `ext`.

**Canonical `HookEvent` enum** (mapped to each tool's dialect — PascalCase Claude/Codex/Copilot,
camelCase Cursor, snake_case Windsurf): `pre_tool_use`, `post_tool_use`, `user_prompt_submit`,
`session_start`, `session_end`, `stop`, `subagent_stop`, `pre_compact`, `notification`. Everything
beyond this core is a per-tool superset carried in `ext`.

## 5. URN scheme

`urn:{kind}:{id}` where `kind ∈ EntityKind` and `id` is the entity's slug (`name`). The URN is the
primary cross-tool key: a single entity has one URN and many per-tool serializations. Uniqueness is
per-kind, so a skill and a former command can never collide (the old skill×command collision risk
disappears). The `{kind}` segment lets the sync pipeline route to the correct serializer without
inspecting the payload.

## 6. Storage model (heterogeneous, per-entity)

The contract and serializer pattern are uniform; the **store differs per entity** — this already
matches the app's reality:

| Entity | Store | Sync to Claude |
|---|---|---|
| skill / agent / instruction | **Workspace source** — `.md` in the workspace (Claude-format serialization doubles as storage) | symlink (identity) |
| hook | **Live-config broker** — `~/.claude/settings.json` / `.claude/settings.json` (`hooks` key), edited in place | in-place write (no workspace copy) |
| mcp | **Live-config broker** — `~/.claude.json`, `<repo>/.mcp.json`, `projects[path].mcpServers`, edited in place | in-place write (no workspace copy) |

The "common representation" is the **in-memory `Entity` + the serializer/sync pipeline**, not a single
storage format. Forcing hook/mcp into `.md` would be wrong — they are JSON live-config. Each entity has
its own repository/store; a `CustomizationSerializer`-style boundary (rename → `EntitySerializer`)
handles `.md`-backed entities, while hook/mcp reuse their existing broker stores.

## 7. Serializers, neutral dirs, and the emitter boundary

- **Serializer per `(entity × tool)`.** `render(entity) → file content / config patch`. The Claude
  serializer for `.md`-backed entities is identity (symlink the stored `.md`); other tools generate.
- **Write once to neutral targets where they exist.** Skills → `.agents/skills/` (read by Cursor,
  Windsurf, Copilot, Zed, Codex). Always-on instructions → `AGENTS.md`. **Claude is the holdout**
  (reads `CLAUDE.md`, not `AGENTS.md`), so `instruction` always also emits `CLAUDE.md`.
- **Instruction format split by activation:** `always` → plain markdown (`CLAUDE.md`/`AGENTS.md`, no
  frontmatter); `glob`/`agent-requested`/`manual` → frontmatter-bearing (`.cursor/rules/*.mdc`,
  `.github/instructions/*.instructions.md`). Never conflate the two (AGENTS.md rejects frontmatter;
  `.mdc` requires it).
- **enable/disable + scoping are emitter-side, not entity fields.** MCP proved this: tools disagree
  most here (`enabledMcpjsonServers` arrays vs per-server `enabled` bool vs UI-only). Model them as a
  separate settings surface the emitter consults.
- **The global-instruction wall:** Cursor User Rules and Copilot Personal Instructions are UI-only
  (no file) — a symlink/file app cannot write them. Personal-scope always-on instructions can only be
  materialized per-project (`.cursor/rules` `alwaysApply`, `.github/copilot-instructions.md`) or set
  by hand in each tool's UI. (This is the same wall documented in the Cursor adapter spec.)

## 8. Sequencing (too large for one PR)

Each phase is an independent, green, mergeable slice.

1. **Phase 0 — `Entity` core + `.md` entities.** Introduce `Entity` + `Skill`/`Agent`/`Instruction`;
   delete `Customization`/`CustomizationFrontmatter`/`customization-service`; migrate the three
   `.md`-backed entities to canonical (Claude serializer = identity/symlink). Fold **command → skill**
   (`explicitOnly`), migrating `commands/<name>.md` → `skills/<name>/SKILL.md`. Reshape
   **global-instruction → instruction** with `activation` (+ `AGENTS.md` emission). Renderer ripple
   (`c.frontmatter.name` → `c.name`, `c.body` → `c.content`) is mechanical/compiler-guided.
2. **Phase 1 — hook + mcp under the contract.** Wrap the existing hook/mcp broker services so they
   expose `Hook`/`Mcp` `Entity` types and participate in the same list/health/sync pipeline, keeping
   their in-place storage.
3. **Phase 2 — Cursor serializer (+ others).** Implement the Cursor serializers (the original goal),
   targeting native `.cursor/` and neutral `.agents/` dirs; update
   `2026-07-01-cursor-adapter-design.md` to reference `Entity`. Extend to Windsurf/Copilot/Codex as
   desired.

## 9. Testing

- **node project:** `Entity` construction + `urn` derivation per kind; each `EntitySerializer` render
  (skill incl. `explicitOnly`; instruction `always`→CLAUDE.md/AGENTS.md and scoped→`.mdc`; agent
  body-as-system-prompt; mcp stdio+remote; hook event-name mapping across dialects); command→skill
  migration; hook/mcp broker adapters exposing `Entity`. Characterization: the existing suite pins
  behavior across the model rename.
- **jsdom project:** renderer reads canonical fields; command list merges into skills (no separate
  view); instruction activation surfaced.

## 10. Out of scope / non-goals

- No neutral on-disk storage for `.md` entities (Approach 1 kept — Claude `.md` remains the store).
- No writing Cursor User Rules / Copilot Personal Instructions (UI-only; unsyncable).
- Hook handler types beyond `command` (`prompt`/`http`/`mcp_tool`/`agent`) are pass-through in `ext`,
  not first-class in Phase 0/1.
- Zed/Continue as sync targets for hooks (they don't support hooks).

## 11. Open questions (for the plan, not blocking the design)

- Exact `ext` bag typing per tool (namespaced sub-objects vs opaque map) once the serializers are written.
- Whether `Mcp` scopes reuse `Scope` (`personal|project`) or need a third `local` value (Claude's
  per-project `projects[path]` scope) — likely modeled emitter-side.
- Migration UX for `commands/*.md` → skills (automatic on upgrade vs prompted).

## 12. Sources (cross-tool research, mid-2026)

- **Skills / SKILL.md:** agentskills.io/specification; code.claude.com/docs/en/skills; cursor.com/docs/skills; docs.devin.ai/desktop/cascade/skills; docs.github.com/en/copilot/concepts/agents/about-agent-skills; zed.dev/docs/ai/skills; developers.openai.com/codex/skills.
- **Agents / subagents:** code.claude.com/docs/en/sub-agents; cursor.com/docs/subagents; code.visualstudio.com/docs/copilot/customization/custom-chat-modes; developers.openai.com/codex/subagents; docs.continue.dev/reference.
- **Commands / prompts:** cursor.com/changelog/1-6; cursor.com/help/customization/skills (migrate-to-skills); code.visualstudio.com/docs/agent-customization/prompt-files.
- **MCP:** modelcontextprotocol.io/specification; code.claude.com/docs/en/mcp; cursor.com/docs/mcp; docs.devin.ai/desktop/cascade/mcp; code.visualstudio.com/docs/agents/reference/mcp-configuration; developers.openai.com/codex/mcp; zed.dev/docs/ai/mcp; docs.continue.dev/customize/deep-dives/mcp.
- **Rules / instructions:** code.claude.com/docs/en/memory; agents.md; cursor.com/docs/context/rules; docs.devin.ai/desktop/cascade/memories; code.visualstudio.com/docs/copilot/customization/custom-instructions; zed.dev/docs/ai/rules; developers.openai.com/codex/guides/agents-md.
- **Hooks:** code.claude.com/docs/en/hooks; cursor.com/docs/hooks; docs.devin.ai/desktop/cascade/hooks; developers.openai.com/codex/hooks; code.visualstudio.com/docs/agent-customization/hooks.
