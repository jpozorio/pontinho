import { computeGame } from './engine';
import { Game } from './model';

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

/** Dinheiro de uma partida: pote, o que cada um pôs e, se terminou, o acerto. */
export interface GameMoney {
  pot: number;
  /** (1 + reentradas) × entrada, por jogador */
  put: Record<string, number>;
  settlement: Settlement | null;
}

export type AgreementError = 'not-two-players' | 'invalid-amount' | 'exceeds-pot';

/** Arredonda para centavos, eliminando restos de ponto flutuante. */
export const cents = (x: number): number => Math.round(x * 100) / 100;
const sum = (xs: number[]): number => cents(xs.reduce((a, b) => a + b, 0));

export function computeMoney(game: Game): GameMoney {
  const view = computeGame(game);
  const put: Record<string, number> = Object.fromEntries(
    view.players.map((p) => [p.name, cents((1 + p.reentries) * game.config.entryValue)]),
  );
  const pot = sum(Object.values(put));

  let settlement: Settlement | null = null;
  if (view.winner !== null) {
    const winner = view.winner;
    const agreed = game.agreement?.saves;
    // Só vale se o vencedor era um dos dois do acordo.
    const valid = agreed !== undefined && Object.hasOwn(agreed, winner);
    const saves = valid ? { ...agreed } : {};
    const partner = Object.keys(saves).find((n) => n !== winner);
    const partnerSave = partner !== undefined ? saves[partner] : 0;
    const winnerTakes = cents(pot - partnerSave);
    settlement = {
      pot,
      saves,
      winner,
      winnerTakes,
      rows: view.players.map((p) => {
        const receives = p.name === winner ? winnerTakes : p.name === partner ? partnerSave : 0;
        return { player: p.name, put: put[p.name], receives, balance: cents(receives - put[p.name]) };
      }),
    };
  }
  return { pot, put, settlement };
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
  if (sum(two.map((n) => saves[n])) > computeMoney(game).pot) return { error: 'exceeds-pot' };
  return { game: { ...game, agreement: { saves: Object.fromEntries(two.map((n) => [n, saves[n]])) } } };
}

export function clearAgreement(game: Game): Game {
  if (!game.agreement) return game;
  const { agreement: _removed, ...rest } = game;
  return rest;
}
