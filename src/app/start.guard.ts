import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { GameStore } from './state/game-store';

/** Decide a tela inicial a partir da partida salva. */
export const startGuard: CanActivateFn = () => {
  const game = inject(GameStore).game();
  const target = !game ? '/novo' : game.finishedAt ? '/fim' : '/jogo/rodada';
  return inject(Router).parseUrl(target);
};
