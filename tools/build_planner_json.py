#!/usr/bin/env python3
"""MY HI-AWARD: data/MY_HI_AWARD_DATA.xlsx -> planner JSON shards.

Python standard library only, so GitHub Actions needs no pip install.
Workbook contract (current October operation):
  - sheet 1: '10월'     / row 5 headers / data from row 6
  - sheet 2: '하이스타' / row 6 headers / data from row 7
"""
from pathlib import Path
import zipfile, xml.etree.ElementTree as ET, re, json, shutil, hashlib
from datetime import datetime, timedelta, timezone

ROOT = Path(__file__).resolve().parents[1]
XLSX = ROOT / 'data' / 'MY_HI_AWARD_DATA.xlsx'
OUT = ROOT / 'data' / 'planner'
OLD_SHARDS = ROOT / 'data' / 'planners'
OLD_ALL = ROOT / 'data' / 'planners.json'
META = ROOT / 'data' / 'meta.json'
MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
OFFICE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'


def norm(v):
    s = '' if v is None else str(v).strip().upper()
    if s.endswith('.0') and s[:-2].isdigit():
        s = s[:-2]
    return s.zfill(6) if s.isdigit() else s


def num(v, d=0):
    try:
        x = float(v)
        return int(x) if x.is_integer() else x
    except Exception:
        return d


def ci(ref):
    n = 0
    for ch in re.match(r'([A-Z]+)', ref).group(1):
        n = n * 26 + ord(ch) - 64
    return n - 1


def get(r, i):
    return r[i] if i < len(r) else None


def shared_strings(z):
    ss = []
    if 'xl/sharedStrings.xml' not in z.namelist():
        return ss
    root = ET.fromstring(z.read('xl/sharedStrings.xml'))
    for si in root.findall(f'{{{MAIN}}}si'):
        ss.append(''.join(t.text or '' for t in si.iter(f'{{{MAIN}}}t')))
    return ss


def sheet_targets(z):
    """Map actual workbook sheet names to worksheet XML paths."""
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rel_map = {r.attrib['Id']: r.attrib['Target'] for r in rels.findall(f'{{{PKG_REL}}}Relationship')}
    out = {}
    for s in wb.findall(f'.//{{{MAIN}}}sheets/{{{MAIN}}}sheet'):
        rid = s.attrib[f'{{{OFFICE_REL}}}id']
        target = rel_map[rid].lstrip('/')
        if not target.startswith('xl/'):
            target = 'xl/' + target
        out[s.attrib['name']] = target
    return out


def rows(z, target, shared):
    root = ET.fromstring(z.read(target))
    out = {}
    for row in root.findall(f'.//{{{MAIN}}}sheetData/{{{MAIN}}}row'):
        vals = {}
        for c in row.findall(f'{{{MAIN}}}c'):
            i = ci(c.attrib['r'])
            t = c.attrib.get('t')
            v = c.find(f'{{{MAIN}}}v')
            if t == 'inlineStr':
                q = c.find(f'{{{MAIN}}}is')
                val = ''.join(x.text or '' for x in q.iter(f'{{{MAIN}}}t')) if q is not None else ''
            elif v is None:
                val = None
            else:
                s = v.text
                if t == 's':
                    val = shared[int(s)]
                elif t == 'b':
                    val = (s == '1')
                else:
                    try:
                        val = float(s)
                        val = int(val) if val.is_integer() else val
                    except Exception:
                        val = s
            vals[i] = val
        if vals:
            a = [None] * (max(vals) + 1)
            for i, v in vals.items():
                a[i] = v
            out[int(row.attrib['r'])] = a
    return out


def processing_date_from_october(octr):
    """Use the workbook's processing date so the UI date changes only with data."""
    # Current sheet: row 2 = ['처리일자', 20261001]
    raw = get(octr.get(2, []), 1)
    if raw is not None:
        s = str(raw).strip()
        if s.endswith('.0'):
            s = s[:-2]
        if re.fullmatch(r'\d{8}', s):
            try:
                return datetime.strptime(s, '%Y%m%d').date().isoformat()
            except ValueError:
                pass
    # Fallback only when source file has no usable processing date.
    kst = timezone(timedelta(hours=9))
    return (datetime.now(kst).date() - timedelta(days=1)).isoformat()


