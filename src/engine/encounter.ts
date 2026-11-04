import {visibleTarget} from './evelynn';
import definitions from "../../data/encounters.json";
import balance from "../../data/encounter-balance.json";
import traits from "../../data/traits.json";
import { applyDamage, attackReach, healthRatio, log, resolveAttack, units, visual } from "./combat";
import {strategicContext,frontline,ensureWorld} from "./world";
import {buildIdentity} from "./stats";
import {ultimateReady} from "./kits";
import {blocked,effect,state} from "./runtime";
import { statsFor } from "./stats";
import { opportunity, rememberEncounter, trustOf } from "./memory";
import simulation from "../../data/simulation.json";
import {nearPortal} from './portal';
import { Rng } from "./rng";
import type { Game, Intent, Reaction, ResponsePlan, Situation, Unit } from "./types";

import {orderResponse} from './team-chat';

const actions = Object.keys(definitions.actions) as Reaction[];
const clamp = (n: number) => Math.min(100, Math.max(0, n));
const living = (team: Unit[]) => team.filter(u => u.alive && !u.returningToBase && !u.portal && !(u.atFountain&&nearPortal(u)));
const deaths = (team: Unit[]) => team.reduce((sum, u) => sum + u.deaths, 0);
const health = (team: Unit[]) => team.reduce((sum, u) => sum + u.health, 0);
const direction = (unit: Unit) => unit.team === "blue" ? 1 : -1;
function personality(unit: Unit) {
  const entries = unit.traits.map(t => traits[t]);
  const keys = Object.keys(traits["공격적입니다"]) as (keyof typeof traits["공격적입니다"])[];
  return Object.fromEntries(keys.map(key => [key, entries.reduce((sum, e) => sum + e[key], 0) / Math.max(1, entries.length)])) as typeof traits["공격적입니다"];
}

export function openDecision(game: Game, situation?: Situation, subject?: Unit) {
  if (game.blue[0].returningToBase || !game.blue[0].alive || game.blue[0].portal || (game.blue[0].atFountain&&nearPortal(game.blue[0])) || game.encounter || game.phase !== "playing") return;
  const player = game.blue[0];
  if(blocked(player)||player.atFountain||subject&&Math.abs(subject.position-player.position)>32)return;
  if(!living(game.red).some(u=>visibleTarget(game,u)&&Math.abs(u.position-player.position)<=35)&&!game.world?.minions.some(m=>m.team!==player.team&&m.health>0&&Math.abs(m.position-player.position)<20))return;
  const exposed = living(game.red).find(u => u.position < 42);
  const endangered = living(game.blue).find(u => u.id !== player.id && healthRatio(u) < .35);
  const defending = living(game.red).some(u => u.position < 30);
  const context=strategicContext(game,player);
  const kind = situation ?? (context.threat>3 ? "tower-defense" : context.nearEnemyTower ? (context.wave?"siege":"no-wave") : player.level>=6&&context.ready===0 ? "ultimate-wait" : healthRatio(player) < 0.4 ? "low-health" : endangered ? "ally-danger" : defending ? "tower-defense" : exposed ? "enemy-overextended" : "standoff");
  game.phase = "decision";
  game.pending = {
    situation: kind, title: definitions[kind].title,
    description: definitions[kind].description.replace("{subject}", (subject ?? endangered ?? exposed)?.champion.name ?? "적 선봉"),
    choices: definitions.menus[kind].filter(id => id !== "healthpack" || game.packs.blue <= game.time).map(id => ({ ...definitions.choices.find(c => c.id === id)!, bonus: 0 })),
  };
  log(game, game.pending.description, "major");
}

export function startEncounter(game: Game, id: string) {
  if (game.phase !== "decision" || !game.pending?.situation || !game.blue[0].alive) return;
  const selected = game.pending.choices.find(c => c.id === id);
  if (!selected) return;
  game.encounter = {
    id: ++game.encounterSerial, situation: game.pending.situation, intent: id as Intent,
    wave: 0, nextWaveAt: game.time + 1, startDeaths: [deaths(game.blue), deaths(game.red)],
    startHealth: [health(game.blue), health(game.red)], rounds: [],
    startUnits: units(game).map(u => ({id:u.id, health:u.health, deaths:u.deaths, position:u.position, damage:u.damage})),
    initialOpportunity: opportunity(game, "blue"), protections: [],
  };
  log(game, `내 선택: ${selected.label}. 팀원들은 각자 상황을 판단합니다.`, "major");
  game.pending = undefined; game.phase = "playing";
}

