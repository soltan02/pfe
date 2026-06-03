import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../services/auth';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-agent-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './agent-dashboard.html',
  styleUrls: ['./agent-dashboard.css']
})
export class AgentDashboardComponent implements OnInit {
  user: any = null;
  myAffectations: any[] = [];
  loading = true;
  attendanceSummary = { present: 0, absent: 0 };
  attendanceLoading = true;

  readonly currentMonth = new Date().toISOString().slice(0, 7);
  readonly currentMonthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  readonly todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // BehaviorSubject guarantees a sync first emission, so the gate below
    // prevents any HTTP call from racing the auth state on first paint.
    this.auth.currentUser$.subscribe(u => {
      this.user = u;
      if (u) {
        this.loadAttendance();
        this.loadAffectations();
      }
      this.cdr.detectChanges();
    });
  }

  private loadAttendance() {
    this.attendanceLoading = true;
    this.http.get<any>(`${environment.apiUrl}/presences/me/monthly/${this.currentMonth}`).subscribe({
      next: (data) => {
        this.attendanceSummary = {
          present: data?.present ?? 0,
          absent: data?.absent ?? 0
        };
        this.attendanceLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.attendanceLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  private loadAffectations() {
    this.http.get<any[]>(`${environment.apiUrl}/affectations/mes-affectations`).subscribe({
      next: (data) => {
        this.myAffectations = (data || []).slice(0, 3);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get activeCount(): number {
    return this.myAffectations.filter(a => a.statut === 'active').length;
  }

  logout() {
    this.auth.logout();
  }
}
