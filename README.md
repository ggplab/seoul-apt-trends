# seoul-apt-trends

2022년 서울시 아파트 매매 실거래 12,651건을 탐색하는 **인터랙티브 대시보드**.
교육 과정 「2-6-1 [미션] 서울시 아파트 실거래 데이터 분석」 노트북과 동일한
전처리 파이프라인을 웹으로 옮겨, 학생들이 분석 결과를 눈으로 확인할 수 있게 한다.

**Live**: https://ggplab.github.io/seoul-apt-trends/

## 페르소나

> "내 집 마련을 준비 중인 30대 직장인 — 관심 동네의 실거래가 추이를 직접 확인하고 싶다."

- 구/동/면적유형 필터 → 거래건수·평균가·중앙값·평당금액 KPI
- 월별 거래량 + 평당금액 추이 (시장 흐름)
- 구별 평당금액 랭킹 (막대 클릭 = 필터)
- 면적 유형별 비중, 요일별 거래 패턴
- 동별 랭킹 / 최고가 TOP 10 (거래금액순 vs 평당금액순 비교)
- 노트북 마지막 문제(서초구 평당금액 2위 동) 인터랙티브 퀴즈

데이터셋 토글: **📚 2022년(수업 데이터)** ↔ **🔥 최근 1년** — 수업 미션과 현재 시장을 비교할 수 있다.

## 구조

```
docs/                  ← GitHub Pages 루트 (정적 사이트)
  index.html
  app.js               ← vanilla JS + Chart.js + datalabels (CDN)
  style.css
  data/transactions.json         ← 2022 수업 데이터 (12,651건, ~1.2MB)
  data/transactions_recent.json  ← 최근 1년 (74,352건, ~6.9MB / gzip 1.6MB, 토글 시 지연 로드)
scripts/
  prep_data.py         ← 수업 CSV → JSON (노트북과 동일 전처리)
  prep_recent.py       ← rt.molit.go.kr 조건별 자료제공 CSV → JSON (키 불필요)
  fetch_latest.py      ← 공공데이터포털 국토부 API → JSON (서비스키 필요)
```

## 데이터 출처 / 갱신

원천: [국토교통부 아파트 매매 실거래가 상세 자료](https://www.data.go.kr/data/15126469/openapi.do) (공공데이터포털 공개 API)

국토부 API는 브라우저 CORS를 허용하지 않으므로 **빌드 타임에 JSON으로 굽는** 구조다.

**최근 1년 데이터 갱신 (키 불필요, 권장)**:
1. https://rt.molit.go.kr/pt/xls/xls.do 접속 → 아파트·매매·서울특별시 선택 (기간 기본값 = 최근 1년) → CSV 다운
2. `python3 scripts/prep_recent.py <다운로드.csv>`
3. `git add docs/data/transactions_recent.json && git commit -m "data: refresh recent" && git push`

**API로 연도별 갱신 (서비스키 필요)**:
```bash
export MOLIT_API_KEY="<공공데이터포털 서비스키>"
uv venv .venv && source .venv/bin/activate && uv pip install requests
python scripts/fetch_latest.py 2025
```

## 전처리 파이프라인 (노트북 ↔ 동일)

1. 불필요 컬럼 제거 → 2. 시군구 → 구/동 분리 → 3. 전용면적 기준 소형/중형/중대형/대형 분류
4. 계약년월+계약일 → 날짜 → 5. 거래금액 결측 제거(33건) → 6. 콤마 제거·숫자화
7. ㎡ ÷ 3.3 → 평 → 8. 평당금액 = 거래금액 ÷ 평
