#!/usr/bin/env python3
"""Validate generated per-planner records for the two-sheet workbook."""
from pathlib import Path
import json, sys
ROOT=Path(__file__).resolve().parents[1]
base=ROOT/'data'/'planner'
meta_path=ROOT/'data'/'meta.json'
errors=[]
if not meta_path.exists():
    sys.exit('Missing data/meta.json; build data first.')
meta=json.loads(meta_path.read_text(encoding='utf-8'))
files=list(base.rglob('*.json'))
expected=int(meta.get('plannerCount',0))
if not files or len(files)!=expected:
    errors.append(f'planner file count mismatch: {len(files)} != {expected}')
hs=hp=0
for f in files:
    try:
        rec=json.loads(f.read_text(encoding='utf-8'))
    except (ValueError, OSError) as exc:
        errors.append(f'{f}: unreadable ({exc})'); continue
    code=f.stem
    if rec.get('code')!=code or f.parent.name!=code[:3]:
        errors.append(f'{code}: code/path mismatch')
    if not (rec.get('hiStar') or rec.get('hiPoint')):
        errors.append(f'{code}: no HI-STAR or HI-POINT data')
    hs+=bool(rec.get('hiStar'))
    hp+=bool(rec.get('hiPoint'))
if not hs or not hp:
    errors.append(f'Missing HI-STAR or HI-POINT records (HI-STAR={hs}, HI-POINT={hp})')
if errors:
    print('\n'.join(errors[:30]),file=sys.stderr)
    sys.exit(1)
print(f'Validation passed: {len(files)} planner files; HI-STAR={hs}, HI-POINT={hp}')
