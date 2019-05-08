/* 
 *  Copyright 2010-2019 FinTech Neo AS ( fintechneo.com ) - All rights reserved
 */

import { Injectable, NgZone } from '@angular/core';
import { AsyncSubject } from 'rxjs';
import { Observable } from 'rxjs';

import { CanvasTableComponent, CanvasTableColumn, CanvasTableColumnSection } from '../canvastable/canvastable.component';
import { map } from 'rxjs/operators';

declare var XLSX: any;

@Injectable()
export class XLSXService {
    scriptLoadedSubject: AsyncSubject<any>;
    xlsx: any;

    scriptLocation = `assets/xlsx.core.min.js`;

    constructor(private ngZone: NgZone) {

    }

    private loadScripts() {
        if (this.scriptLoadedSubject) {
            return;
        }
        this.scriptLoadedSubject = new AsyncSubject();
        this.ngZone.runOutsideAngular(() => {
            const scriptelm = document.createElement('script');
            scriptelm.src = this.scriptLocation;
            scriptelm.onload = () => {
                this.ngZone.run(() => {
                    console.log('Excel script loaded');
                    this.scriptLoadedSubject.next(XLSX);
                    this.xlsx = XLSX;
                    this.scriptLoadedSubject.complete();
                });
            };
            document.body.appendChild(scriptelm);
        });
    }

    getXLSX(): Observable<any> {
        this.loadScripts();
        return this.scriptLoadedSubject;
    }

    getCellRef(colIndex: number, rowIndex: number) {
        return this.xlsx.utils.encode_cell({ c: colIndex, r: rowIndex + 1 })
    };


    parse(arraybuffer: ArrayBuffer): Observable<any> {
        /* convert data to binary string */
        const data = new Uint8Array(arraybuffer);
        const arr = new Array();
        for (let i = 0; i != data.length; ++i) {
            arr[i] = String.fromCharCode(data[i]);
        }
        const bstr = arr.join('');

        return this.getXLSX().pipe(map((xlsx) => xlsx.read(bstr, { type: 'binary' })));
    }

    writeAndDownload(filename: string, wb: any) {
        const wopts = { bookType: 'xlsx', bookSST: false, type: 'binary' };
        const wbout = this.xlsx.write(wb, wopts);

        const s2ab = (s: string) => {
            const buf = new ArrayBuffer(s.length);
            const view = new Uint8Array(buf);
            for (let i = 0; i !== s.length; ++i) {
                // tslint:disable-next-line:no-bitwise
                view[i] = s.charCodeAt(i) & 0xFF;
            }
            return buf;
        };

        const a = document.createElement('a');
        const theurl = URL.createObjectURL(new Blob([s2ab(wbout)],
            { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
        a.href = theurl;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(theurl);
    }

    exportCanvasTableToExcel(canvastable: CanvasTableComponent, sheetname: string) {
        this.getXLSX().subscribe((xlsx: any) => {
            // Create sheet
            const sheet: any = {};
            const wscols: any[] = [];

            let rowIndex = 0;
            // let boldCellStyle = { font: { name: "Verdana", sz: 11, bold: true, color: "FF00FF88"}, fill: {fgColor: {rgb: "FFFFAA00"}}};
            let hasColumnSections = false;
            const columnSectionsByName: {[name: string]: CanvasTableColumnSection} = {};
            if (canvastable.columnSections && canvastable.columnSections.length > 0) {
                hasColumnSections = true;
                canvastable.columnSections.forEach(columnSection => {
                    columnSectionsByName[columnSection.columnSectionName] = columnSection;
                });
                rowIndex ++;
            }
            const createdColumnSectionHeaders = {};

            canvastable.columns.forEach(
                (col: CanvasTableColumn, ndx: number) => {
                    if (hasColumnSections && !createdColumnSectionHeaders[col.columnSectionName]) {
                        const columnSectionĆellref = xlsx.utils.encode_cell({ c: ndx, r: rowIndex - 1 });
                        sheet[columnSectionĆellref] = {
                            t: 's',
                            v: col.columnSectionName,
                            s: { font: { bold: true }, fill: col.backgroundColor ? {
                                    fgColor: { rgb: 'FF' + col.backgroundColor.substr(1) } } : null
                            }
                        };
                        createdColumnSectionHeaders[col.columnSectionName] = true;
                    }
                    const cellref = xlsx.utils.encode_cell({ c: ndx, r: rowIndex });
                    sheet[cellref] = {
                        t: 's',
                        v: col.name,
                        s: { font: { bold: true }, fill: col.backgroundColor ? {
                                fgColor: { rgb: 'FF' + col.backgroundColor.substr(1) } } : null
                        }
                    };
                    wscols.push({ wpx: col.width });
                });
            rowIndex ++;
            sheet['!cols'] = wscols;
            canvastable.rows.forEach((row) => {
                canvastable.columns.forEach(
                    (col: CanvasTableColumn, colIndex: number) => {
                        const cellref = xlsx.utils.encode_cell({ c: colIndex, r: rowIndex });
                        const val = col.getValue(row);
                        if (val) {
                            const cell: any = {
                                v: col.getValue(row),
                                s: {
                                    fill: col.backgroundColor ?
                                        {
                                            fgColor: {
                                                rgb: 'FF' + col.backgroundColor.substr(1)
                                            }
                                        } :
                                        null
                                }
                            };
                            if (typeof cell.v === 'number') {
                                cell.t = 'n';
                                cell.s.numFmt = '# ##0';
                            } else if (typeof cell.v === 'boolean') {
                                cell.t = 'b';
                            } else {
                                cell.t = 's';
                            }
                            if (col.excelCellAttributes) {
                                Object.assign(cell, col.excelCellAttributes);
                            }
                            sheet[cellref] = cell;
                        }
                    });
                rowIndex++;
            });
            const range = { s: { c: 0, r: 0 }, e: { c: canvastable.columns.length, r: canvastable.rows.length + 1 } };
            sheet['!ref'] = xlsx.utils.encode_range(range);

            const wb = { SheetNames: [sheetname], Sheets: {} };
            wb.Sheets[sheetname] = sheet;
            this.writeAndDownload(sheetname + '.xlsx', wb);
        }
        );
    }
}
