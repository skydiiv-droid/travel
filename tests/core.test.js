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

// 8) v4: 평점·이유·맥락 → 축 배수 / 속성 감점 / 근무 조건부 / 가점 / 예약 팁
check('평점·이유 id 중복 없음 · 축/속성 유효', new Set(C.RATINGS.flatMap(r => r.reasons.map(x => x.id))).size === C.RATINGS.reduce((a, r) => a + r.reasons.length, 0) &&
  C.RATINGS.every(r => (r.axis == null || C.AXIS_KEYS.includes(r.axis)) && r.reasons.every(x => x.attrs.every(k => C.ATTRS.some(a => a.key === k.replace('!', ''))))));
check('시드 전 여행지에 속성 + 숙소·음식 선택지', seed.destinations.every(d => d.attrs && C.ATTRS.every(a => a.type === 'derived' || a.key in d.attrs) &&
  d.attrs.stay_types.length && d.attrs.food_kinds.length));
const T = (r, rs, ctx, extra) => Object.assign({ id: 't' + Math.random(), destination_id: 'x', nights: 1, overall: 3, ratings: r, reasons: rs || {}, context: ctx || {}, manual: { likes: [], pains: [] } }, extra || {});
const recWith = (history, pre, filterIds, nights) => C.recommend({ destinations: seed.destinations.filter(d => !filterIds || filterIds.includes(d.id)), history, settings: {} },
  { departure: dep, origin: 'home', deadline: null, nights: nights || 1, month: 5, budget: 3, travel_cap: 600, exclude_visited: false, base_weights: w, pre_shift: pre });
// 운전 피로: 휴무 후 3 → 반영 없음
check('운전 피로 3 → 아무 감점 없음', recWith([T({ drive_fatigue: 3 }, {}, { pre_shift: 'O', go_modes: ['car'] })], 'N').domesticAll.every(x => x.attrPenalty === 0 && x.condPenalty === 0));
// N 직후 운전 피로(근무 피로) → N 출발일 때만 차 필요한 곳 감점
const nTrip = [T({ drive_fatigue: 5 }, { drive_fatigue: ['r_dr_shift'] }, { pre_shift: 'N', go_modes: ['car'] })];
const rN = recWith(nTrip, 'N', ['namhae', 'busan_old']), rO = recWith(nTrip, 'O', ['namhae', 'busan_old']);
const nam = x => x.domesticAll.find(i => i.dest.id === 'namhae'), bus = x => x.domesticAll.find(i => i.dest.id === 'busan_old');
check('N 직후 출발: 차 필수(남해) 감점, 차 불필요(부산 원도심)는 장거리분만', nam(rN).condPenalty > bus(rN).condPenalty && nam(rN).warnings.some(t => t.indexOf('N 직후 조건') === 0),
  nam(rN).condPenalty.toFixed(2) + ' vs ' + bus(rN).condPenalty.toFixed(2));
