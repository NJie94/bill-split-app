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
  BillSplitStateService
} from './bill-split-state.service';
import {
  BillSplitState,
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
  @Output() close = new EventEmitter<void>();

  // ← **add these**:
  form!: FormGroup;
  results: Result[] = [];

  constructor(
    private fb: FormBuilder,
    private stateSvc: BillSplitStateService,
    private api: BillSplitApiService
  ) {}

  // ← re-add lifecycle hooks
  ngOnInit() {
    this.form = this.fb.group({
      splitMode: ['equal', Validators.required],
      numPeople: [2, [Validators.required, Validators.min(1)]],
      participants: this.fb.array([])
    });

    this.form.get('splitMode')!.valueChanges.subscribe(mode => {
      const arr = this.participants;
      if (mode === 'percentage') {
        arr.setValidators(this.percentageSumValidator());
      } else {
        arr.clearValidators();
      }
      arr.updateValueAndValidity({ emitEvent: false });
      this.calculateShares();
    });

    this.form.get('numPeople')!.valueChanges
      .subscribe(n => this.adjustParticipants(n));

    this.adjustParticipants(this.form.value.numPeople);

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
          percentage: p.percentage,
          isPayer:    p.isPayer
        });
      });
    }
  }

  ngOnDestroy() {
    this.saveState();
  }

  @HostListener('window:beforeunload')
  onWindowUnload() {
    this.saveState();
  }

  // re-add your getters and methods…

  get participants(): FormArray {
    return this.form.get('participants') as FormArray;
  }

  get splitMode(): string {
    return this.form.value.splitMode;
  }

  get totalPaid(): number {
    return this.participants.controls
      .map(c => +c.get('paid')!.value)
      .reduce((s, v) => s + v, 0);
  }

  get canCalculate(): boolean {
    return this.form.valid;
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
        items:      this.fb.array([ this.newItemGroup() ])
      });
      this.items(ctrl).valueChanges
        .subscribe(() => this.syncItemsToPaid(ctrl));
      ctrl.get('paid')!.valueChanges
        .subscribe(() => this.calculateShares());
      arr.push(ctrl);
    }
    while (arr.length > count) {
      arr.removeAt(arr.length - 1);
    }
    this.calculateShares();
  }

  private newItemGroup() {
    return this.fb.group({
      description: [''],
      amount:      [0, [Validators.required, Validators.min(0)]]
    });
  }

  items(part: AbstractControl): FormArray {
    return part.get('items') as FormArray;
  }

  private syncItemsToPaid(part: AbstractControl) {
    const sum = this.items(part).controls
      .map(c => +c.get('amount')!.value)
      .reduce((a,b) => a + b, 0);
    part.get('paid')!.setValue(+sum.toFixed(2), { emitEvent: false });
  }

  calculateShares() {
    const total = this.totalPaid;
    const mode  = this.splitMode;

    this.participants.controls.forEach(c => {
      let share = 0;
      if (mode === 'equal') {
        share = total / this.participants.length;
      } else if (mode === 'percentage') {
        share = total * (+c.get('percentage')!.value / 100);
      } else if (mode === 'solo') {
        share = c.get('isPayer')!.value ? total : 0;
      }
      c.get('share')!.setValue(+share.toFixed(2), { emitEvent: false });
    });
  }

  onSelectSolo(i: number) {
    this.participants.controls.forEach((c, j) =>
      c.get('isPayer')!.setValue(j === i));
    this.calculateShares();
  }

  onSubmit() {
    if (!this.canCalculate) {
      this.form.markAllAsTouched();
      return;
    }

    // **call Rust backend** via our ApiService
    const state: BillSplitState = {
      splitMode:   this.form.value.splitMode,
      numPeople:   this.form.value.numPeople,
      participants: this.participants.controls.map(c => ({
        name:       c.get('name')!.value,
        paid:       +c.get('paid')!.value,
        percentage: +c.get('percentage')!.value,
        isPayer:    c.get('isPayer')!.value
      }))
    };

    this.api.calculate(state).subscribe(
      res => this.results = res,
      err => console.error(err)
    );
  }

  private computePayments = ()=>{ /* now unused—we delegate to the backend */ };

  percentageSumValidator(): ValidatorFn {
    return (ctrl: AbstractControl): ValidationErrors | null => {
      const sum = (ctrl as FormArray).controls
        .map(c => +c.get('percentage')!.value || 0)
        .reduce((a,b) => a + b, 0);
      return Math.abs(sum - 100) < 0.01 ? null : { percentSum: { actual: sum }};
    };
  }

  onClose() {
    this.saveState();
    this.close.emit();
  }

  private saveState() {
    const state: BillSplitState = {
      splitMode:   this.form.value.splitMode,
      numPeople:   this.form.value.numPeople,
      participants: this.participants.controls.map(c => ({
        name:       c.get('name')!.value,
        paid:       +c.get('paid')!.value,
        percentage: +c.get('percentage')!.value,
        isPayer:    c.get('isPayer')!.value
      }))
    };
    this.stateSvc.save(state);
  }
}
