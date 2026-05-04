---
id: "010"
title: Schema validator (frontmatter por tipo)
status: review
priority: later
created_at: 2026-05-03
updated_at: 2026-05-03
depends_on: []
labels: [should-have, core]
related_prd: "§4"
related_arch: "§5.3, §8.4"
branch: "010-schema-validator"
---

# 010 — Schema validator (frontmatter por tipo)

## What

Implementa o serviço `SchemaValidator` (ARCH §5.3): validação completa do frontmatter YAML dos artifacts contra um schema **por tipo** (`skill`, `reference`, `agent`, `global-instruction`). Substitui a "validação mínima" da 003 (ADR-27 — presença de obrigatórios + slug regex + `description ≤ 200`) por validação rica: campos opcionais tipados, limites por type, valores enumerados conferidos, defaults aplicados. O validator é chamado pelo `ArtifactService.save` (003) antes de gravar; falha produz `DomainError({ kind: "validation", details: [...] })`. Não automaticamente sanitiza — a 010 valida e rejeita; correção é manual no editor.

## Why

PRD §4 lista "Full schema validation of frontmatter" como should-have ("if there's time left"). ARCH §5.3 fixa o serviço como `SchemaValidator`. ADR-27 explicitamente escopo o trabalho para esta spec: a 003 entregou só o mínimo (não inviabiliza evolução), mas sem validação rica o app aceita lixo silencioso (limites do Claude/Copilot violados, campos type-específicos ausentes, valores enumerados errados). O custo é editar no app, salvar, e descobrir só no Claude/Copilot que o artifact é ignorado.

A 010 só inicia depois das must-haves validadas em ≥1 semana de uso real (PRD §4 — should-have rule). Se a implementação ultrapassar 3 dias, o trabalho é cortado e vira débito pós-spike.

## Non-goals

- **Não auto-sanitizar** valores inválidos (ARCH §5.3 fixa "Automatic sanitization" como "Does not do"). O validator rejeita; usuário corrige.
- **Não validar conteúdo** do body Markdown (só frontmatter). Validação semântica do conteúdo (ex.: header H1 obrigatório em SKILL.md) fica como débito.
- **Não migrar artifacts legacy** automaticamente (ex.: `scope` singular → `scopes` array). A 006 já cobre via `normalizeArtifactFrontmatter` no `FsArtifactRepository`. O validator opera no shape **normalizado**.
- **Não substituir a validação de `slug` regex** que a 003 já faz — reaproveita. Validator adiciona, não substitui.
- **Não cobrir validação de `settings.json`** — ADR-15 e a 002 têm regras próprias. Esta spec é só sobre frontmatter de artifacts.
- **Não criar UI de "schema explorer"** — validator é silencioso; erros aparecem no save. Editor exibe mensagens via toast/inline.
- **Não validar limites HTTP-específicos do Copilot** (ex.: token limits de instructions) — fora do escopo do app local.

## In scope

- Novo serviço `src/main/application/services/schema-validator.ts` (ou caminho equivalente conforme ADR-13) com a port:
  - `validate(frontmatter: ArtifactFrontmatter): ValidationResult` (sync — sem I/O).
  - `ValidationResult = { ok: true } | { ok: false, errors: ValidationError[] }`.
  - `ValidationError = { path: string, kind: string, message: string }` — `path` em formato JSONPath-lite (ex.: `frontmatter.scopes[0]`, `frontmatter.includeInCopilotInstructions`).
