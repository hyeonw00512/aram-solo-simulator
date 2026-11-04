import type {Game,Unit} from './types';
import {Rng} from './rng';

type Voice='bold'|'stubborn'|'careful'|'casual';
export type ChatCue='owned'|'refuse'|'slots'|'gold'|'later'|'buy'|'bought'|'buy-dead'|'bought-dead'|'dead'|'danger'|'base'|'portal'|'engage'|'retreat'|'group'|'clear'|'defend';
// Dialogue has its own RNG: adding a line must never change combat or acceptance rolls.
const lines:Record<ChatCue,Record<Voice,string[]>>={
 owned:{bold:['인벤 봐','치감 샀다니까 ㅋㅋ'],stubborn:['템창 좀 봐 이미 샀음','있다고 몇 번을 말해'],careful:['있음','샀음'],casual:['치감 있음 ㅇㅇ','나 이미 감']},
 refuse:{bold:['ㄴㄴ 내 각 볼게','아 답답하네 난 내 식대로 함'],stubborn:['알아서 함','오더 그만 좀 내 빌드 감','싫은데 걍 내 할 거 함'],careful:['ㄴ','ㄴㄴ'],casual:['ㄴㄴ 난 패스','?']},
 slots:{bold:['칸 없다고 ㅋㅋ 합치고 치감 감','인벤 터졌음 자리 나면 삼'],stubborn:['칸부터 봐라 자리가 없잖아','템 합쳐야 자리 남 그때 삼'],careful:['칸 없음','칸 꽉 참'],casual:['6칸 꽉 참 합치고 삼','칸 비면 치감 감 ㅇㅇ']},
 gold:{bold:['{gold}골 모자람 ㅅㅂ 돈 되면 {item} 감','{item} 살 건데 {gold}골 부족'],stubborn:['{gold}골 없다고 돈 생기면 삼','돈 없는데 뭘 사 {gold}골 더 있어야 됨'],careful:['{gold}골 없음','{gold} 부족'],casual:['{gold}골 모자람 모이면 {item} 삼','{item} ㅇㅋ 돈이 {gold}골 부족함']},
 later:{bold:['ㅇㅋ 담에 살 때 {item} 감','{item} 갈 테니까 지금은 싸움 보자'],stubborn:['알았음 담 구매에 {item} 감','{item} 갈 거니까 그만 말해'],careful:['담에','담템'],casual:['ㅇㅋ 담 템 {item}','담에 살 때 {item} 감 ㅇㅇ']},
 buy:{bold:['ㅇㅋ {item} 바로 삼','{item} 감 이제 싸우자'],stubborn:['알았다고 {item} 삼','{item} 가면 되지? 삼'],careful:['ㅇ','ㅇㅋ'],casual:['{item} ㅇㅋ','ㅇㅇ {item} 감']},
 bought:{bold:['치감 샀다 이제 패자','치감 나왔음 드가자'],stubborn:['치감 샀음 됐지','치감 샀으니까 인벤 좀 봐'],careful:['치감 샀어 다음 싸움에 묻힐게','치감 준비됨 같이 보자'],casual:['치감 삼 ㅇㅇ','치감 나옴']},
 'buy-dead':{bold:['ㅇㅋ 죽은 김에 {item} 삼','{item} 사두고 부활하면 감'],stubborn:['알았음 부활 전에 {item} 삼','죽어도 템은 사지 {item} 감'],careful:['부활 기다리면서 {item} 살게','ㅇㅇ 지금 {item} 사둘게'],casual:['ㅇㅋ 부활 전에 {item} 사둠','죽은 김에 {item} 감 ㅇㅇ']},
 'bought-dead':{bold:['치감 샀다 부활하면 패자','치감 나옴 부활만 기다려'],stubborn:['치감 샀음 이제 부활 기다리는 중','치감 샀으니까 됐지 부활하면 감'],careful:['치감 샀어 부활하면 합류할게','치감 준비됨 부활 기다리는 중'],casual:['치감 삼 부활 대기 ㅇㅇ','치감 사뒀음 부활하면 감']},
 dead:{bold:['죽어서 못 간다고 ㅋㅋ 부활 기다려','ㅅㅂ 나 죽어있음 지금 싸우러 못 감'],stubborn:['죽어서 못 움직임 부활 시간 좀 봐','지금은 못 감 부활하고 불러'],careful:['나 죽어서 지금 합류 못 해','부활하면 움직일 수 있어 잠깐만'],casual:['죽어서 못 감 ㅠ','회색화면임 부활하면 갈게']},
 danger:{bold:['지금 드가면 뒤진다고 ㅋㅋ 각 좀 봐','ㅅㅂ 지금 싸우면 터짐 좀 빼'],stubborn:['이게 뭔 각이야 안 감','지금 들어가자는 건 좀 아니지'],careful:['빼','ㄴㄴ'],casual:['이건 좀 에바임 ㄴㄴ','지금은 아닌 듯 좀 보자']},
 base:{bold:['나 아직 우물임 잠만','우물인데 벌써 싸우냐 ㅋㅋ'],stubborn:['나 기지라고 미니맵 좀 봐','우물임 아직 못 감'],careful:['아직 우물이야 잠깐만','기지에서 정비 중이야'],casual:['나 우물 잠만','아직 기지임 ㅇㅇ']},
 portal:{bold:['포탈 타는 중 기다려 ㅋㅋ','가는 중인데 먼저 박지 마'],stubborn:['이동 중임 도착하고 말해','포탈 타고 있잖아'],careful:['포탈 타고 가는 중 잠깐만','도착하면 다시 불러줘'],casual:['포탈 타는 중 ㅇㅇ','곧 도착 잠만']},
 engage:{bold:['ㅇㅋ 박자 같이 와','각 보이면 바로 간다 쫄지 마','드가자 ㅋㅋ'],stubborn:['이번엔 따라감 호응해라','ㅇㅋ 근데 혼자 빼지 마'],careful:['ㅇ','ㄱ'],casual:['ㅇㅋ 같이 감','ㄱㄱ 각 보자']},
 retreat:{bold:['아 씨 빠져 빠져','ㅇㅋ 빼 뒤는 내가 봄'],stubborn:['이번엔 빼줌','빼라며 너도 빼라'],careful:['ㅌ','빼'],casual:['ㅌㅌ','ㅇㅋ 빼는 중']},
 group:{bold:['모여 한 번 붙자','ㅇㅋ 같이 가 흩어지지 말고'],stubborn:['모일 테니까 너도 혼자 가지 마','ㅇㅋ 붙어줌'],careful:['ㅇ','감'],casual:['ㅇㅋ 모임','같이 가자 ㅇㅇ']},
 clear:{bold:['라인부터 밀자 ㅋㅋ','ㅇㅋ 미니언 내가 봄'],stubborn:['라인 정리할 테니까 잠깐 기다려','ㅇㅇ 웨이브 먼저 봄'],careful:['라인 봄','라인'],casual:['ㅇㅋ 라인 봄','웨이브부터 ㅇㅇ']},
 defend:{bold:['포탑 앞에서 받아쳐 드가진 말고','ㅇㅋ 수비부터 하자 씨'],stubborn:['수비할 거면 밖으로 나가지 마','ㅇㅋ 포탑 쪽 지킴'],careful:['포탑 끼자','ㅇ'],casual:['ㅇㅋ 수비함','포탑 끼자 ㅇㅇ']},
};
export function chatVoice(u:Unit):Voice{
 if(u.traits.includes('고집이 셉니다')||u.traits.includes('혼자 다닙니다'))return 'stubborn';
 if(u.traits.includes('사립니다')||u.traits.includes('포킹만 합니다'))return 'careful';
 if(u.traits.includes('공격적입니다')||u.traits.includes('죽음을 두려워하지 않습니다'))return 'bold';
 return 'casual';
}
export function teammateLine(g:Game,u:Unit,cue:ChatCue,values:{item?:string;gold?:number}={}){
 const rng=new Rng(g.seed+g.time*31+(g.chat?.serial??0)*419+Number(u.id.split('-')[1])*997);
 if(!u.alive&&cue==='buy')cue='buy-dead';
 if(!u.alive&&cue==='bought')cue='bought-dead';
 let pool=lines[cue][chatVoice(u)];
 const memory=u.relationships[g.playerId];
 if(memory?.experiences&&memory.trust< -20){
  if(cue==='engage')pool=['이번엔 간다','이번엔 호응해라'];
  if(cue==='refuse')pool=['니 오더 안 들음','또 시작이네'];
 }
 const previous=g.chat?.messages.filter(m=>m.sender===u.id).at(-1)?.text;
 const rendered=pool.map(line=>line.replaceAll('{item}',values.item??'치감템').replaceAll('{gold}',String(values.gold??0)));
 const fresh=rendered.filter(line=>line!==previous);
 return rng.pick(fresh.length?fresh:rendered);
}
