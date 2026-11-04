import {GameDialog} from './GameDialog';
import type {Game} from '../engine/types';
import {autoTrainSkills,recommendedSkill,skillMaxOrders,skillPriority,skillRank,skillSlots,skillUpgradeReason,trainSkill,unspentSkills} from '../engine/skill-training';
import {abilityName,rankedAbility} from '../engine/kits';
import {playStyles,setPlayStyle,styleFor} from '../engine/tactics';
import {resourceLabel,skillCost} from '../engine/resources';
import './play-settings.css';
export function PlaySettings({game,open,onToggle,onClose,update,showToggle=true}:{game:Game;open:boolean;onToggle:()=>void;onClose:()=>void;update:(op:(g:Game)=>void)=>void;showToggle?:boolean}){
 const u=game.blue[0],points=unspentSkills(u),style=styleFor(u),suggested=recommendedSkill(u),finished=game.phase==='finished';
 return <>
  {showToggle&&<button className={`play-settings-toggle ${points?'has-points':''}`} aria-expanded={open} aria-haspopup="dialog" onClick={onToggle}>플레이 설정 · {style.name}{points>0&&<b>스킬 +{points}</b>}</button>}
  <GameDialog open={open} className="play-settings" label="플레이 설정" onMinimize={onClose}>
   <header><div><span className="eyebrow">MY PLAYSTYLE</span><h2 tabIndex={-1}>{u.champion.name} · 플레이 설정</h2></div><button onClick={onClose} aria-label="플레이 설정 닫기">전장 보기 · Esc</button></header>
   <p className="settings-note">설정창은 경기 시간을 멈추지 않습니다. 사망 중에도 변경할 수 있으며, 선택 대기나 일시정지 상태는 유지됩니다.</p>
   <section aria-label="스킬 투자"><h3>스킬 투자 <span>Lv.{u.level} · 남은 포인트 {points}</span></h3>
    <div className="skill-training">{skillSlots.map(slot=>{
     const rank=skillRank(u,slot),a=rankedAbility(u,slot)!,next=rankedAbility(u,slot,rank+1)!,max=slot==='R'?3:5,reason=skillUpgradeReason(u,slot);
     return <div className="train-row" key={slot}><div><b>{slot}</b><strong>{abilityName(u,slot)}</strong><small>{rank}/{max}랭크{suggested===slot?' · 추천':''}</small><div className="rank-dots" aria-hidden="true">{Array.from({length:max},(_,i)=><i key={i} className={i<rank?'filled':''}/>)}</div><small>{rank===0?'미습득':`재사용 ${a.cd}초 · ${resourceLabel(u)} ${skillCost(u,a)}`}</small>{rank<max&&<small>다음: 재사용 {next.cd}초 · 소모 {skillCost(u,next)}{next.base>0&&a.kind!=='buff'?` · 기본 위력 ${next.base}`:''}</small>}</div><button disabled={finished||!!reason} title={reason||`${slot}에 1포인트 투자`} aria-label={`${slot} 스킬 올리기`} onClick={()=>update(g=>{trainSkill(g,slot)})}>{rank>=max?'MAX':`+ ${slot}`}</button></div>;
    })}</div>
    <div className="skill-plan">
     <label htmlFor="skill-max-order">선마 순서</label><select id="skill-max-order" value={u.skillMaxOrder?.join('')??'recommended'} disabled={finished} onChange={e=>{const value=e.target.value;update(g=>{g.blue[0].skillMaxOrder=skillMaxOrders.find(order=>order.join('')===value)?.slice();if(g.blue[0].autoSkills)autoTrainSkills(g.blue[0])})}}>
      <option value="recommended">챔피언·빌드 추천 ({skillPriority({...u,skillMaxOrder:undefined}).join(' → ')})</option>{skillMaxOrders.map(order=><option key={order.join('')} value={order.join('')}>{order.join(' → ')}</option>)}
     </select>
     <label className="auto-skills"><input type="checkbox" checked={u.prioritizeUltimate!==false} disabled={finished} onChange={e=>{const first=e.target.checked;update(g=>{g.blue[0].prioritizeUltimate=first;if(g.blue[0].autoSkills)autoTrainSkills(g.blue[0])})}}/> 궁극기 찍을 수 있으면 R 먼저</label>
     <label className="auto-skills"><input type="checkbox" checked={!!u.autoSkills} disabled={finished} onChange={e=>{const auto=e.target.checked;update(g=>{g.blue[0].autoSkills=auto;if(auto)autoTrainSkills(g.blue[0])})}}/> 설정한 선마 순서로 자동 투자</label>
     <p className="settings-note">{u.autoSkills?'자동 투자 중':'자동 투자를 켜면 남은 포인트와 이후 레벨업 포인트를 배분합니다.'} · {skillPriority(u).join(' → ')}{u.prioritizeUltimate!==false?' · 가능하면 R 최우선':' → R'}<br/>레벨 제한이나 최대 랭크로 막히면 다음 스킬을 찍고, 다음 레벨에는 다시 첫 순서부터 확인합니다. 순서를 바꿔도 이미 투자한 포인트는 유지됩니다.</p>
    </div>
    <p className="settings-note">시작 3레벨은 Q·W·E 각 1랭크. 이후 레벨마다 1포인트를 얻습니다. 기본 스킬 최대 5랭크, R은 6·11·16레벨에 투자합니다. 미사용 포인트는 보관됩니다.</p>
   </section>
   <section aria-label="플레이 성향"><h3>플레이 성향 <span>언제든 변경</span></h3><div className="style-grid">{playStyles.map(p=><button key={p.id} aria-pressed={style.id===p.id} disabled={finished} onClick={()=>update(g=>{setPlayStyle(g,p.id)})}><strong>{p.name}</strong><small>{p.text}</small></button>)}</div>
    <div className="tactical-feedback"><b>{style.name}</b><p>{game.encounter?'직접 선택한 분기 행동이 우선합니다. 교전 종료 후 새 성향을 적용합니다.':!u.alive?'부활 후 새 성향으로 행동합니다.':u.tacticalReason??'다음 행동부터 적용됩니다.'}</p></div>
    <p className="settings-note">내 챔피언의 평소 이동·타깃·진입 판단에 적용됩니다. 팀원들은 각자의 판단을 유지하며, 직접 내린 분기 선택과 합류·귀환 명령은 성향보다 우선합니다.</p>
   </section>
  </GameDialog>
 </>;
}
