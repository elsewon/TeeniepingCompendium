/* ===== 티니핑 도감 방문·공유·좋아요 카운터 =====
 *
 * GitHub Pages 는 정적 호스팅이라 서버가 방문을 셀 수 없다. 그래서 세는 일만
 * Cloudflare Worker 에 맡기고, 사이트는 이 Worker 를 불러 숫자를 받아 온다.
 *
 * 저장은 Durable Object 를 쓴다. Workers KV 는 무료 한도가 하루 쓰기 1,000 회이고
 * 전역 반영에 최대 1분이 걸려 실시간 표시에 맞지 않는다. Durable Object 는
 * 무료 플랜에서도 하루 10만 행을 쓸 수 있고, 한 객체 안에서 요청이 차례로
 * 처리되어 센 값이 곧바로 정확하게 읽힌다.
 *
 * ── 영역별로 따로 센다 ────────────────────────────────
 *   list          목록 페이지        방문(세션) · 공유, 오늘/누적
 *   quiz          이름 맞추기        방문(세션) · 공유, 오늘/누적 + 난도별 도전
 *   rank          인기 차트          방문(세션) · 공유, 오늘/누적
 *
 * 통계 그래프(stats.html)는 세지 않는다 — 통계를 보는 행위까지 통계에 섞이지 않도록.
 *   page:<id>     개별 티니핑        방문(세션) · 공유 · 좋아요, 누적 + 주간 + 월간
 *
 * 좋아요는 개별 티니핑에만 있다. 방문·공유와 달리 사람이 스스로 누르는 값이라
 * 브라우저(localStorage)에 표시를 남겨 한 기기당 한 마리에 한 번만 오른다.
 * 되돌리는 길은 두지 않았다 — 빼는 요청을 받으면 남의 숫자를 깎는 데 쓰일 수 있다.
 *
 * 방문은 모두 세션(탭) 단위로, 세는 쪽이 아니라 브라우저(js/stats.js)가 걸러 보낸다.
 * 개별 티니핑은 마리마다 따로 세므로 한 세션에서 여러 마리를 보면 각각 1 씩 오른다.
 *
 * 영역끼리는 서로 더하거나 빼지 않는 독립된 숫자다. 목록의 방문은 목록에 들어온
 * 횟수지 사이트 전체 합계가 아니다.
 *
 * 티니핑별은 기간 열쇠를 따로 쌓아 순위를 뽑는다.
 *   page:<id>:<kind>            누적
 *   d:<YYYY-MM-DD>:<id>:<kind>   오늘
 *   w:<그 주 월요일>:<id>:<kind>   주간
 *   m:<YYYY-MM>:<id>:<kind>      월간
 * 열쇠는 실제로 본 티니핑에만 생긴다 — 하루에 몇 마리를 봤느냐만큼만 늘어난다.
 * 순위를 뽑을 때 기간 접두어만 훑으면 되므로 한 번에 314 개(157 × 2)만 읽는다.
 *
 * ── API ──────────────────────────────────────────
 *   POST /hit?type=visit|share&scope=list|quiz|rank|page[&page=<id>]
 *   POST /hit?type=like&scope=page&page=<id>          좋아요 한 번 (개별 티니핑만)
 *   POST /hit?type=mode&mode=easy|normal|hard        난도별 도전 한 번
 *        주간·월간으로만 쌓는다 (누적은 화면에서 쓰지 않아 세지 않는다)
 *   POST /hit?type=ref&host=<주소>                   방문 경로 (세션당 한 번)
 *   GET  /refs?days=7[&limit=20]                     방문 경로 목록 (많은 순)
 *        달력이 아니라 **최근 N일** 이다 (1~400). 날짜별로만 쌓아 두고
 *        조회할 때 구간을 합치므로 화면에서 기간을 자유롭게 고를 수 있다.
 *   GET  /stats[?page=<id>]                          세지 않고 읽기만
 *   GET  /series[?days=30]                           날짜별 추이 (2~400일)
 *   GET  /rank?period=day|week|month[&at=<기간>][&limit=10]
 *        방문·공유·좋아요 순위를 함께 돌려준다 (한 번 훑어 세 번 줄 세운다).
 *        같은 값이면 같은 순위를 주고, 그 안에서 놓을 차례는 종합 점수로 가른다
 *        (좋아요 10 · 공유 5 · 조회 1 — 위의 SCORE).
 *        직전 기간 순위도 같이 계산해 각 줄에 delta(오르내림)를 붙인다.
 *        at 을 주면 그 기간을 본다 (주 = 그 주 월요일 YYYY-MM-DD, 월 = YYYY-MM).
 *        없으면 이번 기간. 응답의 now 로 "지금이 어느 기간인지" 도 함께 알려 준다.
 *
 * 배포는 README 의 "방문·공유 통계" 절 참고.
 */

