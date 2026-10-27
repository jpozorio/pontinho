# Pontinho PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever o app de pontos do pontinho como PWA (Ionic + Angular atuais), com placar e "faltam X" sempre visíveis, histórico no formato caderno, controle de dinheiro com acordo e dívidas, estado salvo, publicado no GitHub Pages.

**Architecture:** Toda regra de jogo e de dinheiro fica em funções puras em `src/app/domain/` que derivam o estado a partir de um registro bruto (`Game`: configuração, rodadas fechadas, rascunho da rodada aberta, pagamentos, acordo). Um serviço `GameStore` (signals) guarda `AppData` (partida atual + partidas terminadas), persiste em `localStorage` a cada mudança e expõe as visões derivadas. As páginas Ionic standalone só leem visões e chamam ações do store.

**Tech Stack:** Angular 21 (standalone, signals, Vitest — padrão do CLI 21), `@ionic/angular` 9 (`@ionic/angular/standalone`), `ionicons` 8, `@angular/service-worker` (via `ng add @angular/pwa`), GitHub Actions + GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-27-pontinho-pwa-design.md`

## Global Constraints

- Angular **21.x** (não 22: o Angular 22 exige Node ≥ 22.22 e a máquina local tem Node 20.20; o Angular 21 aceita `^20.19 || ^22.12 || >=24`). CI usa Node 22.
- `@ionic/angular` **9.x** (a spec diz "Ionic atual"; a atual é a 9, não a 8).
- Interface toda em **português**. Nome do app: **"Pontinho dos pituchas"** (short name "Pontinho").
- Estoura em **total ≥ 100**. "Faltam X" = `99 − total`.
- Persistência só local (`localStorage`, chave `pontinho:v1`), salva a cada ação; nenhum servidor, nenhum login.
- Publicação em `https://jpozorio.github.io/pontinho/` → build com `--base-href /pontinho/`; roteamento por hash (`withHashLocation()`) para não depender de 404.html.
- Sem Cordova/Capacitor; arquivos antigos (Cordova, `resources/`, `pontinho.apk`, `e2e/`, tslint) são removidos (decisão do builder permitida pela spec).
- Histórico: **jogadores nas colunas**, rodadas nas linhas, nomes completos, rolagem horizontal.
- Navegação de partida em abas inferiores **Rodada · Histórico · Dinheiro**; sem menu lateral.

## Review Focus

1. **Recarregar a página no meio de uma rodada** — os pontos já digitados (rascunho) devem continuar lá. Teste no Task 5 (`persists draft scores across reload`).
2. **Entrada de pontos inválida** — campo vazio ≠ 0; negativo ou decimal não é aceito; 0 é válido. Teste no Task 3 (`rejects negative and fractional scores`) e Task 7.
3. **Nomes de jogadores** — vazios, espaços extras e duplicados (sem diferenciar maiúsculas) quebrariam dívidas por nome. Teste no Task 6 (`validatePlayers`).
4. **`localStorage` corrompido ou indisponível** (JSON inválido, modo privado lançando exceção) — o app abre vazio sem quebrar. Teste no Task 5 (`starts empty on corrupt storage`).
5. **8 jogadores numa tela de 360px** — rodada sem rolagem horizontal; histórico com rolagem horizontal e coluna da rodada fixa. Verificação manual no Task 8 (viewport 360×740).

---

## File Structure

```
src/app/domain/model.ts          tipos do registro bruto (Game, Round, AppData…) e constantes
src/app/domain/engine.ts         computeGame(): totais, estouros, decisões, vencedor, quem dá as cartas, histórico
src/app/domain/actions.ts        transições puras: setDraftScore, closeRound, decide, editRound, truncateFrom
src/app/domain/money.ts          devido, pote, acordo, pagamentos, acerto final, dívidas entre partidas
src/app/domain/*.spec.ts         testes unitários (Vitest)
src/app/state/game-store.ts      serviço com signals + persistência
src/app/state/game-store.spec.ts
src/app/pages/setup/             novo jogo / jogadores
src/app/pages/game/              shell com ion-tabs
src/app/pages/round/             aba Rodada
src/app/pages/history/           aba Histórico
src/app/pages/money/             aba Dinheiro (+ modal de acordo)
src/app/pages/game-over/         fim de jogo
src/app/shared/pay-button.ts     botão "+ pagou" (alert com valor)
src/app/app.routes.ts, app.config.ts, app.ts
.github/workflows/deploy.yml
```

---

### Task 1: Novo projeto Angular 21 + Ionic 9 no lugar do antigo

