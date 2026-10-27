import { canonicalName, validatePlayers } from './validate-players';

describe('canonicalName', () => {
  it('usa a grafia conhecida ignorando maiúsculas e espaços', () => {
    expect(canonicalName(' ana ', ['Beto', 'Ana'])).toBe('Ana');
  });

  it('sem correspondência devolve o nome aparado', () => {
    expect(canonicalName(' Carla ', ['Ana'])).toBe('Carla');
  });
});

describe('validatePlayers', () => {
  it('detecta nome repetido sem diferenciar maiúsculas e aponta a linha', () => {
    expect(validatePlayers(['Ana', ' ana '])).toEqual({ error: 'duplicate', index: 1 });
  });

  it('detecta nome vazio', () => {
    expect(validatePlayers(['Ana', ''])).toEqual({ error: 'empty-name', index: 1 });
    expect(validatePlayers(['Ana', '   '])).toEqual({ error: 'empty-name', index: 1 });
  });

  it('exige pelo menos 2 jogadores', () => {
    expect(validatePlayers(['Ana'])).toEqual({ error: 'too-few' });
    expect(validatePlayers([])).toEqual({ error: 'too-few' });
  });

  it('apara espaços e devolve os nomes', () => {
    expect(validatePlayers([' Ana ', 'Beto'])).toEqual({ names: ['Ana', 'Beto'] });
  });

  it('não confunde nomes com acentos diferentes', () => {
    expect(validatePlayers(['José', 'Jose'])).toEqual({ names: ['José', 'Jose'] });
  });
});
