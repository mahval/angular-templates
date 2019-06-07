/*
 *  Copyright 2010-2016 FinTech Neo AS ( fintechneo.com )- All rights reserved
 */

import {
  Component, QueryList, AfterViewInit,
  Input, Output, Renderer,
  ElementRef,
  DoCheck, NgZone, EventEmitter, OnInit, ViewChild
} from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';
import { BehaviorSubject } from 'rxjs';

export class AnimationFrameThrottler {

  static taskMap: { [key: string]: Function } = null;
  static hasChanges = false;
  static mainLoop() {
    AnimationFrameThrottler.taskMap = {};

    const mainLoop = () => {
      if (AnimationFrameThrottler.hasChanges) {
        AnimationFrameThrottler.hasChanges = false;
        Object.keys(AnimationFrameThrottler.taskMap).forEach(
          (key) => {
            AnimationFrameThrottler.taskMap[key]();
            delete AnimationFrameThrottler.taskMap[key];
          });
      }
      window.requestAnimationFrame(() => mainLoop());
    };
    window.requestAnimationFrame(() => mainLoop());
  }

  constructor(private taskkey: string, private task: Function) {
    if (!AnimationFrameThrottler.taskMap) {
      AnimationFrameThrottler.mainLoop();
    }
    AnimationFrameThrottler.taskMap[taskkey] = task;
    AnimationFrameThrottler.hasChanges = true;
  }
}

export class CanvasTableRowStyle {
  backgroundColor: string;
  color: string;
}

export interface CanvasTableSelectListener {
  getRowStyle?: (rowObj: any, rowindex: number) => CanvasTableRowStyle;

  rowSelected(rowIndex: number, colIndex: number, rowContent: any, multiSelect?: boolean): void;
  isSelectedRow(rowObj: any): boolean;
  isBoldRow(rowObj: any): boolean;
}

export interface CanvasTableColumn {
  name: string;
  columnSectionName?: string;
  footerText?: string;
  width: number;
  backgroundColor?: string;
  tooltipText?: string;
  sortColumn: number;
  excelCellAttributes?: any;
  rowWrapModeHidden?: boolean;
  rowWrapModeMuted?: boolean;
  rowWrapModeChipCounter?: boolean; // E.g. for displaying number of messages in conversation in a "chip"/"badge"
  checkbox?: boolean; // checkbox for selecting rows
  textAlign?: number; // default = left, 1 = right, 2 = center
  compareValue?: (a: any, b: any) => number;
  setValue?: (rowobj: any, val: any) => void;
  footerSumReduce?(prev: number, curr: number): number;
  getValue(rowobj: any): any;
  getFormattedValue?(val: any): string;
}

export class FloatingTooltip {
  constructor(public top: number,
    public left: number,
    public width: number,
    public height: number,
    public tooltipText: string) {

  }
}

export class CanvasTableColumnSection {
  constructor(
    public columnSectionName: string,
    public width: number,
    public leftPos: number,
    public backgroundColor: string) {

  }
}

@Component({
  selector: 'canvastable',
  template: `
      <canvas #thecanvas style="position: absolute; width: 100%; height: 100%; user-select: none;"
          tabindex="0"></canvas>
          <div #columnOverlay draggable="true" [matTooltip]="floatingTooltip.tooltipText" style="position: absolute;"
                (DOMMouseScroll)="floatingTooltip=null"
                (mousewheel)="floatingTooltip=null"
                (mousemove)="canv.onmousemove($event)"
                (click)="columnOverlayClicked($event)"
                [style.top.px]="floatingTooltip.top"
                [style.left.px]="floatingTooltip.left"
                [style.width.px]="floatingTooltip.width"
                [style.height.px]="floatingTooltip.height"
                  *ngIf="floatingTooltip"
                (dragstart)="dragColumnOverlay($event)"
                >
      </div>
      `
})
export class CanvasTableComponent implements AfterViewInit, DoCheck {
  static incrementalId = 1;
  public elementId: string;
  private _topindex = 0.0;
  public get topindex(): number { return this._topindex; }
  public set topindex(topindex: number) {
    if (this._topindex !== topindex) {
      this._topindex = topindex;
      this.hasChanges = true;
    }
  }

  @ViewChild('thecanvas', { static: true }) canvRef: ElementRef;