**Files:**
- Delete: `src/`, `e2e/`, `resources/`, `config.xml`, `ionic.config.json`, `myApp.iml`, `pontinho.apk`, `tslint.json`, `angular.json`, `tsconfig.json`, `package.json`, `package-lock.json`
- Create: projeto gerado pelo CLI na raiz; `src/app/app.routes.ts`, `src/app/app.config.ts`, `src/app/app.ts`, `src/app/pages/game/game.page.ts` (placeholder de abas)
- Modify: `readme.md` (como rodar, testar, publicar), `.gitignore` (manter `.superpowers/`, adicionar `/.angular/`)

**Interfaces:**
- Produces: rotas `#/novo` (SetupPage), `#/jogo/rodada|historico|dinheiro` (GamePage com tabs), `#/fim` (GameOverPage); rota `''` redireciona via guard funcional `startGuard` para `/jogo/rodada` se houver partida atual não terminada, `/fim` se terminada, senão `/novo`. Nesta task as páginas são placeholders com `<ion-title>`; o guard pode retornar sempre `/novo` até o Task 5.

- [ ] **Step 1: Gerar o projeto em diretório temporário e mover para a raiz**

```bash
cd /tmp && rm -rf pontinho-new && npx --yes @angular/cli@21 new pontinho-new --style=scss --ssr=false --skip-git --routing --zoneless=false --ai-config=none --defaults
```
Apagar os arquivos antigos listados acima (`git rm -r`), copiar o conteúdo de `/tmp/pontinho-new` (exceto `node_modules`) para a raiz, renomear o projeto para `pontinho` em `angular.json`/`package.json`, `npm install`.

- [ ] **Step 2: Instalar Ionic e configurar**

```bash
npm i @ionic/angular@9 ionicons@8
```
`app.config.ts`: `provideIonicAngular({ mode: 'md' })`, `provideRouter(routes, withHashLocation())`. Em `angular.json` adicionar aos `styles` os CSS do Ionic (`core.css`, `normalize.css`, `structure.css`, `typography.css`, `padding.css`, `flex-utils.css`, `display.css` de `node_modules/@ionic/angular/css/`). `app.ts` renderiza `<ion-app><ion-router-outlet /></ion-app>`. `lang="pt-BR"` e `<title>Pontinho dos pituchas</title>` em `index.html`.

- [ ] **Step 3: Verificar build e testes**

