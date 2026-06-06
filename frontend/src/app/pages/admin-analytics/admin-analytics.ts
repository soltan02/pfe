import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-analytics.html',
  styleUrls: ['./admin-analytics.css']
})
export class AdminAnalyticsComponent implements OnInit {
  user: any = null;
  analytics = {
    totalAgents: 0, totalSites: 0, totalAffectations: 0,
    completedAffectations: 0, activeAffectations: 0,
    averageAssignmentDuration: 0, systemUptime: '99.9%', lastUpdated: new Date()
  };
  reportsData: any[] = [];
  rapportsData: any[] = [];
  rapportStats: any = {};
  rapportPerChef: any[] = [];
  rapportPerSite: any[] = [];
  loading = true;
  selectedMetric = 'overview';

  // Big Data analytics
  bdSummary: any = {};
  bdAttendanceTrend: any[] = [];
  bdAbsenteeism: any[] = [];
  bdIncidents: any[] = [];
  bdAgentWorkload: any[] = [];
  bdCoverage: any[] = [];
  bdLoading = true;

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.auth.currentUser$.subscribe(u => {
      this.user = u;
      if (u) this.loadAll();
      this.cdr.detectChanges();
    });
  }

  private loadAll() {
    this.loading = true;
    this.http.get<any>(`${environment.apiUrl}/dashboard/stats`).subscribe(s => {
      this.analytics.totalAgents = s?.agents ?? 0;
      this.analytics.totalSites = s?.sites ?? 0;
      this.analytics.totalAffectations = s?.affectations ?? 0;
      this.analytics.lastUpdated = new Date();
      this.cdr.detectChanges();
    });
    this.http.get<any[]>(`${environment.apiUrl}/affectations`).subscribe(list => {
      this.reportsData = list || [];
      this.analytics.totalAffectations = list?.length ?? 0;
      this.analytics.completedAffectations = (list || []).filter(a => a.statut === 'completed' || a.statut === 'termine').length;
      this.analytics.activeAffectations = (list || []).filter(a => a.statut === 'active' || a.statut === 'en cours').length;
      this.cdr.detectChanges();
    });
    this.http.get<any>(`${environment.apiUrl}/rapports/admin/full-report`).subscribe(data => {
      this.rapportsData = data?.rapports || [];
      this.rapportStats = data?.stats || {};
      this.rapportPerChef = data?.perChef || [];
      this.rapportPerSite = data?.perSite || [];
      this.loading = false;
      this.cdr.detectChanges();
    });
    this.loadBigDataAnalytics();
  }

  private loadBigDataAnalytics() {
    this.bdLoading = true;
    const base = `${environment.apiUrl}/analytics`;
    this.http.get<any>(`${base}/summary`).subscribe({
      next: d => { this.bdSummary = d; this.cdr.detectChanges(); },
      error: () => {}
    });
    this.http.get<any[]>(`${base}/attendance-trend`).subscribe({
      next: d => { this.bdAttendanceTrend = d || []; this.cdr.detectChanges(); },
      error: () => {}
    });
    this.http.get<any[]>(`${base}/absenteeism-by-branch`).subscribe({
      next: d => { this.bdAbsenteeism = d || []; this.cdr.detectChanges(); },
      error: () => {}
    });
    this.http.get<any[]>(`${base}/incidents-monthly`).subscribe({
      next: d => { this.bdIncidents = d || []; this.cdr.detectChanges(); },
      error: () => {}
    });
    this.http.get<any[]>(`${base}/agent-workload?limit=10&order=asc`).subscribe({
      next: d => { this.bdAgentWorkload = d || []; this.cdr.detectChanges(); },
      error: () => {}
    });
    this.http.get<any[]>(`${base}/coverage`).subscribe({
      next: d => { this.bdCoverage = d || []; this.bdLoading = false; this.cdr.detectChanges(); },
      error: () => { this.bdLoading = false; }
    });
  }

  get completionRate(): number {
    return this.analytics.totalAffectations
      ? Math.round((this.analytics.completedAffectations / this.analytics.totalAffectations) * 100)
      : 0;
  }

  get activeRate(): number {
    return this.analytics.totalAffectations
      ? Math.round((this.analytics.activeAffectations / this.analytics.totalAffectations) * 100)
      : 0;
  }

  selectMetric(metric: string) {
    this.selectedMetric = metric;
    this.cdr.detectChanges();
  }

  statusColor(statut: string): string {
    if (statut === 'pending') return '#fbbf24';
    if (statut === 'approved') return '#10b981';
    return '#ef4444';
  }

  typeLabel(type: string): string {
    const map: any = { 'incident': '⚠️ Incident', 'absence': '❌ Absence', 'sante': '🏥 Health Issue', 'autre': '📝 Other' };
    return map[type] || type;
  }

  exportCSV() {
    const headers = ['ID', 'Date', 'Type', 'Agent', 'Site', 'Reported By', 'Chef Site', 'Status', 'Details'];
    const rows = this.rapportsData.map((r: any) => [
      r.id, r.date, r.type, r.agent_nom || '', r.site_nom || '',
      r.chef_nom || 'Unknown', r.chef_site_nom || '', r.statut,
      `"${(r.contenu || '').replace(/"/g, '""')}"`
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    this.downloadFile(csv, 'admin-report.csv', 'text/csv;charset=utf-8;');
  }

  exportExcel() {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${this.excelSummarySheet()}
${this.excelPerChefSheet()}
${this.excelPerSiteSheet()}
${this.excelAllReportsSheet()}
</Workbook>`;
    this.downloadFile(xml, 'admin-report.xls', 'application/vnd.ms-excel');
  }

  exportFullCSV() {
    const s = this.rapportStats;
    const lines = [
      'ADMIN REPORT', `Generated,${new Date().toLocaleString()}`, '', 'SUMMARY',
      `Total Reports,${s.total_reports || 0}`, `Pending,${s.pending_reports || 0}`,
      `Approved,${s.approved_reports || 0}`, `Incidents,${s.incidents || 0}`,
      `Absences,${s.absences || 0}`, `Health Issues,${s.health_issues || 0}`,
      `Other,${s.other_reports || 0}`, '', 'REPORTS PER CHEF', 'Chef Name,Report Count',
      ...this.rapportPerChef.map(c => `"${c.chef_nom || 'Unknown'}",${c.report_count}`),
      '', 'REPORTS PER SITE', 'Site Name,Report Count',
      ...this.rapportPerSite.map(s => `"${s.site_nom || 'Unassigned'}",${s.report_count}`),
      '', 'ALL REPORTS', 'ID,Date,Type,Agent,Site,Reported By,Chef Site,Status,Details',
      ...this.rapportsData.map(r => [
        r.id, r.date, r.type, r.agent_nom || '', r.site_nom || '',
        r.chef_nom || 'Unknown', r.chef_site_nom || '', r.statut,
        `"${(r.contenu || '').replace(/"/g, '""')}"`
      ].join(','))
    ];
    this.downloadFile(lines.join('\n'), 'full-admin-report.csv', 'text/csv;charset=utf-8;');
  }

  exportPrint() {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(this.buildPrintHtml());
    win.document.close();
    win.print();
  }

  private downloadFile(content: string, fileName: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  private excelSummarySheet(): string {
    const s = this.rapportStats;
    const row = (label: string, v: any) => `<Row><Cell><Data ss:Type="String">${label}</Data></Cell><Cell><Data ss:Type="Number">${v || 0}</Data></Cell></Row>`;
    return `<Worksheet ss:Name="Summary"><Table>
<Row><Cell><Data ss:Type="String">Admin Report - ${new Date().toLocaleString()}</Data></Cell></Row>
<Row></Row>
${row('Total Reports', s.total_reports)}${row('Pending', s.pending_reports)}${row('Approved', s.approved_reports)}
${row('Incidents', s.incidents)}${row('Absences', s.absences)}${row('Health Issues', s.health_issues)}${row('Other', s.other_reports)}
</Table></Worksheet>`;
  }

  private excelPerChefSheet(): string {
    const rows = this.rapportPerChef.map(c =>
      `<Row><Cell><Data ss:Type="String">${c.chef_nom || 'Unknown'}</Data></Cell><Cell><Data ss:Type="Number">${c.report_count}</Data></Cell></Row>`
    ).join('');
    return `<Worksheet ss:Name="Reports Per Chef"><Table><Row><Cell><Data ss:Type="String">Chef Name</Data></Cell><Cell><Data ss:Type="String">Report Count</Data></Cell></Row>${rows}</Table></Worksheet>`;
  }

  private excelPerSiteSheet(): string {
    const rows = this.rapportPerSite.map(s =>
      `<Row><Cell><Data ss:Type="String">${s.site_nom || 'Unassigned'}</Data></Cell><Cell><Data ss:Type="Number">${s.report_count}</Data></Cell></Row>`
    ).join('');
    return `<Worksheet ss:Name="Reports Per Site"><Table><Row><Cell><Data ss:Type="String">Site Name</Data></Cell><Cell><Data ss:Type="String">Report Count</Data></Cell></Row>${rows}</Table></Worksheet>`;
  }

  private excelAllReportsSheet(): string {
    const headerCells = ['ID', 'Date', 'Type', 'Agent', 'Site', 'Reported By', 'Chef Site', 'Status', 'Details']
      .map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('');
    const dataRows = this.rapportsData.map(r =>
      `<Row>${[
        `<Cell><Data ss:Type="Number">${r.id}</Data></Cell>`,
        `<Cell><Data ss:Type="String">${r.date}</Data></Cell>`,
        `<Cell><Data ss:Type="String">${r.type}</Data></Cell>`,
        `<Cell><Data ss:Type="String">${r.agent_nom || ''}</Data></Cell>`,
        `<Cell><Data ss:Type="String">${r.site_nom || ''}</Data></Cell>`,
        `<Cell><Data ss:Type="String">${r.chef_nom || 'Unknown'}</Data></Cell>`,
        `<Cell><Data ss:Type="String">${r.chef_site_nom || ''}</Data></Cell>`,
        `<Cell><Data ss:Type="String">${r.statut}</Data></Cell>`,
        `<Cell><Data ss:Type="String">${(r.contenu || '').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')}</Data></Cell>`
      ].join('')}</Row>`
    ).join('');
    return `<Worksheet ss:Name="All Reports"><Table><Row>${headerCells}</Row>${dataRows}</Table></Worksheet>`;
  }

  private buildPrintHtml(): string {
    const s = this.rapportStats;
    return `<html><head><title>Admin Report - ${new Date().toLocaleDateString()}</title>
<style>body{font-family:Arial,sans-serif;padding:20px}h1{color:#1a1a2e;border-bottom:2px solid #16213e;padding-bottom:10px}h2{color:#16213e;margin-top:20px}table{width:100%;border-collapse:collapse;margin:10px 0}th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}th{background:#16213e;color:white}tr:nth-child(even){background:#f2f2f2}.stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:10px 0}.stat-box{background:#f8f9fa;padding:15px;border-radius:8px;text-align:center}.stat-box .value{font-size:24px;font-weight:bold;color:#16213e}.stat-box .label{font-size:12px;color:#666}</style>
</head><body>
<h1>STB Security - Admin Report</h1>
<p>Generated: ${new Date().toLocaleString()}</p>
<div class="stat-grid">
  <div class="stat-box"><div class="value">${s.total_reports || 0}</div><div class="label">Total Reports</div></div>
  <div class="stat-box"><div class="value">${s.pending_reports || 0}</div><div class="label">Pending</div></div>
  <div class="stat-box"><div class="value">${s.approved_reports || 0}</div><div class="label">Approved</div></div>
  <div class="stat-box"><div class="value">${this.analytics.totalAgents}</div><div class="label">Total Agents</div></div>
</div>
<h2>Reports by Type</h2>
<table><tr><th>Type</th><th>Count</th></tr>
<tr><td>Incidents</td><td>${s.incidents || 0}</td></tr>
<tr><td>Absences</td><td>${s.absences || 0}</td></tr>
<tr><td>Health Issues</td><td>${s.health_issues || 0}</td></tr>
<tr><td>Other</td><td>${s.other_reports || 0}</td></tr>
</table>
<h2>Reports per Chef</h2>
<table><tr><th>Chef Name</th><th>Report Count</th></tr>
${this.rapportPerChef.map(c => `<tr><td>${c.chef_nom || 'Unknown'}</td><td>${c.report_count}</td></tr>`).join('')}
</table>
<h2>Reports per Site</h2>
<table><tr><th>Site Name</th><th>Report Count</th></tr>
${this.rapportPerSite.map(s => `<tr><td>${s.site_nom || 'Unassigned'}</td><td>${s.report_count}</td></tr>`).join('')}
</table>
<h2>All Reports</h2>
<table><tr><th>ID</th><th>Date</th><th>Type</th><th>Agent</th><th>Site</th><th>Reported By</th><th>Chef Site</th><th>Status</th><th>Details</th></tr>
${this.rapportsData.map(r => `<tr><td>${r.id}</td><td>${r.date}</td><td>${r.type}</td><td>${r.agent_nom || ''}</td><td>${r.site_nom || ''}</td><td>${r.chef_nom || 'Unknown'}</td><td>${r.chef_site_nom || ''}</td><td>${r.statut}</td><td>${r.contenu || ''}</td></tr>`).join('')}
</table>
</body></html>`;
  }
}
