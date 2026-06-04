// Route guard. Two responsibilities:
//   1. Make sure the user is logged in (token in localStorage).
//   2. Enforce the role(s) declared in the route's `data` field, e.g.
//        { path: 'sites', component: SiteListComponent, data: { allowedRoles: ['admin'] } }
//
// The allowedRoles check uses the same numeric scale as the backend's roles.js
// (agent=1, chef=2, admin=3), so listing `['agent']` actually means "agent
// and above" — which is what you usually want.

import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    if (!this.auth.isLoggedIn()) {
      // Not logged in -> send to the login page. The original URL is lost,
      // but for a small app the simple redirect is enough.
      this.router.navigate(['/login']);
      return false;
    }

    const user = this.auth.currentUser$.value;
    const adminOnly = route.data?.['adminOnly'];
    const allowedRoles = route.data?.['allowedRoles'] as string[] | undefined;

    // Legacy `adminOnly: true` flag, kept for any route still using it.
    if (adminOnly && user?.role !== 'admin') {
      this.router.navigate(['/dashboard']);
      return false;
    }

    // Standard allowedRoles check.
    if (allowedRoles?.length) {
      if (!this.roleMatches(user?.role, allowedRoles)) {
        this.router.navigate(['/dashboard']);
        return false;
      }
    }

    return true;
  }

  // Same numeric-level comparison as backend/src/middleware/roles.js.
  // Mirrored here so the guard can decide without a round-trip to the API.
  private roleMatches(userRole: string | undefined, allowedRoles: string[]) {
    if (!userRole) {
      return false;
    }

    const roleLevels: Record<string, number> = {
      agent: 1,
      chef_equipe: 2,
      admin: 3
    };

    const userLevel = roleLevels[userRole] || 0;
    return allowedRoles.some(role => userLevel >= (roleLevels[role] || 0));
  }
}
