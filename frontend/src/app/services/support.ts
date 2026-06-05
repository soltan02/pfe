import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupportService {
  constructor(private http: HttpClient) {}

  sendMessage(message: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/support`, { message });
  }

  getSupportRequests(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/support`);
  }
}
