# Modernização de UI/UX — adoção do OGS Design System

- **Data:** 2026-06-05
- **Status:** spec aprovado (aguardando revisão final do usuário antes do plano)
- **Escopo decidido:** redesign profundo (estética + IA/navegação) · troca de ícones para Lucide · entrega em **PR único** com commits encadeados
- **Fonte de verdade visual:** `OGS · Sistema de Design v1.0 (2026)` (PDF interno)

> Convenção deste documento: prosa em pt-BR; tokens, identificadores, nomes de componentes e copy de exemplo em inglês quando forem termos técnicos.

---

## 1. Objetivo e não-objetivos

### Objetivo
Trazer o `superset-ai-app` para dentro do OGS Design System: paleta, tipografia, forma, iconografia e padrões de componente on-brand, com uma arquitetura de navegação repensada (top-nav + sub-rail + command palette) e estados (vazio/carregando/erro) padronizados. Resultado: o app deixa de ser "MUI azul genérico com Roboto" e passa a parecer um produto OGS.

### Não-objetivos
- **Sem backend / IPC novos.** Esta é uma refa de camada de apresentação (`src/renderer/**` + `theme.ts` + fontes). Nenhuma mudança em `src/main/**` exceto o item de naming sinalizado em §11 (opcional/secundário).
- **Sem framework de i18n.** O app é mono-idioma (chrome PT-BR). Copy é inline; não introduzimos `react-intl`/`i18next` (YAGNI). `settings.language` é outra feature (espelho do assistente) e fica intocada.
- **Sem trocar MUI/Emotion/react-query.** O DS é aplicado *via* MUI theme + componentes compartilhados, não substituindo a stack.
- **Sem reescrever a lógica de domínio** (read-only de plugin, sync, validação Zod permanecem; a UI apenas os *expõe* melhor).

---

## 2. Princípios OGS (extraídos do DS)

1. **"Creme é o papel, tinta é o traço."** Fundo Cream, texto/traço Ink. Modo escuro inverte (canvas Ink, tinta Cream).
2. **Uma cromática por vez.** Verde/Âmbar/Azul nunca decoram juntos — cada um é um *papel semântico*: Azul = ação/link, Verde = sucesso/ativo, Âmbar = premium/atenção, Vermelho = erro. Acento neutro = Ink.
3. **Fio antes de sombra.** Superfícies usam borda hairline; sombra só em overlays (drawer, dialog, menu, command palette).
4. **Grotesca + monoespaçada.** Space Grotesk para display/títulos/UI; JetBrains Mono para rótulos, IDs e metadados — CAIXA ALTA, tracking largo.
5. **Sem emoji.** Ícones funcionais = Lucide (traço ~1.75–2px, cor Ink). Conectivo textual = middot `·`.

---

## 3. Tokens de cor

Definidos em um novo `src/renderer/tokens.ts` (valores OGS crus) e consumidos por `theme.ts`. As 6 cores OGS + 1 vermelho de sistema (o DS mostra "Vermelho · Erro" como papel semântico fora das seis cromáticas; fixamos um hex harmônico).

| Token | Light | Dark | Papel |
|---|---|---|---|
| `ink` | `#142036` | `#142036` | texto, traço, superfície escura |
| `cream` | `#F7F4EE` | `#F7F4EE` | papel claro |
| `verde` | `#119350` | `#3FB97A` | sucesso / ativo / synced |
| `ambar` | `#D9A12C` | `#E5B547` | premium / atenção |
| `azul` | `#3D5CC2` | `#5B79E0` | ação / link / indicador ativo |
| `slate` | `#7A7E89` | `#9AA0A8` | texto secundário |
| `erro` | `#C0392B` | `#E2675A` | erro (a confirmar com a marca, §13) |

### Mapeamento para a `palette` do MUI