const SCOPES = ["list", "quiz", "rank"];
const MODES = ["easy", "normal", "hard"];
/* 개별 티니핑에 쌓는 값. 목록·퀴즈·순위에는 좋아요가 없다(누를 대상이 없다). */
const PAGE_KINDS = ["visit", "share", "like"];

/* 같은 값끼리 놓을 차례를 정하는 종합 점수. 들인 수고만큼 점수를 준다 —
   조회는 페이지를 열기만 해도 오르고, 공유는 링크를 보내야 하고,
   좋아요는 기기당 한 번뿐이라 가장 진심에 가깝다.
   순위 숫자에는 넣지 않는다. 그 차트가 세우는 기준(좋아요면 좋아요)만 순위를 정하고,
   이 점수는 그 값이 똑같은 티니핑끼리 누구를 위에 놓을지만 가른다. */
const SCORE = { like: 10, share: 5, visit: 1 };
const totalScore = (row) =>
  PAGE_KINDS.reduce((sum, kind) => sum + SCORE[kind] * (row[kind] || 0), 0);
/* 방문 경로는 주소(호스트)를 그대로 열쇠에 쓴다. 공유 버튼을 거친 링크는
   주소가 없으므로 _share 로 대신한다.
   리퍼러가 없는 방문(_direct)은 세지 않는다 — 브라우저도 보내지 않고(js/stats.js)
   여기서도 받지 않는다. 옛 js 가 캐시에 남은 브라우저가 보내더라도 조용히
   흘려보낸다(세지 않을 뿐 오류는 아니다).
   날짜별로만 쌓고(ref:d:<날짜>:<주소>) 조회할 때 최근 N일을 합친다 —
   달력 주·달로 쌓으면 "최근 7일" 같은 구간을 만들 수 없다. */

/** 열쇠에 넣어도 되는 주소인지 — 아무 문자열이나 받으면 저장소가 지저분해진다.
    점으로 나뉜 마디가 둘 이상이고, 각 마디는 영숫자로 시작·끝나야 한다. */
const HOST_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

function cleanHost(value) {
  if (!value) return null;
  const v = String(value).toLowerCase();
  if (v === "_share") return v;
  return v.length <= 63 && HOST_RE.test(v) ? v : null;
}

/** 날짜 경계는 모두 한국 시각 기준으로 끊는다 (Worker 는 UTC 로 돈다) */
function seoulParts(now = Date.now()) {
  const d = new Date(now + 9 * 60 * 60 * 1000);
  const day = d.toISOString().slice(0, 10);
  // 주는 월요일에 시작한다. 시프트된 값이라 getUTCDay 가 곧 한국 요일이다.
  const dow = (d.getUTCDay() + 6) % 7;                       // 월=0 … 일=6
  const week = new Date(d.getTime() - dow * 86400000).toISOString().slice(0, 10);
  return { day, week, month: day.slice(0, 7) };
}

/** 기간 지정값이 열쇠에 넣어도 되는 모양인지 (아무 문자열이나 받으면 안 된다) */
function cleanAt(period, value) {
  if (!value) return null;
  const ok = period === "month" ? /^\d{4}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/;
  return ok.test(value) ? value : null;
}

