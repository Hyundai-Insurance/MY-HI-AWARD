#!/usr/bin/env python3
from pathlib import Path
import json,sys
ROOT=Path(__file__).resolve().parents[1]
TEST_CODES=['000008','147894']
f=ROOT/'data'/'planners.json'
if not f.exists():
 print('planners.json missing',file=sys.stderr);sys.exit(1)
d=json.loads(f.read_text(encoding='utf-8'))
errors=[]
for c in TEST_CODES:
 rec=d.get(c)
 if not rec: errors.append(f'{c}: missing in planners.json');continue
 if rec.get('october') is None and rec.get('hiStar') is None: errors.append(f'{c}: empty record')
 else: print(f"OK {c}: october={rec.get('october') is not None}, hiStar={rec.get('hiStar') is not None}")
if errors:
 print('\n'.join(errors),file=sys.stderr);sys.exit(1)
print('Validation passed.')
