// src/app/app.module.ts
import { NgModule }         from '@angular/core';
import { BrowserModule }    from '@angular/platform-browser';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { SplitBillComponent } from './features/split-bill/bill-split.component';


@NgModule({
  declarations: [ SplitBillComponent ],
  imports:    [
    BrowserModule,
    ReactiveFormsModule,
    HttpClientModule
  ],
  bootstrap: [ SplitBillComponent ]
})
export class AppModule {}
