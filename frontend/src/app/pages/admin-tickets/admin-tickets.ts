import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-tickets.html',
  styleUrls: ['./admin-tickets.css']
})
export class AdminTicketsComponent implements OnInit {
  user: any = null;
  tickets: any[] = [];
  loading = true;
  filter: 'all' | 'awaiting' | 'approved' | 'rejected' = 'all';

  toast: { type: 'success' | 'error'; message: string } | null = null;
  private toastTimer: any;

  readonly ticketTypes: { [key: string]: { label: string; icon: string } } = {
    'conge': { label: '🏖️ Leave Request', icon: '🏖️' },
    'attestation_presence': { label: '📋 Attendance Certificate', icon: '📋' },
    'attestation_travail': { label: '💼 Work Certificate', icon: '💼' }
  };

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.auth.currentUser$.subscribe(u => {
      this.user = u;
      if (u) this.loadTickets();
      this.cdr.detectChanges();
    });
  }

  loadTickets() {
    this.loading = true;
    this.http.get<any[]>(`${environment.apiUrl}/demandes`).subscribe({
      next: list => {
        this.tickets = list || [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get filteredTickets() {
    if (this.filter === 'all') return this.tickets;
    if (this.filter === 'awaiting') return this.tickets.filter(t => t.chef_approved && t.statut === 'pending');
    if (this.filter === 'approved') return this.tickets.filter(t => t.statut === 'approved');
    return this.tickets.filter(t => t.statut === 'rejected');
  }

  getTypeLabel(type: string): string {
    return this.ticketTypes[type]?.label || type;
  }

  getTypeIcon(type: string): string {
    return this.ticketTypes[type]?.icon || '🎫';
  }

  approveTicket(id: number) {
    if (!confirm('Give final approval to this ticket?')) return;
    this.http.put(`${environment.apiUrl}/demandes/${id}/admin-approve`, {}).subscribe({
      next: () => {
        this.showToast('success', 'Ticket approved');
        this.loadTickets();
      },
      error: (err: HttpErrorResponse) => {
        this.showToast('error', err.error?.error || 'Failed to approve ticket');
      }
    });
  }

  rejectTicket(id: number) {
    if (!confirm('Reject this ticket?')) return;
    this.http.put(`${environment.apiUrl}/demandes/${id}/admin-reject`, {}).subscribe({
      next: () => {
        this.showToast('success', 'Ticket rejected');
        this.loadTickets();
      },
      error: (err: HttpErrorResponse) => {
        this.showToast('error', err.error?.error || 'Failed to reject ticket');
      }
    });
  }

  deleteTicket(id: number) {
    if (!confirm('Delete this ticket permanently?')) return;
    this.http.delete(`${environment.apiUrl}/demandes/${id}`).subscribe({
      next: () => {
        this.showToast('success', 'Ticket deleted');
        this.loadTickets();
      },
      error: (err: HttpErrorResponse) => {
        this.showToast('error', err.error?.error || 'Failed to delete ticket');
      }
    });
  }

  get awaitingCount(): number {
    return this.tickets.filter(t => t.chef_approved && t.statut === 'pending').length;
  }

  get approvedCount(): number {
    return this.tickets.filter(t => t.statut === 'approved').length;
  }

  get rejectedCount(): number {
    return this.tickets.filter(t => t.statut === 'rejected').length;
  }

  showToast(type: 'success' | 'error', message: string) {
    this.toast = { type, message };
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast = null;
      this.cdr.detectChanges();
    }, 3500);
    this.cdr.detectChanges();
  }
}