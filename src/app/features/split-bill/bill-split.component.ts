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
  BillSplitItem,
  BillSplitStateService,
  SplitMode,
  BillSplitParticipant,
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
      participants: this.fb.array([])
    });

    // Whenever splitMode changes, add/remove the percentage‐sum validator and recalc shares.
    this.form.get('splitMode')!.valueChanges.subscribe((mode: SplitMode) => {
      const arr = this.participants;
      if (mode === 'percentage') {
        arr.setValidators(this.percentageSumValidator());
      } else {
        arr.clearValidators();
      }
      arr.updateValueAndValidity({ emitEvent: false });
      this.calculateShares();
    });

    // Whenever numPeople changes, rebuild that many participant rows.
    this.form.get('numPeople')!.valueChanges.subscribe(n => this.adjustParticipants(n));

    // Initialize with whatever default count is currently in the form (e.g. 2).
    this.adjustParticipants(this.form.value.numPeople);

    // Restore saved state (if any).
    const saved = this.stateSvc.load();
    if (saved) {
      // Patch splitMode & numPeople.  Patching numPeople will trigger adjustParticipants(saved.numPeople)
      // because of the valueChanges subscription above.
      this.form.patchValue({
        splitMode: saved.splitMode,
        numPeople: saved.numPeople
      });

      // At this point, we’ve already called adjustParticipants(saved.numPeople), so
      // “this.participants” now has exactly saved.numPeople FormGroups in it.
      saved.participants.forEach((p, i) => {
        const ctrl = this.participants.at(i);

        // --- REBUILD ITEMS ARRAY ---
        // Grab the items FormArray, clear out whatever “one blank item” was there,
        //     then push one FormGroup per saved item.
        const itemArr = this.items(ctrl);
        itemArr.clear();
        p.items.forEach(savedItem => {
          const fg = this.newItemGroup();
          fg.patchValue({
            description: savedItem.description,
            amount:      savedItem.amount
          });
          itemArr.push(fg);
        });
        // Recompute "paid" from those rebuilt items:
        this.syncItemsToPaid(ctrl);

        // --- PATCH THE OTHER FIELDS ---
        // If there was a saved name, percentage, isPayer, patch those too:
        ctrl.patchValue({
          name:       p.name,
          // If percentage was undefined in saved, keep whatever default percentage was
          percentage: p.percentage ?? ctrl.value.percentage,
          isPayer:    p.isPayer ?? false
        });
      });

      //Once everything is patched, recalc shares one more time:
      this.calculateShares();
    }
  }


  private adjustParticipants(count: number) {
    const arr = this.participants;
    while (arr.length < count) {
      const eachPct = 100 / count;
      const ctrl = this.fb.group({
        name:       [''],              
        paid:       [0, [Validators.required, Validators.min(0)]],
        percentage: [eachPct, [Validators.min(0), Validators.max(100)]],
        isPayer:    [false],
        share:      [{ value: 0, disabled: true }],
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
      // no Validators.required on description: blanks are okay
      description: [''],                
      amount:      [0, [Validators.required, Validators.min(0)]]
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
    // Even if the user left some names blank, we now fill in defaults:
    this.participants.controls.forEach((ctrl, idx) => {
      const rawName = (ctrl.get('name')!.value || '').trim();
      if (!rawName) {
        // Default to “Person 1”, “Person 2”, etc.
        ctrl.get('name')!.setValue(`Person ${idx + 1}`, { emitEvent: false });
      }
      const itemArr = this.items(ctrl);
      itemArr.controls.forEach((itemCtrl, itemIdx) => {
        const desc = (itemCtrl.get('description')!.value || '').trim();
        if (!desc) {
          itemCtrl.get('description')!.setValue(`Item ${itemIdx + 1}`, { emitEvent: false });
        }
        // Amount is already default=0 in newItemGroup(), so no need to patch it here.
      });
    });

    // Now re‐run validation.  (We removed Validators.required on `name`, 
    // so as soon as amounts are valid, the form will be valid.)
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

    // compute bi-partite matching of debtors → creditors
    const instructions = this.computePayments(tmp);

    // merge into results
    this.results = tmp.map((r) => ({
      ...r,
      payments: instructions[r.name] || [],
    }));

    this.saveState();
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
    const state: BillSplitState = {
      splitMode: this.form.value.splitMode,
      numPeople: this.form.value.numPeople,
      participants: this.participants.controls.map(c => {
        // Extract all items from the FormArray
        const itemsFA = c.get('items') as FormArray;
        const items: BillSplitItem[] = itemsFA.controls.map(itemCtrl => ({
          description: itemCtrl.get('description')!.value,
          amount:      +itemCtrl.get('amount')!.value
        }));

        return {
          name:       c.get('name')!.value,
          paid:       +c.get('paid')!.value,
          percentage: +c.get('percentage')!.value,
          isPayer:    c.get('isPayer')!.value,
          items : items
        };
      })
    };
    this.stateSvc.save(state);
  }
}
