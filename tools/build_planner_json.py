#!/usr/bin/env python3
"""MY HI-UP XLSX -> planner JSON shards. Python standard library only."""
from pathlib import Path
import zipfile, xml.etree.ElementTree as ET, re, json, shutil
from datetime import datetime, timedelta, timezone

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / "data" / "MY_HI_UP_DATA.xlsx"
OUT = ROOT / "data" / "planners"
META = ROOT / "data" / "meta.json"
MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"

def norm_code(v):
    if v is None: return ""
    s = str(v).strip().upper()
    if s.endswith(".0") and s[:-2].isdigit(): s = s[:-2]
    return s.zfill(6) if s.isdigit() else s

def num(v, default=0):
    if v is None or v == "": return default
    try:
        x = float(v)
        return int(x) if x.is_integer() else x
    except Exception:
        return default

def col_idx(ref):
    letters = re.match(r"([A-Z]+)", ref).group(1)
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n - 1

def get(row, idx):
    return row[idx] if idx < len(row) else None

def load_rows(z, sheet_num, shared):
    root = ET.fromstring(z.read(f"xl/worksheets/sheet{sheet_num}.xml"))
    rows = {}
    for row in root.findall(f".//{{{MAIN}}}sheetData/{{{MAIN}}}row"):
        vals = {}
        for c in row.findall(f"{{{MAIN}}}c"):
            idx = col_idx(c.attrib["r"])
            typ = c.attrib.get("t")
            v = c.find(f"{{{MAIN}}}v")
            if typ == "inlineStr":
                node = c.find(f"{{{MAIN}}}is")
                val = "".join(t.text or "" for t in node.iter(f"{{{MAIN}}}t")) if node is not None else ""
            elif v is None:
                val = None
            else:
                txt = v.text
                if typ == "s": val = shared[int(txt)]
                elif typ == "b": val = (txt == "1")
                elif typ == "str": val = txt
                else:
                    try:
                        val = float(txt)
                        if val.is_integer(): val = int(val)
                    except Exception:
                        val = txt
            vals[idx] = val
        if vals:
            arr = [None] * (max(vals) + 1)
            for i, val in vals.items(): arr[i] = val
            rows[int(row.attrib["r"])] = arr
    return rows

