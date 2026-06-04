// Dashboard shell: a thin role-switcher that renders one of three
// per-role dashboards. This keeps each role's dashboard self-contained
// while the routing layer still maps /dashboard to a single component.

import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';
import { AgentDashboardComponent } from './agent-dashboard/agent-dashboard';
import { ChefDashboardComponent } from './chef-dashboard/chef-dashboard';
import { AdminDashboardComponent } from './admin-dashboard/admin-dashboard';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, AgentDashboardComponent, ChefDashboardComponent, AdminDashboardComponent],
  template: `
    <app-agent-dashboard *ngIf="role === 'agent'"></app-agent-dashboard>
    <app-chef-dashboard *ngIf="role === 'chef_equipe'"></app-chef-dashboard>
    <app-admin-dashboard *ngIf="role === 'admin'"></app-admin-dashboard>
    <div *ngIf="!role" class="loading">Loading dashboard…</div>
  `,
  styles: [`
    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      background: #070b14;
      color: #94a3b8;
      font-size: 1.1rem;
    }
  `]
})
export class DashboardComponent implements OnInit {
  role = '';

  constructor(private auth: AuthService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    // Subscribe to currentUser$ so the right dashboard shows up after login
    // (no role yet) and after a role change (rare in this app but possible).
    this.auth.currentUser$.subscribe(u => {
      this.role = u?.role ?? '';
      this.cdr.detectChanges();
    });
  }
}
