import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../services/auth';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-pointage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pointage.html',
  styleUrls: ['./pointage.css']
})
export class PointageComponent implements OnInit {
  user: any = null;
  agents: any[] = [];
  filteredAgents: any[] = [];
  selectedAgent: any = null;
  searchQuery = '';
  loading = false;
  saving = false;

  presentCount = 0;
  lateCount = 0;
  absentCount = 0;
  totalAgents = 0;

  selectedStatus: 'present' | 'retard' | 'absent' = 'present';
  selectedDate: string = new Date().toISOString().slice(0, 10);
  arrivalTime = '08:00';
  departureTime = '';

  weekDays: { label: string; short: string; date: string; isToday: boolean }[] = [];

  todayPresences: any[] = [];

  currentMonth = new Date().toISOString().slice(0, 7);
  monthlyPresences: any[] = [];
  groupedByDay: { date: string; records: any[] }[] = [];

  toast: { type: 'success' | 'error'; message: string } | null = null;
  private toastTimer: any;

  readonly todayDate = new Date().toISOString().slice(0, 10);
  readonly dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  get selectedDayLabel(): string {
    const d = new Date(this.selectedDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.buildWeekDays();
  }

  ngOnInit() {
    this.auth.currentUser$.subscribe(u => {
      this.user = u;
      if (u) this.loadData();
      this.cdr.detectChanges();
    });
  }

  private buildWeekDays() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    this.weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - dayOfWeek + i);
      const dateStr = d.toISOString().slice(0, 10);
      this.weekDays.push({
        label: this.dayNames[d.getDay()],
        short: String(d.getDate()),
        date: dateStr,
        isToday: dateStr === this.todayDate
      });
    }
  }

  loadData() {
    this.loading = true;
    this.http.get<any[]>(`${environment.apiUrl}/presences/team-agents`).subscribe({
      next: list => {
        const seen = new Set<number>();
        this.agents = (list || []).filter((a: any) => {
          if (seen.has(a.id)) return false;
          seen.add(a.id);
          return true;
        }).map((a: any) => ({ ...a, statusDot: 'gray' }));
        this.filteredAgents = [...this.agents];
        this.loadTodayPresences();
        this.loadMonthlyData();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadTodayPresences() {
    this.http.get<any[]>(`${environment.apiUrl}/presences/day/${this.selectedDate}`).subscribe({
      next: list => {
        const seen = new Set<number>();
        this.todayPresences = (list || []).filter((p: any) => {
          const id = p.id || p.agent_id;
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        this.updateAgentStatuses();
        this.recomputeCounts();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  selectDay(dateStr: string) {
    this.selectedDate = dateStr;
    this.loadTodayPresences();
    this.cdr.detectChanges();
  }

  loadMonthlyData() {
    this.http.get<any>(`${environment.apiUrl}/presences/monthly/${this.currentMonth}`).subscribe({
      next: data => {
        const grid = data?.grid || {};
        const days = data?.days || [];
        const agentsList = data?.agents || [];

        const allRecords: any[] = [];
        for (const agent of agentsList) {
          const agentGrid = grid[agent.id] || {};
          for (const day of days) {
            const entry = agentGrid[day];
            if (entry) {
              allRecords.push({
                agent_nom: agent.agent_nom,
                agent_id: agent.id,
                date: day,
                statut: entry.statut,
                heure_arrivee: entry.heure_arrivee,
                heure_depart: entry.heure_depart
              });
            }
          }
        }

        this.monthlyPresences = allRecords;
        this.groupByDay(allRecords);
        this.cdr.detectChanges();
      },
      error: () => {
        this.cdr.detectChanges();
      }
    });
  }

  changeMonth(delta: number) {
    const d = new Date(this.currentMonth + '-01');
    d.setMonth(d.getMonth() + delta);
    this.currentMonth = d.toISOString().slice(0, 7);
    this.loadMonthlyData();
    this.cdr.detectChanges();
  }

  private groupByDay(records: any[]) {
    const map = new Map<string, any[]>();
    for (const r of records) {
      const dateStr = typeof r.date === 'string' ? r.date.slice(0, 10) : new Date(r.date).toISOString().slice(0, 10);
      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr)!.push(r);
    }
    this.groupedByDay = Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, recs]) => ({ date, records: recs }));
  }

  dayPresentCount(records: any[]): number {
    return records.filter(r => r.statut === 'present').length;
  }

  dayLateCount(records: any[]): number {
    return records.filter(r => r.statut === 'retard').length;
  }

  dayAbsentCount(records: any[]): number {
    return records.filter(r => r.statut === 'absent' || !r.statut).length;
  }

  formatDayLabel(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  updateAgentStatuses() {
    for (const agent of this.agents) {
      const presence = this.todayPresences.find(p => p.id === agent.id || p.agent_id === agent.id);
      if (presence?.presence?.statut === 'present') {
        agent.statusDot = 'green';
        agent.markedTime = presence.presence.heure_arrivee || '';
      } else if (presence?.presence?.statut === 'retard') {
        agent.statusDot = 'red';
        agent.markedTime = presence.presence.heure_arrivee || '';
      } else {
        agent.statusDot = 'gray';
        agent.markedTime = '';
      }
    }
    this.filteredAgents = this.searchQuery
      ? this.agents.filter(a => a.agent_nom?.toLowerCase().includes(this.searchQuery.toLowerCase()))
      : [...this.agents];
  }

  recomputeCounts() {
    this.presentCount = this.todayPresences.filter(p => p.presence?.statut === 'present').length;
    this.lateCount = this.todayPresences.filter(p => p.presence?.statut === 'retard').length;
    this.absentCount = this.todayPresences.filter(p => p.presence?.statut === 'absent' || !p.presence).length;
    this.totalAgents = this.agents.length;
  }

  selectAgent(agent: any) {
    this.selectedAgent = agent;
    const presence = this.todayPresences.find(p => p.id === agent.id || p.agent_id === agent.id);
    if (presence?.presence) {
      this.selectedStatus = presence.presence.statut === 'retard' ? 'retard' :
                            presence.presence.statut === 'absent' ? 'absent' : 'present';
      this.arrivalTime = presence.presence.heure_arrivee || '08:00';
      this.departureTime = presence.presence.heure_depart || '';
    } else {
      this.selectedStatus = 'present';
      this.arrivalTime = '08:00';
      this.departureTime = '';
    }
    this.cdr.detectChanges();
  }

  filterAgents() {
    const q = this.searchQuery.toLowerCase().trim();
    this.filteredAgents = q
      ? this.agents.filter(a => a.agent_nom?.toLowerCase().includes(q))
      : [...this.agents];
    this.cdr.detectChanges();
  }

  setStatus(status: 'present' | 'retard' | 'absent') {
    this.selectedStatus = status;
    if (status === 'present' && !this.arrivalTime) {
      this.arrivalTime = new Date().toTimeString().slice(0, 5);
    }
    this.cdr.detectChanges();
  }

  saveAttendance() {
    if (!this.selectedAgent) {
      this.showToast('error', 'Please select an agent first');
      return;
    }

    this.saving = true;
    const payload = {
      agent_id: this.selectedAgent.id,
      date: this.selectedDate,
      statut: this.selectedStatus,
      heure_arrivee: this.arrivalTime || null,
      heure_depart: this.departureTime || null
    };

    this.http.post(`${environment.apiUrl}/presences`, payload).subscribe({
      next: () => {
        this.saving = false;
        this.showToast('success', `Attendance recorded for ${this.selectedAgent.agent_nom}`);
        this.loadTodayPresences();
        this.loadMonthlyData();
        this.cdr.detectChanges();
      },
      error: (err: HttpErrorResponse) => {
        this.saving = false;
        this.showToast('error', err.error?.error || 'Failed to record attendance');
        this.cdr.detectChanges();
      }
    });
  }

  initials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(w => w.charAt(0)).join('').substring(0, 2).toUpperCase();
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