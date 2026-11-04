// Dev-only fixture entry: never touches the player's saved match.
import {createRoot} from 'react-dom/client';
import App from '../../src/App';
import {createGame,offerAugments,chooseAugment} from '../../src/engine/game';
import {grantBonusLevel} from '../../src/engine/progression';
const scenario=new URLSearchParams(location.search).get('scenario')??'respawn';
const seed=Number(new URLSearchParams(location.search).get('seed')??415);
const game=createGame(Number.isFinite(seed)?seed:415);offerAugments(game);
if(scenario!=='augment')chooseAugment(game,game.pending!.choices[0].id);
if(!['augment','shop'].includes(scenario)){
 game.phase='playing';game.time=80;game.nextDecision=99999;
 for(const u of [...game.blue,...game.red]){u.atFountain=false;u.position=u.team==='blue'?44:56;}
 game.blue[0].atFountain=true;game.blue[0].position=0;game.blue[0].holdAtBase=true;game.blue[0].deaths=1;game.blue[0].respawnAt=80;game.blue[0].gold=5000;
 if(scenario==='respawn')game.respawnPrompt=true;
 if(scenario==='settings')grantBonusLevel(game,game.blue[0]);
 if(scenario==='result'){game.phase='finished';game.winner='blue';}
}
createRoot(document.getElementById('root')!).render(<App initialGame={game} saveEnabled={false}/>);
