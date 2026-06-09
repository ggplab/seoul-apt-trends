#!/usr/bin/env python3
"""seoul_apart_2022.csv → site/data/transactions.json

2-6-1 미션 노트북과 동일한 전처리 파이프라인:
  1. 불필요 컬럼 제거 (해제사유발생일, 중개사소재지, 번지, 본번, 부번, 도로명, 거래유형)
  2. 시군구 → 구 / 동 분리
  3. 전용면적 → 소형/중형/중대형/대형 분류
  4. 계약년월+계약일 → 날짜
  5. 거래금액 결측 행 제거
  6. 거래금액 콤마 제거 → 숫자
  7. 전용면적(㎡) ÷ 3.3 → 전용면적(평)
  8. 평당금액 = 거래금액 ÷ 전용면적(평)

출력 포맷(용량 절약을 위해 컬럼 배열):
  {"columns": [...], "rows": [[...], ...], "meta": {...}}
"""
import csv
import json
import sys
from pathlib import Path

SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(
    "/Users/limjung/Projects/alice-samsung-2606/파이썬실습자료/seoul_apart_2022.csv"
)
OUT = Path(__file__).resolve().parent.parent / "docs" / "data" / "transactions.json"


def category(pyeong_m2: float) -> str:
    if pyeong_m2 <= 60:
        return "소형"
    elif pyeong_m2 <= 85:
        return "중형"
    elif pyeong_m2 <= 102:
        return "중대형"
    return "대형"


def main() -> None:
    rows = []
    dropped_na = 0
    with SRC.open(encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            price_raw = r["거래금액(만원)"].strip()
            if not price_raw:
                dropped_na += 1
                continue
            price = int(price_raw.replace(",", ""))
            parts = r["시군구"].split()
            gu, dong = parts[1], parts[2]
            m2 = float(r["전용면적(㎡)"])
            pyeong = round(m2 / 3.3, 2)
            ym = r["계약년월"].strip()  # YYYYMM
            day = int(r["계약일"])
            date = f"{ym[:4]}-{ym[4:6]}-{day:02d}"
            rows.append([
                gu,
                dong,
                r["단지명"],
                pyeong,
                price,
                date,
                int(r["층"]) if r["층"].strip() else None,
                int(r["건축년도"]) if r["건축년도"].strip() else None,
                category(m2),
                round(price / pyeong, 2),
            ])

    out = {
        "columns": ["구", "동", "단지명", "전용면적(평)", "거래금액(만원)",
                     "계약일", "층", "건축년도", "유형", "평당금액"],
        "rows": rows,
        "meta": {
            "source": "국토교통부 아파트 매매 실거래가 자료 (공공데이터포털 getRTMSDataSvcAptTradeDev)",
            "period": "2022-01 ~ 2022-12",
            "region": "서울특별시",
            "total": len(rows),
            "dropped_na": dropped_na,
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    prices = [r[4] for r in rows]
    prices.sort()
    mid = len(prices) // 2
    median = prices[mid] if len(prices) % 2 else (prices[mid - 1] + prices[mid]) / 2
    print(f"rows={len(rows)} dropped_na={dropped_na}")
    print(f"mean={sum(prices)/len(prices):.1f} median={median}")
    print(f"out={OUT} size={OUT.stat().st_size/1024:.0f}KB")


if __name__ == "__main__":
    main()