- Schema por type — fixado nesta spec (substitui a "proposal" da ARCH §8.4):
  - **Fields comuns (todos os types, sempre obrigatórios)**: `slug` (string, regex ADR-21 `^[a-z0-9][a-z0-9-]*$`), `name` (string, length ≥1), `type` (enum `skill | reference | agent | global-instruction`), `description` (string, length 1-1024 — limite uniforme alinhado com o cap conhecido do Claude para skill description; conservador para reference/agent/global), `scopes` (array de enum `personal | project`, length ≥1, sem duplicatas — semântica de Set), `version` (string, regex semver loose `^\d+\.\d+\.\d+(-[\w.-]+)?$`), `createdAt` (string, ISO 8601 datetime via `z.string().datetime()`), `updatedAt` (string, ISO 8601 datetime).
  - **`tags`** (todos os types, opcional): `array(string)`, sem limite numérico de elementos; cada tag obedece regex `^[a-z0-9-]+$` (paridade com `slug` regex e tooling tag-friendly).
  - **`includeInCopilotInstructions`** (reference-only, opcional, default `false`): `boolean`. Em `type !== "reference"` com a chave **presente** (mesmo `false`), validator rejeita com `kind: "not-allowed"`.
  - **`global-instruction` constraints** (014): `slug` deve estar em `{"claude", "copilot"}` (validator emite `kind: "enum"` em `frontmatter.slug`); `scopes` deve ser **exatamente** `["personal"]` (`kind: "exact"` em `frontmatter.scopes` para qualquer outro shape, incluindo `["personal", "project"]`).
  - **Agent type-específicos** (`target`, `model`, `tools`): nenhum campo type-específico fixado nesta spec — não existem hoje no workspace de dogfooding e ARCH §8.4 não os definiu. Quando aparecer demanda real, adicionar ao schema agent (ADR-incremento) sem release de spec separada.
  - **Campos desconhecidos**: **lax** (aceita silenciosamente, mantém na shape sem validar). Trade-off: spike-friendly — permite o usuário experimentar campos sem release de schema (ex.: `notes`, `author`); o custo é não pegar typos automaticamente. Pós-spike, considerar promoção para `additionalProperties: false` (`strict`) com alerta no editor.
- Lib de validação: **`zod`**. Rationale: TS-first (types inferidos via `z.infer<typeof schema>` eliminam duplicação entre runtime check e tipos do `Artifact`/`ArtifactFrontmatter`); API fluente; ~50KB de bundle aceitável no Electron Main; comunidade ativa. `ajv` (JSON Schema) é útil quando o schema precisa ser exposto como API/doc — não é o caso (schema vive no Main, sem consumidor externo). Custom validator dobraria esforço de implementação sem ganho.
- Integração com `ArtifactService.save` (003):
  - Antes de escrever no disco, chama `SchemaValidator.validate(artifact.frontmatter)`.
  - Se `ok: false`, lança `DomainError({ kind: "validation", details: { errors } })` — mesma forma de erro da 003 (ADR existente).
  - Save com sucesso só acontece se `ok: true`.
- Integração com `FsArtifactRepository.list/get` (003): **load-permissivo** — validator NÃO roda no `list/get`. Só roda no `ArtifactService.save`. Rationale: (a) listagem permanece tolerante a artifacts legacy/inválidos no disco (não quebra UI quando o schema evolui); (b) save garante que toda escrita nova passa pelo schema; (c) artifact legacy aberto no editor dispara validation no próximo save — usuário corrige inline. Híbrido (badge "invalid" na listagem) é UX debt sem demanda real do PRD; fica como pós-spike. Load-strict pode tornar o app inutilizável após qualquer mudança de schema.
- Erro shape padronizado: `details.errors: ValidationError[]` permite UI listar todos os problemas (não só o primeiro).
- Integração com UI: editor de artifact (003) exibe `ValidationError[]` em campos inline (cada erro próximo do field correspondente via `path`).
- Testes:
  - Unit: schema válido completo passa (`ok: true`).
  - Unit: cada field obrigatório ausente → `errors[].path` aponta para o field, `kind: "required"`.
  - Unit: `slug` com regex inválido → `kind: "format"`, mensagem clara.
  - Unit: `description` acima do limite por type → `kind: "max-length"`.
  - Unit: `scopes` vazio, com duplicatas, ou com valor fora do enum → erros específicos.
  - Unit: `includeInCopilotInstructions: true` em type não-reference → erro (após resolver clarification).
  - Unit: `global-instruction` com `slug` fora de `{"claude", "copilot"}` → erro.
  - Unit: `global-instruction` com `scopes` diferente de `["personal"]` exato → erro.
  - Unit: `version` com formato inválido → erro.
  - Unit: campos desconhecidos → comportamento conforme clarification.
  - Integração: `ArtifactService.save` com frontmatter inválido lança `DomainError({ kind: "validation" })` e **não** escreve no disco.
  - Integração: `ArtifactService.save` com frontmatter válido segue para `FsArtifactRepository.save` normalmente (regressão da 003).
  - Integração: artifacts legacy gravados antes da 010 (sem fields opcionais) — load-permissivo garante que `list`/`get` devolvem normalmente; validator só roda no save subsequente. Sem migration script (consistente com débito em ARCH §8.5 / Risks).