def main():
    if not XLSX.exists():
        raise SystemExit(f'Missing: {XLSX}')

    with zipfile.ZipFile(XLSX) as z:
        ss = shared_strings(z)
        targets = sheet_targets(z)
        missing = [name for name in ('10월', '하이스타') if name not in targets]
        if missing:
            raise SystemExit('Missing required sheet(s): ' + ', '.join(missing))
        octr = rows(z, targets['10월'], ss)
        hsr = rows(z, targets['하이스타'], ss)

    data = {}

    # 10월: A 지역단명 / B 영업소명 / C 성명 / D 취급자코드 / E 위촉차월 / F 월납실적
    for rn, r in octr.items():
        if rn < 6:
            continue
        c = norm(get(r, 3))
        if not c:
            continue
        data.setdefault(c, {})['october'] = {
            'region': get(r, 0), 'branch': get(r, 1), 'name': get(r, 2), 'code': c,
            'careerMonth': num(get(r, 4), None), 'monthlyPremium': num(get(r, 5))
        }

    # HI-STAR: row 6 headers, row 7+ planner rows.
    # Each mission uses the workbook's achievement Y/N as the source of truth.
    for rn, r in hsr.items():
        if rn < 7:
            continue
        c = norm(get(r, 4))
        if not c or get(r, 0) in ('회사합계', '합계'):
            continue

        cm = num(get(r, 6), None)
        new = cm is not None and cm <= 12
        def yn(i):
            return str(get(r, i) or '').strip().upper() == 'Y'

        m = {
            'consent': {'key':'consent','title':'설계동의 + 행복보장분석','current':num(get(r,7)),'unit':'건','achieved':yn(8),'rule':'5건 이상'},
            'design': {'key':'design','title':'가입설계','current':num(get(r,9)),'unit':'건','achieved':yn(10),'rule':'보장성 20건'},
            'targetDb': {'key':'targetDb','title':'고객선정' if new else '타겟DB활용','current':num(get(r,11)),'unit':'명' if new else '%','achieved':yn(12),'rule':'집중고객선정 5명' if new else '활용률 70%'},
            'weekly': {'key':'weekly','title':'주차마감','current':num(get(r,13)),'unit':'원','achieved':yn(14),'rule':'1주차 20만원 / 2주차 40만원 / 3주차 60만원 (1차월 80만원 달성 시 인정)' if new else '1주차 40만원 / 2주차 60만원 / 3주차 80만원'},
            'mainProduct': {'key':'mainProduct','title':'주력상품','current':num(get(r,15)),'unit':'원','achieved':yn(16),'rule':'누계 10만원 이상'},
            'plan': {'key':'plan','title':'10월 4~5주차 2차년도 브릿지 참여','current':num(get(r,17)),'unit':'건','achieved':yn(18),'rule':'10월 4~5주차 2차년도 브릿지 참여'},
            'week1': {'key':'week1','title':'1주차 유실적 참여','current':num(get(r,20)),'unit':'원','goal':num(get(r,19)),'achieved':yn(21),'rule':'5만원 참여 (1차월 60만원 달성 시 인정)' if new else '5만원 참여'},
            'event': {'key':'event','title':'입문접수(유치자) or 우수고객초청 행사 참여','current':num(get(r,22)),'unit':'명','achieved':yn(23),'rule':'1명 이상'},
            'auto': {'key':'auto','title':'자동차 / 운전자','current':num(get(r,24)),'unit':'건','achieved':yn(25),'rule':'자동차 1건 or 운전자 1건' if new else '자동차 2건 or 운전자 2건'}
        }
        order = ['design','mainProduct','weekly','plan','consent','auto','week1','event','targetDb']
        data.setdefault(c, {})['hiStar'] = {
            'region': get(r, 1), 'branch': get(r, 2),
            'team': str(get(r, 3)) if get(r, 3) is not None else None,
            'code': c, 'name': get(r, 5), 'careerMonth': cm,
            'missions': [m[k] for k in order],
            'sourceLineCount': num(get(r, 27), 0), 'grade': get(r, 28),
            'joker': str(get(r, 31) or '').strip()
        }

    for c, d in data.items():
        d['code'] = c
        d.setdefault('october', None)
        d.setdefault('hiStar', None)

    # Remove stale generated formats from older versions so they are never deployed.
    shutil.rmtree(OLD_SHARDS, ignore_errors=True)
    try:
        OLD_ALL.unlink()
    except FileNotFoundError:
        pass

    # Fast lookup format: one tiny JSON file per planner, grouped by 3-char prefix.
    # Example: 000008 -> data/planner/000/000008.json
    tmp = OUT.with_name('planner_tmp')
    shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True)
    for c, rec in data.items():
        d = tmp / c[:3]
        d.mkdir(parents=True, exist_ok=True)
        (d / f'{c}.json').write_text(
            json.dumps(rec, ensure_ascii=False, separators=(',', ':')), encoding='utf-8'
        )
    shutil.rmtree(OUT, ignore_errors=True)
    tmp.rename(OUT)

    closing = processing_date_from_october(octr)
    version = hashlib.sha256(XLSX.read_bytes()).hexdigest()[:12]
    META.write_text(json.dumps({
        'closingDate': closing,
        'version': version,
        'plannerCount': len(data),
        'lookupMode': 'per-code-v1'
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Generated {len(data)} per-code planner JSON files.')
    print(f'Closing date from workbook: {closing}')
    print(f'Data version: {version}')

if __name__ == '__main__':
    main()
