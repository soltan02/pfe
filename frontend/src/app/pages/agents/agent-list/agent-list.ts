import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AgentsService } from '../../../services/agents';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-agent-list',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './agent-list.html'
})
export class AgentListComponent implements OnInit {
  agents: any[] = [];
  siteGroups: { siteName: string; chefName: string; agents: any[] }[] = [];
  loading = true;
  error = '';
  selectedAgentId: number | null = null;
  passwordForm: FormGroup;
  pwdMessage = '';
  pwdError = '';

  constructor(
    private agentsService: AgentsService,
    private http: HttpClient,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.passwordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(4)]]
    });
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading = true;
    this.agentsService.getAll().subscribe({
      next: (data) => {
        this.agents = data;
        this.buildSiteGroups();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.error = 'Loading error'; this.loading = false; this.cdr.detectChanges(); }
    });
  }

  delete(id: number) {
    if (!confirm('Delete this agent?')) return;
    this.agentsService.delete(id).subscribe({
      next: () => this.load(),
      error: () => alert('Error during deletion')
    });
  }

  openPasswordModal(agentId: number) {
    this.selectedAgentId = agentId;
    this.passwordForm.reset();
    this.pwdMessage = '';
    this.pwdError = '';
    this.cdr.detectChanges();
  }

  buildSiteGroups() {
    const map = new Map<string, { siteName: string; chefName: string; agents: any[] }>();
    for (const a of this.agents) {
      const key = a.site_nom || 'Unassigned';
      if (!map.has(key)) {
        map.set(key, { siteName: key, chefName: a.chef_nom || '', agents: [] });
      }
      map.get(key)!.agents.push(a);
    }
    this.siteGroups = Array.from(map.values());
  }

  closeModal() {
    this.selectedAgentId = null;
    this.cdr.detectChanges();
  }

  changePassword() {
    if (this.passwordForm.invalid) return;
    this.http.put(
      `${environment.apiUrl}/auth/change-password-agent/${this.selectedAgentId}`,
      { newPassword: this.passwordForm.value.newPassword }
    ).subscribe({
      next: () => {
        this.pwdMessage = 'Password changed successfully!';
        this.pwdError = '';
        this.passwordForm.reset();
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.pwdError = e.error?.error || 'Error';
        this.pwdMessage = '';
        this.cdr.detectChanges();
      }
    });
  }
}