Run: `npx ng build && npx ng test --watch=false`
Expected: build sem erros; o spec gerado pelo CLI passa (ajuste-o para o novo `app.ts` se necessário).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Recria o projeto com Angular 21 e Ionic 9"
```

---

### Task 2: Modelo e motor de pontuação (`computeGame`)

**Files:**
- Create: `src/app/domain/model.ts`, `src/app/domain/engine.ts`
- Test: `src/app/domain/engine.spec.ts`

**Interfaces:**
- Produces (`model.ts`):
```ts
export const BUST_AT = 100;
export type ReentryLimit = 'one' | 'unlimited';
export type Score = number | 'bust';
export type Decision = 'reenter' | 'out';
export interface GameConfig { entryValue: number; reentryLimit: ReentryLimit; players: string[]; } // players[0] dá as cartas na rodada 1
export interface Round { scores: Record<string, Score>; decisions: Record<string, Decision>; } // decisions: só de quem estourou NESTA rodada
export interface Payment { id: string; player: string; amount: number; at: string; }
export interface Agreement { saves: Record<string, number>; }
export interface Game { id: string; startedAt: string; finishedAt?: string; config: GameConfig; rounds: Round[]; draft: Record<string, Score>; payments: Payment[]; agreement?: Agreement; }
export interface AppData { version: 1; current: Game | null; finished: Game[]; lastConfig?: { entryValue: number; reentryLimit: ReentryLimit }; }
export function newGame(config: GameConfig, now?: Date): Game
```
- Produces (`engine.ts`):
```ts
export type PlayerStatus = 'active' | 'deciding' | 'out';
export interface PlayerView {
  name: string;
  total: number;            // para 'deciding' + 'reenter' = reentryTotal; para estourado = total com estouro (≥100)
  reentries: number;        // inclui uma decisão 'reenter' ainda aberta
  status: PlayerStatus;     // 'deciding' = estourou na última rodada fechada e a partida não acabou
  decision?: Decision;      // decisão atual de quem está 'deciding'
  canReenter: boolean;      // false se reentryLimit 'one' e já reentrou antes
  reentryTotal?: number;    // maior total entre os não estourados da rodada em que estourou
  playsNextRound: boolean;  // 'active' ou ('deciding' && decision==='reenter')
  pointsLeft: number;       // 99 - total
}
export interface HistoryCell { points: Score | null; total: number | null; busted: boolean; reenteredWith?: number; out: boolean; } // points null = não jogou
export interface GameView { players: PlayerView[]; nextRound: number; dealer: string | null; winner: string | null; history: HistoryCell[][]; playingCount: number; }
export function computeGame(game: Game): GameView
```

Regras do motor (da spec): estouro = pontos `'bust'` ou total ≥ 100; total com `'bust'` vira `max(total, 100)`. Decisões de rodadas anteriores à última são fixas. Quem decidiu `'out'` numa rodada já seguida por outra fechada fica `'out'`; quem decidiu `'reenter'` volta com `reentryTotal` e +1 em `reentries`. Vencedor: após a última rodada, se exatamente um jogador que jogou essa rodada terminou abaixo de 100. `dealer`: rodada 1 = `players[0]`; cada rodada seguinte = próximo jogador na ordem de `players` que `playsNextRound` (ou estava jogando) — pula quem está `'out'` ou `'deciding'` com `'out'`/sem decisão. `history[r][i]` segue a ordem de `config.players`; `reenteredWith` preenchido na célula da rodada em que estourou se a decisão (atual) for `'reenter'`.

- [ ] **Step 1: Escrever os testes**

Use jogadores `['Ana','Beto','Carla']`, `entryValue: 5`, `reentryLimit: 'unlimited'`, com helper `round(scores, decisions = {})`.
- `starts with zero totals and first player dealing`: `nextRound === 1`, `dealer === 'Ana'`, todos `total 0`, `pointsLeft 99`, `status 'active'`.
- `sums points per round`: rodadas `{Ana:10,Beto:22,Carla:5}`, `{Ana:15,Beto:9,Carla:4}` → totais 25/31/9, `dealer === 'Carla'` (3ª rodada), `history[1][0]` = `{points:15,total:25,busted:false,out:false}`.
- `marks bust from points or bust flag`: `{Ana:10,Beto:'bust',Carla:100}` → Beto e Carla `status 'deciding'`, `total ≥ 100`, `pointsLeft < 0`; `winner` = 'Ana' (só ela abaixo de 100).
- `reentry returns with highest non-busted total`: 4 jogadores `['Ana','Beto','Carla','Davi']`, rodada `{Ana:40,Beto:'bust',Carla:60,Davi:10}` com decisão `{Beto:'reenter'}` → Beto `total 60`, `reentries 1`, `playsNextRound true`, `history[0][1].reenteredWith === 60`; `winner === null`.
- `deciding out does not play next round but can still switch`: mesma rodada com `{Beto:'out'}` → Beto `status 'deciding'`, `playsNextRound false`; `playingCount === 3`.
- `decision becomes fixed after next round closes`: + rodada `{Ana:5,Carla:5,Davi:5}` → Beto `status 'out'`, `history[1][1].points === null`, `history[1][1].out === true`.
- `reentry limit one blocks second reentry`: `reentryLimit 'one'`, Beto reentra na rodada 1 e estoura de novo na rodada 2 → `canReenter false`.
- `dealer skips players who are out`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx ng test --watch=false`
Expected: FAIL (`computeGame` não existe).

- [ ] **Step 3: Implementar `model.ts` e `computeGame(game: Game): GameView`**

Uma passada pelas rodadas em ordem, mantendo por jogador `{total, reentries, out}`; `newGame` usa `crypto.randomUUID()` e `now.toISOString()`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx ng test --watch=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/domain && git commit -m "Adiciona motor de pontuação do pontinho"
```

---

### Task 3: Ações da partida (rascunho, fechar rodada, decidir, corrigir, desfazer)

**Files:**
- Create: `src/app/domain/actions.ts`
- Test: `src/app/domain/actions.spec.ts`

**Interfaces:**
- Consumes: `Game`, `Score`, `Decision`, `computeGame`, `GameView` (Task 2).
- Produces:
```ts
export type ActionError =
  | 'invalid-score'      // negativo, não inteiro, NaN
  | 'missing-scores'     // algum jogador com playsNextRound sem rascunho
  | 'all-bust'           // todos que jogaram estourariam
  | 'pending-decision'   // alguém 'deciding' sem decisão
  | 'cannot-reenter'     // decide('reenter') com canReenter false
  | 'changes-outcome'    // correção altera quem estourou ou o vencedor
  | 'game-over';
