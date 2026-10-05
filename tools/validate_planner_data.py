#!/usr/bin/env python3
from pathlib import Path
import json, sys
ROOT=Path(__file__).resolve().parents[1]
TEST_CODES=['000008','147894','952232']
base=ROOT/'data'/'planner'
errors=[]
for c in TEST_CODES:
    f=base/c[:3]/f'{c}.json'
    if not f.exists():
        errors.append(f'{c}: missing {f.relative_to(ROOT)}')
        continue
    rec=json.loads(f.read_text(encoding='utf-8'))
    if rec.get('code') != c:
        errors.append(f'{c}: code mismatch')
    elif rec.get('october') is None and rec.get('hiStar') is None:
        errors.append(f'{c}: empty record')
    else:
        print(f"OK {c}: october={rec.get('october') is not None}, hiStar={rec.get('hiStar') is not None}, bytes={f.stat().st_size}")
if errors:
    print('\n'.join(errors), file=sys.stderr)
    sys.exit(1)
count=sum(1 for _ in base.rglob('*.json'))
meta=json.loads((ROOT/'data'/'meta.json').read_text(encoding='utf-8'))
expected=int(meta.get('plannerCount',0))
if count != expected:
    print(f'planner file count mismatch: {count} != {expected}', file=sys.stderr)
    sys.exit(1)
print(f'Validation passed. {count} planner files.')
