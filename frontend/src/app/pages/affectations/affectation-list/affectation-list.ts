import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AffectationsService } from '../../../services/affectations';
import { AgentsService } from '../../../services/agents';
import { SitesService } from '../../../services/sites';
import { AuthService } from '../../../services/auth';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-affectation-list',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './affectation-list.html'
})
export class AffectationListComponent implements OnInit {
  affectations: any[] = [];
  agents: any[] = [];
  sites: any[] = [];
  loading = true;
  showForm = false;
  error = '';
  form: FormGroup;
  user: any = null;

  constructor(
    private affSvc: AffectationsService,
    private agSvc: AgentsService,
    private siteSvc: SitesService,
    private auth: AuthService,
    private http: HttpClient,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      agent_id: ['', Validators.required],
      site_id: ['', Validators.required],
      date_debut: ['', Validators.required],
      duree: [''],
      date_fin: ['']
    });
  }

  ngOnInit() {
    this.auth.currentUser$.subscribe(u => {
      this.user = u;
      if (u) this.loadAll();
      this.cdr.detectChanges();
    });
  }

  loadAll() {
    this.loading = true;
    const affRequest = this.isAgent()
      ? this.http.get<any[]>(`${environment.apiUrl}/affectations/mes-affectations`)
      : this.affSvc.getAll();
    affRequest.subscribe({
      next: list => { this.affectations = list || []; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
    this.agSvc.getAll().subscribe({
      next: list => { this.agents = list || []; this.cdr.detectChanges(); },
      error: () => this.cdr.detectChanges()
    });
    this.siteSvc.getAll().subscribe({
      next: list => { this.sites = list || []; this.cdr.detectChanges(); },
      error: () => this.cdr.detectChanges()
    });
  }

  onDurationChange() {
    const { duree, date_debut } = this.form.value;
    if (!duree || !date_debut) return;
    const end = new Date(date_debut);
    end.setMonth(end.getMonth() + parseInt(duree, 10));
    this.form.patchValue({ date_fin: end.toISOString().slice(0, 10) });
  }

  submit() {
    if (this.form.invalid) return;
    const payload: any = {
      agent_id: this.form.value.agent_id,
      site_id: this.form.value.site_id,
      date_debut: this.form.value.date_debut
    };
    if (this.form.value.date_fin) payload.date_fin = this.form.value.date_fin;
    this.affSvc.create(payload).subscribe({
      next: () => {
        this.loadAll();
        this.showForm = false;
        this.form.reset();
        this.error = '';
      },
      error: (e) => { this.error = e.error?.error || 'Error'; }
    });
  }

  delete(id: number) {
    if (!confirm('Delete this assignment?')) return;
    this.affSvc.delete(id).subscribe({ next: () => this.loadAll() });
  }

  isAgent(): boolean { return this.user?.role === 'agent'; }
  isChef(): boolean { return this.user?.role === 'chef_equipe'; }
  isAdmin(): boolean { return this.user?.role === 'admin'; }
  canCreate(): boolean { return this.isChef() || this.isAdmin(); }
  canDelete(): boolean { return this.isChef() || this.isAdmin(); }
}
