import {createGame,offerAugments,chooseAugment,buyStarter,chooseDecision,tick} from '../src/engine/game';
let g=createGame(Number(process.argv[2]??1));offerAugments(g);chooseAugment(g,g.pending!.choices[0].id);buyStarter(g);
for(let i=0;i<2500&&g.phase!=='finished';i++){
 if(g.pending){if(g.phase==='augment')chooseAugment(g,g.pending.choices[0].id);else chooseDecision(g,g.pending.choices.find(c=>c.id==='push'||c.id==='clear'||c.id==='engage')?.id??g.pending.choices[0].id);}
 else g=tick(g);
 if(g.time%400===0)console.log(g.time,g.world?.buildings.map(b=>[b.id,b.health]),g.world?.minions.length);
}
console.log(JSON.stringify({time:g.time,phase:g.phase,buildings:g.world?.buildings.map(b=>[b.id,b.health]),units:[...g.blue,...g.red].map(u=>({name:u.champion.name,team:u.team,pos:u.position,health:u.health,alive:u.alive,items:u.items,status:u.status})),minions:g.world?.minions.slice(-10),logs:g.logs.slice(-8)},null,2));
