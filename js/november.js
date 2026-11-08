/* November rules transcribed from 플래너별 T/V. Future-week rates are unpublished. */
const November = {
  tier(p, monthly) {
    const [base, up10, up20] = p.targets;
    if (p.specialFlag) return 3;
    if (monthly >= 1000000) return monthly >= up20 ? 3 : 1;
    return monthly >= up20 ? 3 : up10 != null && monthly >= up10 ? 2 : monthly >= base ? 1 : 0;
  },
  rate(tier) { return tier === 3 ? 1.6 : tier === 2 ? 1.3 : 1; },
  basis(value) {
    if (value < 50000) return 0;
    if (value >= 500000) return value;
    return value >= 400000 ? 400000 : value >= 300000 ? 300000 : value >= 200000 ? 200000 : value >= 100000 ? 100000 : 50000;
  },
  calculate(p, monthly, performances) {
    const tier = this.tier(p, monthly), rate = this.rate(tier);
    const awards = performances.map(v => this.basis(v) * rate);
    return {tier, rate, awards, total:awards.reduce((a,b)=>a+b,0)};
  },
  published(p, monthly, overrides={}) {
    const tier=this.tier(p,monthly);
    const weeks=p.weeks.map(w=>{
      const rates=w.week===1?[1,1,1.3,1.6]:w.tierRates;
      const supported=w.week===1||(Array.isArray(rates)&&rates.length===4&&Number.isFinite(w.awardBasis));
      if(!supported)return {...w,pending:true};
      const performance=overrides[w.week]??w.performance;
      const basis=w.week===1?this.basis(performance):w.awardBasis;
      return {...w,performance,rate:rates[tier],award:basis*rates[tier],pending:false};
    });
    return {tier,weeks,total:weeks.reduce((sum,w)=>sum+(w.pending?0:w.award),0)};
  },
  next(p, monthly) {
    if (p.specialFlag) return null;
    const t=this.tier(p,monthly);
    const i=t===0?0:t===1?(p.targets[1]==null?2:1):t===2?2:-1;
    return i<0 ? null : {label:['기본','10UP','20UP'][i], target:p.targets[i], gap:Math.max(0,p.targets[i]-monthly)};
  },
  money(v) {return Number(v).toLocaleString('ko-KR',{maximumFractionDigits:2})+'원';},
  render(p) {
    const el=document.getElementById('november');
    el.innerHTML='<div class="section-title"><span>🏆</span><div><h2>11월 아듀 2026</h2><p>월 누계 목표와 주차별 예상 시상금</p></div></div>';
    if(!p){el.insertAdjacentHTML('beforeend','<p class="empty">조회 가능한 11월 시상 데이터가 없습니다.</p>');return;}
    const money=v=>this.money(v), labels=['구간 미달성','기본','10UP','20UP'];
    const calc=this.calculate(p,p.monthly,p.weeks.map(w=>w.performance));
    const next=this.next(p,p.monthly);
    const published=this.published(p,p.monthly);
    el.insertAdjacentHTML('beforeend',`<div class="nov-tier-caption">현재 달성 구간 <strong>${labels[calc.tier]}</strong>${calc.tier===0?'<span>기본 목표를 향해 도전 중</span>':''}</div><div class="nov-targets">${p.targets.map((v,i)=>`<div class="nov-target ${calc.tier===i+1?'is-current':''}" ${calc.tier===i+1?'aria-current="step"':''}><span class="nov-tier-tag">${calc.tier===i+1?'★ 현재 구간':v==null?'대상 없음':'목표'}</span><small>${['기본','10UP','20UP'][i]}</small><b>${v==null?'대상 없음':money(v)}</b></div>`).join('')}</div>
      <div class="nov-current nov-monthly-card"><div class="nov-monthly-label">월 누계 실적 <span>관리사항 미적용</span></div><strong class="nov-monthly-value">${money(p.monthly)}</strong><div class="nov-monthly-status"><div><small>달성 구간</small><b>${labels[calc.tier]}</b></div><div><small>지급률 · 1주차</small><b>${calc.rate*100}<span>%</span></b></div></div><div class="nov-monthly-next"><small>다음 목표 안내</small><p>${next?`${next.label} 목표까지 <b>${money(next.gap)}</b> 부족`:'20UP 구간 달성'}</p></div></div>
      <p class="guide">월 누계 구간을 기준으로 공개 주차 전체의 시상금을 다시 계산합니다. 구간 미달성 시에도 엑셀 수식의 기본 지급률 100%를 적용합니다.</p>
      ${[1,2,3,4,5].map(number=>{const week=published.weeks.find(w=>w.week===number&&!w.pending);return week?`<div class="nov-week"><b>${number}주차${number===1?' · 11/1~6':''}</b><span>관리사항 적용 실적 ${money(week.performance)}</span><span>현재 월 누계 기준 지급률 ${week.rate*100}%</span><strong>예상 시상금 ${money(week.award)}</strong></div>`:`<div class="nov-week pending"><b>${number}주차</b><span>오픈 예정 · 실적 및 시상 기준 미공개</span></div>`;}).join('')}
      <div class="nov-current"><small>누적 예상 시상금 · 공개 주차 합계</small><strong>${money(published.total)}</strong></div>
      <div class="section-title nov-sim-title"><span aria-hidden="true">✦</span><div><h2>예상 시뮬레이션</h2><p>현재 기준으로 내 시상금 예측해보기!</p></div></div>
      <details class="nov-sim" open><summary>예상 실적 입력하기</summary><p class="guide">예상 최종 실적을 입력하세요. 월 누계와 관리사항 적용 주차 실적은 별도 기준이므로 각각 입력합니다. 실제 실적은 변경되지 않습니다.</p>
      <label for="nov-monthly">예상 월 누계 실적 (원)</label><input id="nov-monthly" type="number" min="0" step="1" value="${p.monthly}">
      <label for="nov-week1">예상 1주차 실적 (관리사항 적용, 원)</label><input id="nov-week1" type="number" min="0" step="1" value="${p.weeks[0].performance}">
      <button id="nov-reset" type="button">실제 실적으로 초기화</button><div id="nov-output" aria-live="polite"></div></details>
      <p class="guide">보장구성비·태아보험 미적용으로 실제 시상금은 변동될 수 있습니다. 미공개 주차는 누적 예상 시상금에서 제외합니다.</p>`);
    const m=document.getElementById('nov-monthly'),w=document.getElementById('nov-week1'),out=document.getElementById('nov-output');
    const update=()=>{
      if(m.value===''||w.value===''||!m.validity.valid||!w.validity.valid){out.textContent='0 이상의 정수 실적을 입력해주세요.';return;}
      const v=Number(m.value),r=this.calculate(p,v,[Number(w.value)]),n=this.next(p,v),forecast=this.published(p,v,{1:Number(w.value)});
      out.innerHTML=`<div class="nov-sim-result-title">예상 결과</div><div class="nov-result-grid"><div class="nov-result-card tier-result"><small>예상 구간</small><strong>${labels[r.tier]}</strong><span>지급률 ${r.rate*100}%</span></div><div class="nov-result-card"><small>목표 달성 현황</small><strong>${r.tier===0?'기본 도전 중':labels[r.tier]+' 달성'}</strong><span>${n?`${n.label}까지 ${money(n.gap)} 부족`:'최고 구간 달성 완료'}</span></div><div class="nov-result-card week-result"><small>1주차 예상 시상금</small><strong>${money(r.awards[0])}</strong><span>예상 월 누계 구간으로 재계산</span></div></div><div class="nov-result-total"><small>누적 예상 시상금</small><strong>${money(forecast.total)}</strong><span>공개 주차 합계 · 현재 대비 ${forecast.total-published.total>0?'+':''}${money(forecast.total-published.total)}</span></div>`;
    };
    m.oninput=w.oninput=update;document.getElementById('nov-reset').onclick=()=>{m.value=p.monthly;w.value=p.weeks[0].performance;update();};update();
  }
};
if(typeof module!=='undefined')module.exports=November;
