import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/** Decide a tela inicial. Por enquanto sempre `/novo`; o Task 5 usa a partida salva. */
export const startGuard: CanActivateFn = () => inject(Router).parseUrl('/novo');
