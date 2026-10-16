/**
 * MyShare Cloud Functions
 *  - cleanupExpired: 1시간마다 만료된 자료(Firestore + Storage)를 삭제
 *
 * 인증(공유 비밀번호)은 Cloud Functions 가 아니라 Firebase Authentication 의
 * "공유 계정(이메일+비밀번호)" 로그인으로 처리한다. (공개 호출형 함수 불필요)
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();

// 서울 리전 (한국 사용자 지연 최소화)
setGlobalOptions({ region: "asia-northeast3" });

/**
 * 만료 자료 자동 삭제. 매 60분 실행.
 * expiresAt 이 현재 시각 이하인 문서를 찾아 Storage 파일과 함께 삭제한다.
 */
exports.cleanupExpired = onSchedule("every 60 minutes", async () => {
  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  const now = admin.firestore.Timestamp.now();

  const snap = await db
    .collection("files")
    .where("expiresAt", "<=", now)
    .get();

  if (snap.empty) {
    logger.info("만료 자료 없음");
    return;
  }

  const jobs = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.storagePath) {
      jobs.push(
        bucket
          .file(data.storagePath)
          .delete()
          .catch((e) =>
            logger.error("Storage 삭제 실패", data.storagePath, e.message)
          )
      );
    }
    jobs.push(docSnap.ref.delete());
  });

  await Promise.all(jobs);
  logger.info(`만료 자료 ${snap.size}건 삭제 완료`);
});
