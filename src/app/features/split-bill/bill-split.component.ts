// frontend/src/app/features/split-bill/bill-split.component.ts
import {
  Component,
  EventEmitter,
  HostListener,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

import {
  BillSplitStateService,
  SplitMode
} from './bill-split-state.service';
import {
  BillSplitState,
  Payment,
  Result,
} from './bill-split.model';
import { BillSplitApiService } from './bill-split-api.service';

@Component({
  selector: 'app-bill-split',
  templateUrl: './bill-split.component.html',
  styleUrls: ['./bill-split.component.scss'],
  standalone: false
})
export class SplitBillComponent implements OnInit, OnDestroy {

  form!: FormGroup;
  results: Result[] = [];

  constructor(
    private fb: FormBuilder,
    private stateSvc: BillSplitStateService
  ) {}

  get participants(): FormArray {
    return this.form.get('participants') as FormArray;
  }

  get numPeople(): number {
    return this.participants.length;
  }

  get splitMode(): SplitMode {
    return this.form.value.splitMode;
  }

  get totalPaid(): number {
    return this.participants.controls
      .map((c) => +c.get('paid')!.value)
      .reduce((sum, v) => sum + v, 0);
  }

  ngOnInit() {
    this.form = this.fb.group({
      splitMode: ['equal' as SplitMode, Validators.required],
      numPeople: [2, [Validators.required, Validators.min(1)]],
      // start with no validator on participants
      participants: this.fb.array([])
    });

    // whenever splitMode changes:
    this.form.get('splitMode')!.valueChanges.subscribe((mode: SplitMode) => {
      const arr = this.participants;
      if (mode === 'percentage') {
        // add the percent-sum validator
        arr.setValidators(this.percentageSumValidator());
      } else {
        // remove that validator
        arr.clearValidators();
      }
      // re‐run validation (but don’t re‐emit valueChanges)
      arr.updateValueAndValidity({ emitEvent: false });
      // keep shares in sync
      this.calculateShares();
    });

    // whenever numPeople changes, rebuild rows & recalc shares
    this.form.get('numPeople')!
      .valueChanges.subscribe(n => this.adjustParticipants(n));

    // initialize with the default count
    this.adjustParticipants(this.form.value.numPeople);

    // restore saved state...
    const saved = this.stateSvc.load();
    if (saved) {
      this.form.patchValue({
        splitMode: saved.splitMode,
        numPeople: saved.numPeople
      });
      saved.participants.forEach((p, i) => {
        const ctrl = this.participants.at(i);
        ctrl.patchValue({
          name:       p.name,
          paid:       p.paid,
          percentage: p.percentage ?? ctrl.value.percentage,
          isPayer:    p.isPayer ?? false
        });
      });
    }
  }

  private adjustParticipants(count: number) {
    const arr = this.participants;
    while (arr.length < count) {
      const eachPct = 100 / count;
      const ctrl = this.fb.group({
        name:       ['', Validators.required],
        paid:       [0, [Validators.required, Validators.min(0)]],
        percentage: [eachPct, [Validators.min(0), Validators.max(100)]],
        isPayer:    [false],
        share:      [{ value: 0, disabled: true }],
        // ← initialize with one blank item so there's always something to type into:
        items:      this.fb.array([ this.newItemGroup() ])
      });

      // wire up your recalculations:
      this.items(ctrl).valueChanges.subscribe(() => this.syncItemsToPaid(ctrl));
      ctrl.get('paid')!.valueChanges.subscribe(() => this.calculateShares());
      arr.push(ctrl);
    }
    while (arr.length > count) {
      arr.removeAt(arr.length - 1);
    }
    this.calculateShares();
  }

  /** helper to build a new item row */
  private newItemGroup(): FormGroup {
    return this.fb.group({
      description: [''],
      amount: [0, [Validators.required, Validators.min(0)]]
    });
  }

  /** helper to grab the items FormArray from a participant FormGroup */
  public items(participant: AbstractControl): FormArray {
    return (participant.get('items') as FormArray);
  }

  /** sum all item.amounts and patch the participant.paid control */
  private syncItemsToPaid(participant: AbstractControl) {
    const sum = this.items(participant)
      .controls
      .map(c => +c.get('amount')!.value)
      .reduce((a, b) => a + b, 0);
    participant.get('paid')!.setValue(+sum.toFixed(2), { emitEvent: false });
  }

  /** public helpers for add/remove item template */
  public addItem(personIndex: number) {
    this.items(this.participants.at(personIndex)).push(this.newItemGroup());
  }

  public removeItem(personIndex: number, itemIndex: number) {
    this.items(this.participants.at(personIndex)).removeAt(itemIndex);
  }

  /** 
   * true once *all* participants have at least one item 
   * (only used when in percentage mode)
   */
  get allHaveItems(): boolean {
    return this.participants.controls.every(ctrl =>
      (ctrl.get('items') as FormArray).length > 0
    );
  }

  /** 
   * enable in Equal/Solo as soon as the form is valid; 
   * in Percentage, also require >=1 item per person
   */
  get canCalculate(): boolean {
    return this.form.valid;
  }

  public calculateShares() {
    const total = this.totalPaid;
    const mode = this.splitMode;

    this.participants.controls.forEach(ctrl => {
      let share = 0;
      if (mode === 'equal') {
        share = total / this.numPeople;
      } else if (mode === 'percentage') {
        const pct = +ctrl.get('percentage')!.value;
        share = total * (pct / 100);
      } else if (mode === 'solo') {
        share = ctrl.get('isPayer')!.value ? total : 0;
      }
      ctrl.get('share')!.setValue(+share.toFixed(2), { emitEvent: false });
    });
  }

  public onSelectSolo(index: number) {
    this.participants.controls.forEach((c, j) =>
      c.get('isPayer')!.setValue(j === index)
    );
    this.calculateShares();
  }

  onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.calculateShares();
    // build bare results
    const tmp: Result[] = this.participants.controls.map(ctrl => {
      const name    = ctrl.get('name')!.value;
      const paid    = +ctrl.get('paid')!.value;
      const share   = +ctrl.get('share')!.value;
      const balance = +(paid - share).toFixed(2);
      return { name, paid, share, balance };
    });

    // compute bi-partite matching of debtors -> creditors
    const instructions = this.computePayments(tmp);

    // merge into results
    this.results = tmp.map((r) => ({
      ...r,
      payments: instructions[r.name] || [],
    }));
  }

  private computePayments(results: Result[]): Record<string, Payment[]> {
    // extract debtors (balance<0) and creditors (balance>0)
    const debtors = results
      .filter((r) => r.balance < 0)
      .map((r) => ({ name: r.name, amount: -r.balance }));
    const creditors = results
      .filter((r) => r.balance > 0)
      .map((r) => ({ name: r.name, amount: r.balance }));

    const map: Record<string, Payment[]> = {};
    debtors.forEach((d) => (map[d.name] = []));

    let i = 0,
      j = 0;
    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i],
        c = creditors[j];
      const amt = Math.min(d.amount, c.amount);

      map[d.name].push({ to: c.name, amount: +amt.toFixed(2) });

      d.amount -= amt;
      c.amount -= amt;

      if (d.amount === 0) i++;
      if (c.amount === 0) j++;
    }

    return map;
  }

  public percentageSumValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const arr = control as FormArray;
      const sum = arr.controls
        // ← use "percentage", not "percent"
        .map(c => +c.get('percentage')!.value || 0)
        .reduce((a, b) => a + b, 0);
  
      return Math.abs(sum - 100) < 0.01
        ? null
        : { percentSum: { actual: sum } };
    };
  }

  ngOnDestroy() {
    this.saveState();
  }

  @HostListener('window:beforeunload')
  onWindowUnload() {
    this.saveState();
  }

  private saveState() {
    const state = {
      splitMode: this.form.value.splitMode,
      numPeople: this.form.value.numPeople,
      participants: this.participants.controls.map(c => ({
        name: c.get('name')!.value,
        paid: +c.get('paid')!.value,
        percentage: +c.get('percentage')!.value,
        isPayer: c.get('isPayer')!.value
      }))
    };
    this.stateSvc.save(state);
  }
}
