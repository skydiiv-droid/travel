# travel

## 여행지 추천 툴 (`index.html`)
단일 파일 · 오프라인 · 모바일 우선. 브라우저로 `index.html`을 열면 바로 동작합니다 (데이터는 localStorage).

- **추천**: 두 사람의 마지막 근무 → 출발지·출발시각, 복귀 후 첫 근무 → 귀가 마감·자동 박수, 테마 슬라이더 11축 → 국내 상위 5 + 해외 슬롯
- **기록**: 과거 여행의 축별 좋았음/불편(강도·원인) 입력 → 축별 배수 m 자동 계산
- **데이터**: JSON export / import(스키마 검증 + 변경 diff 미리보기 + 직전 상태 자동 백업 1개)
- **설정**: 근무 시각, 버퍼, 배수 상수(1.5 / 1.3 / 보정상수), 활동시간 임계값 등

### 파일 구조
| 경로 | 역할 |
|---|---|
| `index.html` | 앱 본체. `<script id="core">` = 계산 코어(순수 함수), `<script id="seed-data">` = 시드 데이터(인라인) |
| `data/seed.json` | 시드 여행지 정본 (국내 60 · 거점 12 · 해외 17). 점수·소요시간은 **초안 추정치** |
| `tools/build.js` | `data/seed.json` → `index.html` 인라인 (`node tools/build.js`) |
| `tools/gen-seed.js` | 최초 시드 생성기 (기록용. 이후엔 seed.json 직접 수정) |
| `tests/core.test.js` | 수식 검증값·출발지 예시·스키마·추천 스모크 테스트 (`node tests/core.test.js`) |

시드를 고친 뒤: `node tools/build.js && node tests/core.test.js`.
이미 쓰고 있는 브라우저에는 시드 변경이 자동 반영되지 않습니다 → 데이터 탭에서 import 하거나 "여행지만 시드로 초기화".
