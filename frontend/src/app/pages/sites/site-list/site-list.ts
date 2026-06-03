import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SitesService } from '../../../services/sites';
import { AuthService } from '../../../services/auth';

@Component({
  selector: 'app-site-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './site-list.html'
})
export class SiteListComponent implements OnInit {
  sites: any[] = [];
  loading = true;
  error = '';
  user: any = null;

  constructor(
    private sitesService: SitesService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.auth.currentUser$.subscribe(u => {
      this.user = u;
      this.load();
    });
  }

  load() {
    this.loading = true;
    this.sitesService.getAll().subscribe({
      next: (data) => { this.sites = data; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.error = 'Loading error'; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  delete(id: number) {
    if (!confirm('Delete this site?')) return;
    this.sitesService.delete(id).subscribe({
      next: () => this.load(),
      error: () => alert('Error during deletion')
    });
  }

  // Role-based checks
  isAdmin(): boolean {
    return this.user?.role === 'admin';
  }

  isChef(): boolean {
    return this.user?.role === 'chef_equipe';
  }

  canEditSites(): boolean {
    return this.isAdmin();
  }

  canDeleteSites(): boolean {
    return this.isAdmin();
  }

  canCreateSites(): boolean {
    return this.isAdmin();
  }
}