## Out of scope (deferred to later specs)

- Validação semântica de conteúdo (body Markdown).
- Auto-sanitização (default values, normalização).
- Validação de `settings.json` (002 tem regras próprias; ADR-15).
- Migration script para artifacts legacy (assume normalização da 006 + tolerância no load — ver clarification).
- Schema versioning (`schemaVersion` field) → débito pós-spike; ARCH §8.4 já lista como "Schema migration debt".
- UI de "schema explorer" / documentação inline dos campos.
- Validação de limites externos (Claude/Copilot) que mudam fora do controle do app — débito de monitoramento.

## Considered alternatives

| Decisão | Escolhida | Alternativas descartadas | Motivo |
|---|---|---|---|
| Onde mora a validação | **Service `SchemaValidator` injetado em `ArtifactService.save`** | (b) Inline em `ArtifactService.save`; (c) Decorator/middleware no IPC dispatcher | ARCH §5.3 já lista `SchemaValidator` como service separado. Inline acopla CRUD e validação (testes mais difíceis). Decorator no IPC esconde lógica de domínio fora da camada `application`. |
| Sanitização automática | **Não sanitizar** (rejeita) | (b) Auto-trim, lowercase em slug, normalize datetime; (c) Aplicar defaults silenciosamente | ARCH §5.3 fixa "Does not do: Automatic sanitization". Rejeitar força o usuário a confrontar erro — alinhado com ADR-21 ("rejeitar colisão força renomear conscientemente"). Sanitização silenciosa cria drift entre o que o usuário digitou e o que foi salvo. |
| Lib de validação | **`zod`** | (b) `ajv` (JSON Schema); (c) Validador custom | TS-first com types inferidos elimina duplicação runtime/static; API fluente; bundle aceitável. `ajv` compensa quando o schema precisa ser exposto externamente (não é o caso). Custom é manutenção sem ganho. |
| Roda no load? | **Load-permissivo** (validator NÃO roda em `list/get`) | (b) Load-strict; (c) Híbrido com badge "invalid" | Load-strict quebra UI ao mínimo drift de schema; híbrido é UX debt sem demanda. Permissivo + validation no save garante novas escritas válidas e não trava listagem. |
| Tratamento de campos desconhecidos | **Lax** (aceita silenciosamente, mantém na shape) | (b) Strict (`additionalProperties: false`) | Spike-friendly: usuário experimenta campos sem release. Custo: não pega typos. Pós-spike pode promover para strict com alerta. |
| Forma do erro | **`DomainError({ kind: "validation", details: { errors: ValidationError[] } })` com array** | (b) Lançar no primeiro erro, abortar; (c) Erro string concatenado | Array permite UI listar todos os problemas; abortar no primeiro forçaria múltiplos saves. Concatenado em string perde estrutura para UI inline. |
| Schema source | **Zod schemas em TS** (`src/main/application/schemas/*.ts`) | (b) JSON Schema em arquivo (`src/main/schemas/*.json`) | Alinhado com escolha da lib. JSON Schema só compensa com consumidor externo. TS-inline gera tipos via `z.infer`. |
| `description` length | **1-1024 chars uniforme em todos os types** | (b) `≤200` por type (atual da 003); (c) Limite distinto por type | `≤200` é restritivo demais para reference/agent/global; `≤1024` é o cap conhecido do Claude para skill description e funciona como upper-bound conservador. Limite distinto adiciona complexidade sem demanda real. |
| Campos type-específicos de agent | **Nenhum por ora** | (b) Adicionar `target`/`model`/`tools` agora | Não existem em workspace de dogfooding; ARCH §8.4 não os fixou. Adicionar quando aparecer demanda real (ADR-incremento), sem release de spec. |

