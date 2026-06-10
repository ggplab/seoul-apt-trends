#!/usr/bin/env python3
"""rt.molit.go.kr 조건별 자료제공 CSV → docs/data/transactions_recent.json

국토부 실거래가 공개시스템(https://rt.molit.go.kr/pt/xls/xls.do)에서
'아파트 > 매매 > 서울특별시, 기간 최대 1년'으로 CSV 다운 후 이 스크립트로 변환한다.
(로그인·API 키 불필요 — 공개 다운로드)

원본 특성: CP949 인코딩, 상단 16줄 안내문, 2022 수업 CSV보다 컬럼 추가(동·매수자·매도자·등기일자).
전처리는 2-6-1 노트북과 동일하되, 해제된 거래(해제사유발생일 존재)는 제외한다.

사용법: python3 scripts/prep_recent.py <다운로드.csv>
"""
import csv
import io
import json
import sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "docs" / "data" / "transactions_recent.json"


def category(m2: float) -> str:
    if m2 <= 60:
        return "소형"
    elif m2 <= 85:
        return "중형"
    elif m2 <= 102:
        return "중대형"
    return "대형"


def main() -> None:
    src = Path(sys.argv[1])
    raw = src.read_bytes().decode("cp949")
    # 안내문 스킵: 실제 헤더("NO","시군구",...)부터 시작
    idx = raw.index('"NO"')
    reader = csv.DictReader(io.StringIO(raw[idx:]))

    rows, dropped_na, dropped_cancel = [], 0, 0
    dates = []
    for r in reader:
        cancel = (r.get("해제사유발생일") or "").strip()
        if cancel and cancel != "-":
            dropped_cancel += 1
            continue
        price_raw = (r.get("거래금액(만원)") or "").replace(",", "").strip()
        if not price_raw or price_raw == "-":
            dropped_na += 1
            continue
        price = int(price_raw)
        parts = r["시군구"].split()
        gu, dong = parts[1], parts[2]
        m2 = float(r["전용면적(㎡)"])
        pyeong = round(m2 / 3.3, 2)
        ym = r["계약년월"].strip()
        date = f"{ym[:4]}-{ym[4:6]}-{int(r['계약일']):02d}"
        dates.append(date)
        floor = (r.get("층") or "").strip()
        built = (r.get("건축년도") or "").strip()
        rows.append([
            gu, dong, r["단지명"].strip(), pyeong, price, date,
            int(floor) if floor.lstrip("-").isdigit() and floor != "-" else None,
            int(built) if built.isdigit() else None,
            category(m2),
            round(price / pyeong, 2),
        ])

    out = {
        "columns": ["구", "동", "단지명", "전용면적(평)", "거래금액(만원)",
                     "계약일", "층", "건축년도", "유형", "평당금액"],
        "rows": rows,
        "meta": {
            "source": "국토교통부 실거래가 공개시스템 조건별 자료제공 (rt.molit.go.kr)",
            "period": f"{min(dates)[:7]} ~ {max(dates)[:7]}",
            "region": "서울특별시",
            "total": len(rows),
            "dropped_na": dropped_na,
            "dropped_cancelled": dropped_cancel,
            "downloaded": "2026-06-10",
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    prices = sorted(x[4] for x in rows)
    mid = len(prices) // 2
    print(f"rows={len(rows)} dropped_na={dropped_na} dropped_cancelled={dropped_cancel}")
    print(f"period={out['meta']['period']} mean={sum(prices)/len(prices):.0f} median={prices[mid]}")
    print(f"out={OUT} size={OUT.stat().st_size/1024/1024:.1f}MB")


if __name__ == "__main__":
    main()
