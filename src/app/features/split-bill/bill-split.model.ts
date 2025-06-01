// src/app/features/split-bill/bill-split.model.ts

export type SplitMode = 'equal' | 'percentage' | 'solo';

export interface BillSplitItem {
  description: string;
  amount: number;
}

export interface BillSplitParticipant {
  name: string;
  paid: number;
  percentage?: number;
  isPayer?: boolean;
  items: BillSplitItem[];
}

export interface BillSplitState {
  splitMode: SplitMode;
  numPeople: number;
  participants: BillSplitParticipant[];
}

export interface Result {
  name: string;
  paid: number;
  share: number;
  balance: number;
  payments?: Payment[];
}

export interface Payment {
  to: string;
  amount: number;
}
