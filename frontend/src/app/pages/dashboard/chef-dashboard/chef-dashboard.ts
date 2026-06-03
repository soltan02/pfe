import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth';
import { AgentsService } from '../../../services/agents';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-chef-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './chef-dashboard.html',
  styleUrls: ['./chef-dashboard.css']
})
export class ChefDashboardComponent implements OnInit {
  user: any = null;
  teamStats = { agentsCount: 0, activeAffectations: 0, pendingAffectations: 0 };
  teamAgents: any[] = [];
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
    this.http.get<any[]>(`${environment.apiUrl}/affectations`).subscribe(list => {
      this.teamStats.activeAffectations = list.filter(a => a.statut === 'active').length;
      this.teamStats.pendingAffectations = list.filter(a => a.statut === 'pending').length;
      this.cdr.detectChanges();
    });
    this.agents.getAll().subscribe(list => {
      this.teamAgents = (list || []).slice(0, 5);
      this.teamStats.agentsCount = list?.length ?? 0;
      this.loading = false;
      this.cdr.detectChanges();
    });
  }

  statusClass(statut: string): string {
    if (statut === 'active') return 'active';
    if (statut === 'pending') return 'pending';
    return 'inactive';
  }
}
