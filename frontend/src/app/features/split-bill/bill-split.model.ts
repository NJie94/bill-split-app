// frontend/src/app/features/split-bill/bill-split.model.ts
export type SplitMode = 'equal' | 'percentage' | 'solo';

export interface BillSplitParticipant {
  name:        string;
  paid:        number;
  percentage?: number;
  isPayer?:    boolean;
}

export interface BillSplitState {
  splitMode:   SplitMode;
  numPeople:   number;
  participants: BillSplitParticipant[];
}

export interface Payment {
  to: string;
  amount: number;
}

export interface Result {
  name: string;
  paid: number;
  share: number;
  balance: number; // positive = they should get back, negative = they owe
  payments?: { to: string; amount: number }[];
}