export type Result = { game: Game } | { error: ActionError };
export function setDraftScore(game: Game, player: string, score: Score | null): Result // null apaga
export function closeRound(game: Game, now?: Date): Result
export function decide(game: Game, player: string, decision: Decision): Result
export function editRound(game: Game, index: number, scores: Record<string, Score>): Result
export function truncateFrom(game: Game, index: number): Game
```
Regras: `closeRound` grava `Round` com `scores` = rascunho só de quem `playsNextRound`; para cada jogador que estoura nessa rodada e `!canReenter`, grava `decisions[p] = 'out'`; zera `draft`; se `computeGame` passar a ter `winner`, define `finishedAt`. `decide` só vale para jogadores `'deciding'` e altera `rounds[last].decisions`; trocar para `'out'` remove o rascunho dele. `editRound` compara, rodada a rodada, o conjunto de estourados e o `winner` antes/depois; se diferente → `'changes-outcome'`. `truncateFrom` remove `rounds[index..]`, zera `draft` e `finishedAt`, e remove `agreement` se `playingCount > 2`.

- [ ] **Step 1: Escrever os testes**

- `rejects negative and fractional scores`: `setDraftScore(g,'Ana',-1)` e `(g,'Ana',2.5)` → `{error:'invalid-score'}`; `0` é aceito.
- `closeRound requires all playing scores`: rascunho só de Ana → `'missing-scores'`.
- `closeRound refuses all bust`: `{Ana:'bust',Beto:120,Carla:'bust'}` → `'all-bust'`.
- `closeRound appends round and clears draft`.
- `closeRound auto-outs busted player who cannot reenter`.
- `closeRound with single survivor finishes the game`: `finishedAt` definido, `computeGame(...).winner === 'Ana'`.
- `closeRound blocks while decision pending`: rodada anterior com Beto estourado e sem decisão → `'pending-decision'`.
- `switching from out to reenter adds player to round`: Beto `'out'` → `decide('reenter')` → `computeGame` mostra `playsNextRound true` e `closeRound` sem nota do Beto → `'missing-scores'`.
- `editRound keeps outcome`: corrigir 10→12 de Ana atualiza total.
- `editRound rejects outcome change`: corrigir para fazer Beto estourar → `'changes-outcome'`.
- `truncateFrom reopens finished game and drops agreement`.

- [ ] **Step 2: Rodar e ver falhar** — `npx ng test --watch=false` → FAIL.
- [ ] **Step 3: Implementar as funções em `actions.ts`.**
- [ ] **Step 4: Rodar e ver passar** — `npx ng test --watch=false` → PASS.
- [ ] **Step 5: Commit** — `git add src/app/domain && git commit -m "Adiciona ações da partida"`

---

### Task 4: Dinheiro — pote, acordo, pagamentos, acerto e dívidas

**Files:**
- Create: `src/app/domain/money.ts`
- Test: `src/app/domain/money.spec.ts`

**Interfaces:**
- Consumes: `Game`, `Agreement`, `Payment`, `computeGame` (Task 2).
- Produces:
```ts
export interface Debt { debtor: string; creditor: string; amount: number; gameId: string; date: string; }
export interface MoneyRow {
  player: string;
  entries: number;          // 1 + reentries
  owes: number;             // entries × entryValue
  paidInGame: number;       // pagamentos do jogador após quitar dívidas antigas
  outstanding: number;      // max(0, owes - paidInGame)
  oldDebts: Debt[];         // dívidas antigas ainda abertas depois dos pagamentos
}
export interface SettlementRow { player: string; put: number; receives: number; balance: number; }
export interface Settlement { pot: number; saves: Record<string, number>; winner: string; winnerTakes: number; rows: SettlementRow[]; }
export interface MoneyView { rows: MoneyRow[]; pot: number; missingToPot: number; settlement: Settlement | null; }
export function computeMoney(game: Game, priorDebts: Debt[]): MoneyView
export function computeDebts(finished: Game[]): Debt[]   // em ordem cronológica
export function addPayment(game: Game, player: string, amount: number, now?: Date): Game
export function removePayment(game: Game, id: string): Game
export type AgreementError = 'not-two-players' | 'invalid-amount' | 'exceeds-pot';
export function setAgreement(game: Game, saves: Record<string, number>): { game: Game } | { error: AgreementError }
export function clearAgreement(game: Game): Game
```
Regras: pote = soma de `owes`. Pagamentos de um jogador quitam primeiro as `priorDebts` dele (mais antiga primeiro), o resto vai para `paidInGame`. Acordo: só com `playingCount === 2` e sem vencedor; chaves = exatamente os dois jogadores; valores ≥ 0; soma ≤ pote. Acerto (só com vencedor): parceiro do acordo recebe o que salvou; vencedor recebe `pote − save do parceiro`; `put = owes`; `balance = receives − put`. `computeDebts`: para cada partida terminada, em ordem, aplica `computeMoney` com as dívidas acumuladas; dívidas antigas restantes continuam; cada não vencedor com `outstanding > 0` gera `Debt` para o vencedor (decisão da spec: dívida é com o vencedor da partida de origem; o vencedor paga a parte do parceiro do acordo com o dinheiro do pote).

- [ ] **Step 1: Escrever os testes** (entrada R$ 5, 4 jogadores)

- `owes one entry per entry and reentry`: Carla reentrou 1× → `entries 2`, `owes 10`; pote 25 (5+5+10+5).
- `missingToPot sums outstanding`: Ana e Davi pagaram 5 → `missingToPot 15`.
- `winner takes whole pot without agreement`: settlement do vencedor `receives 25`, `balance 20`.
- `agreement splits pot`: pote 40, Ana e Davi salvam 10 cada, Davi vence → Davi `receives 30`, Ana `receives 10`, `winnerTakes 30`.
- `agreement only with two players`: com 3 jogando → `'not-two-players'`; soma > pote → `'exceeds-pot'`.
- `unpaid amount becomes debt to winner`: Beto não pagou 5 → `computeDebts([g])` = `[{debtor:'Beto',creditor:'Davi',amount:5,...}]`.
- `payments clear old debts first`: com a dívida acima, Beto paga 8 na partida seguinte → `oldDebts []`, `paidInGame 3`.
- `debt survives games the debtor skips`: Beto ausente da partida 2 → dívida ainda listada após `computeDebts([g1,g2])`.

- [ ] **Step 2: Rodar e ver falhar** — `npx ng test --watch=false` → FAIL.
- [ ] **Step 3: Implementar `money.ts`.**
- [ ] **Step 4: Rodar e ver passar** — `npx ng test --watch=false` → PASS.
- [ ] **Step 5: Commit** — `git add src/app/domain && git commit -m "Adiciona cálculo de dinheiro, acordo e dívidas"`

---

### Task 5: `GameStore` com persistência

**Files:**
- Create: `src/app/state/game-store.ts`
- Test: `src/app/state/game-store.spec.ts`
- Modify: `src/app/app.routes.ts` (guard `startGuard` usa o store)

**Interfaces:**
- Consumes: tudo de `domain/`.
- Produces (`@Injectable({providedIn:'root'})`):
```ts
export const STORAGE_KEY = 'pontinho:v1';
export class GameStore {
  readonly data: Signal<AppData>;
  readonly game: Signal<Game | null>;
  readonly view: Signal<GameView | null>;
  readonly money: Signal<MoneyView | null>;       // usa computeDebts(data.finished)
  readonly lastError: Signal<ActionError | AgreementError | null>;
  startGame(config: GameConfig): void;            // grava lastConfig
  setDraftScore(player: string, score: Score | null): boolean;
  closeRound(): boolean;
  decide(player: string, d: Decision): boolean;
  editRound(index: number, scores: Record<string, Score>): boolean;
  undoFrom(index: number): void;                   // truncateFrom
  addPayment(player: string, amount: number): void;
  removePayment(id: string): void;
  setAgreement(saves: Record<string, number>): boolean;
  clearAgreement(): void;
  archiveAndPrepareNext(): GameConfig | null;     // move partida terminada para finished; devolve config com os mesmos jogadores, vencedor primeiro (ordem rotacionada), entrada/regra iguais
  abandonGame(): void;                             // descarta partida atual sem arquivar
  debtsFor(players: string[]): Debt[];
}
```
Métodos `boolean`: `true` em sucesso; em falha guardam `lastError`. Persistência: `effect` grava `JSON.stringify(data())` em `STORAGE_KEY`; leitura inicial em `try/catch` (JSON inválido, exceção de acesso ou `version !== 1` → `{version:1,current:null,finished:[]}`). Se não houver `lastConfig`, usa a chave antiga `game-value` como `entryValue` (padrão 1) e `reentryLimit 'unlimited'`.

- [ ] **Step 1: Escrever os testes** (TestBed, `localStorage.clear()` no `beforeEach`)

- `persists draft scores across reload`: `startGame`, `setDraftScore('Ana', 12)`, `TestBed.flushEffects()`, nova instância (reset TestBed) → `game().draft.Ana === 12`.
- `starts empty on corrupt storage`: `localStorage.setItem(STORAGE_KEY,'{oops')` → `game() === null`.
- `reads legacy game-value as default entry`: `localStorage.setItem('game-value','3')` → `data().lastConfig?.entryValue ?? ...` resolve para 3 (expor via `defaultConfig(): {entryValue, reentryLimit}`).
- `archiveAndPrepareNext puts winner first`: jogadores `['Ana','Beto','Carla']`, Carla vence → `players` `['Carla','Ana','Beto']`; `current === null`; `finished.length === 1`.
- `closeRound failure sets lastError`.

- [ ] **Step 2: Rodar e ver falhar** — FAIL.
- [ ] **Step 3: Implementar `GameStore` e o guard.**
- [ ] **Step 4: Rodar e ver passar** — PASS.
- [ ] **Step 5: Commit** — `git add src/app && git commit -m "Adiciona store com persistência local"`

---

### Task 6: Tela de novo jogo / jogadores

**Files:**
- Create: `src/app/pages/setup/setup.page.ts|html|scss`, `src/app/pages/setup/validate-players.ts`
- Test: `src/app/pages/setup/validate-players.spec.ts`

**Interfaces:**
- Consumes: `GameStore.startGame`, `archiveAndPrepareNext` (via navegação do fim de jogo passando a config pelo `history.state` ou por um signal `pendingConfig` no store), `defaultConfig()`, `debtsFor`.
- Produces: `export function validatePlayers(names: string[]): { names: string[] } | { error: 'too-few' | 'empty-name' | 'duplicate'; index?: number }` — apara espaços; mínimo 2; duplicado sem diferenciar maiúsculas/acentos não.

UI: lista com `ion-reorder-group` (arrastar para mudar a ordem; texto "o primeiro dá as cartas"), `ion-input` por nome, remover, "+ jogador"; padrão 4 linhas vazias quando não há partida anterior. Entrada (R$, `inputmode="decimal"`) e reentrada (`ion-segment`: "Uma vez" / "Ilimitada"). Ao lado de cada nome com dívida antiga: "deve R$ X". Botão "Começar". Se existir partida em andamento não terminada, a tela mostra aviso e "Abandonar partida atual" com `ion-alert` de confirmação.

- [ ] **Step 1: Testes de `validatePlayers`** — `['Ana',' ana ']` → `duplicate index 1`; `['Ana','']` → `empty-name index 1`; `['Ana']` → `too-few`; `[' Ana ','Beto']` → `names ['Ana','Beto']`.
- [ ] **Step 2: Rodar e ver falhar** — FAIL.
- [ ] **Step 3: Implementar `validatePlayers` e a página.**
- [ ] **Step 4: Rodar testes** — PASS; `npx ng serve`, abrir `http://localhost:4200/#/novo`, cadastrar 3 jogadores, começar → vai para `#/jogo/rodada`.
- [ ] **Step 5: Commit** — `git commit -am "Adiciona tela de novo jogo"` (incluir arquivos novos com `git add`).