/** 직전 기간 (오늘은 어제, 주는 7일 전 월요일, 월은 한 달 전) */
function prevPeriod(period, at) {
  if (period === "month") {
    const [y, m] = at.split("-").map(Number);
    return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  }
  const back = period === "day" ? 1 : 7;
  return new Date(Date.parse(at + "T00:00:00Z") - back * 86400000).toISOString().slice(0, 10);
}

/** 열쇠에 들어갈 수 있는 id 인지 (아무 문자열이나 받으면 저장소가 지저분해진다) */
function cleanPageId(value) {
  return value && /^[a-z0-9-]{1,64}$/.test(value) ? value : null;
}

export class Counter {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async fetch(request) {
    const url = new URL(request.url);
    const { day, week, month } = seoulParts();
    const page = cleanPageId(url.searchParams.get("page"));

    if (url.pathname === "/series") {
      const n = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 2), 400);
      return Response.json(await this.series(day, n));
    }

    if (url.pathname === "/refs") {
      const span = Math.min(Math.max(Number(url.searchParams.get("days")) || 7, 1), 400);
      const t = Date.parse(day + "T00:00:00Z");
      const from = new Date(t - (span - 1) * 86400000).toISOString().slice(0, 10);
      const after = new Date(t + 86400000).toISOString().slice(0, 10);
      const limit = Number(url.searchParams.get("limit")) || 20;

      // 열쇠가 날짜순이라 start/end 로 구간만 훑을 수 있다
      const totals = new Map();
      for (const [key, value] of await this.ctx.storage.list(
        { start: `ref:d:${from}`, end: `ref:d:${after}` })) {
        const host = key.split(":")[3];
        if (host) totals.set(host, (totals.get(host) || 0) + value);
      }
      const rows = [...totals.entries()].map(([host, n]) => ({ host, n }))
        .sort((a, b) => b.n - a.n)
        .slice(0, limit);
      return Response.json({ from, to: day, days: span, rows });
    }

    if (url.pathname === "/rank") {
      const asked = url.searchParams.get("period");
      const period = ["day", "week", "month"].includes(asked) ? asked : "week";
      const at = cleanAt(period, url.searchParams.get("at"))
              || (period === "month" ? month : period === "day" ? day : week);
      const key = (v) => (period === "month" ? `m:${v}:` : period === "day" ? `d:${v}:` : `w:${v}:`);
      const limit = Number(url.searchParams.get("limit")) || 10;
      return Response.json({
        period, at, prev: prevPeriod(period, at),
        now: { day, week, month },
        ...(await this.rank(key(at), key(prevPeriod(period, at)), limit)),
      });
    }

    if (url.pathname === "/hit") {
      const type = url.searchParams.get("type");
      const scope = url.searchParams.get("scope");

      if (type === "ref") {
        const host = cleanHost(url.searchParams.get("host"));
        if (host) await this.bump(`ref:d:${day}:${host}`);
      } else if (type === "mode") {
        const mode = url.searchParams.get("mode");
        if (MODES.includes(mode)) {
          await this.bump(`mode:w:${week}:${mode}`);
          await this.bump(`mode:m:${month}:${mode}`);
        }
      } else if (type === "like") {
        // 좋아요는 개별 티니핑에만 있다
        if (scope === "page" && page) {
          await this.bump(`page:${page}:like`);
          await this.bump(`d:${day}:${page}:like`);
          await this.bump(`w:${week}:${page}:like`);
          await this.bump(`m:${month}:${page}:like`);
        }
      } else {
        const kind = type === "share" ? "share" : "visit";
        if (scope === "page" && page) {
          // 개별 티니핑은 누적·주간·월간에 함께 쌓는다 (순위는 기간별로 뽑는다)
          await this.bump(`page:${page}:${kind}`);
          await this.bump(`d:${day}:${page}:${kind}`);
          await this.bump(`w:${week}:${page}:${kind}`);
          await this.bump(`m:${month}:${page}:${kind}`);
        } else if (SCOPES.includes(scope)) {
          await this.bump(`${scope}:${kind}`);
          await this.bump(`day:${day}:${scope}:${kind}`);
        }
      }
    }

    const stats = await this.read(day, week, month);
    stats.week = week;
    stats.month = month;
    if (page) stats.page = await this.readPage(page);
    return Response.json(stats);
  }

  async bump(key) {
    const n = (await this.ctx.storage.get(key)) || 0;
    await this.ctx.storage.put(key, n + 1);
  }

  async get(key) {
    return (await this.ctx.storage.get(key)) || 0;
  }

  async readScope(scope, day) {
    const [visitTotal, shareTotal, visitToday, shareToday] = await Promise.all([
      this.get(`${scope}:visit`),
      this.get(`${scope}:share`),
      this.get(`day:${day}:${scope}:visit`),
      this.get(`day:${day}:${scope}:share`),
    ]);
    return { visitToday, visitTotal, shareToday, shareTotal };
  }

  /** 난도별 도전수 — prefix 가 기간을 정한다 */
  async modeCounts(prefix) {
    const values = await Promise.all(MODES.map((m) => this.get(prefix + m)));
    return Object.fromEntries(MODES.map((m, i) => [m, values[i]]));
  }

  async read(day, week, month) {
    // SCOPES 를 그대로 돌려 만든다 — 영역을 늘려도 여기를 고칠 일이 없도록
    const scopes = await Promise.all(SCOPES.map((s) => this.readScope(s, day)));
    const [modeWeek, modeMonth] = await Promise.all([
      this.modeCounts(`mode:w:${week}:`),
      this.modeCounts(`mode:m:${month}:`),
    ]);
    return {
      date: day,
      ...Object.fromEntries(SCOPES.map((s, i) => [s, scopes[i]])),
      mode: { week: modeWeek, month: modeMonth },
    };
  }

  async readPage(page) {
    const values = await Promise.all(
      PAGE_KINDS.map((kind) => this.get(`page:${page}:${kind}`)));
    return { id: page, ...Object.fromEntries(PAGE_KINDS.map((k, i) => [k, values[i]])) };
  }

  /** 날짜별 추이. 오늘부터 거슬러 n 일치를 돌려준다.
      누적선은 화면에서 그린다 — 여기서는 날짜별 값과 전체 누적만 주면
      "구간 밖의 과거분" 을 빼서 역산할 수 있다. */
  async series(today, n) {
    const dates = [];
    for (let i = n - 1; i >= 0; i--) {
      dates.push(new Date(Date.parse(today + "T00:00:00Z") - i * 86400000)
        .toISOString().slice(0, 10));
    }
    const after = new Date(Date.parse(today + "T00:00:00Z") + 86400000)
      .toISOString().slice(0, 10);

    // day:<날짜>:<영역>:<종류> 를 구간만 훑는다 (열쇠가 날짜순이라 start/end 로 잘린다)
    const rows = await this.ctx.storage.list({ start: `day:${dates[0]}`, end: `day:${after}` });
    const daily = {};
    const index = Object.fromEntries(dates.map((d, i) => [d, i]));
    for (const scope of SCOPES) {
      for (const kind of ["visit", "share"]) daily[`${scope}:${kind}`] = dates.map(() => 0);
    }
    for (const [key, value] of rows) {
      const [, date, scope, kind] = key.split(":");
      const series = daily[`${scope}:${kind}`];
      if (series && date in index) series[index[date]] = value;
    }

    const totals = {};
    for (const scope of SCOPES) {
      for (const kind of ["visit", "share"]) {
        totals[`${scope}:${kind}`] = await this.get(`${scope}:${kind}`);
      }
    }
    return { dates, daily, totals };
  }

  /** 한 기간의 열쇠를 모아 { id → {visit, share, like} } 로 만든다.
      아는 종류만 담는다 — 모르는 꼬리표를 그대로 넣으면 응답에 정체 모를 칸이 생긴다. */
  async collect(prefix) {
    const empty = () => Object.fromEntries(PAGE_KINDS.map((k) => [k, 0]));
    const rows = new Map();
    for (const [key, value] of await this.ctx.storage.list({ prefix })) {
      const parts = key.split(":");
      const kind = parts[parts.length - 1];              // visit | share | like
      const id = parts[parts.length - 2];
      if (!PAGE_KINDS.includes(kind)) continue;
      const row = rows.get(id) || { id, ...empty() };
      row[kind] = value;
      rows.set(id, row);
    }
    return [...rows.values()];
  }

  /** 티니핑 순위. 방문·공유·좋아요 세 벌로 줄 세우고 직전 기간 대비 오르내림을 붙인다.
      줄 세우는 차례는 그 수치 → 종합 점수(totalScore) → 열쇠 순서(=id 순).
      순위 숫자는 그 수치만 보고 매긴다 — 아래 withRanks 참고. */
  async rank(prefix, prevPrefix, limit) {
    const [cur, prev] = await Promise.all([this.collect(prefix), this.collect(prevPrefix)]);

    /* collect 가 열쇠 순서(=id 순)로 돌려주고 Array.sort 는 안정 정렬이라,
       수치도 종합 점수도 같으면 id 순으로 남는다. */
    const order = (rows, key) => rows
      .filter((r) => r[key] > 0)
      .sort((a, b) => b[key] - a[key] || totalScore(b) - totalScore(a));

    /* 값이 같으면 같은 순위를 준다 (1, 1, 3 — 공동 1위가 둘이면 다음은 2위가 아니라 3위).
       줄 세우는 데 쓰는 두 번째·세 번째 기준은 어디에 놓을지만 정할 뿐,
       순위 숫자에는 넣지 않는다. 좋아요가 똑같이 5인 둘을 조회수 때문에 1위·2위로
       갈라 놓으면, 화면에는 "좋아요 5" 가 나란한데 순위만 다른 꼴이 된다. */
    const withRanks = (sorted, key) => {
      let rank = 0;
      let last = null;
      return sorted.map((r, i) => {
        if (r[key] !== last) { rank = i + 1; last = r[key]; }
        return { ...r, rank };
      });
    };

    const build = (key) => {
      // 직전 순위는 상위 몇 개가 아니라 전체에서 매긴다 —
      // 그러지 않으면 지난 기간 11 위였던 티니핑이 "신규" 로 보인다.
      const before = new Map();
      withRanks(order(prev, key), key).forEach((r) => before.set(r.id, r.rank));
      const hadData = before.size > 0;
      // 순위를 전체에서 매긴 뒤에 자른다 (자르고 매기면 공동 순위가 어긋난다)
      return withRanks(order(cur, key), key).slice(0, limit).map((r) => {
        const was = before.get(r.id) || null;
        return {
          ...r,
          // 직전 기간에 기록이 아예 없으면 비교 자체를 하지 않는다 (delta = undefined)
          ...(hadData ? { was, delta: was ? was - r.rank : null } : {}),
        };
      });
    };
    return { visit: build("visit"), share: build("share"), like: build("like") };
  }
}

/** 우리 사이트에서 온 요청인지 (장난으로 숫자를 부풀리는 것을 조금이나마 막는다) */
function isAllowed(origin, env) {
  const list = (env.ALLOW_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.includes(origin);
}

function cors(origin, env) {
  return {
    "Access-Control-Allow-Origin": isAllowed(origin, env) ? origin : "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const headers = cors(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }
    if (!["/hit", "/stats", "/rank", "/series", "/refs"].includes(url.pathname)) {
      return new Response("not found", { status: 404, headers });
    }
    // 세는 것은 우리 사이트에서 온 POST 만 허용한다 (읽기는 누구나 가능)
    if (url.pathname === "/hit") {
      if (request.method !== "POST") {
        return new Response("method not allowed", { status: 405, headers });
      }
      if (!isAllowed(origin, env)) {
        return new Response("forbidden", { status: 403, headers });
      }
    }

    // 카운터는 하나뿐이므로 항상 같은 이름의 객체를 쓴다
    const stub = env.COUNTER.get(env.COUNTER.idFromName("teenieping"));
    const res = await stub.fetch(new Request(url.toString(), { method: "GET" }));
    return new Response(res.body, {
      status: res.status,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  },
};
