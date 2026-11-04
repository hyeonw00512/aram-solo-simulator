import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import App from '../src/App';
import {createGame} from '../src/engine/game';

it('keeps the lobby and simulation unmounted before accepting a new game',()=>{
 const game=createGame(415),before=structuredClone(game);
 const html=renderToStaticMarkup(<App initialGame={game} saveEnabled={false} showStartScreen/>);
 expect(html).toContain('게임을 시작하시겠습니까?');expect(html).toContain('>수락</button>');
 expect(html).not.toContain('후보 챔피언');expect(html).not.toContain('이전 경기 이어하기');expect(html).not.toContain('인게임 팝업 메뉴');expect(game).toEqual(before);
});
it('offers a separate resume action for an existing match instead of silently discarding it',()=>{
 const game=createGame(415);game.phase='playing';game.time=120;const before=structuredClone(game);
 const html=renderToStaticMarkup(<App initialGame={game} saveEnabled={false} showStartScreen/>);
 expect(html).toContain('이전 경기 이어하기');expect(html).toContain('수락하면 새 경기를 시작합니다');expect(html).not.toContain('LIVE MATCH');expect(game).toEqual(before);
});
