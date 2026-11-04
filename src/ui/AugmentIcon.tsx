import {AugmentGrade} from './AugmentGrade';
import {augmentDescription} from '../engine/augments';
import icons from '../../data/augment-icons.json';
import type {Unit} from '../engine/types';
const catalog=icons.data as Record<string,{file:string;name:string}>;
const tierName=(id:string)=>id.startsWith('silver')?'실버':id.startsWith('gold')?'골드':'프리즘';
export function AugmentIcon({id,name}:{id:string;name:string}) {
 const asset=catalog[id];
 return <span className={`augment-icon ${id.split('-')[0]}`} title={`${tierName(id)} · ${name}`}>{asset?<img src={asset.file} alt={name}/>:<span>?</span>}</span>;
}
export function AugmentStrip({unit}:{unit:Unit}) {return <div className="augment-strip" aria-label="보유 증강">{unit.augments.map((a,i)=><AugmentIcon key={`${a.id}-${i}`} id={a.id} name={a.name}/>)}</div>}
export function AugmentDetails({unit}:{unit:Unit}) {return <section className="augment-details"><h3>보유 증강 <small>스킬·장비 시너지 적용</small></h3>{unit.augments.length?unit.augments.map((a,i)=><div key={`${a.id}-${i}`}><AugmentIcon id={a.id} name={a.name}/><span><strong>{a.name}</strong><AugmentGrade champion={unit.champion.id} name={a.name}/><small>{tierName(a.id)} · {augmentDescription(a.name)}</small></span></div>):<p className="muted">아직 선택한 증강이 없습니다.</p>}</section>}
