#!/usr/bin/env node
/* ===== 나무위키 대표 이미지 수집 (og:image 방식) =====
 *
 * 나무위키 문서의 <meta property="og:image"> 가 곧 그 문서의 **대표 이미지**다.
 * 문서 안의 여러 이미지 중 무엇이 본인 것인지 추측할 필요가 없어,
 * 앞선 방식들(이름 alt 매칭 / 문서 고유 이미지)보다 훨씬 정확하다.
 *
 * ⚠️ 주의: 하츄핑 계열 폼(다이아·플로라·베리·스타·프린세스)은 모두 「하츄핑」
 *    문서로 리다이렉트되어 og:image 가 전부 같다. 그대로 받으면 6개 시즌
 *    하츄핑이 동일한 그림이 되므로 SKIP 에 넣어 건너뛴다.
 *
 * 실행:  node tools/fetch-images-og.mjs           (이미지 없는 것만)
 *        node tools/fetch-images-og.mjs --force    (전부 다시 받아 교체)
 *        node tools/fetch-images-og.mjs --only <이름파일>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const IMG_DIR = path.join(ROOT, "images");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* 하츄핑 계열은 전부 「하츄핑」 문서 하나로 합쳐져 있어 og:image 만으로는
 * 폼을 구분할 수 없다. 그 문서의 대표 이미지는 티아라·드레스를 착용한 상위 폼이라
 * 1기 기본 하츄핑 자리에 맞지 않는다. 그래서 계열 전체를 건너뛴다.
 *
 * 다만 **구분할 방법은 있다.** 하츄핑 문서의 「시즌별 변신 폼」 절에는 폼마다
 * 이미지가 따로 실려 있고, img 태그의 alt 에 폼 이름이 들어 있다:
 *   하츄핑 / 하츄핑시즌2-1 / FLORA-HEARTSPING / 베리하츄핑 /
 *   (티니핑5)스타하츄핑 / 프린세스 티니핑 하츄핑
 * 이 절의 alt 로 매칭하면 6종을 각각 받을 수 있다. */
const SKIP = new Set([
  "하츄핑", "다이아 하츄핑", "플로라 하츄핑", "베리 하츄핑", "스타 하츄핑", "프린세스 하츄핑",
]);

function loadData() {
  const win = {};
  new Function("window", fs.readFileSync(path.join(ROOT, "data/teeniepings.js"), "utf8"))(win);
  return win.TEENIEPINGS || [];
}

async function ogImage(title) {
  const res = await fetch("https://namu.wiki/w/" + encodeURIComponent(title), {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const html = await res.text();
  const m = /<meta[^>]*property=['"]og:image['"][^>]*content=['"]([^'"]+)['"]/.exec(html);
  if (!m) return null;
  return m[1].startsWith("//") ? "https:" + m[1] : m[1];
}

async function download(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Referer: "https://namu.wiki/" } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1200) throw new Error("too small");
  fs.writeFileSync(dest, buf);
  return buf.length;
}

async function main() {
  const force = process.argv.includes("--force");
  const onlyIdx = process.argv.indexOf("--only");
  const list = loadData();

  let targets;
  if (onlyIdx !== -1 && process.argv[onlyIdx + 1]) {
    const names = new Set(fs.readFileSync(process.argv[onlyIdx + 1], "utf8").split("\n").map((s) => s.trim()).filter(Boolean));
    targets = list.filter((t) => names.has(t.nameKo));
  } else if (force) {
    targets = list;
  } else {
    targets = list.filter((t) => !fs.existsSync(path.join(IMG_DIR, t.id + ".png")));
  }

  console.log(`대상 ${targets.length}마리 (${force ? "전부 교체" : "필요한 것만"})\n`);
  let ok = 0, skip = 0, fail = 0;
  const failed = [];

  for (const t of targets) {
    if (SKIP.has(t.nameKo)) {
      console.log(`⏭  ${t.nameKo} — 문서가 「하츄핑」과 합쳐져 있어 건너뜀`);
      skip++; continue;
    }
    try {
      const url = await ogImage(t.nameKo);
      if (!url) throw new Error("og:image 없음");
      const bytes = await download(url, path.join(IMG_DIR, t.id + ".png"));
      console.log(`✅ ${t.nameKo} → images/${t.id}.png (${Math.round(bytes / 1024)}KB)`);
      ok++;
    } catch (e) {
      console.log(`⚠️  ${t.nameKo} — ${e.message}`);
      failed.push(t.nameKo); fail++;
    }
    await sleep(400);
  }

  console.log(`\n완료: 성공 ${ok} · 건너뜀 ${skip} · 실패 ${fail}`);
  if (failed.length) console.log("실패:", failed.join(", "));
}

main().catch((e) => { console.error("오류:", e); process.exit(1); });