## Acceptance criteria

1. Existe `src/main/application/services/schema-validator.ts` (ou caminho equivalente seguindo ADR-13) exportando `SchemaValidator` com método `validate(frontmatter): ValidationResult`. Verificável por unit test.
2. `ValidationResult` tem shape `{ ok: true } | { ok: false, errors: ValidationError[] }`. `ValidationError` tem `{ path: string, kind: string, message: string }`. Verificável por type assertion + shape check.
3. Para cada type (`skill`, `reference`, `agent`, `global-instruction`), existe um zod schema em `src/main/application/schemas/` cobrindo: fields comuns (`slug`/`name`/`type`/`description`/`scopes`/`version`/`createdAt`/`updatedAt`), `tags` opcional, e (para `reference`) `includeInCopilotInstructions` opcional. Verificável por leitura de código + unit tests parametrizados por type.
4. Frontmatter completo válido para cada type passa (`{ ok: true }`). Verificável por unit test parametrizado por type.
5. Field obrigatório ausente produz `{ ok: false, errors: [{ path: "frontmatter.<field>", kind: "required", ... }] }`. Verificável por unit test parametrizado.
6. `slug` que falha o regex `^[a-z0-9][a-z0-9-]*$` (ADR-21) produz `kind: "format"` em `frontmatter.slug`.
7. `description` com `length > 1024` (limite uniforme) ou `length < 1` produz `kind: "max-length"` ou `kind: "min-length"` em `frontmatter.description`. Verificável por unit test parametrizado por type.
8. `scopes` vazio (`[]`) produz `kind: "min-items"`; `scopes` com duplicatas produz `kind: "unique"`; `scopes` com valor fora de `["personal", "project"]` produz `kind: "enum"`.
9. `type === "global-instruction"` com `slug` fora de `{"claude", "copilot"}` produz `kind: "enum"` em `frontmatter.slug` (constraint da 014).
10. `type === "global-instruction"` com `scopes !== ["personal"]` (qualquer outro shape) produz `kind: "enum"` ou `kind: "exact"` em `frontmatter.scopes` (constraint da 014).
11. `version` que falha regex semver `^\d+\.\d+\.\d+(-\w+)?$` produz `kind: "format"` em `frontmatter.version`.
12. `includeInCopilotInstructions` **presente** (qualquer valor) em `type !== "reference"` produz `{ ok: false, errors: [{ path: "frontmatter.includeInCopilotInstructions", kind: "not-allowed", ... }] }`. Verificável por unit test em `skill`, `agent`, `global-instruction`.
13. Campos desconhecidos no frontmatter (não definidos no schema do type) são **aceitos silenciosamente** (lax) e mantidos no shape devolvido pelo `ArtifactRepository`. `validate()` devolve `{ ok: true }`. Verificável por unit test que adiciona um campo arbitrário (`author: "x"`) ao frontmatter e checa `ok: true` + presença do campo após save+load.
14. `ArtifactService.save` com frontmatter inválido lança `DomainError({ kind: "validation", details: { errors: ValidationError[] } })` **antes** de chamar `FsArtifactRepository.save` (verificável por spy: repo.save não é chamado).
15. `ArtifactService.save` com frontmatter válido prossegue normalmente (regressão da 003 + 006 — `SyncResult[]` continua devolvido).
16. `FsArtifactRepository.list`/`get` é **load-permissivo**: NÃO chama `SchemaValidator.validate`. Artifacts legacy/inválidos no disco são devolvidos normalmente (regressão da 003 — listagem permanece intocada). Validator só roda no `ArtifactService.save`. Verificável por unit test que pré-popula um artifact com frontmatter inválido (e.g., `description` >1024 chars) e checa que `list()` o devolve sem lançar.
17. UI editor exibe `errors` no toast pós-save (mínimo viável); inline por field é débito UI separado.

