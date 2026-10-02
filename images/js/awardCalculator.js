const awardCalculator = {
  _getNormalSeptemberAward(piRow) {
    const sep = piRow?.months?.[9] || {};
    const explicitAward = Number(sep.award) || 0;
    if (explicitAward > 0) return explicitAward;

    // 9월 미달성자는 백데이터 시상금이 0원이므로,
    // "목표를 딱 달성한다"고 가정한 정상(100%) 시상금을 목표금액 기준으로 계산한다.
    // 기존 7·8월 백데이터의 정상 시상 구간과 동일:
    // 40만 이상 5만 / 60만 이상 7만 / 80만 이상 10만 / 100만 이상 15만.
    const target = Number(sep.target) || 0;
    if (target >= 1000000) return 150000;
    if (target >= 800000) return 100000;
    if (target >= 600000) return 70000;
    if (target >= 400000) return 50000;
    return 0;
  },

  calculatePersonalIncreaseAward(piRow, month) {
    if (!piRow) {
      return {
        month, targetAmount: 0, actualAmount: 0, shortfall: 0,
        achieved: false, awardAmount: 0,
        currentSecuredAmount: 0, septemberExpectedAmount: 0,
        totalAwardAmount: 0, showSeptemberForecast: false,
        septemberMultiplier: 1, forecastNote: "",
        monthStatuses: {}, monthAwards: {}
      };
    }

    const monthData = piRow.months[month] || { target: 0, actual: 0, shortfall: 0, award: 0, flag: null };
    const jul = piRow.months[7] || {};
    const aug = piRow.months[8] || {};
    const sep = piRow.months[9] || {};

    const julAchieved = jul.flag === 1;
    const augAchieved = aug.flag === 1;
    const sepAchieved = sep.flag === 1;
    const consecutiveEligible = julAchieved && augAchieved;

    const julAward = julAchieved ? (Number(jul.award) || 0) : 0;
    const augAward = augAchieved ? (Number(aug.award) || 0) : 0;
    const sepActualAward = sepAchieved ? (Number(sep.award) || 0) : 0;
    const currentSecuredAmount = julAward + augAward;

    const multiplier = CONFIG.AWARD_RULES.personalIncrease.september200Multiplier || 2;
    const normalSeptemberAward = this._getNormalSeptemberAward(piRow);

    // 모든 개인환산 대상자에게 "9월 달성 시" 예상 영역을 보여준다.
    // ① 7·8월 모두 달성: 기존 정책 유지 → 미달성 시 8월 시상금 × 200%,
    //    실제 9월 달성 시 실제 9월 시상금 × 200%.
    // ② 7·8월 중 1회 달성 또는 모두 미달성: 9월 정상 시상금 100% 적용.
    let septemberExpectedAmount = 0;
    let septemberMultiplier = 1;

    if (consecutiveEligible) {
      septemberMultiplier = multiplier;
      septemberExpectedAmount = sepAchieved
        ? sepActualAward * multiplier
        : augAward * multiplier;
    } else {
      septemberExpectedAmount = sepAchieved
        ? sepActualAward
        : normalSeptemberAward;
    }

    const totalAwardAmount = currentSecuredAmount + septemberExpectedAmount;

    const monthAwards = {
      7: julAward,
      8: augAward,
      // 월별 현황 카드는 실제 달성 상태만 표시한다. 미달성이면 0원.
      9: sepAchieved
        ? (consecutiveEligible ? sepActualAward * multiplier : sepActualAward)
        : 0,
    };

    const forecastNote = consecutiveEligible
      ? "7·8월 연속 달성 기준, 9월 달성 시 200%를 적용한 예상 금액입니다."
      : "7·8월 달성 여부와 관계없이, 9월 목표 달성 시 정상 시상금(100%)을 반영한 예상 금액입니다.";

    return {
      month,
      targetAmount: Number(monthData.target) || 0,
      actualAmount: Number(monthData.actual) || 0,
      shortfall: monthData.shortfall !== null && monthData.shortfall !== undefined
        ? Math.max(-(Number(monthData.shortfall) || 0), 0)
        : Math.max((Number(monthData.target) || 0) - (Number(monthData.actual) || 0), 0),
      achieved: monthData.flag === 1,
      awardAmount: Number(monthData.award) || 0,
      currentSecuredAmount,
      septemberExpectedAmount,
      totalAwardAmount,
      showSeptemberForecast: true,
      septemberMultiplier,
      forecastNote,
      monthStatuses: {
        7: julAchieved ? "달성" : "미달성",
        8: augAchieved ? "달성" : "미달성",
        9: sepAchieved ? "달성" : "미달성",
      },
      monthAwards,
    };
  },

  getHonorsResult(honorsRow) {
    const tiers = [
      { grade: "프라임Ⅰ", threshold: 500000, award: 300000 },
      { grade: "프라임Ⅱ", threshold: 700000, award: 500000 },
      { grade: "프레스티지Ⅰ", threshold: 1000000, award: 700000 },
      { grade: "프레스티지Ⅱ", threshold: 1500000, award: 1000000 },
      { grade: "마스터Ⅰ", threshold: 2000000, award: 1500000 },
      { grade: "마스터Ⅱ", threshold: 3000000, award: 2500000 },
      { grade: "마스터Ⅲ", threshold: 4000000, award: 4000000 },
      { grade: "서밋", threshold: 5000000, award: 5000000 },
    ];

    if (!honorsRow) {
      return {
        monthlyPerformance: { 7: 0, 8: 0, 9: 0 }, averagePerformance: 0,
        grade: "-", awardAmount: 0, nextGrade: "프라임Ⅰ", nextAwardAmount: 300000,
        additionalPerformanceNeeded: 1500000, additionalRewardAmount: 300000, isTopTier: false,
      };
    }

    const monthlyPerformance = honorsRow.monthlyPerformance || { 7: 0, 8: 0, 9: 0 };
    const totalPerformance = [7, 8, 9].reduce((sum, m) => sum + (Number(monthlyPerformance[m]) || 0), 0);
    const averagePerformance = totalPerformance / 3;
    let currentTier = null;
    tiers.forEach((tier) => { if (averagePerformance >= tier.threshold) currentTier = tier; });
    const currentIndex = currentTier ? tiers.indexOf(currentTier) : -1;
    const nextTier = tiers[currentIndex + 1] || null;

    return {
      ...honorsRow,
      monthlyPerformance,
      averagePerformance,
      grade: currentTier?.grade || "미달성",
      awardAmount: currentTier?.award || 0,
      nextGrade: nextTier?.grade || null,
      nextAwardAmount: nextTier?.award || 0,
      nextAverageThreshold: nextTier?.threshold || null,
      additionalPerformanceNeeded: nextTier ? Math.max((nextTier.threshold * 3) - totalPerformance, 0) : 0,
      additionalRewardAmount: nextTier ? Math.max(nextTier.award - (currentTier?.award || 0), 0) : 0,
      isTopTier: !nextTier && !!currentTier,
    };
  },

  getTCStepUpResult(tcRow) {
    if (!tcRow) return { eligible: false };

    const status = String(tcRow.status || "").replace(/\s+/g, " ");
    const isEarly = status.includes("조기") && status.includes("달성");
    const isMaintain = status.includes("유지") && status.includes("도전자");

    return {
      eligible: true,
      ...tcRow,
      isEarly,
      isMaintain,
      rewardText: isEarly
        ? "금 반돈 (500,000원)"
        : isMaintain
          ? "금 반돈 (500,000원) 도전!"
          : "해당 없음",
      confirmedGoldAmount: isEarly ? CONFIG.AWARD_RULES.tcStepUp.goldHalfDonAmount : 0,
    };
  },

  calculateTotalSummary(piResult, honorsResult, tcResult) {
    const cashTotal = (piResult.totalAwardAmount || 0) + (honorsResult.awardAmount || 0);
    return {
      cashTotal,
      tcEligible: !!tcResult.eligible,
      tcEarly: !!tcResult.isEarly,
      tcMaintain: !!tcResult.isMaintain,
      tcRewardText: tcResult.eligible ? tcResult.rewardText : "",
    };
  },
};
