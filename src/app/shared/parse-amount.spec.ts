import { parseAmount } from './parse-amount';

describe('parseAmount', () => {
  it('accepts integers and comma/dot decimals', () => {
    expect(parseAmount('5')).toBe(5);
    expect(parseAmount('5,50')).toBe(5.5);
    expect(parseAmount('5.50')).toBe(5.5);
    expect(parseAmount(' 7 ')).toBe(7);
  });

  it('rounds to cents', () => {
    expect(parseAmount('2,3333')).toBe(2.33);
    expect(parseAmount('2,678')).toBe(2.68);
  });

  it('rejects invalid input', () => {
    for (const bad of ['', 'abc', '-1', '1,2,3', '5 reais', null, undefined]) expect(parseAmount(bad)).toBeNull();
  });

  it('rejects zero unless allowed', () => {
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('0', true)).toBe(0);
    expect(parseAmount('-1', true)).toBeNull();
  });
});
