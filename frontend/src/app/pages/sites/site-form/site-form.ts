import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { SitesService } from '../../../services/sites';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-site-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './site-form.html'
})
export class SiteFormComponent implements OnInit {
  form: FormGroup;
  isEdit = false;
  siteId: any = null;
  error = '';
  loading = false;
  chefs: any[] = [];

  constructor(
    private fb: FormBuilder,
    private sitesService: SitesService,
    private http: HttpClient,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.form = this.fb.group({
      nom: ['', Validators.required],
      adresse: [''],
      ville: [''],
      statut: ['actif'],
      chef_id: ['']
    });
  }

  ngOnInit() {
    this.loadChefs();
    this.siteId = this.route.snapshot.params['id'];
    if (this.siteId) {
      this.isEdit = true;
      this.sitesService.getById(this.siteId).subscribe({
        next: (s) => this.form.patchValue(s),
        error: () => this.router.navigate(['/sites'])
      });
    }
  }

  loadChefs() {
    // First get already assigned chef IDs, then filter them out
    this.http.get<number[]>(`${environment.apiUrl}/sites/assigned-chefs`).subscribe({
      next: (assignedChefIds) => {
        this.http.get<any[]>(`${environment.apiUrl}/auth/users-list`).subscribe({
          next: (users) => {
            this.chefs = users.filter(u =>
              u.role === 'chef_equipe' &&
              // When editing, include the currently assigned chef in the list
              (!assignedChefIds.includes(u.id) || (this.isEdit && u.id == this.form.get('chef_id')?.value))
            );
          },
          error: (e) => console.error('Error loading chefs:', e)
        });
      },
      error: (e) => {
        // Fallback: load all chefs if assigned-chefs endpoint fails
        console.error('Error loading assigned chefs:', e);
        this.http.get<any[]>(`${environment.apiUrl}/auth/users-list`).subscribe({
          next: (users) => {
            this.chefs = users.filter(u => u.role === 'chef_equipe');
          },
          error: (e2) => console.error('Error loading chefs:', e2)
        });
      }
    });
  }

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    const action = this.isEdit
      ? this.sitesService.update(this.siteId, this.form.value)
      : this.sitesService.create(this.form.value);

    action.subscribe({
      next: () => this.router.navigate(['/sites']),
      error: (e) => { this.error = e.error?.error || 'Error'; this.loading = false; }
    });
  }
}