---

### Task 7: Aba Rodada (tela principal)

**Files:**
- Create: `src/app/pages/game/game.page.ts|html` (ion-tabs: Rodada `#/jogo/rodada`, Histórico, Dinheiro; ícones `create`, `list`, `cash`), `src/app/pages/round/round.page.ts|html|scss`, `src/app/pages/round/points-left.ts`
- Test: `src/app/pages/round/round.page.spec.ts`, `src/app/pages/round/points-left.spec.ts`

**Interfaces:**
- Consumes: `GameStore.view/money/game/setDraftScore/closeRound/decide`.
- Produces: `export type LeftLevel = 'ok' | 'near' | 'bust'; export function leftLevel(pointsLeft: number): LeftLevel` — `bust` se < 0, `near` se ≤ 19, senão `ok` (limiares são escolha do builder; estes são os fixados).

UI (mockup `tela-rodada.html`, opção A):
- Cabeçalho: "Rodada N", "baralho: {dealer}", "Pote R$ X".
- Uma linha por jogador com `playsNextRound`: nome, `total → total+rascunho` (só quando há rascunho), `ion-input type="number" inputmode="numeric"` (vazio = sem nota), botão/toggle "estourou", à direita **"faltam X"** grande com classe `leftLevel` calculada **do total com rascunho**, ou "💥 estourou". Reentradas: "↻ N".
- Jogadores `'deciding'`: chip "estourou — reentra / sai" (`ion-segment`), editável; com `'out'` aparece em cinza com o mesmo controle; se `!canReenter`, só texto "saiu".
- "Fechar rodada": mostra mensagem do `lastError` ("Lance os pontos de todos", "Alguém precisa ficar abaixo de 100 — confira os pontos", "Falta decidir se {nome} reentra").
- Após fechar com estourados que podem reentrar: `ion-alert` por jogador "{nome} estourou. Reentra com {reentryTotal}?" [Sai] [Reentra]; em "Reentra", segundo alert "Pagou agora?" com valor da entrada pré-preenchido → `addPayment`.
- Se houver vencedor, navega para `#/fim`.

