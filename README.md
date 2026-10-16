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

이 저장소의 `public/` 은 배포된 사이트에서 그대로 내려받아 복원했다.
배포 사이트로는 받을 수 없는 아래 항목은 아직 저장소에 없다.

- Cloud Functions (`functions/index.js`, 리전 `asia-northeast3` — 24시간 만료 자동삭제로 추정)

`storage.rules` 는 콘솔에서 복사해 넣었다(배포본과 동일). `firestore.rules` 는 콘솔 배포본에 고정(pin) 수정 허용을 추가한 것이다.

Functions 가 저장소에 없으므로 `firebase deploy` 를 전체로 돌리지 말고 대상을 지정해 배포한다:

```
firebase deploy --only hosting,firestore:rules,storage
```
