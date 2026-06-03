import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-chef-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './chef-tickets.html',
  styleUrls: ['./chef-tickets.css']
})
export class ChefTicketsComponent implements OnInit {
  user: any = null;
  tickets: any[] = [];
  loading = true;
  filter: 'all' | 'pending' | 'approved' | 'rejected' = 'all';

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
    this.http.get<any[]>(`${environment.apiUrl}/demandes/team-requests`).subscribe({
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
    if (this.filter === 'pending') return this.tickets.filter(t => t.statut === 'pending' && !t.chef_approved);
    if (this.filter === 'approved') return this.tickets.filter(t => t.chef_approved && t.statut === 'pending');
    return this.tickets.filter(t => t.statut === 'rejected');
  }

  getTypeLabel(type: string): string {
    return this.ticketTypes[type]?.label || type;
  }

  getTypeIcon(type: string): string {
    return this.ticketTypes[type]?.icon || '🎫';
  }

  getTicketStatus(t: any): { label: string; color: string; bg: string; border: string } {
    if (t.statut === 'rejected') {
      return { label: 'Rejected', color: '#fca5a5', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)' };
    }
    if (t.statut === 'approved') {
      return { label: 'Approved', color: '#86efac', bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.3)' };
    }
    if (t.chef_approved) {
      return { label: 'Awaiting Admin', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)', border: 'rgba(96,165,250,0.3)' };
    }
    return { label: 'Pending Review', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.3)' };
  }

  approveTicket(id: number) {
    if (!confirm('Approve this ticket? It will be forwarded to admin for final approval.')) return;
    this.http.put(`${environment.apiUrl}/demandes/${id}/chef-approve`, {}).subscribe({
      next: () => {
        this.showToast('success', 'Ticket approved - forwarded to admin');
        this.loadTickets();
      },
      error: (err: HttpErrorResponse) => {
        this.showToast('error', err.error?.error || 'Failed to approve ticket');
      }
    });
  }

  rejectTicket(id: number) {
    if (!confirm('Reject this ticket?')) return;
    this.http.put(`${environment.apiUrl}/demandes/${id}/chef-reject`, {}).subscribe({
      next: () => {
        this.showToast('success', 'Ticket rejected');
        this.loadTickets();
      },
      error: (err: HttpErrorResponse) => {
        this.showToast('error', err.error?.error || 'Failed to reject ticket');
      }
    });
  }

  get pendingCount(): number {
    return this.tickets.filter(t => t.statut === 'pending' && !t.chef_approved).length;
  }

  get chefApprovedCount(): number {
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