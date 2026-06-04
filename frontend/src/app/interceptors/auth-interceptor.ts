// HTTP interceptor: attaches the JWT to every outgoing request.
// Runs as part of the chain registered in app.config.ts via withInterceptors().
// If there is no token, the request is forwarded unchanged (the login request
// itself needs to be able to go through without an Authorization header).

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