| MUI | Light | Dark | Observação |
|---|---|---|---|
| `mode` | `light` | `dark` | |
| `primary.main` / `contrastText` | `#142036` / `#F7F4EE` | `#F2EEE5` / `#142036` | **botão filled default = Ink** (DS "Novo projeto"); inverte no dark |
| `info.main` | `#3D5CC2` | `#5B79E0` | **Azul = ação/link**; usado em links, indicador de aba/nav, botão "Publicar" (`color="info"`) |
| `success.main` | `#119350` | `#3FB97A` | synced, switch on, "Aprovar" |
| `warning.main` | `#D9A12C` | `#E5B547` | premium / não-sincronizado |
| `error.main` | `#C0392B` | `#E2675A` | |
| `secondary.main` | `#3D5CC2` | `#5B79E0` | alias de Azul para conveniência (`color="secondary"`) |
| `background.default` | `#F7F4EE` | `#0F1828` | canvas |
| `background.paper` | `#FFFFFF` | `#16223A` | cards/superfícies |
| `text.primary` | `#142036` | `#F2EEE5` | |
| `text.secondary` | `#5A6573` | `#9AA0A8` | |
| `divider` | `rgba(20,32,54,0.11)` | `rgba(255,255,255,0.08)` | hairline |

Tokens de superfície extras (fora da `palette`, expostos via `theme` custom ou constantes): `railSurface` (light `#F2EEE5` / dark `#142036`), `inputSurface` (light `#FBFAF6` / dark `#16223A`).

> **Correção consciente:** a versão inicial do brainstorm cogitou `primary = Azul`. O DS coloca **Ink** como botão primário e Azul como acento de ação — então `primary = Ink`. Consequência: todos os `<Button variant="contained">` atuais passam a ser Ink (intencional e on-brand). Emphasis azul vira `color="info"`.

---

## 4. Tipografia

- **Fontes:** adicionar `@fontsource/space-grotesk` (400/500/600/700) e `@fontsource/jetbrains-mono` (400/500/600); **remover** os três imports `@fontsource/roboto` em `src/renderer/main.tsx:5-7` e a dependência `@fontsource/roboto` do `package.json`.
- `typography.fontFamily` → `'"Space Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'`.
- Família mono (token) → `'"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace'` (o editor já usa isso no textarea — `CustomizationEditor.tsx:263` — agora vira token compartilhado).

| Variante | Tamanho/peso | Tracking |
|---|---|---|
| `h1` | 42 / 600 | -0.02em |
| `h2` | 32 / 600 | -0.02em |
| `h3` | 20 / 600 | -0.01em |
| `h4` (título de tela) | 26 / 600 | -0.02em |
| `h6` (título de card) | 1.0rem / 600 | — |
| `body1` | 16 / 400 | — |
| `body2` | 14 / 400 | — |
| `button` | 500 | textTransform: none (mantém) |
| **`kicker`** (novo, via componente) | mono 10–11 / 500 | uppercase, .20em, cor slate |

A única caixa-alta do app é **kicker** e **status pill** — ambos mono, tracking largo. Títulos e botões nunca em caixa-alta.

---

## 5. Forma, espaçamento e elevação

- **Raios** (token `radius`): `xs 6 · sm 10 · md 14 (default) · lg 20 · pill 999`. `shape.borderRadius = 14`. Botões/inputs usam `sm/md`; cards `md`; pills `pill`.
- **Espaçamento:** **mantemos a unidade MUI de 8px** (já múltiplo da base 4px do DS) para evitar churn massivo de todos os `sx={{ p: n }}` existentes. O guia 4/8/12/16/24/32/48/64 fica documentado; valores ímpares (4, 12) via `.5`/`1.5`. *(Trade-off: não alteramos `spacing` factor — mexer nisso reescreveria silenciosamente todo espaçamento atual.)*
- **Elevação ("fio antes de sombra"):** superfícies = `variant="outlined"` (borda hairline), sem sombra. Sombras (`shadow.sm/md/lg`) reservadas a overlays. `MuiPaper` mantém `backgroundImage: none`.

---

## 6. Iconografia — migração para Lucide

- **Nova dependência:** `lucide-react` (pacote npm — equivalente bundlado ao "Lucide via CDN" do DS; em app Electron não usamos CDN).
- **Remover** `@mui/icons-material` de **17 arquivos** (`src/renderer/**`, 65 linhas de import).
- **Convenção:** ícones a 18–20px, `strokeWidth={1.75}`, `color` herdando `currentColor` (Ink/slate conforme contexto). Um wrapper opcional `Icon` padroniza tamanho/traço.
- **Mapa de substituição (principais):**

