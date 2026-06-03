import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  currentUser$ = new BehaviorSubject<any>(null);

  constructor(private http: HttpClient, private router: Router) {
    // Try to restore user from token on initialization
    const token = this.getToken();
    if (token) {
      const decoded = this.decodeToken(token);
      if (decoded) {
        this.currentUser$.next(decoded);
      }
    }
  }

  login(email: string, password: string) {
    return this.http.post(`${environment.apiUrl}/auth/login`, { email, password });
  }

  fetchMe() {
    this.http.get(`${environment.apiUrl}/auth/me`).subscribe({
      next: (u: any) => {
        this.currentUser$.next(u);
      },
      error: (e) => {
        console.error('fetchMe error:', e);
      }
    });
  }

  saveToken(t: string) { localStorage.setItem('token', t); }
  getToken() { return localStorage.getItem('token'); }

  logout() {
    localStorage.removeItem('token');
    this.currentUser$.next(null);
    this.router.navigate(['/login']);
  }

  isLoggedIn() { return !!this.getToken(); }

  private decodeToken(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]));
      return { id: payload.id, email: payload.email, role: payload.role };
    } catch {
      return null;
    }
  }
}