## Risks & assumptions

- **ASSUMPTION:** A 006 (`normalizeArtifactFrontmatter`) já garante que o validator recebe o shape normalizado (sem `scope` singular legacy). Se a 006 não estiver `done` ao iniciar a 010, o validator vai precisar lidar com ambos os shapes.
- **ASSUMPTION:** Nenhum artifact existente em workspace de dogfooding viola o schema fixado (fix do schema deve refletir a realidade do que já foi criado). Se violar, a 010 introduz regressão silenciosa em listagem (via clarification load-strict).
- **ASSUMPTION:** Limites do Claude/Copilot citados (skill description ≤1024, etc.) são estáveis o suficiente para o spike. Se mudarem, validator rejeita conteúdo que o tool ainda aceita (aceito como débito).
- **RISCO médio:** Lib escolhida (`zod`/`ajv`) adiciona ~50KB ao bundle do Main. Spike é desktop, sem constraint de bundle, mas ADR-11 diz "single runtime → no protocol design". Custom validator zera dependency mas dobra o esforço de implementação. Decisão via clarification.
- **RISCO médio:** Schema fix-time (decisão final dos campos por type) pode estourar o "≤3 dias" do should-have. **Mitigação:** começar com schema mínimo viável (mesma cobertura da 003 + obrigatórios da ARCH §8.4), expandir incrementalmente. Cortar campos opcionais se passar de 3 dias.
- **RISCO baixo:** Validator no load (se híbrido escolhido) requer UX para "artifact com badge invalid" — design não trivial. **Mitigação:** clarification load-permissivo (default) evita o trabalho; load-strict só se aparecer demanda real.
- **DEBT consciente:** Sem `schemaVersion` field — quando o schema mudar (pós-spike), artifacts antigos podem virar inválidos sem migration. ARCH §8.5 já registra "Schema migration debt"; a 010 herda o mesmo débito para frontmatter de artifacts.
- **DEBT consciente:** Sem auto-sanitização — usuário com typo em `version: "1.0"` (faltando patch) precisa corrigir manualmente. UX subótima, mas alinhada com decisão arquitetural.

## References

- [PRD.md §4](../../PRD.md) — should-have "Full schema validation of frontmatter".
- [ARCH.md §5.3](../../ARCH.md) — `SchemaValidator` na tabela de Main services; "Does not do: Automatic sanitization".
- [ARCH.md §8.4](../../ARCH.md) — Data model — YAML frontmatter (proposal); "Frontmatter debt — refine after dogfooding".
- [ARCH.md §8.5](../../ARCH.md) — "Schema migration debt" para `settings.json` (referência de pattern).
- [ARCH.md §9 ADR-21](../../ARCH.md) — Slug regex `^[a-z0-9][a-z0-9-]*$`.
- [ARCH.md §9 ADR-27](../../ARCH.md) — "Validação mínima no save"; explicitamente cita 010 como expansão.
- [ARCH.md §9 ADR-30](../../ARCH.md) — `Artifact.frontmatter.scopes: ArtifactScope[]` (sempre ≥1).
- [Spec 003](../003-artifact-crud/spec.md) — `ArtifactService.save` com validação mínima da 003.
- [Spec 006](../006-multi-scope-artifacts/spec.md) — `normalizeArtifactFrontmatter`; shape normalizado.
- [Spec 014](../014-global-instructions/spec.md) — constraints `slug ∈ {claude, copilot}`, `scopes === ["personal"]`.
- ROADMAP — `010-schema-validator` em "Later → Should-have".
- [zod](https://zod.dev/) — opção de lib (clarification).
- [ajv](https://ajv.js.org/) — opção de lib (clarification).