  @ViewChild(MatTooltip, { static: false }) columnOverlay: MatTooltip;

  private canv: HTMLCanvasElement;

  private ctx: any;
  private _rowheight = 30;
  public fontheight = 16;

  public fontFamily = 'Roboto, "Helvetica Neue", sans-serif';

  private maxVisibleRows: number;

  private scrollBarRect: any;

  private touchdownxy: any;
  private scrollbardrag: Boolean = false;

  public _horizScroll = 0;
  public get horizScroll(): number { return this._horizScroll; }
  public set horizScroll(horizScroll: number) {
    if (this._horizScroll !== horizScroll) {
      this._horizScroll = horizScroll;
      this.hasChanges = true;
    }
  }

  public _rows: any[] = [];

  public _columns: CanvasTableColumn[] = [];
  public get columns(): CanvasTableColumn[] { return this._columns; }
  public set columns(columns: CanvasTableColumn[]) {
    if (this._columns !== columns) {
      this._columns = columns;
      this.recalculateColumnSections();
      this.calculateColumnFooterSums();
      this.hasChanges = true;
    }
  }


  public hoverRowColor = 'rgba(0, 0, 0, 0.04)';
  public selectedRowColor = 'rgba(225, 238, 255, 1)';

  public colpaddingleft = 10;
  public colpaddingright = 10;
  public seprectextraverticalpadding = 4; // Extra padding above/below for separator rectangles

  private lastMouseDownEvent: MouseEvent;
  private _hoverRowIndex: number;
  private get hoverRowIndex(): number { return this._hoverRowIndex; }
  private set hoverRowIndex(hoverRowIndex: number) {
    if (this._hoverRowIndex !== hoverRowIndex) {
      this._hoverRowIndex = hoverRowIndex;
      this.hasChanges = true;
    }
  }

  // Auto row wrap mode (width based on iphone 5) - set to 0 to disable row wrap mode
  public autoRowWrapModeWidth = 540;

  public rowWrapMode = true;
  public rowWrapModeWrapColumn = 2;

  public hasChanges: boolean;

  private formattedValueCache: { [key: string]: string; } = {};

  public columnSections: CanvasTableColumnSection[] = [];

  public scrollLimitHit: BehaviorSubject<number> = new BehaviorSubject(0);

  public floatingTooltip: FloatingTooltip;

  @Input() selectListener: CanvasTableSelectListener;
  @Output() touchscroll = new EventEmitter();

  constructor(elementRef: ElementRef, private renderer: Renderer, private _ngZone: NgZone) {
    // this.elementId = "canvasTable"+(CanvasTableComponent.incrementalId++);
    // console.log("Creating canvas table with id "+this.elementId);
  }

  ngDoCheck() {
    if (this.canv) {

      const devicePixelRatio = window.devicePixelRatio ? window.devicePixelRatio : 1;
      const wantedWidth = Math.floor(this.canv.scrollWidth * devicePixelRatio);
      const wantedHeight = Math.floor(this.canv.scrollHeight * devicePixelRatio);

      if (this.canv.width !== wantedWidth || this.canv.height !== wantedHeight) {
        this.canv.width = wantedWidth;
        this.canv.height = wantedHeight;
        if (devicePixelRatio !== 1) {
          this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        }
        this.maxVisibleRows = this.canv.scrollHeight / this.rowheight;
        this.hasChanges = true;
        if (this.canv.scrollWidth < this.autoRowWrapModeWidth) {
          this.rowWrapMode = true;
        } else {
          this.rowWrapMode = false;
        }
      }
    }
  }

