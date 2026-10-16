import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  initializeFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import imageCompression from "https://cdn.jsdelivr.net/npm/browser-image-compression@2.0.2/+esm";
import { firebaseConfig } from "/firebase-config.js";

/* ------------------------------------------------------------------ */
/* Firebase 초기화                                                     */
/* ------------------------------------------------------------------ */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// 제한된 네트워크(회사/병원 프록시 등)에서도 실시간 수신이 끊기지 않도록 롱폴링 강제.
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
const storage = getStorage(app);

// 모든 기기가 로그인하는 공유 계정. 비밀번호만 사용자가 입력한다.
// (이메일은 고정값 — Firebase 콘솔에서 이 이메일로 계정 1개를 만들어 둔다.)
const SHARE_EMAIL = "share@myshare.app";

const TTL_MS = 24 * 60 * 60 * 1000; // 24시간
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_BYTES = 20 * 1024 * 1024;
const FILE_MAX_BYTES = 10 * 1024 * 1024;

/* ------------------------------------------------------------------ */
/* DOM                                                                 */
/* ------------------------------------------------------------------ */
const $ = (id) => document.getElementById(id);
const loginSection = $("login");
const splashSection = $("splash");
const appSection = $("app");
const loginForm = $("loginForm");
const passwordInput = $("password");
const loginBtn = $("loginBtn");
const loginError = $("loginError");
const listEl = $("list");
const emptyState = $("emptyState");
const progressList = $("progressList");

/* ------------------------------------------------------------------ */
/* 인증                                                                */
/* ------------------------------------------------------------------ */
await setPersistence(auth, browserLocalPersistence);

