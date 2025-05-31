import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

import { AppComponent } from './app.component';
import { SplitBillComponent } from './features/split-bill/bill-split.component';
import { ApiModule } from './core/api.module';

@NgModule({
  declarations: [AppComponent, SplitBillComponent],
  imports: [BrowserModule, ReactiveFormsModule, HttpClientModule, ApiModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
