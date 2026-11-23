// 계산 코어 테스트. 실행: node tests/core.test.js
// index.html 안의 <script id="core"> 와 시드 데이터를 그대로 꺼내 검증한다.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const coreSrc = html.match(/<script id="core">([\s\S]*?)<\/script>/)[1];
const seed = JSON.parse(html.match(/<script type="application\/json" id="seed-data">([\s\S]*?)<\/script>/)[1]);
const ctx = { module: { exports: {} } };
ctx.globalThis = ctx;
vm.runInNewContext(coreSrc, ctx);
const C = ctx.module.exports;

let fail = 0;
function check(name, ok, detail) {
  console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  (' + detail + ')' : ''));
  if (!ok) fail++;
}

// 1) 사양서 검증값 + 출발지 예시 (selfTest 공용)
for (const r of C.selfTest()) check(r.name, r.pass, r.detail);

// 2) 출발 시각 세부
const d1 = C.resolveDeparture({ date: '2026-11-22', jw: { kind: 'N_prev' }, gf: { kind: 'O' } });
check('예1 출발시각 = N 종료 07:00 + 60분', d1.departure.getHours() === 8 && d1.departure.getDate() === 22);
const d2 = C.resolveDeparture({ date: '2026-11-21', jw: { kind: 'O' }, gf: { kind: 'D' } });
check('예2 출발시각 = D 종료 15:00 + 60분', d2.departure.getHours() === 16);
const d4 = C.resolveDeparture({ date: '2026-11-21', jw: { kind: 'D' }, gf: { kind: 'E' } });
check('늦게 끝나는 쪽(여친 E) 기준, 출발지는 정우 근무로 직장', d4.later === 'gf' && d4.origin === 'work' && d4.departure.getDate() === 22 && d4.departure.getHours() === 0);

// 3) 시드 데이터 스키마 검증
const v = C.validateData(Object.assign({ exported_at: 'seed' }, seed), null);
check('시드 데이터 스키마 오류 0', v.ok, v.errors.slice(0, 5).join(' / '));
const counts = seed.destinations.reduce((a, d) => (a[d.type] = (a[d.type] || 0) + 1, a), {});
check('시드 구성 (국내 ~60 / 거점 ~12 / 해외 15~20)', counts.domestic === 60 && counts.spot === 12 && counts.overseas >= 15 && counts.overseas <= 20, JSON.stringify(counts));

// 4) 잘못된 import 차단
const bad = C.validateData({ schema_version: 1, history: [{ id: 'a', destination_id: 'x', date: '2026/1/1', nights: 1, overall: 9, pains: [{ axis: 'foo', severity: 5, cause: 'x' }] }] }, { destinations: [] });
check('잘못된 history import 는 오류', !bad.ok && bad.errors.length >= 4, bad.errors.length + '건');

// 5) 추천 스모크: 2박, 집 출발, 예산 중
const w = {}; C.AXIS_KEYS.forEach(k => { w[k] = 5; });
const data = { destinations: seed.destinations, history: [], settings: {} };
const dep = C.at('2026-11-21', '09:00');
const r2 = C.recommend(data, { departure: dep, origin: 'home', deadline: C.at('2026-11-23', '21:00'), nights: 2, month: 11,
  budget: 2, travel_cap: 240, exclude_visited: false, base_weights: w, after_night: false });
check('2박: 국내 5곳, 거점 없음, 해외 슬롯 숨김', r2.domestic.length === 5 && r2.domestic.every(x => x.dest.type === 'domestic') && !r2.overseasShown);
const r0 = C.recommend(data, { departure: dep, origin: 'home', deadline: C.at('2026-11-21', '22:00'), nights: 0, month: 11,
  budget: 3, travel_cap: 150, exclude_visited: false, base_weights: w, after_night: false });
check('당일: day_trip_ok 만', r0.domestic.length > 0 && r0.domestic.every(x => x.dest.day_trip_ok), r0.domestic.map(x => x.dest.name).join(','));
const r7 = C.recommend(data, { departure: dep, origin: 'home', deadline: null, nights: 7, month: 1,
  budget: 3, travel_cap: 300, exclude_visited: false, base_weights: w, after_night: false });
check('7박: 해외 슬롯 2곳, 장기오프 우선', r7.overseas.length === 2 && r7.overseas.every(x => x.dest.long_off_tag), r7.overseas.map(x => x.dest.name).join(','));
// 가중치 정규화 → 총점이 0~10 안
check('총점 범위 0~10', r2.domestic.every(x => x.total >= 0 && x.total <= 10));
// 기여도 합 = 총점
check('축별 기여도 합 = 총점', r2.domestic.every(x => Math.abs(Object.values(x.contrib).reduce((a, b) => a + b, 0) - x.total) < 1e-9));

// 6) 해외 강제 표시 · 전체 목록
const r1 = C.recommend(data, { departure: dep, origin: 'home', deadline: C.at('2026-11-22', '21:00'), nights: 1, month: 11,
  budget: 3, travel_cap: 240, exclude_visited: false, base_weights: w, after_night: false, force_overseas: true });
check('1박 + 해외 항상 보기: 해외 표시, 최소박수 경고', r1.overseasShown && r1.overseasAll.length > 0 && r1.overseasAll.every(x => x.warnings.some(t => t.indexOf('권장') >= 0)), r1.overseasAll.length + '곳');
check('더 보기용 전체 목록 제공', r2.domesticAll.length === r2.domesticCount && r2.domesticAll.length > 5);

// 7) 과거 기록 시기: 월/계절/모름 + v1(date) 이전
const legacy = C.validateData({ schema_version: 1, history: [{ id: 'a', destination_id: 'gyeongju', date: '2024-10-03', nights: 1, overall: 4 }] }, { destinations: seed.destinations });
check('v1 date → year·month 로 변환', legacy.ok && legacy.layers.history[0].year === 2024 && legacy.layers.history[0].month === 10 && !('date' in legacy.layers.history[0]));
const v2 = C.validateData({ schema_version: 2, history: [
  { id: 'a', destination_id: 'gyeongju', year: null, month: null, season: 'summer', nights: 1, overall: 4 },
  { id: 'b', destination_id: 'gyeongju', year: null, month: null, season: null, nights: 1, overall: 4 }] }, { destinations: seed.destinations });
check('계절만 / 기억 안 남 기록 허용', v2.ok, v2.errors.join(' / '));
check('시기 라벨', C.whenLabel(v2.layers.history[0]) === '여름' && C.whenLabel(v2.layers.history[1]) === '시기 모름' && C.whenLabel(legacy.layers.history[0]) === '2024년 10월');
check('잘못된 계절 값 차단', !C.validateData({ schema_version: 2, history: [{ id: 'a', destination_id: 'x', season: 'rainy', nights: 1, overall: 3 }] }, { destinations: [] }).ok);

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED');
process.exit(fail ? 1 : 0);
