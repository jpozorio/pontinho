/** Interpreta um valor digitado em reais ("5", "5,50", "5.50"); null se inválido ou não positivo. */
export function parseAmount(raw: unknown, allowZero = false): number | null {
  const text = String(raw ?? '').trim().replace(',', '.');
  if (text === '' || !/^\d+(\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || (n === 0 && !allowZero)) return null;
  return Math.round(n * 100) / 100;
}
