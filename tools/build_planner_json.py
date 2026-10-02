#!/usr/bin/env python3
from pathlib import Path
import zipfile, xml.etree.ElementTree as ET, re, json, shutil
from datetime import datetime, timedelta, timezone
ROOT=Path(__file__).resolve().parents[1]; XLSX=ROOT/'data'/'MY_HI_AWARD_DATA.xlsx'; OUT=ROOT/'data'/'planners'; META=ROOT/'data'/'meta.json'; MAIN='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
def norm(v):
 s='' if v is None else str(v).strip().upper(); s=s[:-2] if s.endswith('.0') and s[:-2].isdigit() else s; return s.zfill(6) if s.isdigit() else s
def num(v,d=0):
 try:
  x=float(v); return int(x) if x.is_integer() else x
 except: return d
def ci(ref):
 n=0
 for ch in re.match(r'([A-Z]+)',ref).group(1): n=n*26+ord(ch)-64
 return n-1
def get(r,i): return r[i] if i<len(r) else None
def rows(z,n,shared):
 root=ET.fromstring(z.read(f'xl/worksheets/sheet{n}.xml')); out={}
 for row in root.findall(f'.//{{{MAIN}}}sheetData/{{{MAIN}}}row'):
  vals={}
  for c in row.findall(f'{{{MAIN}}}c'):
   i=ci(c.attrib['r']); t=c.attrib.get('t'); v=c.find(f'{{{MAIN}}}v')
   if t=='inlineStr':
    q=c.find(f'{{{MAIN}}}is'); val=''.join(x.text or '' for x in q.iter(f'{{{MAIN}}}t')) if q is not None else ''
   elif v is None: val=None
   else:
    s=v.text
    if t=='s': val=shared[int(s)]
    else:
     try: val=float(s); val=int(val) if val.is_integer() else val
     except: val=s
   vals[i]=val
  if vals:
   a=[None]*(max(vals)+1)
   for i,v in vals.items(): a[i]=v
   out[int(row.attrib['r'])]=a
 return out
def main():
 with zipfile.ZipFile(XLSX) as z:
  ss=[]
  if 'xl/sharedStrings.xml' in z.namelist():
   sr=ET.fromstring(z.read('xl/sharedStrings.xml'))
   for si in sr.findall(f'{{{MAIN}}}si'): ss.append(''.join(t.text or '' for t in si.iter(f'{{{MAIN}}}t')))
  octr=rows(z,1,ss); hsr=rows(z,2,ss)
 data={}
 for rn,r in octr.items():
  if rn<6: continue
  c=norm(get(r,3));
  if not c: continue
  data.setdefault(c,{})['october']={'region':get(r,0),'branch':get(r,1),'name':get(r,2),'code':c,'careerMonth':num(get(r,4),None),'monthlyPremium':num(get(r,5))}
 for rn,r in hsr.items():
  if rn<7: continue
  c=norm(get(r,4));
  if not c or get(r,0) in ('회사합계','합계'): continue
  cm=num(get(r,6),None); new=cm is not None and cm<=12
  def yn(i): return str(get(r,i) or '').strip().upper()=='Y'
  m={
   'consent':{'key':'consent','title':'설계동의 + 행복보장분석','current':num(get(r,7)),'unit':'건','achieved':yn(8),'rule':'5건 이상'},
   'design':{'key':'design','title':'가입설계','current':num(get(r,9)),'unit':'건','achieved':yn(10),'rule':'보장성 20건'},
   'targetDb':{'key':'targetDb','title':'고객선정' if new else '타겟DB활용','current':num(get(r,11)),'unit':'명' if new else '%','achieved':yn(12),'rule':'집중고객선정 5명' if new else '활용률 70%'},
   'weekly':{'key':'weekly','title':'주차마감','current':num(get(r,13)),'unit':'원','achieved':yn(14),'rule':'신인 주차별 기준' if new else '기존 주차별 기준'},
   'mainProduct':{'key':'mainProduct','title':'주력상품','current':num(get(r,15)),'unit':'원','achieved':yn(16),'rule':'누계 10만원 이상'},
   'plan':{'key':'plan','title':"10월 4~5주차 2차년도 브릿지 참여",'current':num(get(r,17)),'unit':'건','achieved':yn(18),'rule':'10월 4~5주차 2차년도 브릿지 참여'},
   'week1':{'key':'week1','title':'1주차 유실적 참여','current':num(get(r,20)),'unit':'원','achieved':yn(21),'rule':'5만원 참여'},
   'event':{'key':'event','title':'입문접수/우수고객 행사','current':num(get(r,22)),'unit':'명','achieved':yn(23),'rule':'1명 이상'},
   'auto':{'key':'auto','title':'자동차 / 운전자','current':num(get(r,24)),'unit':'건','achieved':yn(25),'rule':'자동차/운전자 기준'} }
  order=['design','mainProduct','weekly','plan','consent','auto','week1','event','targetDb']
  data.setdefault(c,{})['hiStar']={'region':get(r,1),'branch':get(r,2),'team':str(get(r,3)) if get(r,3) is not None else None,'code':c,'name':get(r,5),'careerMonth':cm,'missions':[m[k] for k in order],'sourceLineCount':num(get(r,27),0),'grade':get(r,28),'joker':str(get(r,31) or '').strip()}
 for c,d in data.items(): d['code']=c; d.setdefault('october',None); d.setdefault('hiStar',None)
 tmp=OUT.with_name('planners_tmp'); shutil.rmtree(tmp,ignore_errors=True); tmp.mkdir(parents=True)
 for p in sorted({c[:3] for c in data}): (tmp/f'{p}.json').write_text(json.dumps({c:data[c] for c in data if c.startswith(p)},ensure_ascii=False,separators=(',',':')),encoding='utf-8')
 shutil.rmtree(OUT,ignore_errors=True); tmp.rename(OUT)
 kst=timezone(timedelta(hours=9)); META.write_text(json.dumps({'closingDate':(datetime.now(kst).date()-timedelta(days=1)).isoformat()},ensure_ascii=False,indent=2),encoding='utf-8')
 print('Generated',len(data),'planner codes')
if __name__=='__main__': main()
