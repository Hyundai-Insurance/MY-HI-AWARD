const uiRenderer = {
  formatWon(amount) {
    if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return "-";
    return `${Math.round(Number(amount)).toLocaleString("ko-KR")}원`;
  },

  el(id) { return document.getElementById(id); },

  showScreen(screenName) {
    this.el("screen-login").classList.toggle("hidden", screenName !== "login");
    this.el("screen-loading").classList.toggle("hidden", screenName !== "loading");
    this.el("screen-error").classList.toggle("hidden", screenName !== "error");
    this.el("screen-result").classList.toggle("hidden", screenName !== "result");
    this.el("screen-histar").classList.toggle("hidden", screenName !== "histar");
    window.scrollTo({ top: 0, behavior: "auto" });
  },

  renderLogin() {
    this.showScreen("login");
    this.el("login-error").classList.add("hidden");
    this.el("planner-code-input").value = "";
  },

  renderLoading() { this.showScreen("loading"); },

  renderError(type, detail = "") {
    if (type === "not_registered") {
      this.showScreen("login");
      const box = this.el("login-error");
      box.textContent = "등록되지 않은 코드입니다.";
      box.classList.remove("hidden");
      return;
    }
    this.showScreen("error");
    this.el("error-detail").textContent = detail ? `개발자 확인용 : ${detail}` : "";
  },

  renderLoginFormatError() {
    this.showScreen("login");
    const box = this.el("login-error");
    box.textContent = "플래너 코드를 확인해주세요. (영문/숫자 6자리)";
    box.classList.remove("hidden");
  },

  renderGuideHeader() {
    this.el("guide-title").textContent = "3분기 HI-UP";
    this.el("guide-closing").textContent = dateHelper.getClosingDateLabel();
  },

  renderPlannerProfile(plannerData) {
    const base = plannerData.personalIncrease || plannerData.honors || plannerData.tcStepUp || plannerData.hiStar;
    const honors = plannerData.honors;

    this.el("profile-region").textContent = base?.region || "-";
    this.el("profile-branch").textContent = base?.branch || "-";
    this.el("profile-office").textContent = honors?.team ? `팀 ${honors.team}` : "";
    this.el("profile-name").textContent = base?.name || "-";
    this.el("profile-code").textContent = plannerData.code;
    this.el("profile-month").textContent = base?.careerMonth !== null && base?.careerMonth !== undefined
      ? `${base.careerMonth}차월`
      : "-";
  },

  renderTotalAward(summary) {
    this.el("total-award-cash").textContent = this.formatWon(summary.cashTotal);
    const extra = this.el("total-award-extra");

    if (summary.tcEarly) {
      extra.textContent = `+ ${summary.tcRewardText}`;
      extra.className = "total-award-extra is-gold";
      extra.classList.remove("hidden");
    } else if (summary.tcMaintain) {
      extra.textContent = summary.tcRewardText;
      extra.className = "total-award-extra is-challenge";
      extra.classList.remove("hidden");
    } else {
      extra.textContent = "";
      extra.classList.add("hidden");
    }
  },

  renderPersonalIncrease(result) {
    const monthLabel = `${result.month}월`;
    this.el("pi-title").textContent = `${monthLabel} 환산순증 목표`;
    this.el("pi-target").textContent = this.formatWon(result.targetAmount);
    this.el("pi-actual").textContent = this.formatWon(result.actualAmount);
    this.el("pi-shortfall").textContent = this.formatWon(result.shortfall);

    const setText = (id, value) => { const node = this.el(id); if (node) node.textContent = value; };
    setText("pi-current-award", this.formatWon(result.currentSecuredAmount));
    setText("pi-september-award", this.formatWon(result.septemberExpectedAmount));
    setText("pi-final-award", this.formatWon(result.totalAwardAmount));
    setText("pi-additional-award", this.formatWon(result.septemberExpectedAmount));
    setText("pi-forecast-note", result.forecastNote || "9월 목표 달성 시 받을 수 있는 예상 금액입니다.");
    setText("pi-september-rule", result.septemberMultiplier === 2 ? "9월 시상금 × 200% 적용" : "9월 시상금 100% 적용");
    setText("pi-award", this.formatWon(result.totalAwardAmount));

    const motivationWrap = this.el("pi-motivation-wrap");
    const forecastNote = this.el("pi-forecast-note");
    if (motivationWrap) motivationWrap.classList.toggle("hidden", !result.showSeptemberForecast);
    if (forecastNote) forecastNote.classList.toggle("hidden", !result.showSeptemberForecast);

    const percent = result.targetAmount > 0
      ? Math.min(100, Math.round((result.actualAmount / result.targetAmount) * 100))
      : 0;
    this.el("pi-progress-fill").style.width = `${percent}%`;
    this.el("pi-progress-percent").textContent = `${percent}%`;

    // 개인환산순증 제목 옆 상태 배지는 사용하지 않음
    const statusBadge = this.el("pi-status-badge");
    if (statusBadge) statusBadge.classList.add("hidden");

    this.el("pi-tier-label").textContent = "7·8·9월 개인환산순증 시상 현황";

    const statusWrap = this.el("pi-month-status-wrap");
    statusWrap.innerHTML = "";
    [7, 8, 9].forEach((m) => {
      const status = result.monthStatuses[m];
      const award = result.monthAwards[m] || 0;
      const item = document.createElement("div");
      const safeStatus = String(status || "데이터 준비중");
      const success = safeStatus.startsWith("달성");
      item.className = `month-status-item ${success ? "is-success" : safeStatus === "데이터 준비중" ? "is-ready" : "is-fail"}`;
      item.innerHTML = `
        <div class="month-status-month">${m}월</div>
        <div class="month-status-text">${safeStatus}</div>
        <div class="month-status-award">${this.formatWon(award)}</div>
      `;
      statusWrap.appendChild(item);
    });
  },

  renderHonors(result, highlightMonth) {
    this.el("honors-grade").textContent = result.grade || "-";
    this.el("honors-average").textContent = this.formatWon(result.averagePerformance || 0);
    this.el("honors-current-award").textContent = this.formatWon(result.awardAmount || 0);
    this.el("honors-current-grade").textContent = result.awardAmount > 0 ? `${result.grade} 확보` : "아직 달성한 등급이 없어요";

    const wrap = this.el("honors-monthly-wrap");
    wrap.innerHTML = "";
    [7, 8, 9].forEach((m) => {
      const value = result.monthlyPerformance?.[m] || 0;
      const card = document.createElement("div");
      card.className = `honors-month-card${m === highlightMonth ? " is-current" : ""}`;
      card.innerHTML = `
        <div class="honors-month-label">${m}월 실적${m === highlightMonth ? " · 이번달" : ""}</div>
        <div class="honors-month-value">${this.formatWon(value)}</div>
      `;
      wrap.appendChild(card);
    });

    const actions = this.el("honors-next-actions");
    const topTier = this.el("honors-top-tier");
    const nextBox = this.el("honors-next-award")?.closest(".pi-forecast-box");
    const arrow = nextBox?.previousElementSibling;

    if (result.isTopTier) {
      if (nextBox) nextBox.classList.add("hidden");
      if (arrow) arrow.classList.add("hidden");
      actions.classList.add("hidden");
      topTier.classList.remove("hidden");
    } else {
      if (nextBox) nextBox.classList.remove("hidden");
      if (arrow) arrow.classList.remove("hidden");
      actions.classList.remove("hidden");
      topTier.classList.add("hidden");
      this.el("honors-next-award").textContent = this.formatWon(result.nextAwardAmount || 0);
      this.el("honors-next-grade").textContent = `${result.nextGrade} · 평균 ${this.formatWon(result.nextAverageThreshold || 0)} 달성`;
      this.el("honors-needed").textContent = this.formatWon(result.additionalPerformanceNeeded || 0);
      const nextStepText = this.el("honors-next-step-text");
      if (nextStepText) nextStepText.textContent = `${result.nextGrade} 달성이 가능해요!`;
      this.el("honors-more-reward").textContent = this.formatWon(result.additionalRewardAmount || 0);
    }

    this.el("honors-note").textContent = "";
  },

  renderTCStepUp(tcResult) {
    const section = this.el("section-tc");
    const nav = this.el("nav-tc");

    const quickNav = nav ? nav.closest(".quick-nav") : null;

    if (!tcResult.eligible) {
      section.classList.add("hidden");
      nav.classList.add("hidden");
      if (quickNav) quickNav.classList.add("three-tabs");
      return;
    }

    section.classList.remove("hidden");
    nav.classList.remove("hidden");
    if (quickNav) quickNav.classList.remove("three-tabs");

    const monthLabel = dateHelper.getMonthLabel();
    this.el("tc-progress-title").textContent = `${monthLabel} 실적진도`;
    this.el("tc-life-insurance").textContent = this.formatWon(tcResult.lifeInsurance);
    this.el("tc-auto").textContent = this.formatWon(tcResult.autoPerformance);
    this.el("tc-conversion").textContent = this.formatWon(tcResult.conversionPerformance);
    this.el("tc-income-progress").textContent = this.formatWon(tcResult.incomeProgress);
    this.el("tc-income-sub").textContent = tcResult.prevMonthNote || "";

    const badge = this.el("tc-award-badge");
    const desc = this.el("tc-award-desc");
    const awardBox = this.el("tc-award-box");

    badge.textContent = tcResult.rewardText;
    if (tcResult.isEarly) {
      badge.className = "badge badge-success";
      desc.textContent = "조기달성 대상자";
      awardBox.classList.remove("is-pending");
    } else if (tcResult.isMaintain) {
      badge.className = "badge badge-warning";
      desc.textContent = "유지달성 시상 도전 대상자";
      awardBox.classList.add("is-pending");
    } else {
      badge.className = "badge badge-muted";
      desc.textContent = "현재 시상 구분을 확인해주세요.";
      awardBox.classList.add("is-pending");
    }
  },

  renderHiStar(plannerData) {
    const hs = plannerData.hiStar;
    this.el("histar-closing").textContent = dateHelper.getClosingDateLabel();
    const empty = this.el("histar-empty");
    const content = this.el("histar-content");
    if (!hs) {
      empty.classList.remove("hidden"); content.classList.add("hidden"); this.showScreen("histar"); return;
    }
    empty.classList.add("hidden"); content.classList.remove("hidden");
    this.el("hs-region").textContent = hs.region || "-"; this.el("hs-branch").textContent = hs.branch || "-";
    this.el("hs-name").textContent = hs.name || "-"; this.el("hs-code").textContent = plannerData.code;
    const cm = Number(hs.careerMonth); this.el("hs-month").textContent = Number.isFinite(cm) ? `${cm}차월` : "-";
    this.el("hs-type").textContent = Number.isFinite(cm) && cm <= 12 ? "신인플래너" : "기존플래너";
    const missions = Array.isArray(hs.missions) ? hs.missions.slice(0,9).map(m => ({...m})) : [];
    // 주력상품은 현재실적 100,000원 이상이면 달성으로 판정한다.
    missions.forEach(m => {
      if (m.key === "mainProduct") {
        m.achieved = Number(m.current || 0) >= 100000;
        m.rule = "10만원 이상";
      }
      // 기존 '누구나 플랜' 칸은 10월 4~5주차 2차년도 브릿지 참여 조건으로 표시한다.
      if (m.key === "plan") {
        m.title = "10월 4~5주차 2차년도 브릿지 참여";
        m.rule = "10월 4~5주차 2차년도 브릿지 참여";
      }
    });
    const achieved = missions.map(m => !!m.achieved);
    const combos = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    const complete = combos.filter(line => line.every(i => achieved[i]));
    const lineCells = new Set(complete.flat());
    this.el("hs-count").textContent = `${achieved.filter(Boolean).length} / 9`;
    this.el("hs-lines").textContent = `${complete.length}줄`;
    const board = this.el("histar-board"); board.innerHTML = "";
    const fmt = (m) => {
      const v = Number(m.current || 0); if (m.unit === "원") return `${Math.round(v).toLocaleString("ko-KR")}원`;
      return `${Number.isInteger(v) ? v : v.toLocaleString("ko-KR")}${m.unit || ""}`;
    };

    // 미달성 카드는 누르기 전에도 "얼마나 더 필요한지" 바로 보여준다.
    // 달성 여부(Y/N)는 기존 백데이터를 그대로 신뢰하고, 부족분만 화면용으로 계산한다.
    const shortfallText = (m) => {
      if (m.achieved) return "";
      const current = Number(m.current || 0);
      const isNew = Number.isFinite(cm) && cm <= 12;
      let goal = null;
      let unit = m.unit || "";

      switch (m.key) {
        case "consent": goal = 5; unit = "건"; break;
        case "design": goal = 20; unit = "건"; break;
        case "targetDb": goal = isNew ? 5 : 70; unit = isNew ? "명" : "%"; break;
        case "weekly": {
          // 하이스타 기준표: 1/2/3주차 누적 기준. 마감 기준일에 맞춰 현재 주차를 선택한다.
          const closing = dateHelper.getClosingDateLabel ? dateHelper.getClosingDateLabel() : "";
          const dayMatch = String(closing).match(/(\d{1,2})일/);
          const day = dayMatch ? Number(dayMatch[1]) : new Date().getDate();
          const week = day <= 7 ? 1 : day <= 14 ? 2 : 3;
          const goals = isNew ? [200000,400000,600000] : [400000,600000,800000];
          goal = goals[week - 1]; unit = "원"; break;
        }
        case "mainProduct": goal = 100000; unit = "원"; break;
        case "plan": return "참여 필요";
        case "week1": goal = Number(m.goal || 0) || 50000; unit = "원"; break;
        case "event": goal = 1; unit = "명"; break;
        case "auto": goal = isNew ? 1 : 2; unit = "건"; break;
        default: return "미달성";
      }
      const gap = Math.max(goal - current, 0);
      if (unit === "원") return `${Math.round(gap).toLocaleString("ko-KR")}원 부족`;
      return `${Number.isInteger(gap) ? gap : gap.toLocaleString("ko-KR")}${unit} 부족`;
    };

    missions.forEach((m,i) => {
      const btn=document.createElement("button"); btn.type="button"; btn.className=`hs-card${m.achieved?' is-achieved':''}${lineCells.has(i)?' is-line':''}`;
      btn.setAttribute("aria-label",`${m.title} 상세 보기`);
      const pending = shortfallText(m);
      btn.innerHTML=`<span class="hs-card-inner"><span class="hs-face hs-front"><span class="hs-num">${i+1}</span><span class="hs-title">${m.title}</span><span class="hs-front-rule-label">조건</span><span class="hs-front-rule">${m.rule || '-'}</span>${m.achieved?'<span class="hs-stamp">완료</span>':`<span class="hs-pending hs-shortfall">부족 · ${pending}</span>`}</span><span class="hs-face hs-back"><span class="hs-back-title">${m.title}</span><span class="hs-current-label">현재 실적</span><span class="hs-current">${fmt(m)}</span><span class="hs-current-label">달성조건</span><span class="hs-rule">${m.rule || '-'}</span></span></span>`;
      btn.addEventListener("click",()=>btn.classList.toggle("is-flipped")); board.appendChild(btn);
    });
    const cel=this.el("histar-celebrate");
    cel.textContent = complete.length ? `★ ${complete.length}줄 HI-STAR 완성!` : achieved.some(Boolean) ? `현재 ${achieved.filter(Boolean).length}개 미션 달성!` : "첫 HI-STAR 스탬프에 도전해보세요!";

    // HI-STAR 시상금: 6줄=5만원, 8줄=10만원. 현재 배치에서 필요한 최소 추가 칸 수를 계산한다.
    const award=this.el("histar-award");
    const currentLines=complete.length;
    const currentAward=currentLines >= 8 ? 100000 : currentLines >= 6 ? 50000 : 0;
    const missing=[];
    achieved.forEach((ok,i)=>{ if(!ok) missing.push(i); });
    const lineCountFor = (extraSet) => combos.filter(line => line.every(i => achieved[i] || extraSet.has(i))).length;
    const minExtraFor = (targetLines) => {
      if(currentLines >= targetLines) return 0;
      for(let k=1;k<=missing.length;k++){
        const choose=(start,picked)=>{
          if(picked.length===k) return lineCountFor(new Set(picked)) >= targetLines ? picked.slice() : null;
          for(let x=start;x<=missing.length-(k-picked.length);x++){
            picked.push(missing[x]); const hit=choose(x+1,picked); picked.pop(); if(hit) return hit;
          }
          return null;
        };
        const hit=choose(0,[]); if(hit) return hit.length;
      }
      return null;
    };
    const n5=minExtraFor(6), n10=minExtraFor(8);
    const won = n => `${n.toLocaleString("ko-KR")}원`;
    let awardHtml='';
    if(currentAward >= 100000){
      awardHtml=`<div class="hs-reward-kicker">💰 예상 시상금</div><div class="hs-reward-earned is-max"><span>현재 확보</span><strong>${won(currentAward)}</strong><em class="hs-reward-bonus">+ 장기신환산 1등급 UP</em></div>`;
    } else if(currentAward >= 50000){
      const next = n10 == null ? '' : `<div class="hs-reward-goal is-primary"><span class="hs-reward-condition">🎯 <b>${n10}칸</b> 추가 달성 시</span><strong>100,000원</strong><em class="hs-reward-bonus">+ 장기신환산 1등급 UP</em></div>`;
      awardHtml=`<div class="hs-reward-kicker">💰 예상 시상금</div><div class="hs-reward-earned"><span>현재 확보</span><strong>${won(currentAward)}</strong><em class="hs-reward-bonus">+ 장기신환산 1등급 UP</em></div>${next ? `<div class="hs-reward-next-label">다음 시상 달성하려면!</div>${next}` : ''}`;
    } else {
      const first = n5 == null ? '' : `<div class="hs-reward-goal is-primary"><span class="hs-reward-condition"><b>${n5}칸</b> 추가 달성 시</span><strong>50,000원</strong><em class="hs-reward-bonus">+ 장기신환산 1등급 UP</em></div>`;
      const second = n10 == null ? '' : `<div class="hs-reward-next-label">다음 시상 달성하려면!</div><div class="hs-reward-goal is-secondary"><span class="hs-reward-condition">🎯 <b>${n10}칸</b> 추가 달성 시</span><strong>100,000원</strong><em class="hs-reward-bonus">+ 장기신환산 1등급 UP</em></div>`;
      awardHtml=`<div class="hs-reward-kicker">💰 예상 시상금</div>${first}${second}`;
    }
    award.innerHTML=awardHtml;
    this.showScreen("histar");
  },

};
