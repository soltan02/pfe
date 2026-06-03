import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';
import { AgentsService } from '../../services/agents';

@Component({
  selector: 'app-team-management',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './team-management.html',
  styleUrls: ['./team-management.css']
})
export class TeamManagementComponent implements OnInit {
  user: any = null;
  teamAgents: any[] = [];
  teamStats = { activeAgents: 0 };
  loading = true;
  selectedAgent: any = null;

  constructor(
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
    this.agents.getAll().subscribe(list => {
      this.teamAgents = list || [];
      this.teamStats.activeAgents = list?.length ?? 0;
      this.loading = false;
      this.cdr.detectChanges();
    });
  }

  selectAgent(agent: any) {
    this.selectedAgent = this.selectedAgent?.id === agent.id ? null : agent;
    this.cdr.detectChanges();
  }

  getAgentStatus(agent: any): string {
    return agent?.statut || agent?.status || 'Active';
  }
}
