import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SplitBillComponent } from './bill-split.component';

describe('SplitBillComponent', () => {
  let component: SplitBillComponent;
  let fixture: ComponentFixture<SplitBillComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SplitBillComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SplitBillComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
