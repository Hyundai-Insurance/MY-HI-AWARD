const fs=require('fs'),path=require('path'),assert=require('assert');const N=require(require('path').join(__dirname,'../js/november.js'));let count=0,mismatch=[];let sample;
for(const dir of fs.readdirSync(require('path').join(__dirname,'../data/planner')))for(const file of fs.readdirSync(require('path').join(__dirname,'../data/planner',dir))){
 const r=JSON.parse(fs.readFileSync(require('path').join(__dirname,'../data/planner',dir)+'/'+file));if(!r.november)continue;const p=r.november;count++;assert(Math.abs(N.published(p,p.monthly).total-p.weeks[0].sourceAward)<.001);const c=N.calculate(p,p.monthly,p.weeks.map(w=>w.performance));if(Math.abs(c.total-p.weeks[0].sourceAward)>.001)mismatch.push([p.code,c.total,p.weeks[0].sourceAward]);if(r.hiStar&&r.hiPoint&&!sample)sample=p.code;
}
assert.equal(mismatch.length,0,JSON.stringify(mismatch.slice(0,5)));
let p={targets:[300000,400000,500000],specialFlag:false};
for(const [m,t] of [[299999,1],[300000,1],[399999,1],[400000,2],[499999,2],[500000,3]])assert.equal(N.tier(p,m),t);
assert.deepEqual([49999,50000,99999,100000,199999,200000,300000,400000,499999,500000,550000].map(v=>N.basis(v)),[0,50000,50000,100000,100000,200000,300000,400000,400000,500000,550000]);
assert.deepEqual(N.calculate(p,500000,[100000,200000]).awards,[160000,320000]);
assert.deepEqual(N.calculate(p,400000,[100000,200000]).awards,[130000,260000]);
p={targets:[1000000,null,1200000],specialFlag:false};assert.equal(N.tier(p,1000000),1);assert.equal(N.tier(p,1200000),3);assert.equal(N.next(p,1000000).target,1200000);p.specialFlag=true;assert.equal(N.tier(p,0),3);
console.log(JSON.stringify({novemberCount:count,allExcelAwardsMatched:true,sample,boundaries:'passed'}));

assert.equal(N.tier({targets:[300000,400000,500000],specialFlag:false},0),1);assert.equal(N.calculate({targets:[300000,400000,500000],specialFlag:false},0,[100000]).total,100000);assert.equal(N.next({targets:[300000,400000,500000],specialFlag:false},0).gap,400000);
