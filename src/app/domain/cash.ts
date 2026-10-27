import { computeGame } from './engine';
import { Game, Movement, NewMovement, Night, Pending } from './model';
import { cents, computeMoney } from './money';

export interface CashRow {
  player: string;
  result: number;
  paid: number;
  received: number;
  /** result + paid − received */
  balance: number;
}

export interface CashView {
  cash: number;
  games: number;
  rows: CashRow[];
}

export type CashError = 'invalid-amount' | 'exceeds-cash' | 'same-player' | 'cash-not-empty' | 'game-in-progress';

/** Resultado por jogador de uma partida (terminada: acerto; em andamento: −o que pôs). */
function gameResults(game: Game): [string, number][] {
  const money = computeMoney(game, []);
  if (money.settlement) return money.settlement.rows.map((r): [string, number] => [r.player, r.balance]);
  return computeGame(game).players.map((p): [string, number] => [
    p.name,
    -cents((1 + p.reentries) * game.config.entryValue),
  ]);
}

function cashOf(movements: Movement[]): number {
  return cents(
    movements.reduce((a, m) => (m.kind === 'in' ? a + m.amount : m.kind === 'out' ? a - m.amount : a), 0),
  );
}

export function computeCash(night: Night, current: Game | null): CashView {
  const order: string[] = [];
  const result = new Map<string, number>();
  const paid = new Map<string, number>();
  const received = new Map<string, number>();
  const add = (map: Map<string, number>, p: string, v: number): void => {
    if (!order.includes(p)) order.push(p);
    map.set(p, (map.get(p) ?? 0) + v);
  };

  for (const g of night.games) for (const [p, v] of gameResults(g)) add(result, p, v);
  if (current) for (const [p, v] of gameResults(current)) add(result, p, v);
  for (const m of night.movements) {
    if (m.kind === 'in') add(paid, m.player, m.amount);
    else if (m.kind === 'out') add(received, m.player, m.amount);
    else {
      add(paid, m.from, m.amount);
      add(received, m.to, m.amount);
    }
  }

  const rows = order.map((player): CashRow => {
    const r = cents(result.get(player) ?? 0);
    const pd = cents(paid.get(player) ?? 0);
    const rc = cents(received.get(player) ?? 0);
    return { player, result: r, paid: pd, received: rc, balance: cents(r + pd - rc) };
  });
  return { cash: cashOf(night.movements), games: night.games.length, rows };
}

export function addMovement(
  night: Night,
  m: NewMovement,
  current: Game | null,
  now: Date = new Date(),
): { night: Night } | { error: CashError } {
  if (!Number.isFinite(m.amount) || m.amount <= 0) return { error: 'invalid-amount' };
  const amount = cents(m.amount);
  if (amount <= 0) return { error: 'invalid-amount' };
  if (m.kind === 'transfer' && m.from === m.to) return { error: 'same-player' };
  if (m.kind === 'out' && amount > computeCash(night, current).cash) return { error: 'exceeds-cash' };
  const movement = { ...m, amount, id: crypto.randomUUID(), at: now.toISOString() } as Movement;
  return { night: { ...night, movements: [...night.movements, movement] } };
}

export function removeMovement(
  night: Night,
  id: string,
  current: Game | null,
): { night: Night } | { error: CashError } {
  const next: Night = { ...night, movements: night.movements.filter((m) => m.id !== id) };
  if (computeCash(next, current).cash < 0) return { error: 'exceeds-cash' };
  return { night: next };
}

export function closeNight(
  night: Night,
  current: Game | null,
  _now: Date = new Date(),
): { pendings: Pending[] } | { error: CashError } {
  if (current && computeGame(current).winner === null) return { error: 'game-in-progress' };
  const view = computeCash(night, current);
  if (view.cash > 0) return { error: 'cash-not-empty' };

  const debtors = view.rows.filter((r) => r.balance < 0).map((r) => ({ p: r.player, left: -r.balance }));
  const creditors = view.rows.filter((r) => r.balance > 0).map((r) => ({ p: r.player, left: r.balance }));
  debtors.sort((a, b) => b.left - a.left);
  creditors.sort((a, b) => b.left - a.left);

  const pendings: Pending[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const amount = cents(Math.min(d.left, c.left));
    if (amount > 0) {
      pendings.push({ id: crypto.randomUUID(), debtor: d.p, creditor: c.p, amount, date: night.startedAt });
    }
    d.left = cents(d.left - amount);
    c.left = cents(c.left - amount);
    if (d.left <= 0) i++;
    if (c.left <= 0) j++;
  }
  return { pendings };
}
