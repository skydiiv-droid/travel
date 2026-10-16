# My Share

휴대폰과 PC 사이 24시간 임시 파일·텍스트 공유 웹앱 (Firebase Hosting + Auth + Firestore + Storage).

- 배포 주소: https://sharing-23fb7.web.app/
- Firebase 프로젝트: `sharing-23fb7`

## 구조

```
public/            Hosting 으로 배포되는 정적 파일
  index.html
  app.js           앱 로직 (Auth / Firestore `files` 컬렉션 / Storage `uploads/`)
  styles.css
  sw.js            서비스워커 (네트워크 우선 + 오프라인 캐시)
  firebase-config.js
  manifest.webmanifest, icons/
firebase.json      Hosting 설정
.firebaserc        기본 프로젝트 지정
```

## 복원 메모

`public/` 은 배포된 사이트에서 내려받아 복원했고, 규칙과 함수 코드는 콘솔에서 복사해 넣었다.

- `storage.rules`: 배포본과 동일
- `firestore.rules`: 배포본 + 고정(pin) 수정 허용
- `functions/index.js`: 배포본(`cleanupExpired`)과 동일. `expiresAt <= now` 로 조회하므로
  `expiresAt` 이 없는 고정 항목은 삭제되지 않는다.
  `package.json` 이 없어 `firebase.json` 에 functions 는 넣지 않았다(이 저장소에서 함수 배포 불가).

배포는 대상을 지정해서 한다:

```
firebase deploy --only hosting,firestore:rules,storage
```
