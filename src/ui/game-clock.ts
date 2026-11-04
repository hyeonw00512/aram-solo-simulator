import {tick} from '../engine/game';
import type {Game} from '../engine/types';
import type {Popup} from './popup-flow';

export function tickPlayback(game:Game,paused:boolean,active:Popup|null):Game{
 if(paused||active==='shop')return game;
 return tick(game);
}
