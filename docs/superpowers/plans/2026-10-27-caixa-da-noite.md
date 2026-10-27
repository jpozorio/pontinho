# Caixa da noite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o dinheiro "por partida" (pagamentos dentro da partida e dívida com o vencedor) por um caixa da noite: saldo acumulado de cada jogador em todas as partidas da noite, movimentos de dinheiro (jogador→caixa, caixa→jogador, jogador→jogador), acerto final que fecha a noite e gera pendências.

**Architecture:** Regras puras novas em `src/app/domain/cash.ts` (saldos, movimentos, fechamento) e `src/app/domain/migrate.ts` (v1→v2). `AppData` passa à versão 2 com `night` e `pendings`; `Game.payments` deixa de existir e `money.ts` fica só com pote/acordo/acerto da partida. O `GameStore` orquestra; a página Caixa substitui a aba Dinheiro e também existe fora da partida (`#/caixa`).

**Tech Stack:** Angular 21 + @ionic/angular 9 (standalone, signals), Vitest via `npx ng test --watch=false`.

**Spec:** `docs/superpowers/specs/2026-10-27-caixa-da-noite-design.md` (e o spec original `2026-10-27-pontinho-pwa-design.md`)

## Global Constraints

- Interface em português; valores com `currency: 'BRL'` (locale pt-BR já registrado).
- Persistência só em `localStorage`, chave `pontinho:v1` (mantida), `version: 2`; salva a cada ação; dado v1 é migrado sem perder a partida em andamento.
- Dinheiro sempre arredondado a centavos (`cents` já existe em `money.ts` — exportar e reutilizar).
- O caixa **nunca** fica negativo.
- "Fechar a noite" só com caixa zerado e sem partida em andamento.
- Pendências não entram no saldo da noite nem passam pelo caixa; "pago" só remove.
- Partida abandonada não conta; partida terminada conta assim que tem vencedor.
- Regras do acordo inalteradas.
- Instalar dependências só com `npx npm@11 i` (registro público já fixado em `.npmrc`). Commits terminam com o trailer de Co-Authored-By/Claude-Session.

## Review Focus

1. **Dado v1 real com partida em andamento e pagamentos** — abre na v2 com a mesma partida, pagamentos viram entradas no caixa. Teste no Task 2 (`migrates a v1 game in progress without losing it`).
2. **Remover um movimento de entrada que já foi gasto** (caixa ficaria negativo) — recusado com mensagem. Teste no Task 1 (`refuses removing a movement that would make the cash negative`).
3. **Recarregar no meio da noite** (com partidas terminadas, movimentos e partida atual) — tudo volta igual. Teste no Task 3 (`persists the night across reload`).
4. **Nomes com maiúsculas/espaços diferentes entre partidas** ("ana" vs "Ana") — o saldo da noite é de um jogador só (Setup já canonicaliza nomes contra os conhecidos; incluir jogadores da noite e das pendências na lista de conhecidos). Teste no Task 6.
5. **Abandonar a partida depois de pagamentos** — a partida some do saldo, os pagamentos ficam como crédito. Teste no Task 3 (`abandoned game does not count but its movements stay`).

---

## File Structure

```
src/app/domain/model.ts       + Movement, Night, Pending; AppData v2; Game sem payments
src/app/domain/cash.ts        computeCash, addMovement, removeMovement, closeNight
src/app/domain/migrate.ts     migrateV1(raw): AppData
src/app/domain/money.ts       reduzido: computeMoney(game) → pote/acerto; acordo; exporta cents
src/app/state/game-store.ts   v2: night, pendings, cash, ações de caixa
src/app/pages/cash/           CashPage (+ agreement.modal, transfer.modal, settle.modal)
src/app/pages/money/          removido (conteúdo migra para cash/)
src/app/shared/pay-button.ts  vira MoveButton (entrada/saída do caixa)
```

---

### Task 1: Domínio do caixa (`cash.ts`) e novos tipos