  ngAfterViewInit() {
    this.canv = this.canvRef.nativeElement;
    this.ctx = this.canv.getContext('2d');

    this.canv.onwheel = (event: MouseWheelEvent) => {
      event.preventDefault();
      switch (event.deltaMode) {
        case 0:
          // pixels
          this.topindex += (event.deltaY / this.rowheight);
          break;
        case 1:
          // lines
          this.topindex += event.deltaY;
          break;
        case 2:
          // pages
          this.topindex += (event.deltaY * (this.canv.scrollHeight / this.rowheight));
          break;
      }

      this.enforceScrollLimit();
    };

    const checkIfScrollbarArea = (clientX: number, clientY: number, wholeScrollbar?: boolean) => {
      if (!this.scrollBarRect) {
        return false;
      }
      const canvrect = this.canv.getBoundingClientRect();
      const x = clientX - canvrect.left;
      const y = clientY - canvrect.top;
      return x > this.scrollBarRect.x && x < this.scrollBarRect.x + this.scrollBarRect.width &&
        (wholeScrollbar || y > this.scrollBarRect.y && y < this.scrollBarRect.y + this.scrollBarRect.height);
    };

    const checkScrollbarDrag = (clientX: number, clientY: number) => {

      if (!this.scrollBarRect) {
        return;
      }

      const canvrect = this.canv.getBoundingClientRect();
      this.touchdownxy = { x: clientX - canvrect.left, y: clientY - canvrect.top };
      if (checkIfScrollbarArea(clientX, clientY)) {
        this.scrollbardrag = true;
      }
    };

    this.canv.onmousedown = (event: MouseEvent) => {
      event.preventDefault();
      checkScrollbarDrag(event.clientX, event.clientY);
      this.lastMouseDownEvent = event;
    };

    let previousTouchY: number;
    let previousTouchX: number;
    let touchMoved = false;

    this.canv.addEventListener('touchstart', (event: TouchEvent) => {

      this.canv.focus(); // Take away focus from search field
      previousTouchX = event.targetTouches[0].clientX;
      previousTouchY = event.targetTouches[0].clientY;
      checkScrollbarDrag(event.targetTouches[0].clientX, event.targetTouches[0].clientY);
      if (this.scrollbardrag) {
        event.preventDefault();
      }

      touchMoved = false;
    });

    this.canv.addEventListener('touchmove', (event: TouchEvent) => {
      event.preventDefault();
      touchMoved = true;
      if (event.targetTouches.length === 1) {
        const newTouchY = event.targetTouches[0].clientY;
        const newTouchX = event.targetTouches[0].clientX;
        if (this.scrollbardrag === true) {
          this.doScrollBarDrag(newTouchY);
        } else {
          this.topindex -= (newTouchY - previousTouchY) / this.rowheight;
          if (!this.rowWrapMode) {
            this.horizScroll -= (newTouchX - previousTouchX);
          }

          previousTouchY = newTouchY;
          previousTouchX = newTouchX;
        }
        this.enforceScrollLimit();
        this.touchscroll.emit(this.horizScroll);
      }

    }, false);

    this.canv.addEventListener('touchend', (event: TouchEvent) => {
      event.preventDefault();
      if (!touchMoved) {
        this.selectRow(event.changedTouches[0].clientX, event.changedTouches[0].clientY);
      }
      if (this.scrollbardrag) {
        this.scrollbardrag = false;
      }
    });

    this.renderer.listenGlobal('window', 'mousemove', (event: MouseEvent) => {
      if (this.scrollbardrag === true) {
        event.preventDefault();
        this.doScrollBarDrag(event.clientY);
      }
    });

    this.canv.onmousemove = (event: MouseEvent) => {
      if (this.scrollbardrag === true) {
        event.preventDefault();
        return;
      }

      const canvrect = this.canv.getBoundingClientRect();
      let newHoverRowIndex = Math.floor(this.topindex + (event.clientY - canvrect.top) / this.rowheight);
      if (this.scrollbardrag || checkIfScrollbarArea(event.clientX, event.clientY, true)) {
        newHoverRowIndex = null;
      }

      if (this.hoverRowIndex !== newHoverRowIndex) {
        this.hoverRowIndex = newHoverRowIndex;
        if (this.lastMouseDownEvent) {

          this.selectRow(this.lastMouseDownEvent.clientX, event.clientY);
        }
      }
      if (this.hoverRowIndex !== null) {
        const clientX = event.clientX - canvrect.left;
        const colIndex = this.getColIndexByClientX(clientX);
        const colStartX = this.columns.reduce((prev, curr, ndx) => ndx < colIndex ? prev + curr.width : prev, 0);

        if (!event.shiftKey && !this.lastMouseDownEvent && this.columns[colIndex] && this.columns[colIndex].tooltipText) {
          this.floatingTooltip = new FloatingTooltip(
            (this.hoverRowIndex - this.topindex) * this.rowheight,
            colStartX - this.horizScroll,
            this.columns[colIndex].width,
            this.rowheight, this.columns[colIndex].tooltipText);
          setTimeout(() => {
            if (this.columnOverlay) {
              this.columnOverlay.show(1000);
            }
          }, 0);
        } else {
          this.floatingTooltip = null;
        }
      } else {
        this.floatingTooltip = null;
      }
    };
    this.canv.onmouseout = (event: MouseEvent) => {
      const newHoverRowIndex = null;
      if (this.hoverRowIndex !== newHoverRowIndex) {
        this.hoverRowIndex = newHoverRowIndex;
      }
    };

    this.renderer.listenGlobal('window', 'mouseup', (event: MouseEvent) => {
      this.touchdownxy = undefined;
      this.lastMouseDownEvent = undefined;
      if (this.scrollbardrag) {
        this.scrollbardrag = false;
      }
    });

    this.canv.onmouseup = (event: MouseEvent) => {
      event.preventDefault();
      if (!this.scrollbardrag &&
        this.lastMouseDownEvent &&
        event.clientX === this.lastMouseDownEvent.clientX &&
        event.clientY === this.lastMouseDownEvent.clientY) {
        this.selectRow(event.clientX, event.clientY);
      }
      this.lastMouseDownEvent = null;
    };


    this.renderer.listenGlobal('window', 'resize', () => true);

    const paintLoop = () => {
      if (this.hasChanges) {
        try {
          this.dopaint();
        } catch (e) {
          console.log(e);
        }
        this.hasChanges = false;
      }
      window.requestAnimationFrame(() => paintLoop());
    };

    this._ngZone.runOutsideAngular(() =>
      window.requestAnimationFrame(() => paintLoop())
    );
  }

