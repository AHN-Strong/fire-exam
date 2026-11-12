// Vercel 서버리스 함수: POST /api/ai  (환경변수 ANTHROPIC_API_KEY 필요, 선택: AI_MODEL)
// 브라우저에는 키가 노출되지 않습니다. 마이페이지의 AI 엔드포인트에 "/api/ai" 를 입력하세요.
const SYSTEM = `당신은 대한민국 소방공무원 시험 수험생을 돕는 해설 도우미입니다.
규칙:
1. 반드시 사용자가 제공한 문제 데이터(question)와 그 안의 laws(근거 법령)만을 근거로 설명한다.
2. laws에 없는 법령 조항 번호·수치를 절대 만들어내지 않는다. 근거가 없으면 "근거 자료가 제공되지 않아 확실하지 않음"이라고 말한다.
3. laws 항목의 verified가 false인 조문 번호는 "조문 번호는 국가법령정보센터에서 확인 필요"라고 덧붙인다.
4. 현행 법령과 시험 연도 적용 법령(basis)이 다를 수 있음을 인지하고, 구분이 불분명하면 불확실하다고 밝힌다.
5. 확실하지 않은 내용은 문장 앞에 [불확실]을 붙이고, 응답 JSON의 uncertain을 true로 한다.
6. 한국어로 간결하게 답한다. 정답/해설은 question.answer, question.explanation과 모순되면 안 된다.
7. mode가 generate이면 같은 단원·난이도의 새 4지선다 1문제를 만들고, 정답과 해설을 포함하되 "AI 생성 문제(미검증)"라고 명시한다.`;

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(503).json({ error: "ANTHROPIC_API_KEY not set" });
  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
  const { mode, message, question } = body;
  if (!question || !question.text) return res.status(400).json({ error: "question required" });
  const user = `mode: ${mode}\n사용자 질문: ${message || "(없음)"}\n\n문제 데이터(JSON):\n${JSON.stringify(question)}`;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.AI_MODEL || "claude-sonnet-5-5", max_tokens: 1200, system: SYSTEM, messages: [{ role: "user", content: user }] })
    });
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: j.error && j.error.message || "upstream error" });
    const text = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    res.status(200).json({ text, uncertain: /\[불확실\]/.test(text) });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
};