/** Weights express simulation behaviour, not live LoL statistics. Every reason
 * is derived from the same factors that selected the action. No authored ending. */
export function planResponse(game: Game, unit: Unit, rng: Rng): ResponsePlan {
  const encounter = game.encounter!;
  const weights = Object.fromEntries(actions.map(a => [a, balance.weights.baseline])) as Record<Reaction, number>;
  const reasons: Record<Reaction, { value: number; text: string }[]> = { engage: [], join: [], retreat: [], cover: [], poke: [], hesitate: [], chase: [], clear: [], push: [] };
  const add = (action: Reaction, value: number, text: string) => { weights[action] += value; if (value > 0) reasons[action].push({ value, text }); };
  if (unit.id === game.playerId) {
    const waitForOpening = encounter.wave > 0 && opportunity(game, unit.team) > .15 && healthRatio(unit) > .45 && unit.cooldownUntil <= game.time;
    const action: Reaction = encounter.intent === "push" ? "push" : encounter.intent === "clear" ? "clear" : encounter.intent === "regroup" ? "cover" : encounter.intent === "engage" ? "engage" : ["retreat", "healthpack"].includes(encounter.intent) ? "retreat" : encounter.intent === "wait" ? waitForOpening ? "poke" : "hesitate" : ["peel", "hold"].includes(encounter.intent) ? "cover" : encounter.wave > 0 ? "retreat" : "poke";
    return { unitId: unit.id, action, reason: encounter.intent === "wait" ? waitForOpening ? "기다리는 동안 유리한 각이 생겨 짧게 견제합니다" : "위치를 유지하며 체력·인원·스킬 준비가 유리해질 때를 기다립니다" : encounter.intent === "trade" && encounter.wave > 0 ? "짧은 교환을 마치고 이탈합니다" : "플레이어가 선택한 행동입니다", misunderstood: false, weights };
  }
  const p = personality(unit), w = balance.weights;
  const context=strategicContext(game,unit),build=buildIdentity(unit),s=statsFor(unit);
  add("clear",context.threat>2?12:0,"적 미니언이 아군 건물에 도착해 라인 정리가 급합니다");
  add("push",context.wave&&context.nearEnemyTower?8:0,"아군 미니언이 포탑 공격을 받아주므로 건물을 압박합니다");
  add("hesitate",context.nearEnemyTower&&!context.wave?10:0,"아군 미니언이 없어 포탑 진입을 기다립니다");
  add("retreat",context.nearEnemyTower&&!context.wave&&build.role!=="tank"?8:0,"현재 빌드는 포탑 공격을 오래 버티기 어렵습니다");
  add("engage",build.role==="tank"&&healthRatio(unit)>.6?4:0,"현재 체력·방어 빌드로 전방을 유지할 수 있습니다");
  add("poke",build.role==="mage"?4:0,"현재 주문력 빌드에 맞춰 스킬 견제를 선택합니다");
  add("cover",build.role==="support"?4:0,"회복·보호 스킬로 아군을 지킵니다");
  add("hesitate",unit.level>=6&&!ultimateReady(unit,game.time)?5:0,"궁극기 재사용 대기 중이라 전면 진입을 늦춥니다");
  add("join",ultimateReady(unit,game.time)&&context.ready>=2?3:0,"아군 궁극기가 함께 준비되어 연계할 수 있습니다");
  add("hesitate",s.mana>0&&state(unit).mana<s.mana*.2?8:0,"마나가 부족해 스킬 연계가 어렵습니다");
  if(unit.team==="blue"&&encounter.intent==="clear")add("clear",p.cohesion*7,"아군의 라인 정리 지시에 맞춥니다");
  if(unit.team==="blue"&&encounter.intent==="push")add("push",context.wave?p.cohesion*6:0,"아군과 웨이브를 따라 건물을 압박합니다");
  if(unit.team==="blue"&&encounter.intent==="regroup")add("cover",p.cohesion*7,"아군 합류와 궁극기를 기다리며 엄호합니다");
  const friends = living(unit.team === "blue" ? game.blue : game.red);
  const enemies = living(unit.team === "blue" ? game.red : game.blue);
  const nearest = Math.min(...enemies.map(e => Math.abs(e.position - unit.position)), 100);
  const hurt = Math.max(0, 1 - healthRatio(unit) / Math.max(.01, p.retreatHealth));
  const outnumbered = Math.max(0, enemies.length - friends.length);
  const cooldown = unit.cooldownUntil > game.time;
  const previousAction = encounter.rounds.at(-1)?.plans.find(plan => plan.unitId === unit.id)?.action;
  add("retreat", previousAction === "retreat" ? (1 - p.risk) * w.withdrawMomentum : 0, "이미 시작한 후퇴를 계속합니다");
  const traitsText = unit.traits.join(" / ");
  add("engage", p.aggression * w.aggression, `성향: ${traitsText}`);
  add("retreat", hurt * w.injury, `체력이 ${Math.round(healthRatio(unit) * 100)}%로 낮습니다`);
  add("retreat", outnumbered * (1 - p.risk) * w.outnumbered, `생존 인원 ${friends.length} 대 ${enemies.length}로 불리합니다`);
  add("engage", hurt * p.risk * w.risk, `위험을 감수하는 성향으로 저체력에도 싸움을 겁니다`);
  add("hesitate", cooldown ? (1 - p.risk) * w.cooldown : 0, `주요 스킬 준비까지 ${unit.cooldownUntil - game.time}초 남았습니다`);
  add("hesitate", Math.max(0, nearest - balance.range) / balance.range * w.distance, `가장 가까운 적까지 거리 ${Math.round(nearest)}, 즉시 공격 범위 밖입니다`);
  add("poke", unit.traits.includes("포킹만 합니다") ? w.pokeTrait : 0.5, unit.traits.includes("포킹만 합니다") ? "포킹 성향으로 짧게 때리고 빠지려 합니다" : "짧은 교환 기회를 봅니다");
  const losses = deaths(unit.team === "blue" ? game.blue : game.red) - encounter.startDeaths[unit.team === "blue" ? 0 : 1];
  add("retreat", losses * (1 - p.risk) * w.loss, `이번 교전에서 아군 ${losses}명이 추가로 쓰러졌습니다`);
  const enemyTower = context.tower.kind!=='nexus'&&Math.abs(unit.position-context.tower.position)<14;
  add("retreat", enemyTower ? (1 - p.risk) * w.towerFear : 0, "적 포탑이 가까워 추격을 끊으려 합니다");
  let misunderstandingWeight = 0;
  const angle = opportunity(game, unit.team);
  const frontLeader = friends.filter(f => f.id !== unit.id && encounter.rounds.at(-1)?.plans.some(p => p.unitId === f.id && ["engage", "join", "chase"].includes(p.action))).sort((a,b) => direction(unit) * (b.position - a.position))[0];
  const leader = unit.team === "blue" && encounter.intent === "engage" && game.blue[0].alive ? game.blue[0] : frontLeader;
  const trust = leader ? trustOf(unit, leader) : 0;
  if (leader && trust < 0) add("hesitate", -trust / 20 * simulation.memory.reluctance, `${leader.champion.name}의 이전 무리한 플레이를 기억해 신중해집니다 (신뢰 ${trust})`);
  if (leader && trust > 0) add("join", trust / 20, `${leader.champion.name}과(와) 쌓은 신뢰로 호응합니다 (신뢰 +${trust})`);
  add("join", Math.max(0, angle) * simulation.memory.goodAngle * 5, trust < 0 ? "신뢰는 낮지만 지금은 체력·인원·스킬 준비가 유리해 직접 각을 보고 호응합니다" : "현재 체력·인원·스킬 준비가 유리해 호응합니다");
  const cornered = nearest < 16 && (unit.team === "blue" ? unit.position < context.own.position+2 : unit.position > context.own.position-2);
  add("cover", cornered ? simulation.memory.necessity * 2 : 0, "포탑 앞까지 밀려 더 물러나기 어려워 함께 받아쳐야 합니다");
  if (unit.team === "blue") {
    const previous = encounter.rounds.at(-1);
    const chargingAlly = previous?.plans.find(plan => plan.unitId !== unit.id && plan.unitId !== game.playerId && ["engage", "join"].includes(plan.action) && friends.some(friend => friend.id === plan.unitId));
    if (chargingAlly && encounter.intent !== "engage") {
      const leader = friends.find(friend => friend.id === chargingAlly.unitId)!;
      add("join", p.cohesion * (1 - hurt) * w.cohesion, `${leader.champion.name}이(가) 계속 싸우는 것을 보고 뒤따릅니다`);
    }
    if (encounter.intent === "engage") {
      add("join", p.cohesion * w.cohesion, "아군의 진입에 호응하려 합니다");
      add("hesitate", (1 - p.cohesion) * w.hesitation, "팀 합류보다 자기 판단을 우선합니다");
    } else if (["retreat", "healthpack"].includes(encounter.intent) || (encounter.intent === "trade" && encounter.wave > 0)) {
      add("retreat", p.cohesion * w.withdrawFollow, "아군의 이탈에 맞춰 거리를 벌립니다");
      add("cover", p.cohesion * (1 - hurt) * w.cohesion, "이탈하는 아군을 엄호하려고 남습니다");
      add("engage", (1 - p.cohesion) * p.aggression * w.aggression, "아군이 빠져도 공격 기회를 놓치기 싫어합니다");
    } else if (["peel", "hold"].includes(encounter.intent)) {
      add("cover", p.cohesion * w.cohesion, "아군을 지키며 들어오는 상대를 받아칩니다");
      add("engage", p.misread * w.misread, "받아치는 움직임을 진입 기회로 보고 앞으로 갑니다");
    } else if (encounter.intent === "wait") {
      add("hesitate", p.cohesion * w.cohesion, "아군과 함께 상대의 움직임을 살핍니다");
      add("poke", (1 - hurt) * 2, "기다리는 동안 안전한 견제 기회를 봅니다");
    } else {
      add("poke", p.cohesion * w.cohesion, "아군의 짧은 교환에 맞춰 지원합니다");
      misunderstandingWeight = p.misread * w.misread;
      add("engage", misunderstandingWeight, "짧은 교환을 전면 진입 신호로 받아들였습니다");
    }
  } else {
    const withdrawing = encounter.intent === "retreat" || (encounter.intent === "trade" && encounter.wave > 0);
    add("chase", withdrawing ? p.aggression * w.pursuit : 0, "물러나는 상대를 추격해 추가 처치를 노립니다");
    add("cover", !withdrawing ? p.cohesion * w.cohesion : 0, "들어오는 적을 받아치며 아군을 지키려 합니다");
    add("join", p.cohesion, "아군과 함께 공격하려 합니다");
  }
  const response=orderResponse(game,unit);if(response)add(response.action,14,response.reason);
  let roll = rng.next() * actions.reduce((sum, a) => sum + weights[a], 0);
  let action = actions[actions.length - 1];
  for (const a of actions) { roll -= weights[a]; if (roll < 0) { action = a; break; } }
  const misunderstood = action === "engage" && misunderstandingWeight > 0 && rng.chance(misunderstandingWeight / weights.engage);
  const factors = reasons[action].filter(r => misunderstood || !r.text.includes("진입 신호")).sort((a, b) => b.value - a.value).slice(0, 2).map(r => r.text);
  if (misunderstood && !factors.some(f => f.includes("신호"))) factors.unshift("짧은 교환을 전면 진입 신호로 받아들였습니다");
  return { unitId: unit.id, action, misunderstood, weights, reason: factors.join(" · ") || "순간적인 판단으로 행동합니다" };
}

