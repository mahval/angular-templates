/* 
 *  Copyright 2010-2016 FinTech Neo AS ( fintechneo.com )- All rights reserved
 */

import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AsyncSubject } from 'rxjs';
import { BehaviorSubject } from 'rxjs';
import { DACSector } from './daccodelists.service';
import { ThematicArea } from './thematicarea.class';
import { HttpClient } from '@angular/common/http';

export class DACSocketUpdateMessage {
    constructor(public methodname : string,
                public params : any[]) {
                    
    }
}

@Injectable()
export class DACService {
    
    thematicAreas : AsyncSubject<ThematicArea[]> = new AsyncSubject();
        
    socket : WebSocket;
    socketUpdates : BehaviorSubject<DACSocketUpdateMessage> = new BehaviorSubject(null);
    
    constructor(
        private http : HttpClient,
        private dialog : MatDialog) {

        this.thematicAreas.next([
            new ThematicArea(1,"Health","",1999,2099,[]),
            new ThematicArea(2,"Education","",1999,2099,[]),
            new ThematicArea(3,"Civil society","",1999,2099,[]),
            new ThematicArea(4,"Peaceful coexistence","",1999,2099,[]),
            new ThematicArea(5,"Economic empowerment","",1999,2099,[]),
            new ThematicArea(6,"Human rights","",1999,2099,[]),
            new ThematicArea(7,"Gender equality","",1999,2099,[]),
        ]);
        this.thematicAreas.complete();
                    
    }
        
    
    public setDacSectorStateForThematicArea(thematicArea: ThematicArea, dacsector: DACSector, state : boolean) {                
        this.socketUpdates.next(new DACSocketUpdateMessage(
                "setDacSectorStateForThematicArea",
                [thematicArea.id, dacsector.code,state])
        );          
    }
}
