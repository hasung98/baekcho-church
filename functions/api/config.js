const KV_KEY = "church-config";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function onRequestGet(context) {
  const { env } = context;

  try {
    // KV 바인딩 확인
    if (!env.CHURCH_KV) {
      throw new Error("CHURCH_KV binding not found");
    }

    const raw = await env.CHURCH_KV.get(KV_KEY);

    if (!raw) {
      return jsonResponse({
        youtubeUrl: "",
        bulletinImage: "",
        updatedAt: null,
      });
    }

    return jsonResponse(JSON.parse(raw));
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        where: "GET /api/config",
        error: err.message,
        stack: String(err),
        hasKV: !!env.CHURCH_KV,
      },
      500,
    );
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;

  try {
    body = await request.json();
  } catch (e) {
    return jsonResponse(
      {
        ok: false,
        error: "잘못된 요청 형식입니다.",
      },
      400,
    );
  }

  try {
    if (!env.CHURCH_KV) {
      throw new Error("CHURCH_KV binding not found");
    }

    const correctPassword = String(env.ADMIN_PASSWORD || "");
    const inputPassword = String(body.password || "");

    if (!correctPassword) {
      throw new Error("ADMIN_PASSWORD not found");
    }

    if (!inputPassword || !timingSafeEqual(inputPassword, correctPassword)) {
      return jsonResponse(
        {
          ok: false,
          error: "비밀번호가 올바르지 않습니다.",
        },
        401,
      );
    }

    const youtubeUrl = String(body.youtubeUrl || "").trim();
    const bulletinImage = String(body.bulletinImage || "");

    if (
      youtubeUrl &&
      !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(youtubeUrl)
    ) {
      return jsonResponse(
        {
          ok: false,
          error: "유튜브 주소 형식이 올바르지 않습니다.",
        },
        400,
      );
    }

    if (bulletinImage) {
      if (!bulletinImage.startsWith("data:image/")) {
        return jsonResponse(
          {
            ok: false,
            error: "이미지 형식이 올바르지 않습니다.",
          },
          400,
        );
      }

      if (bulletinImage.length > MAX_IMAGE_BYTES) {
        return jsonResponse(
          {
            ok: false,
            error: "이미지 용량이 너무 큽니다.",
          },
          400,
        );
      }
    }

    const data = {
      youtubeUrl,
      bulletinImage,
      updatedAt: new Date().toISOString(),
    };

    await env.CHURCH_KV.put(KV_KEY, JSON.stringify(data));

    return jsonResponse({
      ok: true,
      updatedAt: data.updatedAt,
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        where: "POST /api/config",
        error: err.message,
        stack: String(err),
        hasKV: !!env.CHURCH_KV,
        hasPassword: !!env.ADMIN_PASSWORD,
      },
      500,
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
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