**Files:**
- Modify: `src/app/domain/model.ts`, `src/app/domain/money.ts` (só exportar `cents`)
- Create: `src/app/domain/cash.ts`
- Test: `src/app/domain/cash.spec.ts`

**Interfaces:**
- Produces (`model.ts`, aditivo — `Game.payments` ainda fica nesta task):
```ts
export type Movement =
  | { id: string; at: string; kind: 'in'; player: string; amount: number }   // jogador → caixa
  | { id: string; at: string; kind: 'out'; player: string; amount: number }  // caixa → jogador
  | { id: string; at: string; kind: 'transfer'; from: string; to: string; amount: number };
export type NewMovement = Omit<Movement, 'id' | 'at'>;  // distributivo por kind
export interface Night { id: string; startedAt: string; games: Game[]; movements: Movement[]; }
export interface Pending { id: string; debtor: string; creditor: string; amount: number; date: string; }
export function newNight(now?: Date): Night
```
- Produces (`cash.ts`):
```ts
export interface CashRow { player: string; result: number; paid: number; received: number; balance: number; } // balance = result + paid − received
export interface CashView { cash: number; games: number; rows: CashRow[]; }
export type CashError = 'invalid-amount' | 'exceeds-cash' | 'same-player' | 'cash-not-empty' | 'game-in-progress';
export function computeCash(night: Night, current: Game | null): CashView
export function addMovement(night: Night, m: NewMovement, current: Game | null, now?: Date): { night: Night } | { error: CashError }
export function removeMovement(night: Night, id: string, current: Game | null): { night: Night } | { error: CashError }
export function closeNight(night: Night, current: Game | null, now?: Date): { pendings: Pending[] } | { error: CashError }
```
Regras: `result` = Σ `settlement.rows[].balance` das `night.games` + partida `current`: se tem vencedor, o `balance` do acerto dela; senão `−put` de cada jogador (`(1+reentradas)×entrada`). `paid` = Σ `in` do jogador + Σ `transfer.from`; `received` = Σ `out` + Σ `transfer.to`. `cash` = Σ in − Σ out. `rows` = todos os jogadores que aparecem em partidas ou movimentos da noite, ordem de primeira aparição. `addMovement`: amount finito > 0 (senão `invalid-amount`); `out` maior que `cash` → `exceeds-cash`; transfer com from === to → `same-player`; valores em centavos. `removeMovement`: recusa com `exceeds-cash` se o caixa resultante ficar < 0. `closeNight`: `current` sem vencedor → `game-in-progress`; `cash > 0` → `cash-not-empty`; senão pendências gulosas (maior devedor com maior credor, repetindo até zerar), `date` = `night.startedAt`.

- [ ] **Step 1: Testes** (entrada R$ 5; use `computeMoney`/`computeGame` existentes para montar partidas terminadas com helpers)
  - `result sums settlements of finished games`: 2 partidas (Ana vence a 1ª com pote 15, Beto a 2ª com pote 15; 3 jogadores sem reentrada) → Ana +5, Beto +5, Carla −10.
  - `game in progress counts what each one put so far`: partida atual sem vencedor, Carla reentrou 1× → Carla `result` −10, demais −5.
  - `in/out/transfer change balance and cash` (a partir de Ana +5, Beto +5, Carla −10): transfer Carla→Beto 5 → Carla −5, Beto 0, cash 0; Carla `in` 5 → Carla 0, cash 5; Ana `out` 5 → Ana 0, cash 0.
  - `sum of balances equals cash` (invariante em qualquer cenário montado).
  - `refuses out beyond the cash` → `exceeds-cash`; `refuses zero/negative/NaN` → `invalid-amount`; `refuses transfer to self` → `same-player`.
  - `refuses removing a movement that would make the cash negative`: in 10, out 10, remover o in → `exceeds-cash`.
  - `closeNight blocks with game in progress` e `with cash left` (códigos acima).
  - `closeNight turns unpaid balances into greedy pendings`: saldos Ana +20, Beto +5, Carla −15, Davi −10, caixa 0 → pendências Carla→Ana 15, Davi→Ana 5, Davi→Beto 5.