  public dragColumnOverlay(event: DragEvent) {
    const canvrect = this.canv.getBoundingClientRect();
    const selectedColIndex = this.getColIndexByClientX(event.clientX - canvrect.left);
    const selectedRowIndex = Math.floor(this.topindex + (event.clientY - canvrect.top) / this.rowheight);

    if (!this.columns[selectedColIndex].checkbox) {
      console.log('Dragstart', event);
      event.dataTransfer.setData('text/plain', 'rowIndex:' + selectedRowIndex);
    } else {
      event.preventDefault();
      this.lastMouseDownEvent = event;
    }

    this.selectListener.rowSelected(selectedRowIndex, -1, this.rows[selectedRowIndex]);
    this.hasChanges = true;
  }

  public columnOverlayClicked(event: MouseEvent) {
    this.lastMouseDownEvent = null;
    this.selectRow(event.clientX, event.clientY);
  }

  public doScrollBarDrag(clientY: number) {
    const canvrect = this.canv.getBoundingClientRect();
    this.topindex = this.rows.length * ((clientY - canvrect.top) / this.canv.scrollHeight);

    this.enforceScrollLimit();
  }

  public getColIndexByClientX(clientX: number) {
    let x = -this.horizScroll;
    let selectedColIndex = 0;
    for (; selectedColIndex < this.columns.length; selectedColIndex++) {
      const col = this.columns[selectedColIndex];
      if (clientX >= x && clientX < x + col.width) {
        break;
      }
      x += col.width;
    }
    return selectedColIndex;
  }

  public selectRow(clientX: number, clientY: number, multiSelect?: boolean) {
    const canvrect = this.canv.getBoundingClientRect();
    clientX -= canvrect.left;

    const selectedRowIndex = Math.floor(this.topindex + (clientY - canvrect.top) / this.rowheight);

    this.selectListener.rowSelected(selectedRowIndex,
      this.getColIndexByClientX(clientX),
      this.rows[selectedRowIndex],
      multiSelect);
    this.hasChanges = true;
  }

  public autoAdjustColumnWidths(minwidth: number, maxwidth: number) {
    const padding = this.colpaddingleft + this.colpaddingright;
    const devicePixelRatio = window.devicePixelRatio ? window.devicePixelRatio : 1;

    this.columns.forEach(c => {
      let newwidth = devicePixelRatio * Math.round(this.ctx.measureText(c.name).width + padding);
      if (newwidth > maxwidth) {
        newwidth = maxwidth;
      }
      if (newwidth > minwidth) {
        c.width = newwidth;
      }
    });

    for (let rowindex = this.topindex; rowindex <
      this.topindex + this.canv.height / this.rowheight &&
      rowindex < this.rows.length;
      rowindex++) {
      const row = this.rows[rowindex];
      this.columns.forEach(c => {
        let valueWidth = Math.round(
          (this.ctx.measureText(
            c.getFormattedValue ?
              c.getFormattedValue(c.getValue(row)) :
              c.getValue(row)
          ).width + padding) * devicePixelRatio
        );

        if (valueWidth > maxwidth) {
          valueWidth = maxwidth;
        }

        if (valueWidth > c.width) {
          c.width = valueWidth;
        }
      });
    }
    this.recalculateColumnSections();
    this.hasChanges = true;
  }

