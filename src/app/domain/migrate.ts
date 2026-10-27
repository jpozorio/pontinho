import { AppData, Game, GameV1, Movement, Night, Payment, Pending } from './model';

const empty = (): AppData => ({ version: 2, current: null, night: null, pendings: [] });

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

const arrayOf = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

const text = (x: unknown): string => (typeof x === 'string' ? x : '');

/** Partida minimamente utilizável: id, jogadores e rodadas; o resto ganha padrão. */
function asGame(x: unknown): GameV1 | null {
  if (!isObject(x) || typeof x['id'] !== 'string') return null;
  const config = x['config'];
  if (!isObject(config) || !Array.isArray(config['players']) || !Array.isArray(x['rounds'])) return null;
  return { ...(x as unknown as GameV1), draft: isObject(x['draft']) ? (x['draft'] as Game['draft']) : {} };
}

const games = (x: unknown): GameV1[] => arrayOf(x).map(asGame).filter((g): g is GameV1 => g !== null);

/** Converte o dado guardado (v1 ou v2) para o formato atual; qualquer outra coisa vira vazio. */
export function migrate(raw: unknown, now: Date = new Date()): AppData {
  if (!isObject(raw)) return empty();
  if (raw['version'] === 2) return fromV2(raw);
  if (raw['version'] === 1) return fromV1(raw, now);
  return empty();
}

function fromV2(d: Record<string, unknown>): AppData {
  const n = d['night'];
  const night: Night | null = isObject(n)
    ? {
        ...(n as unknown as Night),
        id: typeof n['id'] === 'string' ? n['id'] : crypto.randomUUID(),
        startedAt: text(n['startedAt']),
        games: games(n['games']).map(strip),
        movements: arrayOf(n['movements']).filter(isObject) as unknown as Movement[],
      }
    : null;
  const current = asGame(d['current']);
  const data: AppData = {
    version: 2,
    current: current && strip(current),
    night,
    pendings: arrayOf(d['pendings']).filter(isObject) as unknown as Pending[],
  };
  const last = asGame(d['lastFinished']);
  if (last) data.lastFinished = strip(last);
  if (isObject(d['lastConfig'])) data.lastConfig = d['lastConfig'] as AppData['lastConfig'];
  return data;
}

function fromV1(d: Record<string, unknown>, now: Date): AppData {
  const when = (g: Game): string => text(g.finishedAt) || text(g.startedAt);
  const finished = games(d['finished']).sort((a, b) => when(a).localeCompare(when(b)));
  const current = asGame(d['current']);
  const all = current ? [...finished, current] : finished;

  const data = empty();
  if (isObject(d['lastConfig'])) data.lastConfig = d['lastConfig'] as AppData['lastConfig'];
  if (current) data.current = strip(current);
  if (all.length === 0) return data;

  const movements: Movement[] = all
    .flatMap((g) => arrayOf(g.payments))
    .filter(
      (p): p is Payment =>
        isObject(p) && typeof p['player'] === 'string' && Number.isFinite(p['amount']) && (p['amount'] as number) > 0,
    )
    .map(
      (p): Movement => ({
        id: typeof p.id === 'string' ? p.id : crypto.randomUUID(),
        at: text(p.at),
        kind: 'in',
        player: p.player,
        amount: p.amount,
      }),
    )
    .sort((a, b) => a.at.localeCompare(b.at));
  const startedAt =
    all
      .map((g) => text(g.startedAt))
      .filter((s) => s !== '')
      .sort()[0] ?? now.toISOString();
  const night: Night = { id: crypto.randomUUID(), startedAt, games: finished.map(strip), movements };
  data.night = night;
  if (night.games.length > 0) data.lastFinished = night.games.at(-1);
  return data;
}

function strip(g: GameV1): Game {
  const { payments: _payments, ...game } = g;
  return game;
}