- [ ] **Step 2: Rodar e ver falhar** — `npx ng test --watch=false` → FAIL (`cash` não existe).
- [ ] **Step 3: Implementar os tipos e `cash.ts`.**
- [ ] **Step 4: Rodar e ver passar** — PASS.
- [ ] **Step 5: Commit** — `git add src/app/domain && git commit -m "Adiciona regras do caixa da noite"`

---

### Task 2: Migração v1 → v2

**Files:**
- Create: `src/app/domain/migrate.ts`
- Test: `src/app/domain/migrate.spec.ts`
- Modify: `src/app/domain/model.ts`

**Interfaces:**
- Consumes: `Night`, `Movement`, `Pending`, `newNight` (Task 1).
- Produces:
```ts
// model.ts
export interface AppData { version: 2; current: Game | null; night: Night | null; pendings: Pending[]; lastFinished?: Game; lastConfig?: { entryValue: number; reentryLimit: ReentryLimit }; }
export interface AppDataV1 { version: 1; current: Game | null; finished: Game[]; lastConfig?: AppData['lastConfig']; } // Game v1 tem payments
// migrate.ts
export function migrate(raw: unknown, now?: Date): AppData   // aceita v1 ou v2; qualquer outra coisa → vazio
```
Regras: v2 válido passa direto (com defaults para campos faltando). v1: se há `finished` ou `current`, cria uma noite com `games = finished` (ordem por `finishedAt`), `startedAt` = o mais antigo `startedAt`; cada `payment` de cada partida (terminada e atual) vira `{kind:'in', player, amount, at, id}`; `Game.payments` é removido de todas; `lastFinished` = última de `finished`; dívidas antigas descartadas. Sem partidas → `night: null`. Vazio = `{version:2, current:null, night:null, pendings:[]}`.
Nesta task `Game` passa a não ter `payments` (remover do tipo); o compilador vai apontar usos em `money.ts`, store e páginas — **nesta task** só ajuste `money.ts`: `computeMoney(game: Game): { pot: number; put: Record<string, number>; settlement: Settlement | null }` (remove `MoneyRow`, `Debt`, `computeDebts`, `addPayment`, `removePayment`, `suggestedPayment`), mantendo `setAgreement`/`clearAgreement`/`Settlement`. Para o resto compilar, faça a mudança de store/páginas no Task 3 — então **Tasks 2 e 3 são entregues juntas pelo mesmo implementador**, com um commit cada; o build só precisa passar no fim do Task 3.

- [ ] **Step 1: Testes** — `migrates a v1 game in progress without losing it` (current com 2 rodadas e 1 pagamento → `current.rounds.length===2`, `night.movements` com 1 `in` igual ao pagamento, `current` sem `payments`); `folds finished games into one open night` (2 terminadas → `night.games.length===2`, `lastFinished` = a mais recente); `empty v1 gives no night`; `garbage gives empty v2`; `v2 passes through`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar `migrate` e reduzir `money.ts`** (ajustar `money.spec.ts` ao novo retorno: pote, put, acordo e acerto continuam com os mesmos números).
- [ ] **Step 4: Rodar os testes de domínio** — `npx ng test --watch=false` pode falhar só por compilação do store/páginas; os specs de `src/app/domain` devem passar (rodar com `--include src/app/domain`).
- [ ] **Step 5: Commit** — `git commit -m "Migra dados para o formato com caixa da noite"`

---

### Task 3: Store v2

**Files:**
- Modify: `src/app/state/game-store.ts` (+ spec), `src/app/shared/pay-button.ts` (+ spec), `src/app/pages/round/round.page.ts`, `src/app/pages/money/*`, `src/app/pages/game-over/*`, `src/app/pages/setup/*` (só o mínimo para compilar e manter o comportamento — a UI nova vem nos Tasks 4–6)

