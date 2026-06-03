import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
      return false;
    }

    const user = this.auth.currentUser$.value;
    const adminOnly = route.data?.['adminOnly'];
    const allowedRoles = route.data?.['allowedRoles'] as string[] | undefined;

    if (adminOnly && user?.role !== 'admin') {
      this.router.navigate(['/dashboard']);
      return false;
    }

    if (allowedRoles?.length) {
      if (!this.roleMatches(user?.role, allowedRoles)) {
        this.router.navigate(['/dashboard']);
        return false;
      }
    }

    return true;
  }

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