function targetFor(unit: Unit, enemies: Unit[], rng: Rng) {
  const p = personality(unit);
  const carries = enemies.filter(e => ["mage","marksman"].includes(buildIdentity(e).role));
  const pool = carries.length && rng.chance(p.focusCarry) ? carries : enemies;
  return [...pool].sort((a, b) => Math.abs(a.position - unit.position) - Math.abs(b.position - unit.position) || a.health - b.health)[0];
}

export function advanceEncounter(game: Game) {
  const encounter = game.encounter;
  if (!encounter || game.time < encounter.nextWaveAt) return;
  const rng = new Rng(game.seed + encounter.id * 104729 + encounter.wave * 7919);
  const participants = units(game).filter(u => u.alive && !u.returningToBase && !u.portal && !(u.atFountain&&nearPortal(u)));
  const plans = participants.map(u => planResponse(game, u, rng));
  const previousPlans = encounter.rounds.at(-1)?.plans;
  const round = { time: game.time, plans, movements: participants.map(u=>({unitId:u.id,from:u.position,to:u.position,visible:u.team==='blue'||visibleTarget(game,u)})) };
  encounter.rounds.push(round);
  log(game, `교전 ${encounter.wave + 1}/${balance.waves} — 아군 ${living(game.blue).length}명 · 적군 ${living(game.red).length}명`, "major");
  // Everyone decides from the same snapshot before movement or damage occurs.
  const destinations = new Map<string, number>();
  for (const plan of plans) {
    const unit = participants.find(u => u.id === plan.unitId)!;
    unit.status = unit.id === game.playerId && encounter.intent === "wait" && plan.action === "hesitate" ? "각을 보는 중" : definitions.actions[plan.action];
    log(game, `${unit.team === "blue" ? "아군" : "적군"} ${unit.champion.name}: ${unit.status} — ${plan.reason}.`);
    if (previousPlans?.some(p => p.unitId === unit.id && p.action === "hesitate") && ["join", "engage", "cover"].includes(plan.action)) log(game, `${unit.champion.name}이(가) 뒤늦게 교전에 합류합니다.`);
    if(blocked(unit)||effect(unit,"root"))continue;
    const movement = statsFor(unit).moveSpeed / 325;
    unit.atFountain = false;
    if(plan.action==="clear"||plan.action==="push"){
      const target=plan.action==="clear"?ensureWorld(game).minions.filter(m=>m.team!==unit.team).sort((a,b)=>Math.abs(a.position-unit.position)-Math.abs(b.position-unit.position))[0]:ensureWorld(game).buildings.find(b=>b.team!==unit.team&&b.alive);
      if(target)destinations.set(unit.id,clamp(unit.position+Math.sign(target.position-unit.position)*Math.min(balance.step*movement,Math.abs(target.position-unit.position))));
    }else if(unit.id===game.playerId&&encounter.intent==="regroup"){const pos=frontline(game,unit.team).position;destinations.set(unit.id,clamp(unit.position+Math.sign(pos-unit.position)*Math.min(balance.retreatStep,Math.abs(pos-unit.position))));}
    else if (unit.id === game.playerId && encounter.intent === "healthpack") {
      const distance = simulation.packs.bluePosition - unit.position;
      destinations.set(unit.id, unit.position + Math.sign(distance) * Math.min(Math.abs(distance), balance.retreatStep * movement));
    } else if (unit.id === game.playerId && encounter.intent === "wait") destinations.set(unit.id, unit.position);
    else if (unit.id === game.playerId && encounter.intent === "hold") {
      const distance = frontline(game,"blue").position - unit.position;
      destinations.set(unit.id, unit.position + Math.sign(distance) * Math.min(Math.abs(distance), balance.retreatStep * movement));
    }
    else if (unit.id === game.playerId && encounter.intent === "peel") {
      const ally = participants.filter(u => u.team === unit.team && u.id !== unit.id).sort((a,b) => healthRatio(a) - healthRatio(b))[0];
      if (ally) destinations.set(unit.id, unit.position + Math.sign(ally.position-unit.position) * Math.min(balance.step * movement, Math.abs(ally.position-unit.position)));
    }
    else if (plan.action === "retreat") destinations.set(unit.id, clamp(unit.position - direction(unit) * balance.retreatStep * movement));
    else if (["engage", "join", "chase"].includes(plan.action)) {
      const enemies = participants.filter(u => u.team !== unit.team&&visibleTarget(game,u));
      const target = targetFor(unit, enemies, rng);
      if (target) destinations.set(unit.id, clamp(unit.position + Math.sign(target.position - unit.position) * Math.min(balance.step * movement, Math.abs(target.position - unit.position))));
    } else if (plan.action === "hesitate") {
      // A late arrival actually closes distance; it can act next wave.
      const target = targetFor(unit, participants.filter(u => u.team !== unit.team&&visibleTarget(game,u)), rng);
      if (target) destinations.set(unit.id, clamp(unit.position + Math.sign(target.position - unit.position) * Math.min(balance.step / 2, Math.abs(target.position - unit.position))));
    }
  }
  for (const unit of participants) unit.position = destinations.get(unit.id) ?? unit.position;
  for (const movement of round.movements) movement.to = participants.find(u=>u.id===movement.unitId)!.position;
  for (const unit of participants) for (const side of ["blue", "red"] as const) {
    const location = side === "blue" ? simulation.packs.bluePosition : simulation.packs.redPosition;
    if (game.packs[side] <= game.time && Math.abs(unit.position - location) < 3 && healthRatio(unit) < .85) {
      const amount = Math.min(unit.maxHealth - unit.health, Math.round(unit.maxHealth * simulation.packs.healFraction));
      unit.health += amount; game.packs[side] = game.time + simulation.packs.cooldown;
      visual(game, {to:unit.id, type:"heal", amount}); log(game, `${unit.champion.name}: 체력팩으로 ${amount} 회복. 다음 생성 ${simulation.packs.cooldown}초 후.`);
    }
  }
  if (encounter.intent === "engage" && game.blue[0].alive && !plans.some(p => p.unitId !== game.playerId && p.unitId.startsWith("blue-") && ["join", "engage"].includes(p.action))) log(game, "이번 진입에 함께 들어오는 아군이 없습니다. 내 공격이 고립될 수 있습니다.", "bad");
  // Seeded initiative avoids giving the blue team the first hit every wave.
  const order = [...plans];
  for (let i = order.length - 1; i > 0; i--) { const j = rng.int(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
  const contributors = new Map<string, Set<string>>();
  for (const plan of order) {
    const attacker = participants.find(u => u.id === plan.unitId)!;
    if (!attacker.alive || ["retreat","hesitate","clear","push"].includes(plan.action) || blocked(attacker)) continue;
    const range = attackReach(attacker, game.time);
    const candidates = participants.filter(u => u.alive && visibleTarget(game,u) && u.team !== attacker.team && Math.abs(u.position - attacker.position) <= range);
    const victim = targetFor(attacker, candidates, rng);
    if (!victim) { log(game, `${attacker.champion.name}: 거리가 벌어져 공격하지 못했습니다.`); continue; }
    const multiplier = plan.action === "poke" ? balance.pokeMultiplier : plan.action === "cover" ? balance.coverMultiplier : 1;
    const victimPlan = plans.find(p => p.unitId === victim.id);
    const coverer = participants.find(u => u.alive && u.team === victim.team && u.id !== victim.id && Math.abs(u.position - victim.position) <= balance.range && plans.some(p => p.unitId === u.id && p.action === "cover"));
    const helpers = contributors.get(victim.id) ?? new Set<string>(); helpers.add(attacker.id); contributors.set(victim.id, helpers);
    const killed = resolveAttack(game, attacker, victim, rng, {action:plan.action,multiplier, victimAction:victimPlan?.action, coverer: victimPlan?.action === "retreat" || healthRatio(victim) < .4 ? coverer : undefined});
    // Kill/assist credit is tracked by recent damage in the shared combat engine.
    // Actual living towers fire in advanceWorld, including champion aggro.
  }
  encounter.wave++; encounter.nextWaveAt = game.time + balance.waveSeconds;
  if (encounter.wave < balance.waves && living(game.blue).length && living(game.red).length) return;
  const allyLosses = deaths(game.blue) - encounter.startDeaths[0], enemyLosses = deaths(game.red) - encounter.startDeaths[1];
  const healthDelta = (encounter.startHealth[1] - health(game.red)) - (encounter.startHealth[0] - health(game.blue));
  const result = enemyLosses > allyLosses ? "처치 이득" : allyLosses > enemyLosses ? "처치 손해" : healthDelta > 30 ? "체력 교환 이득" : healthDelta < -30 ? "체력 교환 손해" : "비등한 교환";
  const playerEscaped = game.blue[0].alive && game.blue[0].position <= frontline(game,'blue').position;
  const playerState = !game.blue[0].alive ? "나는 사망했습니다" : playerEscaped ? "나는 포탑 쪽으로 이탈했습니다" : "나는 아직 교전 지역에 있습니다";
  const text = `${result}: 아군 ${allyLosses}명 / 적군 ${enemyLosses}명 사망. ${playerState}.`;
  log(game, text, "major");
  game.encounterHistory.push({ id: encounter.id, intent: encounter.intent, situation: encounter.situation, text, allyLosses, enemyLosses, playerEscaped, rounds: encounter.rounds });
  game.encounterHistory = game.encounterHistory.slice(-6);
  rememberEncounter(game);
  game.encounter = undefined; game.nextDecision = game.time + balance.decisionInterval;
}