  public scrollTop() {
    this.topindex = 0;
    this.hasChanges = true;
  }

  public get rows(): any[] {
    return this._rows;
  }

  public set rows(rows: any[]) {
    if (this._rows !== rows) {
      this._rows = rows;
      this.calculateColumnFooterSums();
      this.hasChanges = true;
    }
  }

  public calculateColumnFooterSums(): void {
    this.columns.forEach((col) => {
      if (col.footerSumReduce) {
        col.footerText = col.getFormattedValue(
          this.rows.reduce((prev, row) => col.footerSumReduce(prev, col.getValue(row)), 0)
        );
      }
    });
  }

  public recalculateColumnSections(): void {
    let leftX = 0;
    this.columnSections = this.columns.reduce((accumulated, current) => {
      let ret;

      if (accumulated.length === 0 ||
        accumulated[accumulated.length - 1].columnSectionName !== current.columnSectionName) {

        ret = accumulated.concat([
          new CanvasTableColumnSection(current.columnSectionName,
            current.width,
            leftX,
            current.backgroundColor)]);
      } else if (accumulated.length > 0 && accumulated[accumulated.length - 1].columnSectionName === current.columnSectionName) {
        accumulated[accumulated.length - 1].width += current.width;
        ret = accumulated;
      }
      leftX += current.width;
      return ret;
    }, []);
    this.hasChanges = true;
  }


  private enforceScrollLimit() {
    if (this.topindex < 0) {
      this.topindex = 0;
    } else if (this.rows.length < this.maxVisibleRows) {
      this.topindex = 0;
    } else if (this.topindex + this.maxVisibleRows > this.rows.length) {
      this.topindex = this.rows.length - this.maxVisibleRows;
      // send max rows hit events (use to fetch more data)
      this.scrollLimitHit.next(this.rows.length);
    }


    const columnsTotalWidth = this.columns.reduce((width, col) =>
      col.width + width, 0);

    if (this.horizScroll < 0) {
      this.horizScroll = 0;
    } else if (
      this.canv.scrollWidth < columnsTotalWidth &&
      this.horizScroll + this.canv.scrollWidth > columnsTotalWidth) {
      this.horizScroll = columnsTotalWidth - this.canv.scrollWidth;
    }
  }

