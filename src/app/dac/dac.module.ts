/* 
 *  Copyright 2010-2016 FinTech Neo AS ( fintechneo.com )- All rights reserved
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { CanvasTableModule } from '../canvastable/canvastable.module';
import { DACAdminComponent } from './dacadmin.component';
import { DACService } from './dac.service';
import { DACCodeListsService } from './daccodelists.service';

@NgModule({
  imports: [
      CommonModule,
      FormsModule,
      CanvasTableModule,
      MatCheckboxModule,
      MatSidenavModule,
      MatToolbarModule,
      MatButtonModule,
      MatIconModule,
      MatInputModule,
      MatListModule,
      MatDialogModule,
      
  ],
  declarations: [DACAdminComponent],
  exports: [DACAdminComponent],  
  providers: [DACCodeListsService],
  entryComponents: []
})
export class DACModule {

}