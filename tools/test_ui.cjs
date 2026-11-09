// DOM-independent integration checks; does not replace visual browser QA.
const vm=require('vm'),fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..');
class Element{constructor(){this.value='';this.textContent='';this.innerHTML='';this.validity={valid:true};}insertAdjacentHTML(_,s){this.innerHTML+=s;for(const m of s.matchAll(/id="([^"]+)"[^>]*?(?:value="([^"]*)")?[^>]*>/g)){const e=elements[m[1]]??=new Element();const value=m[0].match(/value="([^"]*)"/);if(value)e.value=value[1];}}}
let elements={november:new Element()};
const context={console,URL,location:{href:'http://localhost/MY-HI-AWARD/',origin:'http://localhost'},document:{getElementById:id=>elements[id]},fetch:async(url)=>{const relative=new URL(url).pathname.replace('/MY-HI-AWARD/','');try{const text=fs.readFileSync(path.join(root,relative),'utf8');return{ok:true,status:200,json:async()=>JSON.parse(text)}}catch{return{ok:false,status:404}}}};
vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'js/dataLoader.js'),'utf8')+'\n globalThis.loader=dataLoader;',context);vm.runInContext(fs.readFileSync(path.join(root,'js/november.js'),'utf8')+'\n globalThis.N=November;',context);
(async()=>{await context.loader.init();assert.equal(context.loader.meta.closingDate,'2026-11-06');assert.equal(await context.loader.get('ZZZZZZ'),null);let r=await context.loader.get('8');assert.equal(r.code,'000008');assert(r.hiStar&&r.hiPoint&&r.november);context.N.render(r.november);assert.equal((elements.november.innerHTML.match(/class="nov-week pending"/g)||[]).length,5-r.november.weeks.length);assert(!elements.november.innerHTML.includes('예상 시뮬레이션'));context.N.render(null);assert(elements.november.innerHTML.includes('데이터가 없습니다'));console.log('Integration passed: padded/unknown code, all three sheet lookup, pending weeks, date metadata');})().catch(e=>{console.error(e);process.exitCode=1});
// Presentation and November-only top total regression checks.
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');assert(!index.includes('id="total-points"'));assert(index.includes('11월 시상금 한눈에 보기!'));
elements['total-cash']=new Element();elements['total-note']=new Element();
context.addEventListener=()=>{};vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8')+'\n globalThis.testApp=app;',context);
context.testApp.data={november:{monthly:400000,targets:[300000,400000,500000],specialFlag:false,weeks:[{week:1,performance:100000},{week:2,performance:200000,awardBasis:200000,tierRates:[0.8,0.8,1.1,1.4]}]}};context.testApp.renderTotal(null,null);assert.equal(elements['total-cash'].textContent,'350,000원');
context.testApp.data={};context.testApp.renderTotal(null,null);assert.equal(elements['total-cash'].textContent,'-');
for(const [monthly,tier] of [[299999,1],[300000,1],[400000,2],[500000,3]]){
 const p={monthly,targets:[300000,400000,500000],specialFlag:false,sourceTier:'',weeks:[{week:1,performance:100000,sourceAward:100000}]};
 context.N.render(p);const html=elements.november.innerHTML;
 assert.equal((html.match(/class="nov-target(?: |")/g)||[]).length,2);
 assert.equal((html.match(/aria-current="step"/g)||[]).length,tier===1?0:1);
 assert(!html.includes('<small>기본</small>'));
 assert(!html.includes('예상 시뮬레이션'));
 if(tier===1) assert(html.includes('10UP 목표까지'));
}
console.log('Presentation passed: November-only multiweek total, empty state, 10UP/20UP goals and active tier');