  /**
   * Draws a rounded rectangle using the current state of the canvas.
   * If you omit the last three params, it will draw a rectangle
   * outline with a 5 pixel border radius
   * @param x The top left x coordinate
   * @param y The top left y coordinate
   * @param width The width of the rectangle
   * @param height The height of the rectangle
   * @param [radius = 5] The corner radius; It can also be an object
   *                 to specify different radii for corners
   * @param [radius.tl = 0] Top left
   * @param [radius.tr = 0] Top right
   * @param [radius.br = 0] Bottom right
   * @param [radius.bl = 0] Bottom left
   * @param [fill = false] Whether to fill the rectangle.
   * @param [stroke = true] Whether to stroke the rectangle.
   */
  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number,
      width: number, height: number, radius?: any, fill?: boolean, stroke?: boolean) {
    if (typeof stroke === 'undefined') {
      stroke = true;
    }
    if (typeof radius === 'undefined') {
      radius = 5;
    }
    if (typeof radius === 'number') {
      radius = { tl: radius, tr: radius, br: radius, bl: radius };
    } else {
      const defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
      for (const side in defaultRadius) {
        radius[side] = radius[side] || defaultRadius[side];
      }
    }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
    if (fill) {
      ctx.fill();
    }
    if (stroke) {
      ctx.stroke();
    }
  }

  public get rowheight(): number {
    return this.rowWrapMode ? this._rowheight * 2 : this._rowheight;
  }

  public set rowheight(rowheight: number) {
    if (this._rowheight !== rowheight) {
      this._rowheight = rowheight;
      this.hasChanges = true;
    }
  }

  private dopaint() {
    this.ctx.textBaseline = 'middle';
    this.ctx.font = this.fontheight + 'px ' + this.fontFamily;

    const canvwidth: number = this.canv.scrollWidth;
    const canvheight: number = this.canv.scrollHeight;

    let colx = 0 - this.horizScroll;
    // Columns
    for (let colindex = 0; colindex < this.columns.length; colindex++) {
      const col: CanvasTableColumn = this.columns[colindex];
      if (colx + col.width > 0 && colx < canvwidth) {
        this.ctx.fillStyle = col.backgroundColor ? col.backgroundColor : '#fff';
        this.ctx.fillRect(colx,
          0,
          colindex === this.columns.length - 1 ?
            canvwidth - colx :
            col.width,
          canvheight
        );
      }
      colx += col.width;
    }

    if (this.rows.length < 1) {
      return;
    }

    // Rows
    for (let n = this.topindex; n < this.rows.length; n += 1.0) {
      const rowIndex = Math.floor(n);

      if (rowIndex > this.rows.length) {
        break;
      }

      const rowobj = this.rows[rowIndex];

      const halfrowheight = (this.rowheight / 2);
      const rowy = (rowIndex - this.topindex) * this.rowheight;
      if (rowobj) {
        // Clear row area
        // Alternating row colors:
        // let rowBgColor : string = (rowIndex%2===0 ? "#e8e8e8" : "rgba(255,255,255,0.7)");
        // Single row color:
        const rowstyle = this.selectListener.getRowStyle ?
          this.selectListener.getRowStyle(rowobj, rowIndex) : {
            color: '#000',
            backgroundColor: '#fff'
          };
        let rowBgColor = rowstyle.backgroundColor;

        const isBoldRow = this.selectListener.isBoldRow(rowobj);
        const isSelectedRow = this.selectListener.isSelectedRow(rowobj);
        if (this.hoverRowIndex === rowIndex) {
          rowBgColor = this.hoverRowColor;
        }
        if (isSelectedRow) {
          rowBgColor = this.selectedRowColor;
        }

        this.ctx.fillStyle = rowBgColor;
        this.ctx.fillRect(0, rowy, canvwidth,
          this.rowheight);

        let x = 0;
        for (let colindex = 0; colindex < this.columns.length; colindex++) {
          const col: CanvasTableColumn = this.columns[colindex];
          const val: any = col.getValue(rowobj);
          let formattedVal: string;
          const formattedValueCacheKey: string = colindex + ':' + val;
          if (this.formattedValueCache[formattedValueCacheKey]) {
            formattedVal = this.formattedValueCache[formattedValueCacheKey];
          } else if (('' + val).length > 0 && col.getFormattedValue) {
            formattedVal = col.getFormattedValue(val);
            this.formattedValueCache[formattedValueCacheKey] = formattedVal;
          } else {
            formattedVal = '' + val;
          }
          if (this.rowWrapMode && col.rowWrapModeHidden) {
            continue;
          } else if (this.rowWrapMode && col.rowWrapModeChipCounter && parseInt(val, 10) > 1) {
            this.ctx.save();

            this.ctx.strokeStyle = '#01579B';
            if (isSelectedRow) {
              this.ctx.fillStyle = '#000';
            } else {
              this.ctx.fillStyle = '#01579B';
            }
            this.roundRect(this.ctx,
              canvwidth - 50,
              rowy + 3,
              28,
              15, 10, true);
            this.ctx.font = '10px ' + this.fontFamily;

            this.ctx.strokeStyle = '#000';
            if (isSelectedRow) {
              this.ctx.fillStyle = '#01579B';
            } else {
              this.ctx.fillStyle = '#000';
            }
            this.ctx.textAlign = 'center';
            this.ctx.fillText(formattedVal + '', canvwidth - 36, rowy + halfrowheight - 15);

            this.ctx.restore();

            continue;
          } else if (this.rowWrapMode && col.rowWrapModeChipCounter) {
            continue;
          }
          if (this.rowWrapMode && colindex === this.rowWrapModeWrapColumn) {
            x = 0;
          }

          x += this.colpaddingleft;

          if ((x - this.horizScroll + col.width) >= 0 && formattedVal.length > 0) {
            this.ctx.fillStyle = '#000';
            if (isSelectedRow) {
              this.ctx.fillStyle = '#01579B';
            }
            if (this.rowWrapMode) {
              // Wrap rows if in row wrap mode
              if (colindex >= this.rowWrapModeWrapColumn) {
                this.ctx.save();
                this.ctx.font = '14px ' + this.fontFamily;
                this.ctx.fillStyle = '#01579B';
                this.ctx.fillText(formattedVal, x, rowy + halfrowheight + 12);
                this.ctx.restore();
              } else if (col.rowWrapModeMuted) {
                this.ctx.save();
                this.ctx.font = '12px ' + this.fontFamily;
                this.ctx.fillStyle = '#777';
                this.ctx.fillText(formattedVal, x, rowy + halfrowheight - 15);
                this.ctx.restore();
              } else {
                if (isBoldRow) {
                  this.ctx.save();
                  this.ctx.font = 'bold ' + this.ctx.font;
                }
                this.ctx.fillText(formattedVal, x, rowy + halfrowheight - 15);
                if (isBoldRow) {
                  this.ctx.restore();
                }
              }
            } else if (x - this.horizScroll < canvwidth) {
              const texty: number = rowy + halfrowheight;
              let textx: number = x - this.horizScroll;

              const width = col.width - this.colpaddingright - this.colpaddingleft;

              this.ctx.save();
              this.ctx.beginPath();
              this.ctx.moveTo(textx, rowy);
              this.ctx.lineTo(textx + width, rowy);
              this.ctx.lineTo(textx + width, rowy + this.rowheight);
              this.ctx.lineTo(textx, rowy + this.rowheight);
              this.ctx.closePath();

              this.ctx.clip();

              if (col.checkbox) {
                this.ctx.beginPath();
                this.ctx.arc(textx + width / 2, texty, 6, 0, 2 * Math.PI);
                this.ctx.stroke();
                if (val) {
                  this.ctx.beginPath();
                  this.ctx.arc(textx + width / 2, texty, 4, 0, 2 * Math.PI);
                  this.ctx.fill();
                }
              } else {
                if (col.textAlign === 1) {
                  textx += width;
                  this.ctx.textAlign = 'end';
                }

                if (isBoldRow) {
                  this.ctx.font = 'bold ' + this.ctx.font;
                }
                this.ctx.fillStyle = rowstyle.color;
                this.ctx.fillText(formattedVal, textx, texty);
              }
              this.ctx.restore();
            }
          }

          x += (Math.round(col.width * (this.rowWrapMode && col.rowWrapModeMuted ?
                (10 / this.fontheight) : 1)) - this.colpaddingleft); // We've already added colpaddingleft above
        }
      } else {
        break;
      }
      if (rowy > canvheight) {
        break;
      }
      this.ctx.fillStyle = '#000';

    }

    // Column separators

    if (!this.rowWrapMode) {
      // No column separators in row wrap mode
      this.ctx.strokeStyle = '#bbb';
      let x = 0;
      for (let colindex = 0; colindex < this.columns.length; colindex++) {
        this.ctx.beginPath();
        this.ctx.moveTo(x - this.horizScroll, 0);
        this.ctx.lineTo(x - this.horizScroll, canvheight);
        this.ctx.stroke();
        x += this.columns[colindex].width;
      }
    }

    // Scrollbar
    let scrollbarheight = canvheight / this.rows.length * this.rowheight;
    if (scrollbarheight < 20) {
      scrollbarheight = 20;
    }
    const scrollbarpos =
      (this.topindex / (this.rows.length - this.maxVisibleRows)) * (canvheight - scrollbarheight);

    if (scrollbarheight < canvheight) {
      const scrollbarverticalpadding = 4;
      const scrollbarwidth = 20;
      const scrollbarx = canvwidth - scrollbarwidth;
      this.ctx.fillStyle = '#aaa';
      this.ctx.fillRect(scrollbarx, 0, scrollbarwidth, canvheight);
      this.ctx.fillStyle = '#fff';
      this.scrollBarRect = {
        x: scrollbarx + 1,
        y: scrollbarpos + scrollbarverticalpadding / 2,
        width: scrollbarwidth - 2,
        height: scrollbarheight - scrollbarverticalpadding
      };

      if (this.scrollbardrag) {
        this.ctx.fillStyle = 'rgba(200,200,255,0.5)';
        this.roundRect(this.ctx,
          this.scrollBarRect.x - 4,
          this.scrollBarRect.y - 4,
          this.scrollBarRect.width + 8,
          this.scrollBarRect.height + 8, 5, true);

        this.ctx.fillStyle = '#fff';
        this.ctx.fillRect(this.scrollBarRect.x,
          this.scrollBarRect.y,
          this.scrollBarRect.width,
          this.scrollBarRect.height);
      } else {
        this.ctx.fillStyle = '#fff';
        this.ctx.fillRect(this.scrollBarRect.x, this.scrollBarRect.y, this.scrollBarRect.width, this.scrollBarRect.height);
      }

    }

  }
}

