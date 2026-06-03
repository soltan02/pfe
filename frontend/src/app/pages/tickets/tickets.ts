import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './tickets.html',
  styleUrls: ['./tickets.css']
})
export class TicketsComponent implements OnInit {
  user: any = null;
  tickets: any[] = [];
  loading = true;
  showForm = false;
  saving = false;

  form = {
    type: 'conge',
    date_debut: '',
    date_fin: '',
    motif: ''
  };

  toast: { type: 'success' | 'error'; message: string } | null = null;
  private toastTimer: any;

  readonly ticketTypes = [
    { value: 'conge', label: '🏖️ Leave Request', description: 'Request time off / vacation' },
    { value: 'attestation_presence', label: '📋 Attendance Certificate', description: 'Request proof of attendance' },
    { value: 'attestation_travail', label: '💼 Work Certificate', description: 'Request employment certificate' }
  ];

  readonly statusMap: Record<string, { label: string; color: string; bg: string; border: string }> = {
    'pending': { label: 'Pending', color: '#fbbf24', bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.3)' },
    'chef_approved': { label: 'Chef Approved', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)', border: 'rgba(96,165,250,0.3)' },
    'approved': { label: 'Approved', color: '#22c55e', bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.3)' },
    'rejected': { label: 'Rejected', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)' }
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
    this.http.get<any[]>(`${environment.apiUrl}/demandes/my-requests`).subscribe({
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

  submitTicket() {
    if (!this.form.type || !this.form.date_debut || !this.form.motif) {
      this.showToast('error', 'Please fill in all required fields');
      return;
    }

    this.saving = true;
    this.http.post(`${environment.apiUrl}/demandes/my-requests`, this.form).subscribe({
      next: () => {
        this.saving = false;
        this.showToast('success', 'Ticket submitted successfully! It will be reviewed by your team leader.');
        this.showForm = false;
        this.form = { type: 'conge', date_debut: '', date_fin: '', motif: '' };
        this.loadTickets();
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        this.saving = false;
        this.showToast('error', err.error?.error || 'Failed to submit ticket');
        this.cdr.detectChanges();
      }
    });
  }

  deleteTicket(id: number) {
    if (!confirm('Delete this ticket?')) return;
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

  getStatusStyle(statut: string, chefApproved: boolean) {
    // Determine display status
    let key = statut;
    if (statut === 'pending' && chefApproved) key = 'chef_approved';
    const s = this.statusMap[key] || this.statusMap['pending'];
    return { 'background': s.bg, 'color': s.color, 'border': '1px solid ' + s.border };
  }

  getStatusLabel(statut: string, chefApproved: boolean): string {
    if (statut === 'pending' && chefApproved) return 'Chef Approved';
    return this.statusMap[statut]?.label || statut;
  }

  getTypeLabel(type: string): string {
    const t = this.ticketTypes.find(tt => tt.value === type);
    return t ? t.label : type;
  }

  canDelete(ticket: any): boolean {
    return ticket.statut === 'pending' && !ticket.chef_approved;
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