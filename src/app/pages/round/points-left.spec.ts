import { leftLevel } from './points-left';

describe('leftLevel', () => {
  it('is ok with plenty of room', () => expect(leftLevel(20)).toBe('ok'));
  it('is near at 19', () => expect(leftLevel(19)).toBe('near'));
  it('is near at 0', () => expect(leftLevel(0)).toBe('near'));
  it('is bust below zero', () => expect(leftLevel(-1)).toBe('bust'));
});
