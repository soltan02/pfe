import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth';
import { AgentsService } from '../../services/agents';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-agent-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './agent-profile.html',
  styleUrls: ['./agent-profile.css']
})
export class AgentProfileComponent implements OnInit {
  user: any = null;
  profileStats = { totalAssignments: 0, completedAssignments: 0, hoursWorked: 0 };
  teamStats = { teamSize: 0, activeAffectations: 0, sitesManaged: 0 };
  assignmentHistory: any[] = [];
  loading = true;
  editMode = false;
  saveSuccess = '';
  saveError = '';
  currentPassword = '';
  newPassword = '';
  pwdLoading = false;
  pwdSuccess = '';
  pwdError = '';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private agents: AgentsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.auth.currentUser$.subscribe(u => {
      this.user = { ...u };
      if (u) {
        this.loadProfile();
        if (this.isManager()) this.loadTeamStats();
      }
      this.cdr.detectChanges();
    });
  }

  isAgent(): boolean { return this.user?.role === 'agent'; }
  isChef(): boolean { return this.user?.role === 'chef_equipe'; }
  isAdmin(): boolean { return this.user?.role === 'admin'; }
  isManager(): boolean { return this.isChef() || this.isAdmin(); }

  roleLabel(): string {
    if (this.isAdmin()) return 'Administrator';
    if (this.isChef()) return 'Team Leader';
    return 'Security Agent';
  }

  toggleEdit() {
    this.editMode = !this.editMode;
    this.saveSuccess = '';
    this.saveError = '';
  }

  save() {
    const payload: any = {};
    if (this.user?.nom) payload.nom = this.user.nom;
    if (this.user?.email) payload.email = this.user.email;
    if (this.user?.telephone) payload.telephone = this.user.telephone;

    this.http.put(`${environment.apiUrl}/users/profile`, payload).subscribe({
      next: (res: any) => {
        this.saveSuccess = 'Profile updated successfully!';
        this.editMode = false;
        this.auth.currentUser$.next(res.user);
        this.loadProfile();
      },
      error: (e) => { this.saveError = e.error?.error || 'Failed to save profile'; }
    });
  }

  changePassword() {
    this.pwdSuccess = '';
    this.pwdError = '';
    if (!this.currentPassword || !this.newPassword) {
      this.pwdError = 'Please fill in both password fields';
      return;
    }
    this.pwdLoading = true;
    this.http.put(`${environment.apiUrl}/users/change-own-password`, {
      currentPassword: this.currentPassword,
      newPassword: this.newPassword
    }).subscribe({
      next: () => {
        this.pwdSuccess = 'Password changed successfully!';
        this.currentPassword = '';
        this.newPassword = '';
        this.pwdLoading = false;
      },
      error: (e) => {
        this.pwdError = e.error?.error || 'Failed to change password';
        this.pwdLoading = false;
      }
    });
  }

  private loadProfile() {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/auth/me`).subscribe({
      next: data => {
        this.user = { ...this.user, ...data };
        if (!this.isAgent()) { this.loading = false; this.cdr.detectChanges(); return; }
        this.http.get<any[]>(`${environment.apiUrl}/affectations/mes-affectations`).subscribe({
          next: list => {
            this.assignmentHistory = list || [];
            this.profileStats.totalAssignments = list?.length ?? 0;
            this.profileStats.completedAssignments = (list || []).filter(a => a.statut === 'completed').length;
            this.profileStats.hoursWorked = (list || []).reduce((sum, a) => sum + (a.heures || 0), 0);
            this.loading = false;
            this.cdr.detectChanges();
          },
          error: () => { this.loading = false; this.cdr.detectChanges(); }
        });
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  private loadTeamStats() {
    this.agents.getAll().subscribe(list => {
      this.teamStats.teamSize = list?.length ?? 0;
      this.cdr.detectChanges();
    });
    this.http.get<any[]>(`${environment.apiUrl}/affectations`).subscribe(list => {
      this.teamStats.activeAffectations = (list || []).filter(a => a.statut === 'active').length;
      this.teamStats.sitesManaged = new Set((list || []).map(a => a.site_id)).size;
      this.cdr.detectChanges();
    });
  }
}
