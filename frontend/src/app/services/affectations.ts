// Wrapper over /api/affectations.
// An affectation is a (agent, site, date range) tuple. There is no PUT here —
// to change an assignment we delete the old row and POST a new one. That's
// simpler than tracking an `archived` flag and matches how the UI works.

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AffectationsService {
  url = `${environment.apiUrl}/affectations`;
  constructor(private http: HttpClient) {}

  getAll() { return this.http.get<any[]>(this.url); }
  create(d: any) { return this.http.post<any>(this.url, d); }
  delete(id: number) { return this.http.delete<any>(`${this.url}/${id}`); }
}
