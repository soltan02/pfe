import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './users.html'
})
export class UsersComponent implements OnInit {
  users: any[] = [];
  siteGroups: { siteName: string; users: any[] }[] = [];
  filteredSiteGroups: { siteName: string; users: any[] }[] = [];
  searchTerm = '';
  loading = true;
  selectedUser: any = null;
  passwordForm: FormGroup;
  message = '';
  error = '';
  selectedRole = 'agent';

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.passwordForm = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(4)]]
    });
  }

  ngOnInit() { this.loadUsers(); }

  loadUsers() {
    this.http.get<any[]>(`${environment.apiUrl}/auth/users-list`).subscribe({
      next: (data) => {
        this.users = data;
        this.buildSiteGroups();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }

  selectUser(user: any) {
    this.selectedUser = user;
    this.selectedRole = user.role;
    this.passwordForm.reset();
    this.message = '';
    this.error = '';
    this.cdr.detectChanges();
  }

  changePassword() {
    if (this.passwordForm.invalid) return;
    this.http.put(
      `${environment.apiUrl}/auth/change-password/${this.selectedUser.id}`,
      { newPassword: this.passwordForm.value.newPassword }
    ).subscribe({
      next: () => {
        this.message = 'Password changed successfully!';
        this.error = '';
        this.passwordForm.reset();
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.error = e.error?.error || 'Error';
        this.message = '';
        this.cdr.detectChanges();
      }
    });
  }

  filterUsers() {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredSiteGroups = this.siteGroups;
      return;
    }
    this.filteredSiteGroups = this.siteGroups
      .map(g => ({
        siteName: g.siteName,
        users: g.users.filter(u =>
          u.nom?.toLowerCase().includes(term) ||
          u.email?.toLowerCase().includes(term) ||
          (u.id?.toString()).includes(term)
        )
      }))
      .filter(g => g.users.length > 0);
  }

  buildSiteGroups() {
    const map = new Map<string, { siteName: string; users: any[] }>();
    for (const u of this.users) {
      const key = u.site_nom || 'No Site';
      if (!map.has(key)) {
        map.set(key, { siteName: key, users: [] });
      }
      map.get(key)!.users.push(u);
    }
    this.siteGroups = Array.from(map.values());
    this.filterUsers();
  }

  changeRole() {
    this.http.put(
      `${environment.apiUrl}/auth/change-role/${this.selectedUser.id}`,
      { role: this.selectedRole }
    ).subscribe({
      next: (res: any) => {
        this.message = `Role changed to ${this.selectedRole}!`;
        this.error = '';
        this.selectedUser.role = this.selectedRole;
        this.loadUsers();
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.error = e.error?.error || 'Error';
        this.message = '';
        this.cdr.detectChanges();
      }
    });
  }
}
