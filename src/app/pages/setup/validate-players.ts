export type PlayersValidation =
  | { names: string[] }
  | { error: 'too-few' | 'empty-name' | 'duplicate'; index?: number };

/** Apara os nomes; exige 2+, sem vazios e sem repetidos (ignora maiúsculas, não acentos). */
export function validatePlayers(names: string[]): PlayersValidation {
  if (names.length < 2) return { error: 'too-few' };
  const trimmed = names.map((n) => n.trim());
  const empty = trimmed.findIndex((n) => n === '');
  if (empty >= 0) return { error: 'empty-name', index: empty };
  const seen = new Set<string>();
  for (let i = 0; i < trimmed.length; i++) {
    const key = trimmed[i].toLocaleLowerCase('pt-BR');
    if (seen.has(key)) return { error: 'duplicate', index: i };
    seen.add(key);
  }
  return { names: trimmed };
}