| MUI (`@mui/icons-material`) | Lucide (`lucide-react`) |
|---|---|
| `Home` | `House` |
| `MonitorHeart` | `Activity` |
| `AutoAwesome` | `Sparkles` |
| `SmartToy` | `Bot` |
| `Terminal` | `SquareTerminal` |
| `EditNote` | `NotebookPen` |
| `Webhook` | `Webhook` |
| `Extension` | `Puzzle` |
| `Storefront` | `Store` |
| `Tune` | `SlidersHorizontal` |
| `Settings` | `Settings` |
| `ChevronLeft/Right` | `ChevronLeft/Right` |
| `ExpandLess/More` | `ChevronUp/Down` |
| `Search` | `Search` |
| `RocketLaunch` | `Rocket` |
| `CheckCircle` | `CheckCircle2` |
| `ArrowForward` | `ArrowRight` |
| `DataObject` / `Hub` | `Braces` / `Network` |

(Marcas próprias OGS — globo / app-icon — entram como SVG em `src/renderer/assets/` para a logo do TopNav; não são da família Lucide.)

---

## 7. Arquitetura de navegação (app shell)

Substitui o `Sidebar.tsx` (rail agrupado colapsável) por um shell de dois níveis. Mantém o princípio do `CLAUDE.md`: **sem `react-router`** — navegação é estado (`useState` + união discriminada), agora com dois níveis.

```
AppShell
├── TopNav            brand · [Início · Biblioteca · Plugins · Diagnóstico] · ⌘K · sync · tema · ⚙
├── SubRail           contextual: Biblioteca → Skills/Agents/Commands/Hooks/Global Instructions
│                                 Plugins    → Plugins/Marketplaces
│                                 Início/Diagnóstico → sem sub-rail
└── <screen>
```

### Modelo de navegação
```ts
type Area = 'inicio' | 'biblioteca' | 'plugins' | 'diagnostico';
type LibrarySub = 'skills' | 'agents' | 'commands' | 'hooks' | 'global-instructions';
type PluginsSub = 'plugins' | 'marketplaces';
type Nav =
  | { area: 'inicio' }
  | { area: 'biblioteca'; sub: LibrarySub }
  | { area: 'plugins'; sub: PluginsSub }
  | { area: 'diagnostico' };
```

### Componentes novos do shell
- **`TopNav`** — marca (logo SVG + "Superset AI" + kicker `OGS · TECNOLOGIA BRASIL`), abas primárias (indicador Azul), cluster direito: gatilho da command palette (`⌘K`), **status de sync** (chip verde/âmbar lendo `useHealthReport`), **toggle de tema** (☾/☀ ligado a `settings.ui.theme`), `⚙ Configurações`.
- **`SubRail`** — itens contextuais; ativo = Ink + barra Azul à esquerda; kicker de seção em mono.
- **`CommandPalette`** — overlay `⌘K`: buscar e pular para qualquer entidade + ações de criação ("Nova skill", "Novo agent"…). Implementado com MUI `Dialog` + lista filtrável (sem dependência nova). Substitui a busca local de cada tela por uma busca global.
- **Persistência:** colapso do sub-rail e tema seguem o padrão atual de `localStorage` + `settings`.

### Wiring de tema (corrige gap existente)
Hoje `main.tsx:14-15` escolhe o modo só por `prefers-color-scheme`, ignorando `settings.ui.theme` (`'system' | 'light' | 'dark'`) que já existe no schema. O toggle do TopNav passa a gravar `settings.ui.theme`; `main.tsx` passa a resolver: `theme === 'system' ? prefers-color-scheme : theme`.

---

## 8. Componentes compartilhados (a camada "design system")

Novo diretório `src/renderer/components/ds/`:

| Componente | Papel |
|---|---|
| `Kicker` | rótulo mono caixa-alta (tracking .20em, slate) |
| `ScreenHeader` | kicker + H1 + subtítulo/contagem + slot de ações — usado por **toda** tela |
| `StatusPill` | dot + label mono; variantes `synced` (verde), `unsynced` (âmbar), `plugin`/`read-only` (azul outline), `error` (vermelho) |
| `EmptyState` | ícone Lucide + título + descrição + CTAs |
| `LoadingState` | skeletons com shimmer (lista, card, detalhe) |
| `ErrorState` | alerta com barra esquerda (padrão de alerta do DS) + "Tentar novamente" |
| `Icon` (opcional) | wrapper Lucide com tamanho/traço padrão |