def main():
    if not XLSX.exists():
        raise SystemExit(f"Missing: {XLSX}")
    with zipfile.ZipFile(XLSX) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            sr = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in sr.findall(f"{{{MAIN}}}si"):
                shared.append("".join(t.text or "" for t in si.iter(f"{{{MAIN}}}t")))
        p_rows = load_rows(z, 1, shared)
        h_rows = load_rows(z, 2, shared)
        t_rows = load_rows(z, 3, shared)
        hs_rows = load_rows(z, 5, shared)

    data = {}

    for rn, r in p_rows.items():
        if rn < 5: continue
        c = norm_code(get(r, 3))
        if not c: continue
        target = num(get(r, 6))
        rec = {
            "region": get(r,1), "branch": get(r,2), "code": c, "name": get(r,4),
            "careerMonth": num(get(r,5), None),
            "months": {
                "7": {"target":target,"actual":num(get(r,7)),"shortfall":num(get(r,8),None),"award":num(get(r,9)),"flag":num(get(r,17),None)},
                "8": {"target":target,"actual":num(get(r,10)),"shortfall":num(get(r,11),None),"award":num(get(r,12)),"flag":num(get(r,18),None)},
                "9": {"target":target,"actual":num(get(r,13)),"shortfall":num(get(r,14),None),"award":num(get(r,15)),"flag":num(get(r,19),None)}
            }
        }
        data.setdefault(c, {})["personalIncrease"] = rec

    for rn, r in h_rows.items():
        if rn < 5: continue
        c = norm_code(get(r, 4))
        if not c: continue
        rec = {
            "region":get(r,1),"branch":get(r,2),"team":str(get(r,3)) if get(r,3) is not None else None,
            "code":c,"name":get(r,5),"careerMonth":num(get(r,6),None),
            "monthlyPerformance":{"7":num(get(r,8)),"8":num(get(r,9)),"9":num(get(r,10))},
            "averagePerformance":num(get(r,11)),"grade":get(r,12) or "-","awardAmount":num(get(r,13))
        }
        data.setdefault(c, {})["honors"] = rec

    for rn, r in t_rows.items():
        if rn < 5: continue
        c = norm_code(get(r, 3))
        if not c: continue
        note = str(get(r,13) or "").strip()
        rec = {
            "region":get(r,1),"branch":get(r,2),"code":c,"name":get(r,4),"careerMonth":num(get(r,5),None),
            "lifeInsurance":num(get(r,6)),"autoPerformance":num(get(r,7)),"conversionPerformance":num(get(r,8)),
            "incomeProgress":num(get(r,11)),"awardAmount":num(get(r,12)),"prevMonthNote":note,
            "status":"조기 달성" if note else "유지 달성 도전자"
        }
        data.setdefault(c, {})["tcStepUp"] = rec


    # HI-STAR: 7행부터 플래너별 데이터, 4행은 각 미션의 달성조건
    hs_rules = {}
    if 4 in hs_rows:
        rr = hs_rows[4]
        for key, idx in [("consent",7),("design",9),("targetDb",11),("weekly",13),("mainProduct",15),("plan",17),("week1",19),("event",22),("auto",24)]:
            hs_rules[key] = str(get(rr, idx) or "").strip()
    for rn, r in hs_rows.items():
        if rn < 7: continue
        c = norm_code(get(r, 4))
        if not c: continue
        def yn(idx): return str(get(r, idx) or "").strip().upper() == "Y"
        career_month = num(get(r,6), None)
        is_new = career_month is not None and career_month <= 12

        # 백데이터의 열 순서는 "미션 데이터 순서"일 뿐, 실제 3x3 HI-STAR 배치 순서가 아닙니다.
        # 아래 순서는 공식 HI-STAR Plus 빙고판(기존/신인) 배치를 그대로 따릅니다.
        mission_by_key = {
            "consent": {"key":"consent","title":"설계동의 + 행복보장분석","current":num(get(r,7)),"unit":"건","achieved":yn(8),"rule":"5건 이상"},
            "design": {"key":"design","title":"가입설계","current":num(get(r,9)),"unit":"건","achieved":yn(10),"rule":"보장성 20건"},
            "targetDb": {
                "key":"targetDb",
                "title":"고객선정" if is_new else "타겟DB활용",
                "current":num(get(r,11)),
                "unit":"명" if is_new else "%",
                "achieved":yn(12),
                "rule":"집중고객선정 5명" if is_new else "활용률 70%"
            },
            "weekly": {
                "key":"weekly","title":"주차마감","current":num(get(r,13)),"unit":"원","achieved":yn(14),
                "rule":"1주차 20만원 / 2주차 40만원 / 3주차 60만원 (1차월 80만원 달성 시 인정)" if is_new else "1주차 40만원 / 2주차 60만원 / 3주차 80만원"
            },
            "mainProduct": {"key":"mainProduct","title":"주력상품","current":num(get(r,15)),"unit":"원","achieved":yn(16),"rule":"누계 10만원 이상"},
            "plan": {"key":"plan","title":"누구나 '플랜' 참여","current":num(get(r,17)),"unit":"건","achieved":yn(18),"rule":"1건 이상 참여"},
            "week1": {
                "key":"week1","title":"1주차 유실적 참여","current":num(get(r,20)),"unit":"원","goal":num(get(r,19)),"achieved":yn(21),
                "rule":"5만원 참여 (1차월 60만원 달성 시 인정)" if is_new else "5만원 참여"
            },
            "event": {"key":"event","title":"입문접수(유치자) or 우수고객초청 행사참여","current":num(get(r,22)),"unit":"명","achieved":yn(23),"rule":"1명 이상"},
            "auto": {
                "key":"auto","title":"자동차 / 운전자","current":num(get(r,24)),"unit":"건","achieved":yn(25),
                "rule":"자동차 1건 or 운전자 1건" if is_new else "자동차 2건 or 운전자 2건"
            }
        }
        board_order = ["design", "mainProduct", "weekly", "plan", "consent", "auto", "week1", "event", "targetDb"]
        missions = [mission_by_key[key] for key in board_order]
        rec = {"region":get(r,0),"branch":get(r,2),"team":str(get(r,3)) if get(r,3) is not None else None,
               "code":c,"name":get(r,5),"careerMonth":num(get(r,6),None),"missions":missions,
               "sourceLineCount":num(get(r,27),0),"grade":get(r,28),"joker":str(get(r,31) or "").strip()}
        data.setdefault(c, {})["hiStar"] = rec

    for c, rec in data.items():
        rec["code"] = c
        rec.setdefault("personalIncrease", None)
        rec.setdefault("honors", None)
        rec.setdefault("tcStepUp", None)
        rec.setdefault("hiStar", None)

    tmp = OUT.with_name("planners_tmp")
    if tmp.exists(): shutil.rmtree(tmp)
    tmp.mkdir(parents=True)
    prefixes = sorted({c[:3] for c in data})
    for prefix in prefixes:
        shard = {c: data[c] for c in data if c.startswith(prefix)}
        (tmp / f"{prefix}.json").write_text(
            json.dumps(shard, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )
    if OUT.exists(): shutil.rmtree(OUT)
    tmp.rename(OUT)

    # 데이터가 실제로 변환된 시점(KST)의 전일을 마감 기준일로 저장합니다.
    kst = timezone(timedelta(hours=9))
    closing_date = (datetime.now(kst).date() - timedelta(days=1)).isoformat()
    META.write_text(
        json.dumps({"closingDate": closing_date}, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )

    print(f"Generated {len(prefixes)} shards for {len(data)} planner codes.")
    print(f"Closing date: {closing_date}")

if __name__ == "__main__":
    main()
