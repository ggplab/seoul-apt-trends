#!/usr/bin/env python3
"""공공데이터포털 국토교통부 아파트 매매 실거래가 API → docs/data/transactions.json

GitHub Pages는 정적 호스팅이고 국토부 API는 브라우저 CORS를 허용하지 않으므로,
이 스크립트로 빌드 타임에 데이터를 받아 JSON으로 굽는 구조를 사용한다.

사용법:
  1. https://www.data.go.kr/data/15126469/openapi.do 에서 활용신청 → 서비스키 발급
  2. export MOLIT_API_KEY="<일반 인증키(Decoding)>"
  3. uv run python scripts/fetch_latest.py 2024      # 해당 연도 서울 전체 수집
  4. git add docs/data/transactions.json && git commit && git push

의존성: requests (uv pip install requests)
"""
import json
import os
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

import requests

API = "https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev"

# 서울 25개 자치구 법정동코드(앞 5자리)
SEOUL_LAWD = {
    "11110": "종로구", "11140": "중구", "11170": "용산구", "11200": "성동구",
    "11215": "광진구", "11230": "동대문구", "11260": "중랑구", "11290": "성북구",
    "11305": "강북구", "11320": "도봉구", "11350": "노원구", "11380": "은평구",
    "11410": "서대문구", "11440": "마포구", "11470": "양천구", "11500": "강서구",
    "11530": "구로구", "11545": "금천구", "11560": "영등포구", "11590": "동작구",
    "11620": "관악구", "11650": "서초구", "11680": "송파구", "11710": "강동구",
    "11740": "강남구",
}


def category(m2: float) -> str:
    if m2 <= 60:
        return "소형"
    elif m2 <= 85:
        return "중형"
    elif m2 <= 102:
        return "중대형"
    return "대형"


def fetch_month(key: str, lawd: str, ymd: str) -> list:
    items, page = [], 1
    while True:
        r = requests.get(API, params={
            "serviceKey": key, "LAWD_CD": lawd, "DEAL_YMD": ymd,
            "pageNo": page, "numOfRows": 1000,
        }, timeout=30)
        r.raise_for_status()
        root = ET.fromstring(r.text)
        code = root.findtext(".//resultCode", "")
        if code not in ("00", "000"):
            raise RuntimeError(f"API error {code}: {root.findtext('.//resultMsg')}")
        batch = root.findall(".//item")
        items.extend(batch)
        total = int(root.findtext(".//totalCount", "0"))
        if page * 1000 >= total:
            return items
        page += 1


def main() -> None:
    key = os.environ.get("MOLIT_API_KEY")
    if not key:
        sys.exit("MOLIT_API_KEY 환경변수에 공공데이터포털 서비스키를 설정하세요.")
    year = sys.argv[1] if len(sys.argv) > 1 else "2022"

    rows, dropped = [], 0
    for lawd, gu in SEOUL_LAWD.items():
        for m in range(1, 13):
            ymd = f"{year}{m:02d}"
            for it in fetch_month(key, lawd, ymd):
                price_raw = (it.findtext("dealAmount") or "").replace(",", "").strip()
                if not price_raw:
                    dropped += 1
                    continue
                m2 = float(it.findtext("excluUseAr") or 0)
                pyeong = round(m2 / 3.3, 2)
                price = int(price_raw)
                date = f"{it.findtext('dealYear')}-{int(it.findtext('dealMonth')):02d}-{int(it.findtext('dealDay')):02d}"
                rows.append([
                    gu,
                    (it.findtext("umdNm") or "").strip(),
                    (it.findtext("aptNm") or "").strip(),
                    pyeong, price, date,
                    int(it.findtext("floor") or 0) or None,
                    int(it.findtext("buildYear") or 0) or None,
                    category(m2),
                    round(price / pyeong, 2) if pyeong else None,
                ])
            time.sleep(0.2)  # rate limit 배려
        print(f"{gu} 완료 — 누적 {len(rows)}건")

    out_path = Path(__file__).resolve().parent.parent / "docs" / "data" / "transactions.json"
    out = {
        "columns": ["구", "동", "단지명", "전용면적(평)", "거래금액(만원)",
                     "계약일", "층", "건축년도", "유형", "평당금액"],
        "rows": rows,
        "meta": {
            "source": "국토교통부 아파트 매매 실거래가 자료 (공공데이터포털 getRTMSDataSvcAptTradeDev)",
            "period": f"{year}-01 ~ {year}-12",
            "region": "서울특별시",
            "total": len(rows),
            "dropped_na": dropped,
        },
    }
    out_path.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"저장: {out_path} ({len(rows)}건, 결측 제외 {dropped}건)")


if __name__ == "__main__":
    main()
