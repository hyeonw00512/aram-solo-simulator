import type {Unit} from '../engine/types';
import {statsFor} from '../engine/stats';
import {resourceKind,resourceLabel,currentResource} from '../engine/resources';
export function ResourceBar({unit}:{unit:Unit}){
 const kind=resourceKind(unit),max=statsFor(unit).resourceMax,value=currentResource(unit,max),label=resourceLabel(unit);
 if(kind==='none')return <div className="resource-bar none">무자원 · 소모 없음</div>;
 return <div className={`resource-bar ${kind}`}><div><span>{label}</span><span>{Math.round(value)} / {Math.round(max)}</span></div><div className="resource-track" role="meter" aria-label={`${unit.champion.name} ${label}`} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}><i style={{width:`${max?value/max*100:0}%`}}/></div></div>;
}