- [ ] **Step 1: Testes** — `leftLevel(20)==='ok'`, `leftLevel(19)==='near'`, `leftLevel(0)==='near'`, `leftLevel(-1)==='bust'`; componente: com Ana total 78, digitar 12 no input dela → texto da linha contém `90` e `faltam` `9` antes de fechar a rodada (store real com `localStorage` limpo).
- [ ] **Step 2: Rodar e ver falhar** — FAIL.
- [ ] **Step 3: Implementar abas e página.**
- [ ] **Step 4: Rodar testes** — PASS; no `ng serve`, jogar 3 rodadas com um estouro e reentrada, recarregar a página no meio de uma digitação e confirmar que os números continuam.
- [ ] **Step 5: Commit** — `git add src/app && git commit -m "Adiciona aba Rodada"`

---

### Task 8: Aba Histórico (formato caderno)

**Files:**
- Create: `src/app/pages/history/history.page.ts|html|scss`, `src/app/pages/history/edit-round.modal.ts`
- Test: `src/app/pages/history/history.page.spec.ts`

**Interfaces:**
- Consumes: `GameStore.view().history`, `editRound`, `undoFrom`, `lastError`.

UI (mockup `historico-v3.html`, variante com rolagem):
- `<table>` dentro de contêiner `overflow-x: auto`; colunas = `config.players` com nome completo (`min-width` ~64px, `white-space: nowrap`); 1ª coluna (nº da rodada) `position: sticky; left: 0`; cabeçalho `position: sticky; top: 0`; rodapé com linhas **Σ total** e **faltam** (`position: sticky; bottom: 0`, cores de `leftLevel`).
- Célula: pontos; "💥" para estouro; "↻ {reenteredWith}" abaixo quando reentrou; cinza "–" para quem saiu.
- Tocar numa linha abre modal com os pontos da rodada editáveis → `editRound`; se `'changes-outcome'`, alert "Essa correção muda quem estourou. Desfazer a partir da rodada N e lançar de novo?" → `undoFrom(N-1)`.
- Botão "Desfazer última rodada" (com confirmação).

