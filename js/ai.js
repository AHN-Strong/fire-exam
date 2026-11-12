/* AI 해설 모듈.
 * - 설정(마이페이지)에 AI 엔드포인트가 있으면 서버(/api/ai)로 질의. 키는 서버 환경변수에만 보관(브라우저에 두지 않음).
 * - 엔드포인트가 없거나 실패하면 DB에 저장된 해설·법령·개념노트·용어집으로 만든 "로컬 해설"로 대체. 문제 풀이/오답노트는 AI 없이 동작.
 * - 서버에는 문제 데이터와 근거 법령 메타데이터만 전달하며, 법령 근거가 없으면 조문을 만들어내지 말라고 지시함(api/ai.js 참고).
 */
FE.ai = (function () {
  var MODES = {
    easy: "쉬운 말로 설명", terms: "법률·용어 풀이", choices: "선택지별 오답 분석",
    concept: "관련 개념 더 보기", similar: "유사 문제", generate: "유사 문제 생성", ask: "질문"
  };
  function endpoint() { return (FE.store.S.settings.aiEndpoint || "").trim(); }
  function enabled() { return !!endpoint(); }

  function payload(q, mode, message) {
    var ch = FE.store.chapterById(q.chapterId), sj = FE.store.subjectById(q.subjectId);
    return {
      mode: mode, message: message || "",
      question: {
        id: q.id, subject: sj && sj.name, chapter: ch && ch.name, year: q.year, type: q.type,
        text: q.text, choices: q.choices, answer: q.answer, explanation: q.explanation, why: q.why || [],
        laws: (q.laws || []).map(function (l) { return { name: l.name, article: l.article, note: l.note, basis: l.basis, verified: !!l.verified }; })
      }
    };
  }

  function local(q, mode, message) {
    var ch = FE.store.chapterById(q.chapterId), lines = [], gl = FE_SEED.glossary;
    if (mode === "easy") {
      lines.push("**핵심 정리**\n" + q.explanation);
      lines.push("정답은 " + q.answer + "번 「" + q.choices[q.answer - 1] + "」 입니다.");
    } else if (mode === "terms") {
      var hits = Object.keys(gl).filter(function (t) { return (q.text + q.choices.join(" ") + q.explanation).indexOf(t) >= 0; });
      if (hits.length) lines.push("**이 문제의 용어 풀이**\n" + hits.map(function (t) { return "• " + t + ": " + gl[t]; }).join("\n"));
      else lines.push("이 문제와 관련해 등록된 용어 설명이 아직 없습니다.");
      if ((q.laws || []).length) lines.push("**관련 법령**\n" + q.laws.map(function (l) { return "• " + l.name + " " + l.article + (l.note ? " (" + l.note + ")" : "") + (l.verified ? "" : " — 조문 번호 미검증"); }).join("\n"));
    } else if (mode === "choices") {
      lines.push("**선택지별 분석**\n" + q.choices.map(function (c, i) {
        return (i + 1 === q.answer ? "✅ " : "❌ ") + (i + 1) + ". " + c + "\n   → " + ((q.why || [])[i] || "등록된 선택지별 해설이 없습니다.");
      }).join("\n"));
    } else if (mode === "concept") {
      lines.push(ch && ch.note ? "**" + ch.name + " 핵심 개념**\n" + ch.note : "이 단원에 등록된 개념 노트가 없습니다.");
    } else if (mode === "generate") {
      lines.push("유사 문제 ‘생성’은 AI 연결이 필요합니다. 마이페이지에서 AI 엔드포인트를 설정하세요. 대신 같은 단원의 저장된 문제를 아래 ‘유사 문제’에서 풀어볼 수 있습니다.");
    } else {
      lines.push("추가 질문 답변은 AI 연결이 필요합니다(현재 미연결). 저장된 해설을 대신 보여드립니다.\n" + q.explanation);
    }
    return { text: lines.join("\n\n"), source: "local", uncertain: false };
  }

  function ask(q, mode, message) {
    if (!enabled() || mode === "similar") return Promise.resolve(local(q, mode, message));
    var ctrl = new AbortController(), t = setTimeout(function () { ctrl.abort(); }, 30000);
    return fetch(endpoint(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload(q, mode, message)), signal: ctrl.signal })
      .then(function (r) { clearTimeout(t); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        if (!j || !j.text) throw new Error("빈 응답");
        return { text: String(j.text), source: "llm", uncertain: !!j.uncertain };
      })
      .catch(function (e) {
        var r = local(q, mode, message);
        r.text = "⚠ AI 서버에 연결하지 못해(" + e.message + ") 저장된 해설로 대신 표시합니다.\n\n" + r.text;
        return r;
      });
  }
  return { ask: ask, enabled: enabled, MODES: MODES, payload: payload };
})();
