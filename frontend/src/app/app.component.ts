// app.module.ts
import { NgModule }      from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ApiModule }     from './core/api.module';
import { BillSplitModule } from './features/bill-split/bill-split.module';

@NgModule({
  imports: [
    BrowserModule,
    ApiModule,
    BillSplitModule
  ],
  bootstrap: [/* your root component */]
})
export class AppModule {}
