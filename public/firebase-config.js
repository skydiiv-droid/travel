// ▼▼▼ 여기만 본인 Firebase 프로젝트 값으로 교체하세요 ▼▼▼
// Firebase 콘솔 > 프로젝트 설정 > 일반 > "내 앱" > 웹앱 > SDK 설정/구성 에서 복사.
export const firebaseConfig = {
  apiKey: "AIzaSyDoYyqYXFbej82qVfidfPAPBZhNUOJcucA",
  authDomain: "sharing-23fb7.firebaseapp.com",
  projectId: "sharing-23fb7",
  storageBucket: "sharing-23fb7.firebasestorage.app",
  messagingSenderId: "929401059122",
  appId: "1:929401059122:web:41d0b0802fba294f5a492b",
};
// ▲▲▲ 여기까지 ▲▲▲

// Cloud Functions 리전(functions/index.js 의 setGlobalOptions 와 일치해야 함)
export const functionsRegion = "asia-northeast3";