@Component({
  moduleId: window['_moduleidroot'] + '/canvastable/',
  selector: 'canvastablecontainer',
  templateUrl: 'canvastablecontainer.component.html'
})
export class CanvasTableContainerComponent implements OnInit {
  colResizePreviousX: number;
  colResizeColumnIndex: number;
  columnResized: boolean;
  sortColumn = 0;
  sortDescending = false;
  showColumnSections = false;

  savedColumnWidths: number[] = [];
  @ViewChild(CanvasTableComponent, { static: true }) canvastable: CanvasTableComponent;
  @Input() configname = 'default';
  @Input() canvastableselectlistener: CanvasTableSelectListener;

  @Output() sortToggled: EventEmitter<any> = new EventEmitter();

  constructor(private renderer: Renderer) {

  }

  ngOnInit() {
    const savedColumnWidthsString: string = localStorage.getItem(this.configname + 'CanvasTableColumnWidths');
    if (savedColumnWidthsString) {
      this.savedColumnWidths = JSON.parse(savedColumnWidthsString);
    }


    this.renderer.listenGlobal('window', 'mousemove', (event: MouseEvent) => {
      if (this.colResizePreviousX) {
        event.preventDefault();
        event.stopPropagation();
        this.colresize(event.clientX);
      }
    });
    this.renderer.listenGlobal('window', 'mouseup', (event: MouseEvent) => {
      if (this.colResizePreviousX) {
        event.preventDefault();
        event.stopPropagation();
        this.colresizeend();
      }
    });
  }

