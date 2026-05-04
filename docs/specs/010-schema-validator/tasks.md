# 010 — Schema validator (frontmatter por tipo) — tasks

> Convenção: `[Tnnn] [P?] descrição → AC#N`
> `[P]` = pode rodar em paralelo com tasks vizinhas marcadas `[P]` (arquivos distintos, sem dependência).

## Mapa de cobertura

| AC | Tasks |
|----|-------|
| AC#1 | T004, T006 |
| AC#2 | T007 |
| AC#3 | T008, T009, T010, T011 |
| AC#4 | T012 |
| AC#5 | T013 |
| AC#6 | T014 |
| AC#7 | T015 |
| AC#8 | T016 |
| AC#9 | T017 |
| AC#10 | T018 |
| AC#11 | T019 |
| AC#12 | T020 |
| AC#13 | T021 |
| AC#14 | T023 |
| AC#15 | T024 |
| AC#16 | T026 |
| AC#17 | T028 |

## Phase 1 — Setup
- [x] T001 Atualizar frontmatter de `docs/specs/010-schema-validator/spec.md`: `status: active`, `updated_at: 2026-05-03`, preencher `branch: "010-schema-validator"` ao criar a branch de implementação.
- [x] T002 Criar branch git `010-schema-validator` a partir de `main` (sem hard deps; recomendado após 003+006).
- [x] T003 `npm install zod` (adicionar a `dependencies` em `package.json`); rodar `npm run typecheck` para confirmar instalação.

## Phase 2 — Application — Schemas zod
- [x] T004 Criar `src/main/application/schemas/common.ts` com helpers `slugSchema` (regex ADR-21), `versionSchema` (regex semver loose), `descriptionSchema` (1-1024), `scopesSchema` (array enum, ≥1, sem duplicatas), `tagsSchema` (array regex `^[a-z0-9-]+$`, opcional), `isoDatetimeSchema`. Exportar tipos via `z.infer`. → AC#1, AC#3
- [x] T005 [P] Criar `src/main/application/schemas/skill.ts`, `reference.ts`, `agent.ts`, `global-instruction.ts` montando o objeto por type a partir dos helpers em `common.ts`. `reference.ts` adiciona `includeInCopilotInstructions: boolean.optional()`. `global-instruction.ts` restringe `slug` a enum `["claude","copilot"]` e `scopes` a `z.tuple([z.literal("personal")])`. → AC#3, AC#9, AC#10

## Phase 3 — Application — `SchemaValidator`
- [x] T006 Criar `src/main/application/services/schema-validator.ts` com `class SchemaValidator { validate(frontmatter): ValidationResult }`. Stub inicial lança `not implemented`. Exportar tipos `ValidationResult`, `ValidationError`. → AC#1, AC#2
- [x] T007 RED `tests/main/application/services/__tests__/schema-validator.shape.test.ts`: `validate(validFrontmatter)` devolve `{ ok: true }`; `validate(invalidFrontmatter)` devolve `{ ok: false, errors: ValidationError[] }`; cada `ValidationError` tem `{ path: string, kind: string, message: string }`. → AC#2
- [x] T008 RED `tests/main/application/services/__tests__/schema-validator.skill.test.ts`: frontmatter válido completo de skill → `ok: true`. → AC#3, AC#4
- [x] T009 RED `tests/main/application/services/__tests__/schema-validator.reference.test.ts`: frontmatter válido de reference (com e sem `includeInCopilotInstructions`) → `ok: true`. → AC#3, AC#4
- [x] T010 RED `tests/main/application/services/__tests__/schema-validator.agent.test.ts`: frontmatter válido de agent → `ok: true`. → AC#3, AC#4
- [x] T011 RED `tests/main/application/services/__tests__/schema-validator.global-instruction.test.ts`: frontmatter válido de global-instruction (`slug: "claude"`, `scopes: ["personal"]`) → `ok: true`. → AC#3, AC#4
- [x] T012 GREEN implementar `validate()`: switch por `frontmatter.type` → roda o schema zod correspondente; mapeia `ZodError.issues` para `ValidationError[]` com `path` em formato JSONPath-lite (ex.: `frontmatter.scopes[0]`); kind derivado do `issue.code` (`required`, `format`, `max-length`, `min-length`, `enum`, etc.). → AC#3, AC#4
- [x] T013 RED `tests/main/application/services/__tests__/schema-validator.required.test.ts`: cada field obrigatório (`slug`, `name`, `type`, `description`, `scopes`, `version`, `createdAt`, `updatedAt`) ausente → erro com `kind: "required"` em `path: "frontmatter.<field>"`. Parametrizado. → AC#5
- [x] T014 RED `tests/main/application/services/__tests__/schema-validator.slug-format.test.ts`: `slug: "Invalid Slug"` (espaços/maiúsculas) → `kind: "format"` em `frontmatter.slug`. → AC#6
- [x] T015 RED `tests/main/application/services/__tests__/schema-validator.description-length.test.ts`: `description.length > 1024` → `kind: "max-length"`; `description === ""` → `kind: "min-length"`. Parametrizado por type. → AC#7
- [x] T016 RED `tests/main/application/services/__tests__/schema-validator.scopes.test.ts`: `scopes: []` → `kind: "min-items"`; `scopes: ["personal","personal"]` → `kind: "unique"`; `scopes: ["invalid"]` → `kind: "enum"`. → AC#8
- [x] T017 RED `tests/main/application/services/__tests__/schema-validator.global-instruction-slug.test.ts`: `type: "global-instruction"`, `slug: "openai"` → `kind: "enum"` em `frontmatter.slug`. → AC#9
- [x] T018 RED `tests/main/application/services/__tests__/schema-validator.global-instruction-scopes.test.ts`: `type: "global-instruction"`, `scopes: ["personal","project"]` → `kind: "exact"` ou `kind: "enum"` em `frontmatter.scopes`. → AC#10
- [x] T019 RED `tests/main/application/services/__tests__/schema-validator.version.test.ts`: `version: "1.0"` → `kind: "format"` em `frontmatter.version`; `version: "1.2.3-rc.1"` → `ok: true`. → AC#11
- [x] T020 RED `tests/main/application/services/__tests__/schema-validator.include-flag.test.ts`: `type: "skill"` com `includeInCopilotInstructions: false` (presente) → `kind: "not-allowed"` em `frontmatter.includeInCopilotInstructions`; idem para `agent` e `global-instruction`. → AC#12
- [x] T021 RED `tests/main/application/services/__tests__/schema-validator.unknown-fields.test.ts`: frontmatter válido + `author: "x"` (campo desconhecido) → `validate()` devolve `ok: true`; o campo `author` é mantido no shape devolvido (lax). → AC#13