- [ ] **Step 1: Teste do componente** — 8 jogadores e 2 rodadas → 8 `th` com os nomes completos, 2 linhas de rodada, linha de faltam com 8 valores; célula de reentrada contém `↻`.
- [ ] **Step 2: Rodar e ver falhar** — FAIL.
- [ ] **Step 3: Implementar página e modal.**
- [ ] **Step 4: Rodar testes** — PASS; verificação manual no DevTools em 360×740 com 8 jogadores: rolagem horizontal funciona, coluna da rodada e rodapé ficam fixos; e em paisagem.
- [ ] **Step 5: Commit** — `git add src/app && git commit -m "Adiciona aba Histórico"`

---

### Task 9: Aba Dinheiro, botão "+ pagou" e acordo

**Files:**
- Create: `src/app/shared/pay-button.ts`, `src/app/pages/money/money.page.ts|html|scss`, `src/app/pages/money/agreement.modal.ts`
- Test: `src/app/pages/money/money.page.spec.ts`

**Interfaces:**
- Consumes: `GameStore.money/view/addPayment/removePayment/setAgreement/clearAgreement`.
- Produces: `<app-pay-button [player]="name" [suggested]="valor">` — abre `ion-alert` com input numérico (valor sugerido = `outstanding` + dívidas antigas, mínimo entrada) e chama `addPayment`. Reutilizado no Task 10.

