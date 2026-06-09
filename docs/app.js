/* 서울 아파트 실거래 추이 대시보드
 * 데이터: docs/data/transactions.json (2-6-1 미션 노트북과 동일 전처리)
 * 컬럼: [구, 동, 단지명, 전용면적(평), 거래금액(만원), 계약일, 층, 건축년도, 유형, 평당금액]
 */
(async function () {
  const res = await fetch("data/transactions.json");
  const { rows, meta } = await res.json();

  const GU = 0, DONG = 1, APT = 2, PYEONG = 3, PRICE = 4, DATE = 5, FLOOR = 6, BUILT = 7, TYPE = 8, PPP = 9;
  const TYPES = ["소형", "중형", "중대형", "대형"];
  const TYPE_COLORS = { 소형: "#60a5fa", 중형: "#2f6fed", 중대형: "#1b2a4a", 대형: "#f59e0b" };
  const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
  const DOW = ["월", "화", "수", "목", "금", "토", "일"];

  // ---- 상태 ----
  const state = { gu: "", dong: "", types: new Set(TYPES), topSort: PRICE };

  // ---- 포맷터 ----
  const comma = (n) => Math.round(n).toLocaleString("ko-KR");
  const eok = (manwon) => {
    const e = manwon / 10000;
    return e >= 1 ? `${e.toFixed(e >= 10 ? 1 : 2)}억` : `${comma(manwon)}만원`;
  };

  // ---- 필터 ----
  function filtered() {
    return rows.filter((r) =>
      (!state.gu || r[GU] === state.gu) &&
      (!state.dong || r[DONG] === state.dong) &&
      state.types.has(r[TYPE])
    );
  }

  // ---- 셀렉트 초기화 ----
  const guSel = document.getElementById("guSelect");
  const dongSel = document.getElementById("dongSelect");
  const gus = [...new Set(rows.map((r) => r[GU]))].sort((a, b) => a.localeCompare(b, "ko"));
  gus.forEach((g) => guSel.add(new Option(g, g)));

  function syncDongOptions() {
    dongSel.innerHTML = '<option value="">전체</option>';
    if (!state.gu) { dongSel.disabled = true; return; }
    dongSel.disabled = false;
    [...new Set(rows.filter((r) => r[GU] === state.gu).map((r) => r[DONG]))]
      .sort((a, b) => a.localeCompare(b, "ko"))
      .forEach((d) => dongSel.add(new Option(d, d)));
  }

  guSel.addEventListener("change", () => { state.gu = guSel.value; state.dong = ""; syncDongOptions(); render(); });
  dongSel.addEventListener("change", () => { state.dong = dongSel.value; render(); });

  document.querySelectorAll("#typeChips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const t = chip.dataset.type;
      if (state.types.has(t) && state.types.size === 1) return; // 최소 1개 유지
      state.types.has(t) ? state.types.delete(t) : state.types.add(t);
      chip.classList.toggle("active");
      render();
    });
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    state.gu = ""; state.dong = ""; state.types = new Set(TYPES);
    guSel.value = ""; syncDongOptions();
    document.querySelectorAll("#typeChips .chip").forEach((c) => c.classList.add("active"));
    render();
  });

  // ---- 차트 공통 ----
  Chart.register(ChartDataLabels);
  Chart.defaults.font.family = '"Pretendard", sans-serif';
  Chart.defaults.color = "#6b7589";
  Chart.defaults.set("plugins.datalabels", { display: false }); // 차트별 명시 설정만 표시

  const monthlyChart = new Chart(document.getElementById("monthlyChart"), {
    data: {
      labels: MONTHS.map((m) => `${m}월`),
      datasets: [
        { type: "bar", label: "거래량(건)", data: [], backgroundColor: "#c7d7f8", yAxisID: "y", order: 2, borderRadius: 4,
          datalabels: { display: true, anchor: "center", align: "center", color: "#3552a0", font: { size: 10, weight: 700 }, formatter: (v) => comma(v) } },
        { type: "line", label: "평균 평당금액(만원)", data: [], borderColor: "#f59e0b", backgroundColor: "#f59e0b", yAxisID: "y2", order: 1, tension: 0.3, pointRadius: 4,
          datalabels: { display: true, offset: 8, color: "#d97706", font: { size: 10.5, weight: 700 },
            align: (ctx) => {
              const vals = ctx.dataset.data.filter((x) => x != null);
              const min = Math.min(...vals), max = Math.max(...vals);
              const v = ctx.dataset.data[ctx.dataIndex];
              return v != null && v < min + 0.15 * (max - min) ? "bottom" : "top"; // 바닥권 포인트는 아래로 — 막대 라벨과 충돌 회피
            },
            backgroundColor: "rgba(255,255,255,.75)", borderRadius: 4, padding: { top: 2, bottom: 1, left: 3, right: 3 },
            formatter: (v) => (v == null ? "" : comma(v)) } },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        y: { position: "left", title: { display: true, text: "거래량(건)" }, grid: { color: "#eef1f6" }, grace: "12%" },
        y2: { position: "right", title: { display: true, text: "평당금액(만원)" }, grid: { drawOnChartArea: false }, grace: "15%" },
      },
      plugins: { legend: { position: "top" } },
    },
  });

  const guChart = new Chart(document.getElementById("guChart"), {
    type: "bar",
    data: { labels: [], datasets: [{ label: "평균 평당금액(만원)", data: [], backgroundColor: [], borderRadius: 4 }] },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      scales: { x: { grid: { color: "#eef1f6" }, grace: "12%" }, y: { grid: { display: false } } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => ` ${comma(c.parsed.x)} 만원/평` } },
        datalabels: { display: true, anchor: "end", align: "end", offset: 2, color: "#3c465c", font: { size: 10.5 }, formatter: (v) => comma(v) },
      },
      onClick: (_, els) => {
        if (!els.length) return;
        const gu = guChart.data.labels[els[0].index];
        state.gu = state.gu === gu ? "" : gu;
        state.dong = "";
        guSel.value = state.gu;
        syncDongOptions();
        render();
      },
      onHover: (e, els) => { e.native.target.style.cursor = els.length ? "pointer" : "default"; },
    },
  });

  const typeChart = new Chart(document.getElementById("typeChart"), {
    type: "doughnut",
    data: { labels: TYPES, datasets: [{ data: [], backgroundColor: TYPES.map((t) => TYPE_COLORS[t]), borderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "52%",
      plugins: {
        legend: { position: "right" },
        tooltip: { callbacks: { label: (c) => ` ${c.label}: ${comma(c.parsed)}건 (${(c.parsed / c.dataset.data.reduce((a, b) => a + b, 0) * 100).toFixed(1)}%)` } },
        datalabels: {
          display: (ctx) => {
            const data = ctx.dataset.data;
            const total = data.reduce((a, b) => a + b, 0);
            return total > 0 && data[ctx.dataIndex] / total >= 0.05; // 5% 미만 조각은 라벨 생략
          },
          color: "#fff",
          font: { size: 11, weight: 700 },
          formatter: (v, ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            return `${(v / total * 100).toFixed(1)}%\n${comma(v)}건`;
          },
          textAlign: "center",
        },
      },
    },
  });

  const dowChart = new Chart(document.getElementById("dowChart"), {
    type: "bar",
    data: { labels: DOW, datasets: [{ label: "거래량(건)", data: [], backgroundColor: DOW.map((d) => (d === "토" || d === "일" ? "#f59e0b" : "#2f6fed")), borderRadius: 4 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { y: { grid: { color: "#eef1f6" }, grace: "12%" }, x: { grid: { display: false } } },
      plugins: {
        legend: { display: false },
        datalabels: { display: true, anchor: "end", align: "end", offset: -2, color: "#3c465c", font: { size: 11, weight: 600 }, formatter: (v) => comma(v) },
      },
    },
  });

  // ---- 렌더 ----
  function render() {
    const data = filtered();

    // KPI
    document.getElementById("kpiCount").textContent = comma(data.length);
    if (data.length) {
      const prices = data.map((r) => r[PRICE]);
      const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
      const sorted = [...prices].sort((a, b) => a - b);
      const mid = sorted.length >> 1;
      const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      const pppMean = data.reduce((a, r) => a + r[PPP], 0) / data.length;
      document.getElementById("kpiMean").textContent = eok(mean);
      document.getElementById("kpiMedian").textContent = eok(median);
      document.getElementById("kpiPyeong").textContent = comma(pppMean);
    } else {
      ["kpiMean", "kpiMedian", "kpiPyeong"].forEach((id) => (document.getElementById(id).textContent = "—"));
    }

    // 월별
    const byMonth = MONTHS.map(() => ({ n: 0, ppp: 0 }));
    data.forEach((r) => {
      const m = +r[DATE].slice(5, 7) - 1;
      byMonth[m].n++; byMonth[m].ppp += r[PPP];
    });
    monthlyChart.data.datasets[0].data = byMonth.map((o) => o.n);
    monthlyChart.data.datasets[1].data = byMonth.map((o) => (o.n ? +(o.ppp / o.n).toFixed(0) : null));
    monthlyChart.update();

    // 구별 (유형 필터만 적용 — 전체 비교 유지)
    const guData = rows.filter((r) => state.types.has(r[TYPE]));
    const guAgg = {};
    guData.forEach((r) => {
      (guAgg[r[GU]] ??= { n: 0, ppp: 0 });
      guAgg[r[GU]].n++; guAgg[r[GU]].ppp += r[PPP];
    });
    const guRank = Object.entries(guAgg)
      .map(([g, o]) => [g, o.ppp / o.n])
      .sort((a, b) => b[1] - a[1]);
    guChart.data.labels = guRank.map((x) => x[0]);
    guChart.data.datasets[0].data = guRank.map((x) => +x[1].toFixed(0));
    guChart.data.datasets[0].backgroundColor = guRank.map((x) => (x[0] === state.gu ? "#f59e0b" : "#2f6fed"));
    guChart.update();

    // 유형 비중
    const typeCount = TYPES.map((t) => data.filter((r) => r[TYPE] === t).length);
    typeChart.data.datasets[0].data = typeCount;
    typeChart.update();

    // 요일별
    const dowCount = [0, 0, 0, 0, 0, 0, 0];
    data.forEach((r) => { dowCount[(new Date(r[DATE]).getDay() + 6) % 7]++; });
    dowChart.data.datasets[0].data = dowCount;
    dowChart.update();

    // 동별 랭킹
    const dongAgg = {};
    data.forEach((r) => {
      const k = r[GU] + "|" + r[DONG];
      (dongAgg[k] ??= { n: 0, ppp: 0 });
      dongAgg[k].n++; dongAgg[k].ppp += r[PPP];
    });
    const dongRank = Object.entries(dongAgg)
      .map(([k, o]) => ({ gu: k.split("|")[0], dong: k.split("|")[1], avg: o.ppp / o.n, n: o.n }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 30);
    document.getElementById("dongRankTitle").textContent =
      (state.gu ? `${state.gu} ` : "서울 전체 ") + "동별 평당금액 랭킹";
    document.querySelector("#dongTable tbody").innerHTML = dongRank
      .map((d, i) => `<tr><td>${i + 1}</td><td>${d.gu}</td><td><strong>${d.dong}</strong></td><td class="num">${comma(d.avg)} 만원/평</td><td class="num">${comma(d.n)}건</td></tr>`)
      .join("");

    // TOP 10
    const top = [...data].sort((a, b) => b[state.topSort] - a[state.topSort]).slice(0, 10);
    document.querySelector("#topTable tbody").innerHTML = top
      .map((r, i) => `<tr><td>${i + 1}</td><td><strong>${r[APT]}</strong><br><span class="sub">${r[BUILT] ?? "?"}년 · ${r[FLOOR] ?? "?"}층 · ${r[DATE]}</span></td><td>${r[GU]} ${r[DONG]}</td><td class="num">${r[PYEONG]}</td><td class="num"><strong>${eok(r[PRICE])}</strong></td><td class="num">${comma(r[PPP])}</td></tr>`)
      .join("");
  }

  // TOP 10 정렬 토글
  const sortPrice = document.getElementById("sortPrice");
  const sortPyeong = document.getElementById("sortPyeong");
  sortPrice.addEventListener("click", () => { state.topSort = PRICE; sortPrice.classList.add("active"); sortPyeong.classList.remove("active"); render(); });
  sortPyeong.addEventListener("click", () => { state.topSort = PPP; sortPyeong.classList.add("active"); sortPrice.classList.remove("active"); render(); });

  // ---- 퀴즈 (서초구 평당금액 2위 동) ----
  (function buildQuiz() {
    const agg = {};
    rows.filter((r) => r[GU] === "서초구").forEach((r) => {
      (agg[r[DONG]] ??= { n: 0, ppp: 0 });
      agg[r[DONG]].n++; agg[r[DONG]].ppp += r[PPP];
    });
    const rank = Object.entries(agg)
      .map(([d, o]) => [d, o.ppp / o.n])
      .sort((a, b) => b[1] - a[1]);
    const answer = rank[1][0];
    const options = rank.slice(0, 4).map((x) => x[0]).sort(() => 0.5 - ((Date.now() % 7) / 7)); // 가벼운 셔플
    const wrap = document.getElementById("quizOptions");
    const result = document.getElementById("quizResult");
    options.forEach((d) => {
      const btn = document.createElement("button");
      btn.textContent = d;
      btn.addEventListener("click", () => {
        wrap.querySelectorAll("button").forEach((b) => b.classList.remove("correct", "wrong"));
        if (d === answer) {
          btn.classList.add("correct");
          result.textContent = `정답! 서초구 평당금액 1위는 ${rank[0][0]}(${comma(rank[0][1])}만원/평), 2위가 ${answer}(${comma(rank[1][1])}만원/평)입니다. ans1 = "${answer}"`;
          result.style.color = "#16a34a";
        } else {
          btn.classList.add("wrong");
          result.textContent = "다시 생각해보세요 — 위 랭킹 표에서 구 필터를 '서초구'로 바꿔보면 힌트가 보입니다.";
          result.style.color = "#dc2626";
        }
      });
      wrap.appendChild(btn);
    });
  })();

  document.getElementById("heroCount").textContent = comma(meta.total);
  syncDongOptions();
  render();
})();
