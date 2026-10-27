import { computeGame } from './engine';
import { Game } from './model';

export interface Debt {
  debtor: string;
  creditor: string;
  amount: number;
  gameId: string;
  date: string;
}

export interface MoneyRow {
  player: string;
  /** 1 + reentradas */
  entries: number;
  /** entries × entryValue */
  owes: number;
  /** pagamentos do jogador após quitar dívidas antigas */
  paidInGame: number;
  /** max(0, owes - paidInGame) */
  outstanding: number;
  /** dívidas antigas ainda abertas depois dos pagamentos */
  oldDebts: Debt[];
}

export interface SettlementRow {
  player: string;
  put: number;
  receives: number;
  balance: number;
}

export interface Settlement {
  pot: number;
  saves: Record<string, number>;
  winner: string;
  winnerTakes: number;
  rows: SettlementRow[];
}

export interface MoneyView {
  rows: MoneyRow[];
  pot: number;
  /** soma do que falta pagar da partida atual (sem dívidas antigas) */
  missingToPot: number;
  settlement: Settlement | null;
}

export type AgreementError = 'not-two-players' | 'invalid-amount' | 'exceeds-pot';

/** Arredonda para centavos, eliminando restos de ponto flutuante. */
export const cents =(x: number): number => Math.round(x * 100) / 100;
const sum = (xs: number[]): number => cents(xs.reduce((a, b) => a + b, 0));

export function computeMoney(game: Game, priorDebts: Debt[]): MoneyView {
  const view = computeGame(game);

  const rows = view.players.map((p): MoneyRow => {
    const entries = 1 + p.reentries;
    const owes = cents(entries * game.config.entryValue);
    let paid = sum(game.payments.filter((x) => x.player === p.name).map((x) => x.amount));
    const oldDebts: Debt[] = [];
    const mine = priorDebts
      .filter((d) => d.debtor === p.name)
      .sort((a, b) => a.date.localeCompare(b.date));
    for (const d of mine) {
      const used = Math.min(paid, d.amount);
      paid = cents(paid - used);
      const left = cents(d.amount - used);
      if (left > 0) oldDebts.push({ ...d, amount: left });
    }
    return {
      player: p.name,
      entries,
      owes,
      paidInGame: paid,
      outstanding: Math.max(0, cents(owes - paid)),
      oldDebts,
    };
  });

  const pot = sum(rows.map((r) => r.owes));
  const missingToPot = sum(rows.map((r) => r.outstanding));

  let settlement: Settlement | null = null;
  if (view.winner !== null) {
    const winner = view.winner;
    const agreed = game.agreement?.saves;
    // Só vale se o vencedor era um dos dois do acordo.
    const valid = agreed !== undefined && Object.hasOwn(agreed, winner);
    const saves = valid ? { ...agreed } : {};
    const partner = Object.keys(saves).find((n) => n !== winner);
    const partnerSave = partner !== undefined ? saves[partner] : 0;
    const winnerTakes = pot - partnerSave;
    settlement = {
      pot,
      saves,
      winner,
      winnerTakes,
      rows: rows.map((r) => {
        const receives = r.player === winner ? winnerTakes : r.player === partner ? partnerSave : 0;
        return { player: r.player, put: r.owes, receives, balance: receives - r.owes };
      }),
    };
  }
  return { rows, pot, missingToPot, settlement };
}

export function computeDebts(finished: Game[]): Debt[] {
  let open: Debt[] = [];
  const when = (g: Game): string => g.finishedAt ?? g.startedAt;
  const ordered = [...finished].sort((a, b) => when(a).localeCompare(when(b)));
  for (const g of ordered) {
    const winner = computeGame(g).winner;
    if (winner === null) continue;
    const money = computeMoney(g, open);
    const inGame = new Set(g.config.players);
    const date = g.finishedAt ?? g.startedAt;
    const carried = [
      ...open.filter((d) => !inGame.has(d.debtor)),
      ...money.rows.flatMap((r) => r.oldDebts),
    ].sort((a, b) => a.date.localeCompare(b.date));
    const fresh = money.rows
      .filter((r) => r.player !== winner && r.outstanding > 0)
      .map((r): Debt => ({ debtor: r.player, creditor: winner, amount: r.outstanding, gameId: g.id, date }));
    open = [...carried, ...fresh];
  }
  return open;
}

export function addPayment(game: Game, player: string, amount: number, now: Date = new Date()): Game {
  if (!Number.isFinite(amount) || amount <= 0) return game;
  const payment = { id: crypto.randomUUID(), player, amount, at: now.toISOString() };
  return { ...game, payments: [...game.payments, payment] };
}

export function removePayment(game: Game, id: string): Game {
  return { ...game, payments: game.payments.filter((p) => p.id !== id) };
}

export function setAgreement(
  game: Game,
  saves: Record<string, number>,
): { game: Game } | { error: AgreementError } {
  const view = computeGame(game);
  if (view.winner !== null || view.playingCount !== 2) return { error: 'not-two-players' };
  const two = view.players.filter((p) => p.playsNextRound).map((p) => p.name);
  if (Object.keys(saves).length !== 2 || !two.every((n) => Object.hasOwn(saves, n))) {
    return { error: 'not-two-players' };
  }
  if (!two.every((n) => Number.isFinite(saves[n]) && saves[n] >= 0)) return { error: 'invalid-amount' };
  if (sum(two.map((n) => saves[n])) > computeMoney(game, []).pot) return { error: 'exceeds-pot' };
  return { game: { ...game, agreement: { saves: Object.fromEntries(two.map((n) => [n, saves[n]])) } } };
}

export function clearAgreement(game: Game): Game {
  if (!game.agreement) return game;
  const { agreement: _removed, ...rest } = game;
  return rest;
}

/** Valor sugerido no "+ pagou": o que falta da partida atual mais as dívidas antigas abertas. */
export function suggestedPayment(r: MoneyRow): number {
  return cents(r.outstanding + r.oldDebts.reduce((a, d) => a + d.amount, 0));
}
