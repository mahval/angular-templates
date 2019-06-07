import { NgModule } from "@angular/core";
import { CanvasTableModule } from "../canvastable/canvastable.module";
import { BookTableComponent } from './booktable.component';
import { MatButtonModule } from "@angular/material/button";
import { MatInputModule } from "@angular/material/input";
import { MatToolbarModule } from "@angular/material/toolbar";
import { FormsModule } from "@angular/forms";
import { HttpClientModule } from "@angular/common/http";

@NgModule({
    imports: [
        FormsModule,
        MatInputModule,
        MatToolbarModule,
        MatButtonModule,
        CanvasTableModule,
        HttpClientModule
    ],
    declarations: [
        BookTableComponent
    ],
    exports: [
        BookTableComponent
    ]
})
export class BookTableModule {

}
