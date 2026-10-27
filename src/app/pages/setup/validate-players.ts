export type PlayersValidation =
  | { names: string[] }
  | { error: 'too-few' | 'empty-name' | 'duplicate'; index?: number };

const key = (n: string): string => n.trim().toLocaleLowerCase('pt-BR');

/** Apara os nomes; exige 2+, sem vazios e sem repetidos (ignora maiúsculas, não acentos). */
export function validatePlayers(names: string[]): PlayersValidation {
  if (names.length < 2) return { error: 'too-few' };
  const trimmed = names.map((n) => n.trim());
  const empty = trimmed.findIndex((n) => n === '');
  if (empty >= 0) return { error: 'empty-name', index: empty };
  const seen = new Set<string>();
  for (let i = 0; i < trimmed.length; i++) {
    const k = key(trimmed[i]);
    if (seen.has(k)) return { error: 'duplicate', index: i };
    seen.add(k);
  }
  return { names: trimmed };
}

/** Devolve a grafia já conhecida (ignora maiúsculas e espaços); senão o nome aparado. */
export function canonicalName(typed: string, known: string[]): string {
  const k = key(typed);
  return known.find((n) => key(n) === k) ?? typed.trim();
}