## Phase 4 — Application — `ArtifactService` integration
- [x] T022 Atualizar `src/main/application/services/artifact-service.ts` para receber `schemaValidator: SchemaValidator` via construtor (DI). → AC#14
- [x] T023 RED `tests/main/application/services/__tests__/artifact-service.save-validation.test.ts`: `save({ artifact: invalidArtifact })` lança `DomainError({ kind: "validation", details: { errors: ValidationError[] } })`; `repo.save` (spy) **não** é chamado. → AC#14
- [x] T024 RED `tests/main/application/services/__tests__/artifact-service.save-valid.test.ts` (regressão da 003+006): `save({ artifact: validArtifact })` segue para `repo.save` normalmente e devolve `{ artifact, syncReport: SyncResult[] }`. → AC#15
- [x] T025 GREEN em `ArtifactService.save`: chamar `schemaValidator.validate(artifact.frontmatter)` antes de `repo.save`; se `ok: false`, lançar `DomainError`; senão prosseguir.

## Phase 5 — Infrastructure — Repository regression
- [x] T026 RED `tests/main/infrastructure/__tests__/fs-artifact-repository.permissive-load.test.ts`: pré-popular um artifact com frontmatter inválido (`description.length > 1024`) no FS fake; `FsArtifactRepository.list()` e `.get(id)` devolvem o artifact sem lançar; `SchemaValidator.validate` (spy) **não** é chamado. → AC#16
- [x] T027 GREEN garantir (por inspeção/code review) que `FsArtifactRepository.list/get` não importa `SchemaValidator`. Sem mudança de código se já não importa. → AC#16

## Phase 6 — Renderer
- [x] T028 [P] Atualizar `src/renderer/features/artifacts/ArtifactEditor.tsx`: ao receber `DomainError({ kind: "validation", details: { errors } })` no save, exibir toast com cabeçalho `"<N> validation error(s)"` + lista compacta `<error.path>: <error.message>` para cada item. → AC#17
- [x] T029 [P] Teste de UI `tests/renderer/features/artifacts/__tests__/artifact-editor.validation-toast.test.tsx`: salvar artifact inválido → toast aparece com pelo menos 1 erro listado. → AC#17

## Phase 7 — Verification
- [x] T030 [P] `npm run lint` passa sem warnings novos no diff. → AC#1-17
- [x] T031 [P] `npm run typecheck` passa (com tipos inferidos via `z.infer`). → AC#1-17
- [x] T032 `npm test` passa, com cobertura ≥ 90% em `src/main/application/services/schema-validator.ts` e `src/main/application/schemas/`. → AC#1-17
- [x] T033 Smoke manual em `npm run dev`: criar skill com `description` >1024 chars → save mostra toast com erro `kind: "max-length"`; corrigir → save passa. → AC#7, AC#14, AC#17
- [x] T034 Smoke manual: criar artifact com campo `author: "me"` extra no frontmatter → save funciona; campo é mantido no disco e na listagem. → AC#13

## Phase 8 — Bookkeeping (sync de docs antes de `status: done`)

> ROADMAP **não** é atualizado nesta phase — entra apenas no retro quinzenal (PRD §6 / CLAUDE.md).

- [x] T035 Reconciliar `ARCH §9`: criar/atualizar ADR registrando a escolha de `zod` como lib de validação, load-permissivo, lax para campos desconhecidos, e `description` 1-1024 uniforme. Promover ADR-27 (já cita 010 como expansão) a estado "implementado por 010" se necessário.
- [x] T036 Reconciliar `ARCH §8.4`: substituir a "proposal" + "Frontmatter debt" por descrição definitiva do schema fixado por type (ou linkar para a 010); atualizar `> Frontmatter debt:` para refletir que a 010 fechou o gap principal e listar débito pós-spike (campos type-específicos de agent, promoção a strict).
- [x] T037 Reconciliar `ARCH §5.3`: confirmar que `SchemaValidator` na tabela de Main services está descrito de forma consistente (validação por type, sync, sem I/O).
- [x] T038 Avaliar se `PRD §4` (should-have "Full schema validation of frontmatter") precisa ajuste após implementação. Registrar a decisão (PR description ou nota no spec) mesmo se for N/A.
- [x] T039 Frontmatter de `spec.md`: marcar `status: review` ao terminar Phase 7 verde; após bookkeeping completo, marcar `status: done`; atualizar `updated_at` em cada transição; preencher `branch: "010-schema-validator"`.
