import layout from '../../data/howling-abyss-layout.json';
import type {Game,Unit} from './types';

export const MAP_LAYOUT_VERSION=1;
type Team=Unit['team'];
type Landmark=keyof typeof layout.teams.blue;
const low=(layout.bounds.min[0]+layout.bounds.min[1])/2;
const span=(layout.bounds.max[0]+layout.bounds.max[1])/2-low;
// A single uniform rotation/scale preserves original ground-plane distances.
// Lateral coordinates use the same pixel scale as mapPoint's longitudinal axis.
export function projectWorld(x:number,z:number){
 return {position:((x+z)/2-low)/span*100,laneOffset:(x-z)/2/span*Math.hypot(770,340)};
}
export const landmark=(team:Team,name:Landmark)=>{
 const p=layout.teams[team][name];return projectWorld(p.x,p.z);
};
export const spawnPosition=(team:Team)=>landmark(team,'spawn').position;
export function portalAnchor(team:Team,game?:Game){
 return game?.world?.buildings.some(b=>b.team===team&&b.kind==='outer'&&!b.alive)?'inner':'outer';
}
// Gate locators are not present in the public geometry. These explicit offsets
// approximate the entrance behind the nexus and the exit ahead of its turret.
// Building/spawn coordinates above are extracted, not approximated.
export function portalPoint(team:Team,end:'entry'|'exit',game?:Game){
 const sign=team==='blue'?1:-1;
 const anchor=layout.teams[team][end==='entry'?'nexus':portalAnchor(team,game)];
 const forward=(end==='entry'?-550:250)*sign,side=450*sign;
 return projectWorld(anchor.x+forward+side,anchor.z+forward-side);
}
