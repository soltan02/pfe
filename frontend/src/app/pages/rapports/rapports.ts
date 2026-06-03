import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-rapports',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './rapports.html',
  styleUrls: ['./rapports.css']
})
export class RapportsComponent implements OnInit {
  form!: FormGroup;
  rapports: any[] = [];
  agents: any[] = [];
  loading = false;
  showForm = false;
  user: any = null;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      agent_id: ['', Validators.required],
      type: ['incident', Validators.required],
      contenu: ['', Validators.required],
      date: [new Date().toISOString().split('T')[0], Validators.required]
    });
  }

  ngOnInit() {
    // If user already logged in, currentUser$ already has a value
    const currentUser = this.auth.currentUser$.value;
    if (currentUser) {
      this.user = currentUser;
      this.loadRapports();
      if (!this.isAdmin()) {
        this.loadAgents();
      }
    }
    this.auth.currentUser$.subscribe(u => {
      if (u && !this.user) {
        this.user = u;
        this.loadRapports();
        if (!this.isAdmin()) {
          this.loadAgents();
        }
      }
    });
  }

  isAdmin(): boolean {
    return this.user?.role === 'admin';
  }

  loadRapports() {
    const endpoint = this.isAdmin() ? '/rapports/admin/all' : '/rapports';
    this.http.get<any[]>(`${environment.apiUrl}${endpoint}`).subscribe({
      next: (data) => {
        this.rapports = data;
      },
      error: (e) => console.error('Error loading rapports:', e)
    });
  }

  validateRapport(id: number) {
    this.http.put(`${environment.apiUrl}/rapports/${id}/validate`, {}).subscribe({
      next: () => {
        this.loadRapports();
      },
      error: (e) => console.error('Error validating rapport:', e)
    });
  }

  loadAgents() {
    this.http.get<any[]>(`${environment.apiUrl}/agents`).subscribe({
      next: (data) => {
        this.agents = data;
      },
      error: (e) => console.error('Error loading agents:', e)
    });
  }

  createRapport() {
    if (!this.form.valid) return;

    this.loading = true;
    this.http.post(`${environment.apiUrl}/rapports`, this.form.value).subscribe({
      next: () => {
        this.loading = false;
        this.form.reset({ date: new Date().toISOString().split('T')[0] });
        this.showForm = false;
        this.loadRapports();
      },
      error: (e) => {
        this.loading = false;
        console.error('Error:', e);
      }
    });
  }

  getStatusColor(statut: string): string {
    if (statut === 'pending') return '#fbbf24';
    if (statut === 'approved') return '#10b981';
    return '#ef4444';
  }

  getTypeLabel(type: string): string {
    const labels: any = {
      'incident': '⚠️ Incident',
      'absence': '❌ Absence',
      'sante': '🏥 Health Issue',
      'autre': '📝 Other'
    };
    return labels[type] || type;
  }
}
