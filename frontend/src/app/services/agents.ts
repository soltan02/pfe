// Thin wrapper over the /api/agents endpoints. Components inject this service
// rather than calling HttpClient directly, so the API base URL is defined
// in exactly one place.

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AgentsService {
  url = `${environment.apiUrl}/agents`;
  constructor(private http: HttpClient) {}

  getAll() { return this.http.get<any[]>(this.url); }
  getById(id: number) { return this.http.get<any>(`${this.url}/${id}`); }
  create(d: any) { return this.http.post<any>(this.url, d); }
  update(id: number, d: any) { return this.http.put<any>(`${this.url}/${id}`, d); }
  delete(id: number) { return this.http.delete<any>(`${this.url}/${id}`); }
}
