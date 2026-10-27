import { AppData, AppDataV1, Game, GameV1, Movement, Night } from './model';

const empty = (): AppData => ({ version: 2, current: null, night: null, pendings: [] });

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Converte o dado guardado (v1 ou v2) para o formato atual; qualquer outra coisa vira vazio. */
export function migrate(raw: unknown, now: Date = new Date()): AppData {
  if (!isObject(raw)) return empty();
  if (raw['version'] === 2) return fromV2(raw as Partial<AppData>);
  if (raw['version'] === 1) {
    const v1 = raw as Partial<AppDataV1>;
    if (v1.finished !== undefined && !Array.isArray(v1.finished)) return empty();
    return fromV1(v1, now);
  }
  return empty();
}

function fromV2(d: Partial<AppData>): AppData {
  const night = isObject(d.night)
    ? { ...d.night, games: d.night.games ?? [], movements: d.night.movements ?? [] }
    : null;
  const data: AppData = {
    version: 2,
    current: d.current ?? null,
    night,
    pendings: Array.isArray(d.pendings) ? d.pendings : [],
  };
  if (d.lastFinished) data.lastFinished = d.lastFinished;
  if (d.lastConfig) data.lastConfig = d.lastConfig;
  return data;
}

function fromV1(d: Partial<AppDataV1>, now: Date): AppData {
  const when = (g: Game): string => g.finishedAt ?? g.startedAt;
  const finished = [...(d.finished ?? [])].sort((a, b) => when(a).localeCompare(when(b)));
  const current = d.current ?? null;
  const all = current ? [...finished, current] : finished;

  const data = empty();
  if (d.lastConfig) data.lastConfig = d.lastConfig;
  if (current) data.current = strip(current);
  if (all.length === 0) return data;

  const movements: Movement[] = all
    .flatMap((g) => g.payments ?? [])
    .map((p): Movement => ({ id: p.id, at: p.at, kind: 'in', player: p.player, amount: p.amount }))
    .sort((a, b) => a.at.localeCompare(b.at));
  const startedAt = all.map((g) => g.startedAt).sort()[0] ?? now.toISOString();
  const night: Night = { id: crypto.randomUUID(), startedAt, games: finished.map(strip), movements };
  data.night = night;
  if (night.games.length > 0) data.lastFinished = night.games.at(-1);
  return data;
}

function strip(g: GameV1): Game {
  const { payments: _payments, ...game } = g;
  return game;
}
