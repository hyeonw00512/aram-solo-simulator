import {memo} from 'react';
import {landmark} from '../engine/map-layout';
import {mapPoint,mapPolygon} from './mapGeometry';

export function Tower({position,lateral=0,red=false,active=false,small=false}:{position:number;lateral?:number;red?:boolean;active?:boolean;small?:boolean}) {
 const p=mapPoint(position,lateral),color=red?'#ed7486':'#6de0f1';
 return <g transform={`translate(${p.x} ${p.y}) scale(${small?.48:.72})`}>
  <title>{red?'적군':'아군'} {active?'전방 포탑':'포탑'}</title>
  <ellipse cy="10" rx="30" ry="17" fill="#081723" opacity=".55"/>
  <path d="M-26 2L0 -12 26 2V13L0 27-26 13Z" fill="#263847" stroke="#75939e" strokeWidth="1.3"/>
  <path d="M-20 -6L0 -16 20 -6 0 5Z" fill="#879c9f"/><path d="M-16 -8V-42L0 -50 16 -42V-8L0 1Z" fill="#526773" stroke="#a0b6b9" strokeWidth="1"/>
  <path d="M0 -48L15 -41V-9L0 -1Z" fill="#2d4556"/>
  <path d="M-21 -43V-54L-13 -57V-48L-5 -52V-62L4 -65V-54L12 -58V-67L21 -62V-46L0 -34Z" fill="#8da4aa" stroke="#bed6db" strokeWidth="1"/>
  <path d="M-22 -52L-12 -59 -4 -56 6 -65 13 -63 20 -66 24 -61 13 -54 4 -55-5 -48-12 -50Z" fill="#d3e9eb"/>
  <path d="M0 -50L-7 -39 0 -27 7 -39Z" fill={color} filter={active?'url(#abyss-glow)':undefined}/>
  <path d="M-5 -23L0 -20 5 -23V-12L0 -9-5 -12Z" fill={color} opacity=".55"/>
  {active&&<><path d="M-25 27L0 40 25 27" fill="none" stroke={color} opacity=".55"/><text y="55" textAnchor="middle" fontSize="11" fill={color} stroke="#0a1926" strokeWidth="3" paintOrder="stroke">{red?'적 전방 포탑':'아군 전방 포탑'}</text></>}
 </g>
}
export function Nexus({position,lateral=0,red=false}:{position:number;lateral?:number;red?:boolean}) {
 const p=mapPoint(position,lateral),color=red?'#eb6f96':'#65dbfb';
 return <g transform={`translate(${p.x} ${p.y}) scale(.65)`}><title>{red?'적':'아군'} 넥서스</title><ellipse cy="15" rx="34" ry="20" fill={color} opacity=".09"/><path d="M-25 6L0 -10 25 6V16L0 31-25 16Z" fill="#4c6273" stroke="#95aeb7"/><path d="M0 -46L-13 -22-9 5 0 15 12 4 15 -23Z" fill={color} stroke="#d0e9ed" strokeWidth="1.3"/><path d="M0 -46V15L12 4 15 -23Z" fill={red?'#8d3459':'#278aa8'}/><path d="M-14 -22L0 -11 15 -23" fill="none" stroke="#e0f7fb" strokeWidth="1.3"/><ellipse cy="7" rx="25" ry="13" fill="none" stroke={color} opacity=".5"/></g>
}
function Bush({position,lateral}:{position:number;lateral:number}) {
 const p=mapPoint(position,lateral);
 return <g transform={`translate(${p.x} ${p.y})`}><title>얼어붙은 수풀 · 배경 표현, 은신 판정 없음</title><ellipse rx="37" ry="15" fill="#132d39" opacity=".7"/>{Array.from({length:17},(_,i)=>{const x=(i%9)*8-32,y=Math.floor(i/9)*8;return <path key={i} d={`M${x} ${y+8}l-6 -${17+i%4*4} 7 9 2 -${15+i%3*4} 6 17 4 -8 -1 22Z`} fill={i%2?'#648a92':'#395f6c'} stroke="#b1d1d4" strokeWidth=".65"/>})}</g>
}