onAuthStateChanged(auth, (user) => {
  splashSection.classList.add("hidden");
  if (user) {
    loginSection.classList.add("hidden");
    appSection.classList.remove("hidden");
    startListening();
  } else {
    appSection.classList.add("hidden");
    loginSection.classList.remove("hidden");
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = passwordInput.value;
  if (!password) return;
  loginError.textContent = "";
  loginBtn.disabled = true;
  loginBtn.textContent = "확인 중…";
  try {
    await signInWithEmailAndPassword(auth, SHARE_EMAIL, password);
    passwordInput.value = "";
  } catch (err) {
    console.error(err);
    const code = (err && err.code) || "";
    if (code.includes("too-many-requests")) {
      loginError.textContent = "시도가 많습니다. 잠시 후 다시 시도하세요.";
    } else {
      loginError.textContent = "비밀번호가 올바르지 않습니다.";
    }
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "접속";
  }
});

/* ------------------------------------------------------------------ */
/* 실시간 목록                                                          */
/* ------------------------------------------------------------------ */
let unsubscribe = null;

function startListening() {
  if (unsubscribe) return;
  const q = query(collection(db, "files"), orderBy("createdAt", "desc"));
  unsubscribe = onSnapshot(
    q,
    (snap) => {
      const items = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      renderList(items);
    },
    (err) => console.error("목록 구독 오류", err)
  );
}

function renderList(items) {
  // 만료된 항목은(자동삭제 전이라도) 화면에서 숨김
  const now = Date.now();
  const visible = items.filter((it) => {
    const exp = it.expiresAt && it.expiresAt.toMillis ? it.expiresAt.toMillis() : 0;
    return !exp || exp > now;
  });

  emptyState.classList.toggle("hidden", visible.length > 0);
  listEl.innerHTML = "";
  for (const item of visible) {
    listEl.appendChild(renderCard(item));
  }
}

function renderCard(item) {
  const card = document.createElement("article");
  card.className = "card";

  if (item.kind === "text") {
    card.appendChild(cardHead("📝", "텍스트", null, item));
    const body = document.createElement("div");
    body.className = "card-text";
    body.textContent = item.content || "";
    card.appendChild(body);
    card.appendChild(
      cardActions(item, [
        {
          label: "복사",
          onClick: () => copyText(item.content || ""),
        },
      ])
    );
    return card;
  }

  const icon =
    item.kind === "image" ? "📷" : item.kind === "video" ? "🎬" : "📄";
  card.appendChild(cardHead(icon, item.name, item.quality, item));

  if (item.kind === "image" && item.downloadURL) {
    const img = document.createElement("img");
    img.className = "card-thumb";
    img.loading = "lazy";
    img.src = item.downloadURL;
    img.alt = item.name;
    card.appendChild(img);
  } else if (item.kind === "video" && item.downloadURL) {
    const video = document.createElement("video");
    video.controls = true;
    video.preload = "metadata";
    video.src = item.downloadURL;
    card.appendChild(video);
  }

  card.appendChild(
    cardActions(item, [
      {
        label: "다운로드",
        onClick: () => downloadFile(item),
      },
    ])
  );
  return card;
}

function cardHead(icon, name, quality, item) {
  const head = document.createElement("div");
  head.className = "card-head";

  const ic = document.createElement("span");
  ic.className = "card-icon";
  ic.textContent = icon;
  head.appendChild(ic);

  const nm = document.createElement("span");
  nm.className = "card-name";
  nm.textContent = name;
  head.appendChild(nm);

  if (quality) {
    const tag = document.createElement("span");
    tag.className = "tag " + (quality === "original" ? "original" : "compressed");
    tag.textContent = quality === "original" ? "원본" : "저화질";
    head.appendChild(tag);
  }
  return head;
}

function cardActions(item, extra) {
  const wrap = document.createElement("div");

  const meta = document.createElement("div");
  meta.className = "card-meta";
  const parts = [];
  if (typeof item.size === "number" && item.kind !== "text") {
    parts.push(formatBytes(item.size));
  }
  parts.push(relativeTime(item.createdAt));
  meta.textContent = parts.join(" · ");

  const actions = document.createElement("div");
  actions.className = "card-actions";
  for (const a of extra) {
    const btn = document.createElement("button");
    btn.textContent = a.label;
    btn.addEventListener("click", a.onClick);
    actions.appendChild(btn);
  }
  const del = document.createElement("button");
  del.className = "danger";
  del.textContent = "삭제";
  del.addEventListener("click", () => removeItem(item));
  actions.appendChild(del);

  wrap.appendChild(meta);
  wrap.appendChild(actions);
  return wrap;
}

/* ------------------------------------------------------------------ */
/* 텍스트 등록                                                          */
/* ------------------------------------------------------------------ */
$("textSubmit").addEventListener("click", async () => {
  const input = $("textInput");
  const content = input.value.trim();
  if (!content) return;
  if (content.length > 20000) {
    toast("텍스트가 너무 깁니다(2만자 제한).");
    return;
  }
  try {
    await addDoc(collection(db, "files"), {
      kind: "text",
      content,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + TTL_MS),
    });
    input.value = "";
  } catch (err) {
    console.error(err);
    toast("텍스트 등록에 실패했습니다.");
  }
});

/* ------------------------------------------------------------------ */
/* 업로드                                                              */
/* ------------------------------------------------------------------ */
$("pickFile").addEventListener("click", () => $("fileInput").click());
$("pickImageCompressed").addEventListener("click", () =>
  $("imageInputCompressed").click()
);
$("pickImageOriginal").addEventListener("click", () =>
  $("imageInputOriginal").click()
);

$("fileInput").addEventListener("change", (e) => {
  handleFiles([...e.target.files], { imageMode: null });
  e.target.value = "";
});
$("imageInputCompressed").addEventListener("change", (e) => {
  handleFiles([...e.target.files], { imageMode: "compressed" });
  e.target.value = "";
});
$("imageInputOriginal").addEventListener("change", (e) => {
  handleFiles([...e.target.files], { imageMode: "original" });
  e.target.value = "";
});

// 드래그 & 드롭 (원본 업로드로 처리)
const dropzone = $("dropzone");
["dragenter", "dragover"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  })
);
["dragleave", "drop"].forEach((ev) =>
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  })
);
dropzone.addEventListener("drop", (e) => {
  const files = e.dataTransfer && e.dataTransfer.files;
  if (files && files.length) handleFiles([...files], { imageMode: null });
});

