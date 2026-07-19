// GET  /api/config  -> 누구나 접근 가능 (메인 화면에서 사용)
// POST /api/config  -> 비밀번호 필요 (관리자 화면에서 사용)
//
// Cloudflare Pages 설정에서 KV Namespace를 "CHURCH_KV" 라는 이름으로 바인딩해야 합니다.
// (Pages 프로젝트 > Settings > Functions > KV namespace bindings)

const KV_KEY = "church-config";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // base64 문자열 기준 약 5MB 제한 (원본 이미지 약 3.7MB 수준)

export async function onRequestGet(context) {
  const { env } = context;

  try {
    const raw = await env.CHURCH_KV.get(KV_KEY);
    if (!raw) {
      return jsonResponse({ youtubeUrl: "", bulletinImage: "", updatedAt: null });
    }
    return jsonResponse(JSON.parse(raw));
  } catch (err) {
    return jsonResponse(
      { error: "데이터를 불러오지 못했습니다.", detail: String(err) },
      500
    );
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ ok: false, error: "잘못된 요청 형식입니다." }, 400);
  }

  // 1) 비밀번호 확인 (저장 시에도 반드시 재검증)
  const correctPassword = (env.ADMIN_PASSWORD || "").toString();
  const inputPassword = (body.password || "").toString();

  if (!correctPassword) {
    return jsonResponse(
      { ok: false, error: "서버에 관리자 비밀번호가 설정되어 있지 않습니다." },
      500
    );
  }
  if (!inputPassword || !timingSafeEqual(inputPassword, correctPassword)) {
    return jsonResponse({ ok: false, error: "비밀번호가 올바르지 않습니다." }, 401);
  }

  // 2) 입력값 검증
  const youtubeUrl = (body.youtubeUrl || "").toString().trim();
  const bulletinImage = (body.bulletinImage || "").toString();

  if (youtubeUrl && !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(youtubeUrl)) {
    return jsonResponse({ ok: false, error: "유튜브 주소 형식이 올바르지 않습니다." }, 400);
  }

  if (bulletinImage) {
    if (!bulletinImage.startsWith("data:image/")) {
      return jsonResponse({ ok: false, error: "이미지 형식이 올바르지 않습니다." }, 400);
    }
    if (bulletinImage.length > MAX_IMAGE_BYTES) {
      return jsonResponse(
        { ok: false, error: "이미지 용량이 너무 큽니다. 더 작은 사진으로 시도해 주세요." },
        400
      );
    }
  }

  // 3) 저장
  const data = {
    youtubeUrl,
    bulletinImage,
    updatedAt: new Date().toISOString(),
  };

  try {
    await env.CHURCH_KV.put(KV_KEY, JSON.stringify(data));
    return jsonResponse({ ok: true, updatedAt: data.updatedAt });
  } catch (err) {
    return jsonResponse(
      { ok: false, error: "저장 중 오류가 발생했습니다.", detail: String(err) },
      500
    );
  }
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
