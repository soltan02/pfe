import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AgentsService } from '../../../services/agents';
import { AuthService } from '../../../services/auth';

// Form-level validators. Returning `null` means "no error" — that's the
// convention Angular Reactive Forms expects.
const numbersOnly = (control: AbstractControl) => {
  if (!control.value) return null;
  return /^\d+$/.test(control.value) ? null : { numbersOnly: true };
};

const phone8digits = (control: AbstractControl) => {
  if (!control.value) return null;
  if (!/^\d+$/.test(control.value)) return { numbersOnly: true };
  if (control.value.length !== 8) return { phone8digits: true };
  return null;
};

const lettersOnly = (control: AbstractControl) => {
  if (!control.value) return null;
  return /^[a-zA-ZàâäéèêëîïôöùûüÀÂÄÉÈÊËÎÏÔÖÙÛÜçÇ\s\-']+$/.test(control.value) ? null : { lettersOnly: true };
};

@Component({
  selector: 'app-agent-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './agent-form.html'
})
export class AgentFormComponent implements OnInit {
  form: FormGroup;
  isEdit = false;
  agentId: any = null;
  error = '';
  loading = false;
  user: any = null;

  constructor(
    private fb: FormBuilder,
    private agentsService: AgentsService,
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      nom:       ['', [Validators.required, lettersOnly]],
      prenom:    ['', [Validators.required, lettersOnly]],
      matricule: ['', [Validators.required, numbersOnly]],
      telephone: ['', [phone8digits]],
      account_role: ['agent', Validators.required],
      statut:    ['actif']
    });
  }

  ngOnInit() {
    this.auth.currentUser$.subscribe(u => {
      this.user = u;
    });

    this.agentId = this.route.snapshot.params['id'];
    if (this.agentId) {
      this.isEdit = true;
      this.agentsService.getById(this.agentId).subscribe({
        next: (a) => { this.form.patchValue(a); this.cdr.detectChanges(); },
        error: () => this.router.navigate(['/agents'])
      });
    }
  }

  isChef(): boolean {
    return this.user?.role === 'chef_equipe';
  }

  isAdmin(): boolean {
    return this.user?.role === 'admin';
  }

  hasError(field: string, error: string) {
    const c = this.form.get(field);
    return c?.hasError(error) && c?.touched;
  }

  isRequired(field: string) {
    const c = this.form.get(field);
    return c?.hasError('required') && c?.touched;
  }

  submit() {
  this.form.markAllAsTouched();
  if (this.form.invalid) return;
  this.loading = true;

  if (this.isEdit) {
    this.agentsService.update(this.agentId, this.form.value).subscribe({
      next: () => this.router.navigate(['/agents']),
      error: (e) => { this.error = e.error?.error || 'Error'; this.loading = false; this.cdr.detectChanges(); }
    });
  } else {
    this.agentsService.create(this.form.value).subscribe({
      next: (res: any) => {
        const matricule = this.form.value.matricule;
        const roleLabel = res.login_info?.role === 'chef_equipe' ? 'Team Leader' : 'Agent';
        alert(
          roleLabel + ' created successfully!\n\n' +
          'Login credentials:\n' +
          'Email: ' + matricule + '@stb.tn\n' +
          'Password: ' + matricule + '\n\n' +
          'Please communicate these credentials to the user.'
        );
        this.router.navigate(['/agents']);
      },
      error: (e) => { this.error = e.error?.error || 'Error'; this.loading = false; this.cdr.detectChanges(); }
    });
  }
}
}
