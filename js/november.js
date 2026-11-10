/* November week 1 and 2 payout rates follow the 플래너별 workbook formulas. */
const November = {
  tier(p, monthly) {
    const [, up10, up20] = p.targets;
    // Excel formulas can store an integer goal with a tiny floating-point remainder.
    const reached = target => {
      if (!Number.isFinite(target)) return false;
      const tolerance = Math.max(Math.abs(monthly), Math.abs(target)) * Number.EPSILON * 4;
      return monthly >= target || target - monthly <= tolerance;
    };
    if (p.specialFlag) return 3;
    if (reached(1000000)) return reached(up20) ? 3 : 1;
    return reached(up20) ? 3 : reached(up10) ? 2 : 1;
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
    const confirmedRates = {1:[1,1,1.3,1.6], 2:[0.8,0.8,1.1,1.4]};
    const weeks=p.weeks.map(w=>{
      const rates=w.tierRates ?? confirmedRates[w.week];
      const supported=Array.isArray(rates)&&rates.length===4&&(confirmedRates[w.week]||Number.isFinite(w.awardBasis));
      if(!supported)return {...w,pending:true};
      const performance=overrides[w.week]??w.performance;
      const basis=w.awardBasis ?? this.basis(performance);
      return {...w,performance,rate:rates[tier],award:basis*rates[tier],pending:false};
    });
    return {tier,weeks,total:weeks.reduce((sum,w)=>sum+(w.pending?0:w.award),0)};
  },
  next(p, monthly) {
    if (p.specialFlag) return null;
    const t=this.tier(p,monthly);
    const i=t===1?(p.targets[1]==null?2:1):t===2?2:-1;
    return i<0 ? null : {label:['기본','10UP','20UP'][i], target:p.targets[i], gap:Math.max(0,p.targets[i]-monthly)};
  },
  money(v) {return Number(v).toLocaleString('ko-KR',{maximumFractionDigits:2})+'원';},
  render(p) {
    const el=document.getElementById('november');
    el.innerHTML='<div class="section-title"><span>🏆</span><div><h2>11월 아듀 2026</h2><p>월 누계 목표와 주차별 예상 시상금</p></div></div>';
    if(!p){el.insertAdjacentHTML('beforeend','<p class="empty">조회 가능한 11월 시상 데이터가 없습니다.</p>');return;}
    const money=v=>this.money(v), labels=['기본','기본','10UP','20UP'];
    const next=this.next(p,p.monthly);
    const published=this.published(p,p.monthly);
    const latestWeek = published.weeks.reduce((latest, week) => {
      return !week.pending && (!latest || week.week > latest.week) ? week : latest;
    }, null);
    const rateLabel = latestWeek ? `지급률 · ${latestWeek.week}주차` : '지급률';
    const percent = rate => (rate * 100).toLocaleString('ko-KR', {maximumFractionDigits: 2});
    const goalCards = p.targets.slice(1).map((value, index) => {
      const tier = index + 2;
      const active = published.tier === tier;
      const status = active ? '★ 현재 구간' : value == null ? '대상 없음' : '목표';
      return `<div class="nov-target${active ? ' is-current' : ''}"${active ? ' aria-current="step"' : ''}>
        <span class="nov-tier-tag">${status}</span>
        <small>${labels[tier]}</small>
        <b>${value == null ? '대상 없음' : money(value)}</b>
      </div>`;
    }).join('');
    el.insertAdjacentHTML('beforeend',`<div class="nov-tier-caption">현재 달성 구간 <strong>${labels[published.tier]}</strong></div><div class="nov-targets">${goalCards}</div>
      <div class="nov-current nov-monthly-card"><div class="nov-monthly-label">월 누계 실적 <span>관리사항 미적용</span></div><strong class="nov-monthly-value">${money(p.monthly)}</strong><div class="nov-monthly-status"><div><small>달성 구간</small><b>${labels[published.tier]}</b></div><div><small>${rateLabel}</small><b>${latestWeek ? `${percent(latestWeek.rate)}<span>%</span>` : '-'}</b></div></div><div class="nov-monthly-next"><small>다음 목표 안내</small><p>${next?`${next.label} 목표까지 <b>${money(next.gap)}</b> 부족`:'20UP 구간 달성'}</p></div></div>
      <p class="guide">월 누계 구간을 기준으로 공개 주차 전체의 시상금을 다시 계산합니다. 기본 구간 지급률은 1주차 100%, 2주차 80%입니다.</p>
      ${[1,2,3,4,5].map(number=>{const week=published.weeks.find(w=>w.week===number&&!w.pending);return week?`<div class="nov-week"><b>${number}주차${number===1?' · 11/1~6':number===2?' · 11/9~13':''}</b><span>관리사항 적용 실적 ${money(week.performance)}</span><span>현재 월 누계 기준 지급률 ${percent(week.rate)}%</span><strong>예상 시상금 ${money(week.award)}</strong></div>`:`<div class="nov-week pending"><b>${number}주차</b><span>오픈 예정 · 실적 및 시상 기준 미공개</span></div>`;}).join('')}
      <div class="nov-current"><small>누적 예상 시상금 · 공개 주차 합계</small><strong>${money(published.total)}</strong></div>
      <p class="guide">보장구성비·태아보험 미적용으로 실제 시상금은 변동될 수 있습니다. 미공개 주차는 누적 예상 시상금에서 제외합니다.</p>`);

  }
};
if(typeof module!=='undefined')module.exports=November;
