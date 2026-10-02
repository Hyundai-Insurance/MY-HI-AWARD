/**
 * dateHelper.js
 * ------------------------------------------------------------------
 * 현재 날짜/월/주차 등을 자동으로 계산하는 함수 모음.
 * 화면에 날짜를 하드코딩하지 않기 위해 모든 로직을 여기로 분리했습니다.
 * ------------------------------------------------------------------
 */

const dateHelper = {

  /** 오늘 날짜 (테스트/디버깅 시 이 함수만 바꾸면 전체 화면에 반영됨) */
  getToday() {
    return new Date();
  },

  /** 현재 월 (1~12) */
  getCurrentMonth(date = this.getToday()) {
    return date.getMonth() + 1;
  },

  /** 현재 몇 주차인지 (해당 월 1일 기준, 7일 단위로 절상) */
  getCurrentWeekOfMonth(date = this.getToday()) {
    return Math.ceil(date.getDate() / 7);
  },

  /**
   * 전일(직전 영업일) 계산
   * - 오늘이 월요일이면 지난 금요일을 반환
   * - 오늘이 일요일이면 지난 금요일을 반환
   * - 그 외에는 단순히 하루 전을 반환
   */
  getPreviousBusinessDate(date = this.getToday()) {
    const d = new Date(date);
    const day = d.getDay(); // 0:일 1:월 ... 6:토

    let daysBack = 1;
    if (day === 1) daysBack = 3;      // 월요일 -> 금요일
    else if (day === 0) daysBack = 2; // 일요일 -> 금요일

    d.setDate(d.getDate() - daysBack);
    return d;
  },

  /** "8월 27일" 형식으로 포맷 */
  formatMonthDay(date) {
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
  },

  /** "8월 4주차 시상 가이드" 문구 생성 */
  getGuideTitle(date = this.getToday()) {
    const month = this.getCurrentMonth(date);
    const week = this.getCurrentWeekOfMonth(date);
    return `${month}월 ${week}주차 시상 가이드`;
  },

  /** "전일 마감 기준 · 8월 27일" 문구 생성 */
  getClosingDateLabel(closingDate = null) {
    // meta.json에 저장된 날짜가 있으면 그 날짜를 그대로 사용합니다.
    // 즉, 데이터가 업데이트되지 않으면 날짜도 바뀌지 않습니다.
    if (closingDate) {
      const parts = String(closingDate).split("-");
      if (parts.length === 3) {
        return `전일 마감 기준 · ${Number(parts[1])}월 ${Number(parts[2])}일`;
      }
    }

    // meta.json이 아직 없는 최초 배포/오류 상황에서만 기존 방식으로 표시합니다.
    const prevBizDate = this.getPreviousBusinessDate(this.getToday());
    return `전일 마감 기준 · ${this.formatMonthDay(prevBizDate)}`;
  },

  /**
   * 매출아너스 3분기(7,8,9월) 카드 중 어떤 달을 강조할지 결정.
   * - 현재 월이 7~9월이면 해당 월을 강조
   * - 3분기가 아니면(예: 다른 달에 접속) 3분기 마지막 달(9월)을 기본 강조
   *   → 향후 분기가 확장되면 CONFIG.AWARD_RULES.honors.quarterMonths 만 수정하면 됨
   */
  getQuarterMonthHighlight(date = this.getToday()) {
    const month = this.getCurrentMonth(date);
    const quarterMonths = CONFIG.AWARD_RULES.honors.quarterMonths;
    if (quarterMonths.includes(month)) return month;
    return quarterMonths[quarterMonths.length - 1];
  },

  /** "○월" 형식 (예: "8월") */
  getMonthLabel(date = this.getToday()) {
    return `${this.getCurrentMonth(date)}월`;
  },
};
