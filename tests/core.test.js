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

// 8) 장면별 체크 · 여행지 속성 감점 · v2→v3 이전
check('체크 항목 id 중복 없음 · 축/속성 이름 유효', new Set(C.CHECKS.map(c => c.id)).size === C.CHECKS.length &&
  C.CHECKS.every(c => (c.axis == null || C.AXIS_KEYS.includes(c.axis)) && (c.attr == null || C.ATTRS.some(a => a.key === c.attr))));
check('모든 장면에 항목 있음', C.SCENES.every(sc => C.CHECKS.some(c => c.scene === sc.key)));
check('시드 전 여행지에 속성(attrs) 9개', seed.destinations.every(d => d.attrs && C.ATTRS.every(a => a.key in d.attrs)));
const v2rec = C.validateData({ schema_version: 2, history: [{ id: 'a', destination_id: 'gyeongju', nights: 1, overall: 3,
  likes: [{ axis: 'food' }], pains: [{ axis: 'crowd', severity: 3, cause: 'place' }],
  details: { move: { info: ['KTX·기차'], bad: ['환승 많음', '이상한항목'], memo: '버스 대기' } } }] }, { destinations: seed.destinations });
const mig = v2rec.layers.history[0];
check('v2 기록 → v3: likes/pains 는 manual, details 는 체크로', v2rec.ok && mig.manual.pains[0].axis === 'crowd' && mig.checks.some(c => c.id === 'go_train') &&
  mig.checks.some(c => c.id === 'go_transfer') && /이상한항목/.test(mig.note) && /버스 대기/.test(mig.note) && !('details' in mig), JSON.stringify(mig.checks));
check('이전된 기록의 배수 유지 (혼잡도 1.25)', Math.abs(C.computeMultipliers([mig]).crowd.m - 1.25) < 1e-9);
// 환승 많음 2번 경험 → 환승 부담 큰 곳 감점, 결과에 반영
const hist = [{ id: 'a', checks: [{ id: 'go_transfer', sev: 3 }] }, { id: 'b', checks: [{ id: 'go_transfer', sev: 3 }] }];
const rA = C.recommend({ destinations: seed.destinations, history: hist, settings: {} }, { departure: dep, origin: 'home', deadline: C.at('2026-11-23', '21:00'), nights: 2, month: 11,
  budget: 3, travel_cap: 600, exclude_visited: false, base_weights: w, after_night: false });
const all = rA.domesticAll, hi = all.filter(x => x.dest.attrs.transfer_load === 2), lo = all.filter(x => x.dest.attrs.transfer_load === 0);
check('환승 부담 2 = 감점 0.67, 0 = 감점 없음', hi.length && hi.every(x => Math.abs(x.attrPenalty - 2 / 3) < 1e-9) && lo.every(x => x.attrPenalty === 0), hi[0] && hi[0].attrPenalty.toFixed(3));
check('감점이 경고 문구로 표시', hi.every(x => x.warnings.some(t => t.indexOf('환승 많음') >= 0)));
check('감점 상한 attr_pen_max', C.attrPenalty({ attrs: { transfer_load: 2, hilly: true, car_needed: 2 } },
  { transfer_load: { f: 1, labels: [] }, hilly: { f: 1, labels: [] }, car_needed: { f: 1, labels: [] } }, 1).pen === 1);
check('볼거리 대비 긴 박수 경고', C.recommend({ destinations: seed.destinations.filter(d => d.id === 'gongju'), history: [], settings: {} },
  { departure: dep, origin: 'home', deadline: null, nights: 4, month: 5, budget: 3, travel_cap: 600, exclude_visited: false, base_weights: w })
  .domesticAll[0].warnings.some(t => t.indexOf('볼거리 대비') >= 0));

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED');
process.exit(fail ? 1 : 0);