Restyle (não novos) de: `EntityDataGrid/CardView` (vira `EntityCard` OGS), `TableView`, `Toolbar` (busca/toggle/ações), `DetailDrawer`/`CustomizationViewDrawer`, `CustomizationEditor`, `Toast`, `SyncReportModal`, `PluginOriginBadge` → `StatusPill`.

---

## 9. Padrões de tela

- **Lista (Skills/Agents/Commands/Hooks):** `ScreenHeader` + `Toolbar` (busca + toggle **Cards/Tabela** — ambos já existem no `EntityDataGrid`) + grid de `EntityCard` (default) ou tabela. Card mostra: nome em mono, `StatusPill` de origem (plugin) e de sync, descrição, ações (Editar/⋯ ou Read-only).
- **Detalhe:** drawer à direita sobre a lista esmaecida — kicker, nome mono, frontmatter em pares chave/valor mono, preview markdown, ações (`Editar` Ink / `Sincronizar` / `⋯`); variante plugin troca Editar por badge `read-only`.
- **Editor:** full-page (preserva o fluxo atual) vestido de OGS — card Frontmatter (Name/Version/Description+contador/Scope em chips Ink) + card Body com toggle Edit/Split/Preview (textarea mono + preview).
- **Início:** `StarterPackScreen` re-headerizada (kicker + H1 "Início"); remove branding "SDE".
- **Diagnóstico:** `HealthScreen` com cards de severidade usando os papéis semânticos (verde/âmbar/vermelho).
- **Estados:** toda tela com dado assíncrono usa `LoadingState`/`EmptyState`/`ErrorState`. Reforça a união discriminada que `App.tsx` já adota (`loading`/`io-error`).

---

## 10. Copy: PT-BR + termos técnicos em EN

Passada de texto sobre strings hardcoded do renderer:
- **Chrome → PT-BR:** "Início", "Buscar", "Nova skill", "Editar", "Salvar", "Cancelar", "Configurações", "Tentar novamente", contadores ("12 pessoais · 3 de plugin"), empty/error copy.
- **Mantém EN:** nomes de entidades/tipos (`Skills`, `Agents`, `Commands`, `Hooks`, `Global Instructions`), valores como `plugin`/`personal`/`project`/`synced`, paths, IDs, frontmatter keys.
- Remove o outlier atual: `Sidebar` usa "Início" mas o resto está em EN — após a passada, o chrome fica consistente em PT.

---

## 11. Limpeza de naming (SDE → OGS · Superset AI)

Ocorrências de "SDE" a corrigir:

| Arquivo | Trecho | Ação |
|---|---|---|
| `components/Sidebar.tsx:218` | logo "SDE" | → marca "Superset AI" (TopNav) |
| `screens/starter-pack/StarterPackScreen.tsx:336,339,358,433` | "SDE Starter Pack / environment / Profile / plugins" | → "Superset AI" / "OGS" |
| `screens/global-instructions/GlobalInstructionScreen.tsx:322,358` | "SDE profile / template" (UI) | → "perfil OGS" / "template OGS" |
| `lib/default-global-instruction.ts:13,51` | descrição/comentário "SDE" | → texto OGS |
| `infrastructure/plugins/plugin-cache-file.ts:73-74` | `owner: 'SDE-AI'`, "Plugins managed by SDE-AI" | **secundário** — é dado do main process, não chrome. Renomear para `OGS` ou tratar em commit separado (§13). |

---

## 12. Impacto, riscos e testes

### Arquivos tocados (alto nível)
`theme.ts` (reescrito), novo `tokens.ts`, `main.tsx` (fontes + wiring de tema), `package.json` (+`@fontsource/space-grotesk`, +`@fontsource/jetbrains-mono`, +`lucide-react`, −`@fontsource/roboto`), **delete** `Sidebar.tsx`, rework `Main.tsx`, novos `components/ds/*` + `AppShell`/`TopNav`/`SubRail`/`CommandPalette`, restyle de todas as `screens/**`, swap de ícones em 17 arquivos, passada de copy.