UI (mockup `historico-dinheiro.html`):
- Cabeçalho "Pote R$ X" e "Falta entrar no pote: R$ Y".
- Por jogador: "N entradas · deve R$ X · pagou R$ Y", dívidas antigas "deve R$ Z ao {credor} (partida de dd/mm)", `app-pay-button`, "ok" verde quando quitado. Lista de pagamentos do jogador expansível com remover (confirmação).
- "Fazer acordo" visível só com `playingCount === 2` e sem vencedor: modal com um valor por jogador (atalhos "1× entrada", "2× entrada"), erros de `AgreementError` em português; acordo existente aparece com "editar" / "remover".

- [ ] **Step 1: Teste** — com 3 jogando, botão de acordo ausente; com 2, presente; após `addPayment('Beto',5)`, a linha do Beto mostra "ok".
- [ ] **Step 2: Rodar e ver falhar** — FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar testes** — PASS.
- [ ] **Step 5: Commit** — `git add src/app && git commit -m "Adiciona aba Dinheiro e acordo"`

---

### Task 10: Fim de jogo e nova partida

**Files:**
- Create: `src/app/pages/game-over/game-over.page.ts|html|scss`
- Test: `src/app/pages/game-over/game-over.page.spec.ts`

**Interfaces:**
- Consumes: `GameStore.view/money/undoFrom/archiveAndPrepareNext`, `app-pay-button`.

UI (mockup "Relatório final"):
- "🏆 {vencedor} venceu" e "N rodadas".
- Caixa com a divisão: "Pote R$ X" e, com acordo, "{A} e {B} salvaram R$ … · resto R$ … para {vencedor}".
- Tabela **Jogador · Pôs · Recebe · Saldo** (`settlement.rows`, vencedor primeiro, saldo verde/vermelho).
- "Ainda falta pagar": quem tem `outstanding > 0` ou dívida antiga, cada um com `app-pay-button`; aviso "o que não for pago fica como dívida com {vencedor}".
- "Desfazer última rodada" (confirmação → `undoFrom(last)` → volta para `#/jogo/rodada`).
- "Nova partida com os mesmos jogadores" → `archiveAndPrepareNext()` → `#/novo` com a config preenchida (editável).

- [ ] **Step 1: Teste** — partida terminada com acordo → tabela mostra os valores do exemplo da spec (Davi recebe 30, Ana 10); clicar "Nova partida" deixa `current === null` e navega para `/novo`.
- [ ] **Step 2: Rodar e ver falhar** — FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Rodar testes** — PASS; fluxo manual completo: partida de 3 jogadores até o fim, pagar uma dívida, nova partida com dívida carregada aparecendo na tela de jogadores e na aba Dinheiro.
- [ ] **Step 5: Commit** — `git add src/app && git commit -m "Adiciona fim de jogo e nova partida"`

---

### Task 11: PWA e publicação no GitHub Pages

**Files:**
- Create: `.github/workflows/deploy.yml`, ícones em `public/icons/` (gerados a partir de `resources/icon.png` do commit antigo: `git show db27fea:resources/icon.png > /tmp/icon.png`)
- Modify: `public/manifest.webmanifest`, `ngsw-config.json`, `angular.json`, `readme.md`

- [ ] **Step 1: Adicionar PWA** — `npx ng add @angular/pwa@21 --skip-confirmation`. Manifest: `name` "Pontinho dos pituchas", `short_name` "Pontinho", `lang` "pt-BR", `start_url` "./", `scope` "./", `display` "standalone", cores do tema. Gerar ícones 72–512 a partir do ícone antigo (qualquer ferramenta; `npx --yes pwa-asset-generator` ou ImageMagick).

- [ ] **Step 2: Workflow** — `deploy.yml`: em `push` na `master`; Node 22; `npm ci`; `npx ng test --watch=false`; `npx ng build --base-href /pontinho/`; `actions/upload-pages-artifact` com `dist/pontinho/browser`; `actions/deploy-pages`. Permissões `pages: write`, `id-token: write`.

- [ ] **Step 3: Verificar localmente** — `npx ng build --base-href /pontinho/` e servir `dist/pontinho/browser` sob `/pontinho/` (ex.: `mkdir -p /tmp/site && cp -r dist/pontinho/browser /tmp/site/pontinho && npx --yes http-server /tmp/site -p 8080`); abrir `http://localhost:8080/pontinho/`, DevTools → Application: manifest válido, service worker ativo; modo offline + recarregar → app abre com a partida salva.

- [ ] **Step 4: Readme** — como rodar (`npm start`), testar, publicar; passo manual: em GitHub → Settings → Pages → Source = "GitHub Actions"; instalar no celular via "Adicionar à tela inicial".

- [ ] **Step 5: Commit** — `git add -A && git commit -m "Transforma em PWA e publica no GitHub Pages"`
