// src/app/features/bill-split/bill-split-api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BillSplitState, Result } from './bill-split.model';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class BillSplitApiService {
  private base = `${environment.apiUrl}/api/bill-split`;

  constructor(private http: HttpClient) {}

  calculate(state: BillSplitState): Observable<Result[]> {
    // transform camelCase → snake_case for Rust backend
    const payload = {
      split_mode:  state.splitMode,
      num_people:  state.numPeople,
      participants: state.participants.map(p => ({
        name:       p.name,
        paid:       p.paid,
        percentage: p.percentage,
        is_payer:   p.isPayer
      }))
    };
    return this.http.post<Result[]>(`${this.base}/calculate`, payload);
  }
}
