// bill-split-state.service.ts
import { Injectable } from '@angular/core';

export type SplitMode = 'equal' | 'percentage' | 'solo';
export interface BillSplitParticipant {
    name: string;
    paid: number;
    percentage?: number;
    isPayer?: boolean;
}

export interface BillSplitState {
    splitMode: SplitMode;
    numPeople: number;
    participants: BillSplitParticipant[];
  }

@Injectable({ providedIn: 'root' })
export class BillSplitStateService {
  private key = 'split-bill-state';
  private disabled = false;

  save(state: BillSplitState) {
    if (this.disabled) return;
    localStorage.setItem(this.key, JSON.stringify(state));
  }

  load(): BillSplitState | null {
    const raw = localStorage.getItem(this.key);
    return raw ? JSON.parse(raw) as BillSplitState : null;
  }

  clear() {
    this.disabled = true;
    localStorage.removeItem(this.key);
  }
}