check('O 출발: 같은 기록이어도 감점 없음', nam(rO).condPenalty === 0 && nam(rO).attrPenalty === 0);
// 운전 자체가 힘듦(휴무 후, 운전 시간 김) → 언제나 장거리 감점
const rAlways = recWith([T({ drive_fatigue: 5 }, { drive_fatigue: ['r_dr_long'] }, { pre_shift: 'O', go_modes: ['car'] })], 'O', ['namhae', 'yangpyeong']);
check('운전 시간 김(장소) → 출발 조건 무관하게 먼 곳만 감점', rAlways.domesticAll.find(i => i.dest.id === 'namhae').attrPenalty > 0 && rAlways.domesticAll.find(i => i.dest.id === 'yangpyeong').attrPenalty === 0);
// 숙소: 선택지 적음 → 선택지 좁은 곳 감점 / 소음 → 팁만
const rStay = recWith([T({ stay_sat: 2 }, { stay_sat: ['r_st_few', 'r_st_noise'] })], 'O', ['inje', 'jeju_city']);
check('숙소 선택지 적음 → 인제(0) 감점, 제주시(2) 없음 · 소음은 팁', rStay.domesticAll.find(i => i.dest.id === 'inje').attrPenalty > 0 && rStay.domesticAll.find(i => i.dest.id === 'jeju_city').attrPenalty === 0 && !!rStay.learned.tips.r_st_noise);
// 가점: 음식 선택지 많아 좋았음 + 해산물 좋아함
const rFood = recWith([T({ food_sat: 5 }, { food_sat: ['r_fd_many'] }, {}, { food_eaten: ['S', 'M'], food_liked: ['S'] })], 'O', ['tongyeong', 'cheorwon']);
const tong = rFood.domesticAll.find(i => i.dest.id === 'tongyeong'), cheo = rFood.domesticAll.find(i => i.dest.id === 'cheorwon');
check('음식 가점: 통영(선택지 많음·해산물) > 철원', tong.bonus > 0 && tong.bonus > cheo.bonus && tong.plus.length > 0, tong.bonus.toFixed(2) + ' vs ' + cheo.bonus.toFixed(2));
check('가점 상한 bonus_max 0.5', recWith(Array(20).fill(0).map(() => T({ food_sat: 5, stay_sat: 5 }, { food_sat: ['r_fd_many'], stay_sat: ['r_st_many'] }, {}, { stay_types: ['H'], food_eaten: ['S'], food_liked: ['S'] })), 'O', ['busan_haeundae']).domesticAll[0].bonus <= 0.5 + 1e-9);
// 숙소 유형 선호: 펜션 1점 → 펜션만 있는 곳(영덕) 마이너스
const rP = recWith([T({ stay_sat: 1 }, {}, {}, { stay_types: ['P'] })], 'O', ['yeongdeok']);
check('펜션 불만족 → 펜션만 있는 영덕은 선호 마이너스', rP.domesticAll[0].bonus < 0, rP.domesticAll[0].bonus.toFixed(2));
// 이전 형식 변환
const v3 = C.validateData({ schema_version: 3, history: [{ id: 'a', destination_id: 'gyeongju', nights: 1, overall: 3,
  checks: [{ id: 'go_car' }, { id: 'go_transfer', sev: 3 }, { id: 'sl_hotel' }, { id: 'ea_seafood' }, { id: 'do_fun' }] }] }, { destinations: seed.destinations });
const m3 = v3.layers.history[0];
check('v3 체크 → v4: 수단·숙소·음식은 맥락으로, 축 평가는 manual 로', v3.ok && m3.context.go_modes[0] === 'car' && m3.stay_types[0] === 'H' && m3.food_eaten[0] === 'S' &&
  m3.manual.pains[0].axis === 'move' && m3.manual.likes[0].axis === 'activity' && !('checks' in m3) && /환승 많음/.test(m3.note), JSON.stringify(m3.manual));
const v2rec = C.validateData({ schema_version: 2, history: [{ id: 'a', destination_id: 'gyeongju', nights: 1, overall: 3,
  likes: [{ axis: 'food' }], pains: [{ axis: 'crowd', severity: 3, cause: 'place' }], details: { move: { info: ['KTX·기차'], memo: '버스 대기' } } }] }, { destinations: seed.destinations });
check('v2 → v4 연쇄 변환 · 배수 유지', v2rec.ok && Math.abs(C.computeMultipliers(v2rec.layers.history).crowd.m - 1.25) < 1e-9 && v2rec.layers.history[0].context.go_modes[0] === 'train');
check('v4 잘못된 평점·코드 차단', !C.validateData({ schema_version: 4, history: [{ id: 'a', destination_id: 'x', nights: 1, overall: 3, ratings: { stay_sat: 7 }, stay_types: ['Z'], context: { pre_shift: 'X' } }] }, { destinations: [] }).ok);

console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED');
process.exit(fail ? 1 : 0);
