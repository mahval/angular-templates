/* 
 *  Copyright 2010-2016 FinTech Neo AS ( fintechneo.com )- All rights reserved
 */


import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule, MatTooltip } from '@angular/material/tooltip';
import { CanvasTableComponent,CanvasTableContainerComponent } from './canvastable.component';
export { CanvasTableColumn, CanvasTableComponent, CanvasTableContainerComponent, CanvasTableSelectListener, AnimationFrameThrottler} from './canvastable.component';

@NgModule({
  imports: [
      CommonModule,
      MatTooltipModule,
      MatIconModule
  ],
  declarations: [CanvasTableComponent,CanvasTableContainerComponent],
  exports: [CanvasTableComponent,CanvasTableContainerComponent]
})
export class CanvasTableModule {

}