  colresizestart(clientX: number, colIndex: number) {
    if (colIndex > 0) {
      this.colResizePreviousX = clientX;
      this.colResizeColumnIndex = colIndex;
    }
  }

  colresize(clientX: number) {
    if (this.colResizePreviousX) {
      new AnimationFrameThrottler('colresize', () => {
        const prevcol: CanvasTableColumn = this.canvastable.columns[this.colResizeColumnIndex - 1];
        if (prevcol && prevcol.width) {
          prevcol.width += (clientX - this.colResizePreviousX);
          if (prevcol.width < 20) {
            prevcol.width = 20;
          }
          this.canvastable.hasChanges = true;
          this.columnResized = true;
          this.colResizePreviousX = clientX;
          this.canvastable.recalculateColumnSections();
          this.saveColumnWidths();
        }
      });
    }
  }

  public sumWidthsBefore(colIndex: number) {
    let ret = 0;
    for (let n = 0; n < colIndex; n++) {
      ret += this.canvastable.columns[n].width;
    }
    return ret;
  }

  getSavedColumnWidth(colIndex: number, defaultWidth: number): number {
    return this.savedColumnWidths[colIndex] ?
      this.savedColumnWidths[colIndex] :
      defaultWidth;
  }

  saveColumnWidths() {
    this.savedColumnWidths = this.canvastable.columns.map((col) => col.width);
    localStorage.setItem(this.configname + 'CanvasTableColumnWidths', JSON.stringify(this.savedColumnWidths));
  }

  colresizeend() {
    this.colResizePreviousX = null;
    this.colResizeColumnIndex = null;
  }

  horizScroll(evt: any) {
    this.canvastable.horizScroll = evt.target.scrollLeft;
  }

  public toggleSort(column: number) {
    if (column === null) {
      return;
    }

    if (this.columnResized) {
      this.columnResized = false;
      return;
    }

    if (column === this.sortColumn) {
      this.sortDescending = !this.sortDescending;
    } else {
      this.sortColumn = column;
    }
    this.sortToggled.emit({ sortColumn: this.sortColumn, sortDescending: this.sortDescending });
  }
}
