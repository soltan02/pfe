// Attaches the JWT to every outgoing request when a token is stored.

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();

  if (token) {
    // Clone the request (immutable) with the new header. We don't mutate `req`
    // because Angular re-uses it across interceptors.
    const authReq = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });

    return next(authReq);
  }

  return next(req);
};
