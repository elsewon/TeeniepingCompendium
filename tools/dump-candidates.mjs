#!/usr/bin/env node
/* ===== 보류된 캐릭터의 후보 이미지를 내려받아 눈으로 고르기 =====
 *
 * '문서 고유 이미지' 방식에서 후보가 2개 이상이면 자동 판별을 보류한다.
 * 이 스크립트는 그 후보들을 /tmp/cands/ 에 저장하고 목록을 출력한다.
 * 사람이 보고 맞는 것을 골라 images/<id>.png 로 복사하면 된다.
 *
 * 실행: node tools/dump-candidates.mjs <이름파일>
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT = "/tmp/cands";

const PAGE_H = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36" };
const IMG_H = { ...PAGE_H, Referer: "https://namu.wiki/" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadData() {
  const win = {};
  new Function("window", fs.readFileSync(path.join(ROOT, "data/teeniepings.js"), "utf8"))(win);
  return win.TEENIEPINGS || [];
}

function pageImages(html) {
  const out = [], seen = new Set();
  const re = /<img[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const s = /data-src='(\/\/i\.namu\.wiki\/i\/[^']+)'/.exec(tag)
           || /[^-]src='(\/\/i\.namu\.wiki\/i\/[^']+)'/.exec(tag);
    if (!s) continue;
    const a = /alt='([^']*)'/.exec(tag);
    const alt = a ? a[1] : "";
    if (/로고|logo|국기|flag|아이콘/i.test(alt)) continue;
    const url = "https:" + s[1];
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ url, alt });
  }
  return out;
}

async function main() {
  const namesFile = process.argv[2];
  if (!namesFile) { console.error("사용법: node tools/dump-candidates.mjs <이름파일>"); process.exit(1); }
  const names = fs.readFileSync(namesFile, "utf8").split("\n").map((s) => s.trim()).filter(Boolean);
  const list = loadData();
  const targets = list.filter((t) => names.includes(t.nameKo));

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  console.log(`대상 ${targets.length}마리 문서 수집...`);
  const perPage = new Map();
  for (const t of targets) {
    try {
      const res = await fetch("https://namu.wiki/w/" + encodeURIComponent(t.nameKo), { headers: PAGE_H });
      if (res.ok) perPage.set(t.nameKo, pageImages(await res.text()));
      process.stdout.write(".");
    } catch (_) { process.stdout.write("x"); }
    await sleep(600);
  }
  console.log("");

  const freq = new Map();
  for (const imgs of perPage.values()) for (const { url } of imgs) freq.set(url, (freq.get(url) || 0) + 1);

  const manifest = [];
  for (const t of targets) {
    const imgs = perPage.get(t.nameKo) || [];
    const uniq = imgs.filter((i) => freq.get(i.url) === 1);
    let i = 0;
    for (const u of uniq) {
      const fn = path.join(OUT, `${t.id}__${i}.webp`);
      try {
        const r = await fetch(u.url, { headers: IMG_H });
        if (!r.ok) continue;
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length < 1200) continue;
        fs.writeFileSync(fn, buf);
        manifest.push({ nameKo: t.nameKo, id: t.id, idx: i, file: fn, alt: u.alt, kb: Math.round(buf.length / 1024) });
        i++;
      } catch (_) { /* skip */ }
      await sleep(150);
    }
  }

  fs.writeFileSync("/tmp/cands/manifest.json", JSON.stringify(manifest, null, 2));
  console.log(`\n후보 ${manifest.length}장 저장 → ${OUT}`);
  const byName = {};
  manifest.forEach((m) => { (byName[m.nameKo] = byName[m.nameKo] || []).push(`${m.idx}:${m.kb}KB(${m.alt.slice(0, 22)})`); });
  Object.entries(byName).forEach(([n, v]) => console.log(`  ${n}: ${v.join(" | ")}`));
}

main().catch((e) => { console.error("오류:", e); process.exit(1); });
