import type {AiBuildPlan} from './ai-builds';
export type Tier = "silver" | "gold" | "prism";
export type Role = "tank" | "fighter" | "mage" | "marksman" | "support" | "assassin";
export type Phase = "pick" | "swap" | "matchup" | "augment" | "shop" | "playing" | "decision" | "finished";
export type Trait = "공격적입니다" | "사립니다" | "딜러만 노립니다" | "혼자 다닙니다" | "체력팩에 집착합니다" | "포킹만 합니다" | "고집이 셉니다" | "죽음을 두려워하지 않습니다";
export interface BaseStats { hp: number; hpperlevel: number; armor: number; armorperlevel: number; spellblock: number; spellblockperlevel: number; attackdamage: number; attackdamageperlevel: number; attackspeed: number; attackspeedperlevel: number; movespeed: number; attackrange: number; mp: number; mpperlevel: number; hpregen: number; hpregenperlevel: number; }
export interface Champion { id: string; name: string; title: string; roles: Role[]; attack: number; magic: number; durability: number; mobility: number; skills: string[]; playable: boolean; stats: BaseStats; }
export interface Augment { id: string; name: string; tier: Tier; effect: string; power: number; tags: string[]; }
export interface Relationship { trust: number; reckless: number; experiences: number; reason: string; updatedAt: number; lastChange?:{time:number;reason:string;encounterId:number}; }
export type MemoryFactor = 'caution' | 'trust' | 'angle' | 'necessity';
export interface DecisionMemory { leaderId:string; trust:number; experiences:number; reckless:number; reason:string; rememberedAt:number; factors:MemoryFactor[]; }
export interface TrustChange { observerId:string; leaderId:string; time:number; before:number; after:number; reckless:number; reason:string; }
export type SkillSlot = "Q" | "W" | "E" | "R";
export type BuildPath = "tank" | "ap" | "ad" | "support";
export interface StatusEffect {kind: "silence" | "charm" | "magic-shred" | "stun" | "root" | "slow" | "shield" | "burn" | "armor-shred" | "weaken" | "stasis" | "heal-cut" | "empower" | "speed"; value: number; until: number; source?: string; key?: string;}
export interface CombatState {mana:number;energy?:number;flow?:number; ready:Partial<Record<SkillSlot,number>>; nextAttack:number; effects:StatusEffect[]; counters:Record<string,number>; procs:Record<string,number>; lastDamage:number; lastCast?:SkillSlot; buildPath?:BuildPath;}
export interface Unit { forge?:{itemId:string;finishAt:number;position:number;startedAt:number}; masterwork?:{itemId:string;smithId:string;bonuses:Record<string,number>}; aiBuild?:AiBuildPlan; shopUnlocked?:boolean; augmentClaims?:number; skillMaxOrder?:Exclude<SkillSlot,'R'>[]; prioritizeUltimate?:boolean; skillRanks?:Record<SkillSlot,number>; autoSkills?:boolean; playStyle?:string; tacticalReason?:string; experience?:number; diedAt?:number; deathDuration?:number; returningToBase?:boolean; holdAtBase?:boolean; order?:TeamOrder; shopRequest?:ShopRequest; lastBuildReason?:string; lastAugmentReason?:string; id: string; champion: Champion; team: "blue" | "red"; traits: Trait[]; level: number; kills: number; deaths: number; assists: number; gold: number; health: number; maxHealth: number; damage: number; taken: number; augments: Augment[]; items: string[]; alive: boolean; position: number; cooldownUntil: number; respawnAt: number; status: string; relationships: Record<string, Relationship>; atFountain: boolean; combat?: CombatState; fountainSince?: number; portalReadyAt?: number; portal?: {from:number;to:number;startedAt:number;arriveAt:number}; }
export interface LogLine { time: number; text: string; tone?: "good" | "bad" | "major"; }
export type Intent = "engage" | "retreat" | "trade" | "wait" | "peel" | "hold" | "healthpack" | "push" | "clear" | "regroup";
export type Reaction = "engage" | "join" | "retreat" | "cover" | "poke" | "hesitate" | "chase" | "clear" | "push";
export type Situation = "ally-picked" | "enemy-overextended" | "low-health" | "standoff" | "ally-danger" | "tower-defense" | "siege" | "no-wave" | "ultimate-wait";
export interface Decision { title: string; description: string; situation?: Situation; choices: { id: string; label: string; bonus: number; hint?: string; }[]; }
export interface ResponsePlan { unitId: string; action: Reaction; reason: string; misunderstood: boolean; weights: Record<Reaction, number>; memory?:DecisionMemory; }
export interface Encounter {
  id: number; situation: Situation; intent: Intent; wave: number; nextWaveAt: number;
  startDeaths: [number, number]; startHealth: [number, number];
  startUnits: { id: string; health: number; deaths: number; position: number; damage: number }[];
  initialOpportunity: number;
  protections: { protector: string; protected: string }[];
  rounds: { time: number; plans: ResponsePlan[]; movements?: {unitId:string;from:number;to:number;visible:boolean}[] }[];
}
export interface EncounterResult { id: number; intent: Intent; situation: Situation; text: string; allyLosses: number; enemyLosses: number; playerEscaped: boolean; rounds: Encounter["rounds"]; memoryChanges?:TrustChange[]; }
export interface VisualEvent { at: number; from?: string; to: string; type: "physical" | "magic" | "true" | "miss" | "heal"; amount: number; }
export interface Building {id:string;team:"blue"|"red";kind:"outer"|"inner"|"inhibitor"|"nexus-tower"|"nexus";name:string;position:number;laneOffset:number;health:number;maxHealth:number;alive:boolean;respawnAt?:number;targetId?:string;aggroUntil?:number;nextAttack:number;}
export interface Minion {experienceGranted?:boolean;id:string;team:"blue"|"red";kind:"melee"|"caster"|"cannon"|"super";position:number;health:number;maxHealth:number;damage:number;range:number;nextAttack:number;}
export interface World {layoutVersion?:number;buildings:Building[];minions:Minion[];wave:number;nextWave:number;serial:number;}
export interface Game { augmentTiers?:Tier[]; seenAugments?:string[]; preparationRules?:1; respawnPrompt?:boolean; shopReturn?:"portal"|"walk"; augmentRerolls?:boolean[]; augmentSerial?:number; matchupRemaining?:number; lobby?:PickLobby; chat?:TeamChat; world?:World; schemaVersion: 3; seed: number; phase: Phase; time: number; blue: Unit[]; red: Unit[]; playerId: string; logs: LogLine[]; pending?: Decision; nextDecision: number; nextAugmentLevel: number; winner?: "blue" | "red"; encounter?: Encounter; encounterSerial: number; encounterHistory: EncounterResult[]; visualEvents: VisualEvent[]; packs: { blue: number; red: number }; }