**Interfaces:**
- Consumes: Tasks 1–2.
- Produces (`GameStore`, além do que já existe exceto o que foi removido):
```ts
readonly night: Signal<Night | null>;
readonly pendings: Signal<Pending[]>;
readonly cash: Signal<CashView | null>;           // computeCash(night, current); null sem noite
readonly money: Signal<GameMoney | null>;         // computeMoney(current) (novo tipo do Task 2, exportar como GameMoney)
readonly lastError: Signal<ActionError | AgreementError | CashError | null>;
payIn(player: string, amount: number): boolean;   // kind 'in'
payOut(player: string, amount: number): boolean;  // kind 'out'
transfer(from: string, to: string, amount: number): boolean;
removeMovement(id: string): boolean;
closeNight(): boolean;                            // grava pendências, night = null
settlePending(id: string): void;
nextConfig(): GameConfig | null;                  // a partir de night.games.at(-1) ?? lastFinished
```
Removidos: `addPayment`, `removePayment`, `debtsFor`. `startGame` cria a noite se `night === null`. `archiveFinished` adiciona a partida a `night.games` e grava `lastFinished`. `abandonGame` só zera `current`. `load()` usa `migrate`. `<app-pay-button>` passa a chamar `payIn` e recebe `[suggested]` do chamador; Rodada "Pagou agora?" chama `payIn`; páginas money/game-over/setup trocam `oldDebts`/`outstanding` por `cash().rows` (saldo da noite) ou removem a seção — o suficiente para compilar.

- [ ] **Step 1: Testes do store** — `persists the night across reload` (2 partidas terminadas + 1 atual + movimentos, reset TestBed → igual); `startGame opens a night once`; `archiveFinished adds to the night`; `abandoned game does not count but its movements stay` (payIn 5 numa partida, abandonar → `cash().rows` do jogador com balance +5, `cash().cash` 5); `closeNight stores pendings and clears the night`; `payOut beyond cash sets lastError exceeds-cash`; `migrates stored v1 on load`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar store e ajustes mínimos de páginas/specs.**
- [ ] **Step 4: `npx ng test --watch=false` e `npx ng build`** — tudo verde, build sem avisos.
- [ ] **Step 5: Commit** — `git commit -m "Store guarda o caixa da noite e pendências"`

---

### Task 4: Página Caixa

**Files:**
- Create: `src/app/pages/cash/cash.page.ts|html|scss`, `src/app/pages/cash/transfer.modal.ts`, move `agreement.modal.ts` de `pages/money/` para `pages/cash/`
- Delete: `src/app/pages/money/`
- Modify: `src/app/app.routes.ts` (tab `jogo/caixa` no lugar de `dinheiro`; rota top-level `caixa` com a mesma página, sem guard), `src/app/pages/game/game.page.ts` (aba "Caixa", ícone `cash-outline`, `tab="caixa"`)
- Test: `src/app/pages/cash/cash.page.spec.ts`

**Interfaces:**
- Consumes: store `cash`, `money`, `view`, `game`, `pendings`, `payIn`, `payOut`, `transfer`, `removeMovement`, `settlePending`, `setAgreement`, `clearAgreement`, `lastError`.

UI (spec "Caixa"):
- Cabeçalho "Caixa"; fora da partida, botão voltar para `/` (o guard decide).
- Topo: **Dinheiro no caixa R$ X** · "N partidas na noite". Sem noite aberta: "Nenhuma noite em andamento" (e só pendências).
- Bloco "Partida atual" (se `game()` sem vencedor): pote da partida e acordo (mesmo comportamento/mensagens da aba Dinheiro atual).
- Jogadores (`cash().rows`): nome, "deve R$ X" (vermelho) / "tem a receber R$ Y" (verde) / "acertado"; botões "pagou ao caixa" (sugerido = |balance| se deve), "recebeu do caixa" (sugerido = min(balance, cash) se tem a receber), "pagou a…" (abre `TransferModal`: escolher o outro jogador + valor).
- Movimentos (mais recentes primeiro): "Ana pagou ao caixa R$ 5,00 · 21:14", "Caixa pagou a Beto…", "Carla pagou a Ana…"; remover com confirmação; erro `exceeds-cash` → "O caixa não tem esse valor".
- Pendências: "Beto deve R$ 20,00 a Ana (noite de dd/mm)" com "pago" (confirmação → `settlePending`).
- O botão "Acerto final" é adicionado no Task 5 (não nesta task).

