import {augmentGrade} from '../engine/augment-grades';
export function AugmentGrade({champion,name}:{champion:string;name:string}){
 const result=augmentGrade(champion,name);
 return <a className={`augment-grade grade-${result.grade??'unknown'}`} href={result.url} target="_blank" rel="noreferrer" title={`OP.GG ${result.patch} 챔피언별 통계 · 게임 내 효과는 원작과 다를 수 있습니다`} onClick={e=>e.stopPropagation()}>{result.grade?`${result.grade} 티어`:'등급 미확인'} <small>OP.GG · {result.patch}</small></a>;
}
