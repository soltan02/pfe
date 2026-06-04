// login page. on success: stash token, seed currentUser$, go to /dashboard.
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.html'
})
export class LoginComponent {
  form: FormGroup;
  error = '';
  loading = false;

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  submit() {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    this.auth.login(
      this.form.value.email,
      this.form.value.password
    ).subscribe({
      next: (res: any) => {
        this.auth.saveToken(res.token);
        this.auth.currentUser$.next(res.user);
        this.router.navigate(['/dashboard']);
      },
      error: (e: any) => {
        this.error = e.error?.error || 'Connection error';
        this.loading = false;
      }
    });
  }
}
