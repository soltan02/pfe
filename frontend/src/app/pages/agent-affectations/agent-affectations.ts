import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-agent-affectations',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './agent-affectations.html'
})
export class AgentAffectationsComponent implements OnInit {
  affectations: any[] = [];
  loading = true;
  user: any = null;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.auth.currentUser$.subscribe(u => {
      this.user = u;
      if (u) this.load();
      this.cdr.detectChanges();
    });
  }

  private load() {
    this.http.get<any[]>(`${environment.apiUrl}/affectations/mes-affectations`).subscribe({
      next: list => { this.affectations = list || []; this.loading = false; this.cdr.detectChanges(); },
      error: () => { this.loading = false; this.cdr.detectChanges(); }
    });
  }
}