- [ ] **Step 1: Testes** — saldo deve/receber/acertado renderiza com os números do caso do Task 1; "pagou ao caixa" com sugestão chama `payIn`; transfer modal chama `transfer`; remover movimento que deixaria caixa negativo mostra "O caixa não tem esse valor"; pendência "pago" remove; rota `/caixa` sem partida renderiza.
- [ ] **Step 2–4:** falhar, implementar, passar (`npx ng test --watch=false`, `npx ng build`).
- [ ] **Step 5: Commit** — `git commit -m "Adiciona a tela Caixa"`

---

### Task 5: Acerto final

**Files:**
- Create: `src/app/pages/cash/settle.modal.ts`
- Modify: `src/app/pages/cash/cash.page.*`
- Test: `src/app/pages/cash/settle.modal.spec.ts`

UI (spec "Acerto final"): modal com quem **paga** (balance < 0) e quem **recebe** (balance > 0) e o dinheiro no caixa, atualizando ao vivo; por devedor "pagou ao caixa" (valor = o que deve, editável), por credor "recebeu do caixa" (valor = min(a receber, caixa)); mensagem enquanto `cash > 0` e há credor: "Ainda há R$ X no caixa — pague os credores antes de fechar"; "Fechar a noite" habilitado só sem partida em andamento e com caixa zerado; com partida em andamento: "Termine ou abandone a partida antes do acerto". Ao fechar: confirmação listando as pendências que serão criadas ("Carla deve R$ 15,00 a Ana") → `store.closeNight()` → fecha o modal.

- [ ] **Step 1: Testes** — lista paga/recebe; botão fechar desabilitado com caixa > 0 e com partida em andamento (mensagens exatas); fechar com caixa 0 cria as pendências do caso do Task 1 e zera a noite.
- [ ] **Step 2–4:** falhar, implementar, passar.
- [ ] **Step 5: Commit** — `git commit -m "Adiciona o acerto final da noite"`

---

### Task 6: Ajustes em Rodada, Fim de jogo e Novo jogo

**Files:**
- Modify: `src/app/pages/round/round.page.*`, `src/app/pages/game-over/*`, `src/app/pages/setup/*`, `src/app/pages/setup/validate-players.ts` (se preciso)
- Test: specs dessas páginas

- **Rodada:** texto do "abandonar": header "Abandonar a partida atual?", message "Os pontos desta partida serão descartados. Pagamentos feitos continuam no caixa." (mesmo texto no alerta de abandonar do Novo jogo).
- **Fim de jogo:** mantém vencedor, divisão do pote e tabela Pôs/Recebe/Saldo da partida; acrescenta coluna/linha **"Na noite"** com o `balance` de `cash().rows` de cada jogador ("deve"/"a receber"); botão "Caixa" → `/caixa`; remove "Ainda falta pagar" e "fica como dívida com…".
- **Novo jogo:** por nome digitado (canonicalizado contra jogadores da noite + pendências): saldo da noite se houver noite ("deve R$ X na noite"/"a receber R$ Y na noite") e pendências ("deve R$ X a Ana" / "a receber R$ X de Beto"); botão "Caixa" → `/caixa`.

- [ ] **Step 1: Testes** — Fim de jogo mostra o saldo da noite somando duas partidas e não tem mais "Ainda falta pagar"; Novo jogo mostra "deve R$ 15,00 a Ana" a partir de pendência e reconhece "ana " como "Ana"; texto novo do abandonar nas duas telas.
- [ ] **Step 2–4:** falhar, implementar, passar (`npx ng test --watch=false`, `npx ng build` sem avisos).
- [ ] **Step 5: Commit** — `git commit -m "Mostra o saldo da noite no fim de jogo e no novo jogo"`
