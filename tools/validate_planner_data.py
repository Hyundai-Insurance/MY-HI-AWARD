#!/usr/bin/env python3
from pathlib import Path
import json, sys
ROOT=Path(__file__).resolve().parents[1]
TEST_CODES=['000008','147894']
errors=[]
for c in TEST_CODES:
    f=ROOT/'data'/'planners'/f'{c[:3]}.json'
    if not f.exists():
        errors.append(f'{c}: shard missing ({f.name})'); continue
    d=json.loads(f.read_text(encoding='utf-8'))
    if c not in d:
        errors.append(f'{c}: code missing in {f.name}'); continue
    rec=d[c]
    if rec.get('october') is None and rec.get('hiStar') is None:
        errors.append(f'{c}: empty record')
    else:
        print(f"OK {c}: october={rec.get('october') is not None}, hiStar={rec.get('hiStar') is not None}")
if errors:
    print('\n'.join(errors), file=sys.stderr); sys.exit(1)
print('Validation passed.')