export type OrderKind='antiheal'|'engage'|'retreat'|'group'|'clear'|'defend'|'focus';
export interface TeamOrder {id:number;kind:OrderKind;until:number;reason:string;focusId?:string;}
export interface QuickOrder {id:number;kind:Exclude<OrderKind,'antiheal'>;at:number;focusId?:string;responses:{unitId:string;status:'accepted'|'ignored'|'unavailable';reason:string}[];}
export interface ShopRequest {orderId:number;itemId:string;status:'pending'|'fulfilled';reason:string;}
export interface ChatMessage {id:number;at:number;sender:string;text:string;tone:'player'|'accept'|'defer'|'ignore'|'system'|'ping';reason?:string;}
export interface TeamPing {id:number;at:number;sender:string;targetId:string;position:number;count:number;reason:string;}
export interface TeamChat {serial:number;orderSerial:number;lastSentAt?:number;messages:ChatMessage[];pings?:TeamPing[];lastPingAt?:Record<string,number>;quickOrder?:QuickOrder;}

export interface PickTrade {partnerId:string;direction:"incoming"|"outgoing";playerChampion:string;partnerChampion:string;resolveAt:number;}
export interface PickLobby {elapsed:number;bench:string[];serial:number;events:string[];trade?:PickTrade;cooldowns:Record<string,number>;aiChanges:Record<string,number>;locked:boolean;}
