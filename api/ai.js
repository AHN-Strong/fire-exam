// Vercel 서버리스 함수: POST /api/ai
// 환경변수: ANTHROPIC_API_KEY (필수), AI_MODEL (선택, 기본 claude-sonnet-5-5),
//           ALLOWED_ORIGINS (선택, 쉼표 구분. 기본 https://ahn-strong.github.io), DAILY_LIMIT (선택, IP당 하루 요청 수, 기본 40)
// API 키는 서버에만 있고 브라우저/GitHub에는 노출되지 않습니다.
const ORIGINS = (process.env.ALLOWED_ORIGINS || "https://ahn-strong.github.io").split(",").map((s) => s.trim());
const LIMIT = parseInt(process.env.DAILY_LIMIT || "40", 10);
const hits = new Map(); // 인스턴스 메모리 기반의 간이 제한(서버리스 특성상 완전하지 않음 → Anthropic 콘솔에서 월 사용 한도도 설정하세요)

const SYSTEM = `당신은 대한민국 소방공무원 시험 수험생을 돕는 해설 도우미입니다.
규칙:
1. 반드시 사용자가 제공한 문제 데이터(question)와 그 안의 laws(근거 법령), explanation, why(선택지별 해설)만을 근거로 설명한다.
2. laws에 없는 법령 조항 번호·수치를 절대 만들어내지 않는다. 근거가 없으면 "근거 자료가 제공되지 않아 확실하지 않음"이라고 말한다.
3. laws의 verified가 false인 조문은 "조문 번호는 국가법령정보센터에서 확인 필요"라고 덧붙인다.
4. 현행 법령과 시험 연도 적용 법령(basis)이 다를 수 있음을 인지하고, 구분이 불분명하면 불확실하다고 밝힌다.
5. 확실하지 않은 내용은 문장 앞에 [불확실]을 붙인다.
6. 정답은 question.answer(공식 가답안 기준)이며 이와 모순되게 말하지 않는다. 가답안이 의심스러우면 "가답안 기준"임을 밝히고 이유를 [불확실]로 표시한다.
7. 한국어로, 수험생이 이해하기 쉽게 간결하게 답한다(최대 12문장).
8. mode 설명: easy=쉬운 말로 풀이, terms=법률·용어 풀이, choices=각 선택지가 맞거나 틀린 이유, concept=관련 개념 추가 설명, ask=수험생 질문에 답변, mywrong=수험생이 고른 선택지(selected)가 왜 틀렸는지 + 헷갈린 포인트 + 다음에 틀리지 않는 암기 요령, generate=같은 단원·난이도의 새 4지선다 1문제(정답·해설 포함, "AI 생성 문제(미검증)" 명시).`;

function cors(req, res) {
  const o = req.headers.origin;
  if (o && ORIGINS.includes(o)) {
    res.setHeader("Access-Control-Allow-Origin", o);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const origin = req.headers.origin;
  if (!origin || !ORIGINS.includes(origin)) return res.status(403).json({ error: "허용되지 않은 출처입니다" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: "ANTHROPIC_API_KEY not set" });

  // 간이 일일 한도(IP 기준)
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "?";
  const day = new Date().toISOString().slice(0, 10), k = day + "|" + ip, n = (hits.get(k) || 0) + 1;
  hits.set(k, n); if (hits.size > 5000) hits.clear();
  if (n > LIMIT) return res.status(429).json({ error: "오늘 AI 해설 사용 한도를 넘었습니다. 내일 다시 이용해 주세요." });

  let body;
  try { body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {}; } catch (e) { return res.status(400).json({ error: "bad json" }); }
  const { mode, message, question, selected } = body;
  if (!question || typeof question.text !== "string") return res.status(400).json({ error: "question required" });
  if (JSON.stringify(body).length > 12000) return res.status(413).json({ error: "too large" });
  const user = `mode: ${String(mode).slice(0, 20)}\n수험생이 고른 선택지(selected): ${selected ? JSON.stringify(selected) : "(없음)"}\n수험생 질문: ${String(message || "(없음)").slice(0, 500)}\n\n문제 데이터(JSON):\n${JSON.stringify(question)}`;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.AI_MODEL || "claude-sonnet-5-5", max_tokens: 900, system: SYSTEM, messages: [{ role: "user", content: user }] })
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: (j.error && j.error.message) || "upstream error" });
    const text = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    res.status(200).json({ text, uncertain: /\[불확실\]/.test(text) });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
};
