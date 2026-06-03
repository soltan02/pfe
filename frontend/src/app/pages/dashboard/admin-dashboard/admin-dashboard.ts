import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth';
import { AgentsService } from '../../../services/agents';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.css']
})
export class AdminDashboardComponent implements OnInit {
  user: any = null;
  systemStats = { agents: 0, sites: 0, affectations: 0, users: 0 };
  recentAffectations: any[] = [];
  recentAgents: any[] = [];
  chefRequests: any[] = [];
  loading = true;

  readonly todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private agents: AgentsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.auth.currentUser$.subscribe(u => {
      this.user = u;
      if (u) this.loadAll();
      this.cdr.detectChanges();
    });
  }

  private loadAll() {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/dashboard/stats`).subscribe(s => {
      this.systemStats = s;
      this.cdr.detectChanges();
    });
    this.http.get<any[]>(`${environment.apiUrl}/affectations`).subscribe(list => {
      this.recentAffectations = (list || []).slice(0, 5);
      this.chefRequests = (list || []).slice(0, 5).map(aff => ({
        id: aff.id,
        chef_nom: aff.chef_nom || 'Chef d\'équipe',
        type: 'Affectation',
        description: `${aff.agent_nom} → ${aff.site_nom}`,
        date_creation: aff.date_debut
      }));
      this.cdr.detectChanges();
    });
    this.agents.getAll().subscribe(list => {
      this.recentAgents = (list || []).slice(0, 5);
      this.loading = false;
      this.cdr.detectChanges();
    });
  }

  deleteAgent(id: number) {
    if (!confirm('Delete this agent?')) return;
    this.agents.delete(id).subscribe(() => this.loadAll());
  }

  statusClass(statut: string): string {
    if (statut === 'active') return 'active';
    if (statut === 'pending') return 'pending';
    return 'inactive';
  }
}
