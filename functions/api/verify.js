// POST /api/verify
// 관리자 비밀번호가 맞는지만 확인하는 가벼운 엔드포인트.
// 실제 데이터 저장은 /api/config 에서 다시 한 번 비밀번호를 검사합니다.

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse({ ok: false, error: "잘못된 요청입니다." }, 400);
  }

  const inputPassword = (body.password || "").toString();
  const correctPassword = (env.ADMIN_PASSWORD || "").toString();

  if (!correctPassword) {
    // 관리자가 환경변수 설정을 깜빡한 경우를 위한 안전장치
    return jsonResponse(
      { ok: false, error: "서버에 관리자 비밀번호가 설정되어 있지 않습니다." },
      500
    );
  }

  if (inputPassword && timingSafeEqual(inputPassword, correctPassword)) {
    return jsonResponse({ ok: true });
  }

  return jsonResponse({ ok: false }, 401);
}

// 문자열 길이로 인한 타이밍 공격을 어느 정도 방지하기 위한 단순 비교 함수
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