async function handleFiles(files, { imageMode }) {
  for (const file of files) {
    try {
      await uploadOne(file, imageMode);
    } catch (err) {
      console.error(err);
      toast(`${file.name} 업로드 실패: ${err.message || err}`);
    }
  }
}

async function uploadOne(file, imageMode) {
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");

  let kind = isImage ? "image" : isVideo ? "video" : "file";
  let quality = null;
  let blob = file;
  let name = file.name;

  // 이미지 저화질 변환 (버튼으로 명시했거나, 일반 업로드는 원본 유지)
  if (isImage) {
    if (imageMode === "compressed") {
      const prog = addProgress(`${name} 압축 중…`);
      try {
        blob = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });
        quality = "compressed";
        // 압축 결과는 jpeg 로 나올 수 있으므로 확장자 정리는 생략(원 파일명 유지)
      } finally {
        prog.remove();
      }
    } else {
      quality = "original";
    }
  }

  // 크기 검증(클라이언트 선검증; 규칙에서도 재검증됨)
  const limit = isVideo ? VIDEO_MAX_BYTES : isImage ? IMAGE_MAX_BYTES : FILE_MAX_BYTES;
  if (blob.size > limit) {
    throw new Error(`크기 초과 (${formatBytes(blob.size)} > ${formatBytes(limit)})`);
  }

  const path = `uploads/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}-${sanitize(name)}`;
  const sref = storageRef(storage, path);
  const contentType = blob.type || file.type || "application/octet-stream";

  const prog = addProgress(name, true);
  const task = uploadBytesResumable(sref, blob, { contentType });
  await new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
        const pct = snap.totalBytes
          ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100)
          : 0;
        prog.setPercent(pct);
      },
      reject,
      resolve
    );
  });
  const downloadURL = await getDownloadURL(sref);
  prog.remove();

  await addDoc(collection(db, "files"), {
    kind,
    name,
    mime: contentType,
    size: blob.size,
    quality,
    storagePath: path,
    downloadURL,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + TTL_MS),
  });
}

/* ------------------------------------------------------------------ */
/* 다운로드 / 삭제 / 복사                                               */
/* ------------------------------------------------------------------ */
async function downloadFile(item) {
  try {
    // downloadURL 을 fetch → blob → 앵커로 저장 (파일명 유지)
    const res = await fetch(item.downloadURL);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = item.name || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error(err);
    // 실패 시 새 탭으로 열기(브라우저 저장)
    window.open(item.downloadURL, "_blank");
  }
}

async function removeItem(item) {
  if (!confirm("삭제하시겠습니까?")) return;
  try {
    if (item.storagePath) {
      await deleteObject(storageRef(storage, item.storagePath)).catch((e) =>
        console.warn("Storage 삭제 경고", e.message)
      );
    }
    await deleteDoc(doc(db, "files", item.id));
  } catch (err) {
    console.error(err);
    toast("삭제에 실패했습니다.");
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("복사되었습니다.");
  } catch {
    // 폴백
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    toast("복사되었습니다.");
  }
}

/* ------------------------------------------------------------------ */
/* 진행 표시 / 유틸                                                     */
/* ------------------------------------------------------------------ */
function addProgress(label, withBar) {
  const li = document.createElement("li");
  li.className = "progress-item";
  li.textContent = label;
  let barInner = null;
  if (withBar) {
    const bar = document.createElement("div");
    bar.className = "progress-bar";
    barInner = document.createElement("span");
    bar.appendChild(barInner);
    li.appendChild(bar);
  }
  progressList.appendChild(li);
  return {
    setPercent: (p) => {
      if (barInner) barInner.style.width = p + "%";
    },
    remove: () => li.remove(),
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function relativeTime(ts) {
  if (!ts || !ts.toMillis) return "방금";
  const diff = Date.now() - ts.toMillis();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

function sanitize(name) {
  return name.replace(/[^\w.\-가-힣]/g, "_").slice(0, 80);
}

let toastTimer = null;
function toast(msg) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2600);
}

/* ------------------------------------------------------------------ */
/* 서비스워커 등록                                                      */
/* ------------------------------------------------------------------ */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