export const AbyssScenery=memo(function AbyssScenery(){
 return <g aria-hidden="true">
  <defs>
   <linearGradient id="abyss-depth" x2=".8" y2="1"><stop stopColor="#233e54"/><stop offset=".5" stopColor="#0a1a2c"/><stop offset="1" stopColor="#030b17"/></linearGradient>
   <linearGradient id="abyss-wall" x2="0" y2="1"><stop stopColor="#536e7d"/><stop offset="1" stopColor="#152939"/></linearGradient>
   <radialGradient id="abyss-mist"><stop stopColor="#8dc9df" stopOpacity=".2"/><stop offset="1" stopColor="#74aaca" stopOpacity="0"/></radialGradient>
   <filter id="abyss-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
   <clipPath id="abyss-deck"><polygon points={mapPolygon(-4,104,-82,82)}/></clipPath>
  </defs>
  <rect width="900" height="560" fill="url(#abyss-depth)"/>
  <path d="M0 0H383L331 49 273 43 249 92 211 83 168 148 122 153 97 225 57 238 33 303 0 324Z" fill="#243e51"/>
  <path d="M0 0H364L325 27 289 22 270 52 236 47 203 96 166 94 139 128 96 145 75 194 34 221 0 272Z" fill="#7796a7"/>
  <path d="M0 0H349L311 13 276 10 251 34 217 34 186 76 148 76 118 111 82 122 52 161 0 189Z" fill="#b0cbd3"/>
  <path d="M900 560H535L572 521 624 527 649 481 703 471 723 411 765 408 803 354 849 346 878 286 900 274Z" fill="#243e51"/>
  <path d="M900 560H558L591 538 644 542 669 503 717 493 741 441 783 433 816 383 860 373 900 309Z" fill="#7392a3"/>
  <path d="M900 560H610L657 550 690 523 734 514 762 468 807 450 846 404 881 394 900 368Z" fill="#c4dce0"/>
  {Array.from({length:12},(_,i)=>{const x=80+i*69,y=105+(i%4)*80;return <path key={i} d={`M${x} ${y}l16 -25 12 8 8 46-23 29Z`} fill="#345368" opacity=".22"/>})}
  <ellipse cx="370" cy="150" rx="310" ry="150" fill="url(#abyss-mist)"/><ellipse cx="550" cy="460" rx="350" ry="100" fill="url(#abyss-mist)"/>
  {/* Extruded bridge wall and heavy supports hang over the abyss. */}
  <polygon points={mapPolygon(-5,105,73,92)} fill="#122534" transform="translate(0 62)"/>
  <path d={`M${mapPoint(-4,82).x} ${mapPoint(-4,82).y}L${mapPoint(104,82).x} ${mapPoint(104,82).y}v48L${mapPoint(-4,82).x} ${mapPoint(-4,82).y+48}Z`} fill="url(#abyss-wall)"/>
  {[12,29,46,63,80,97].map(pos=>{const p=mapPoint(pos,88);return <g key={pos}><path d={`M${p.x-16} ${p.y}v42l12 26 14 -7 10 -40V${p.y-12}Z`} fill="#2f4b5b" stroke="#62808d" strokeWidth="1"/><path d={`M${p.x} ${p.y+12}v36l5 14 8 -30V${p.y+5}Z`} fill="#132b3b"/></g>})}
  <polygon points={mapPolygon(-4,104,-82,82)} fill="#526b77" stroke="#859da6" strokeWidth="3"/>
  <g clipPath="url(#abyss-deck)">
   {Array.from({length:22},(_,i)=>Array.from({length:6},(_,j)=><polygon key={`${i}-${j}`} points={mapPolygon(i*5-4+(j%2)*2.5,i*5+.7+(j%2)*2.5,j*28-84,j*28-57)} fill={['#506975','#587580','#46616f','#607c86'][(i*3+j)%4]} stroke="#344f60" strokeWidth="1"/>))}
   <polygon points={mapPolygon(-4,104,-82,-58)} fill="#a7c7d0" opacity=".7"/><polygon points={mapPolygon(-4,104,60,82)} fill="#b6d1d8" opacity=".7"/>
   {[7,21,38,58,73,91].map((pos,i)=><polygon key={pos} points={mapPolygon(pos,pos+7,i%2?-72:42,i%2?-43:76)} fill="#d0e3e6" opacity=".65"/>)}
   {[25,48,69].map(pos=>{const p=mapPoint(pos);return <path key={pos} d={`M${p.x-23} ${p.y-25}l16 18-6 14 24 7-4 19m-14 -26-15 7m23 0 12 -12`} fill="none" stroke="#293f50" strokeWidth="2"/>})}
   {[32,68].map(pos=>{const p=mapPoint(pos);return <g key={pos} transform={`translate(${p.x} ${p.y}) rotate(-24)`}><path d="M-21 0L0 -14 21 0 0 14Z M-12 0L0 -8 12 0 0 8Z" fill="none" stroke="#9cb5ba" strokeWidth="1" opacity=".55"/></g>})}
  </g>
  {/* Broken snow-capped parapets, not a perfectly repeating rectangular fence. */}
  {[-85,85].map(side=><g key={side}>{Array.from({length:18},(_,i)=>{const pos=i*6-1,p=mapPoint(pos,side),broken=[5,11,14].includes(i);return <g key={i}><polygon points={mapPolygon(pos,pos+4,side-5,side+5)} fill="#2e4758" transform="translate(0 -9)"/><path d={`M${p.x-8} ${p.y-3}v-${broken?9:22}l11 -5 10 4v${broken?10:23}l-11 5Z`} fill="#627d8a" stroke="#91aeb8" strokeWidth=".8"/><path d={`M${p.x-10} ${p.y-(broken?13:26)}l12 -5 12 4-3 6-10 1-11 3Z`} fill="#d8edf0"/>{!broken&&i%3===0&&<path d={`M${p.x+2} ${p.y-18}l4 3-1 10-3 4Z`} fill="#92c8da" opacity=".8"/>}</g>})}</g>)}
  <Bush position={37} lateral={-58}/><Bush position={63} lateral={58}/>
  {(['blue','red'] as const).map(team=>{const spawn=landmark(team,'spawn'),p=mapPoint(spawn.position,spawn.laneOffset),red=team==='red';return <g key={team} transform={`translate(${p.x} ${p.y})`}><ellipse rx="42" ry="27" fill="none" stroke={red?'#b66f89':'#67b7cb'} strokeWidth="2" opacity=".5"/><path d="M-20 0L0 -12 20 0 0 12Z" fill={red?'#914761':'#39758b'} stroke="#b2cbd0"/></g>})}
  {/* Buildings and waves are rendered from game state by WorldLayer. */}
  {/* Braziers make the cold stone readable without competing with team colors. */}
  {[{pos:30,lat:-85},{pos:70,lat:85}].map(({pos,lat})=>{const p=mapPoint(pos,lat);return <g key={pos}><path d={`M${p.x-6} ${p.y}v-14h12v14Z`} fill="#4b5760"/><path d={`M${p.x-7} ${p.y-14}q-3 -10 5 -20l2 8 5 -10q9 16 2 22Z`} fill="#eab77b" filter="url(#abyss-glow)"/></g>})}
  {Array.from({length:34},(_,i)=><circle className="abyss-snow" key={i} cx={(i*137+43)%900} cy={(i*71+29)%550} r={i%4===0?1.7:.9} fill="#e4f4f7" opacity={.12+i%4*.09} style={{animationDelay:`-${i%7}s`}}/>)}
 </g>
});