### Riscos e mitigações
1. **PR único = diff grande contra release gate.** → commits encadeados (§14), cada um verde em lint+typecheck+testes.
2. **Churn de `data-testid`.** A troca de `Sidebar` por `TopNav`+`SubRail` afeta `sidebar`, `sidebar-skills`, `sidebar-toggle`, `sidebar-group-*`, `sidebar-health-badge`, `sidebar-settings`. → **Preservar IDs semânticos onde possível** (ex.: manter `data-testid="nav-skills"` no item de Skills) e atualizar deliberadamente os testes de navegação. Mapear no plano os testes afetados (`tests/renderer/**`, e2e Playwright).
3. **`primary = Ink` muda todos os contained buttons** para escuro. Intencional/on-brand; QA visual por tela.
4. **Métricas de Space Grotesk ≠ Roboto** → revisar line-heights/alinhamentos; snapshots Playwright podem quebrar (atualizar baselines).
5. **Lucide ≠ Material** em tamanho/peso óptico → QA de alinhamento por tela.
6. **Wiring `settings.ui.theme`** muda comportamento (antes só prefers-color-scheme) → cobrir com teste.

### Estratégia de teste
- Atualizar testes unit (vitest jsdom) que dependem de testids/labels de navegação e de copy EN→PT.
- Novos testes para `CommandPalette`, `StatusPill`, `AppShell` (troca de área/sub, toggle de tema).
- Manter thresholds de coverage (lines/functions/statements 80, branches 70).
- Atualizar e2e Playwright (`test:e2e`) e baselines visuais.
- Gate final: `npm run lint && npm run typecheck && npm test && npm run test:e2e` verdes.

---

## 13. Decisões em aberto

1. **Hex do vermelho de erro** — proposto `#C0392B` (light) / `#E2675A` (dark). Confirmar se a marca OGS tem um vermelho oficial.
2. **`SDE-AI` no `plugin-cache-file.ts`** (main process) — renomear nesta refa ou em commit/PR separado por ser dado de backend, não chrome?
3. **Escopo da Command Palette** — proposto: navegação + ações de criação. Buscar *dentro* do corpo das entidades fica para depois (YAGNI).

---

## 14. Entrega — PR único, sequência de commits

Cada commit deixa o gate verde.

1. **`feat(theme): OGS tokens, palette, typography, shape`** — `tokens.ts` + `theme.ts` reescrito + fontes (Space Grotesk/JetBrains Mono, remove Roboto) + wiring `settings.ui.theme` em `main.tsx`.
2. **`feat(ds): shared design-system components`** — `Kicker`, `ScreenHeader`, `StatusPill`, `EmptyState`, `LoadingState`, `ErrorState`, `Icon`.
3. **`refactor(icons): migrate @mui/icons-material → lucide-react`** — 17 arquivos + dependência.
4. **`feat(shell): TopNav + SubRail + CommandPalette`** — substitui `Sidebar`/`Main`; atualiza testes de navegação.
5. **`feat(screens): apply OGS to lists, detail, editor, states`** — Biblioteca (Skills/Agents/Commands/Hooks/Global), Plugins/Marketplaces, Diagnóstico, Início, Settings, Editor, DetailDrawer.
6. **`chore(copy): PT-BR chrome + SDE→Superset AI/OGS naming`** — passada de texto + limpeza de naming.
7. **`test: update unit/e2e + visual baselines`** — fechamento do gate.

---

## 15. Critérios de aceite

- App em Cream/Ink com Space Grotesk + JetBrains Mono; zero Roboto, zero `@mui/icons-material` no renderer.
- Navegação top-nav + sub-rail + `⌘K` funcionando; tema claro/escuro persistido em `settings.ui.theme`.
- Disciplina cromática respeitada (azul=ação, verde=sucesso, âmbar=atenção, vermelho=erro; Ink como acento neutro/botão primário).
- Estados vazio/carregando/erro padronizados em todas as telas com I/O.
- Sem "SDE" na UI; chrome em PT-BR, termos técnicos em EN.
- `lint + typecheck + test (+ e2e)` verdes.
