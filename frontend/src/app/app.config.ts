// Root application providers (Angular standalone bootstrap).
// Consumed by main.ts -> bootstrapApplication(AppComponent, appConfig).
//
// Provides:
//   - the route table (app.routes.ts)
//   - HttpClient with the authInterceptor attached so every outgoing request
//     gets the JWT Authorization header when a token is present

import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
};
