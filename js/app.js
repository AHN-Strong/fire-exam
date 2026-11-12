/* 화면/라우팅/동작. 데이터는 FE.store, 차트는 FE.charts, AI는 FE.ai */
(function () {
  var st = FE.store, S = st.S;
  var $v = document.getElementById("view");
  var MENU = [["home", "홈", "🏠"], ["practice", "문제 풀이", "✏️"], ["exam", "모의고사", "📝"], ["wrong", "오답노트", "📕"], ["stats", "학습 통계", "📊"], ["me", "마이페이지", "👤"]];
  var TYPE_LABEL = { sample: "샘플(자체제작)", past: "기출(출처확인)", ai: "AI 생성", unverified: "출처 미확인" };
  var timerId = null, qStart = Date.now(), setup = { mode: "random", subjectId: "", year: "", chapterId: "", difficulty: "", count: 10 };
  var examSetup = { kind: "real", scope: "all", count: 25, minutes: 0, wrongOnly: false, pastOnly: true };
  var adminState = { subjectId: "", type: "", q: "", editing: null };

  /* ---------- 유틸 ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function fmt(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>"); }
  function dur(sec) { sec = Math.round(sec || 0); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return h ? h + "시간 " + m + "분" : m ? m + "분 " + s + "초" : s + "초"; }
  function mmss(sec) { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ":" + (sec % 60 < 10 ? "0" : "") + sec % 60; }
  function pct(v) { return v == null ? "-" : v + "%"; }
  function toast(msg) { var t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2200); }
  function modal(html) { var m = document.createElement("div"); m.className = "modal-bg"; m.innerHTML = '<div class="modal">' + html + "</div>"; m.addEventListener("click", function (e) { if (e.target === m) m.remove(); }); document.body.appendChild(m); return m; }
  function closeModal() { document.querySelectorAll(".modal-bg").forEach(function (m) { m.remove(); }); }
  function go(h) { if (location.hash === h) route(); else location.hash = h; }
  function badge(q) { return '<span class="badge b-' + q.type + '">' + TYPE_LABEL[q.type] + "</span>"; }
  function subjName(id) { var s = st.subjectById(id); return s ? s.name : "-"; }
  function chapName(id) { var c = st.chapterById(id); return c ? c.name : "-"; }
  function opts(list, sel, blank) { return (blank != null ? '<option value="">' + blank + "</option>" : "") + list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(sel) ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join(""); }
  function val(id) { var e = document.getElementById(id); return e ? e.value : ""; }
  function stars(n) { return "★★★".slice(0, n) + "☆☆☆".slice(0, 3 - n); }
  function empty(msg, btn) { return '<div class="empty">' + msg + (btn || "") + "</div>"; }

  /* ---------- 라우터 ---------- */
  function route() {
    clearInterval(timerId); closeModal();
    var parts = (location.hash || "#/home").replace(/^#\/?/, "").split("/"), p = parts[0] || "home";
    var fn = { home: vHome, practice: vPractice, exam: vExam, wrong: vWrong, stats: vStats, me: vMe, admin: vAdmin }[p] || vHome;
    renderNav(p);
    fn(parts.slice(1));
    window.scrollTo(0, 0);
  }
  function renderNav(p) {
    document.getElementById("nav").innerHTML = MENU.map(function (m) { return '<a href="#/' + m[0] + '" class="' + (m[0] === p ? "on" : "") + '">' + m[1] + "</a>"; }).join("");
    document.getElementById("tabs").innerHTML = MENU.map(function (m) { return '<a href="#/' + m[0] + '" class="' + (m[0] === p ? "on" : "") + '"><b>' + m[2] + "</b>" + m[1].replace("문제 ", "") + "</a>"; }).join("");
  }

  /* ---------- 홈 ---------- */
  function vHome() {
    var o = st.overall(), t = st.today(), goal = S.profile.goal || 20, bs = st.bySubject(), weak = st.weakChapters(3);
    var wrongIds = Object.keys(S.wrong).sort(function (a, b) { return S.wrong[b].last - S.wrong[a].last; }).slice(0, 5);
    var h = '<h1>' + esc(S.profile.name) + '님, 오늘도 한 걸음 더</h1><p class="sub">' + S.profile.examYear + '년 시험 대비 · 꾸준한 반복이 합격을 만듭니다</p>';
    h += '<div class="grid g4">' +
      stat("전체 풀이 수", o.solved + "문제", "정답 " + o.correct + "개") + stat("전체 정답률", pct(o.rate), "") +
      stat("누적 학습 시간", o.sec ? dur(o.sec) : "0분", "오늘 " + dur(t.sec)) + stat("연속 학습", st.streakDays() + "일", "하루 1문제 이상 풀이") + "</div>";
    h += '<div class="grid g2" style="margin-top:14px"><div class="card"><h2>오늘의 학습 목표</h2><div class="row"><b style="font-size:22px">' + t.solved + " / " + goal + '</b><span class="sub" style="margin:0">문제</span><span class="sp"></span>' +
      (t.solved >= goal ? '<span class="badge b-past">목표 달성 🎉</span>' : "") + '</div><div class="prog" style="margin:10px 0 14px"><i style="width:' + Math.min(100, t.solved / goal * 100) + '%"></i></div>' +
      '<div class="row"><a class="btn" href="#/practice" data-act="quick" data-m="random">이어서 문제 풀기</a><a class="btn sec" href="#/exam">모의고사</a></div></div>';
    h += '<div class="card"><h2>과목별 정답률</h2>' + FE.charts.hbars(st.subjects().map(function (s) { var g = bs[s.id]; return { label: s.name, value: g ? g.rate : null, sub: g ? g.n + "문제" : "미풀이" }; })) + "</div></div>";
    h += '<div class="grid g2" style="margin-top:14px"><div class="card"><h2>취약 단원</h2>';
    h += weak.length ? '<div class="list">' + weak.map(function (w) { return '<div class="it"><div class="t"><b>' + esc(w.chapter.name) + "</b><small>" + subjName(w.chapter.subjectId) + " · " + w.n + '문제 풀이</small></div><b style="color:' + (w.rate < 50 ? "var(--ng)" : "var(--navy)") + '">' + pct(w.rate) + '</b><button class="btn sm sec" data-act="quick" data-m="chapter" data-id="' + w.chapter.id + '">연습</button></div>'; }).join("") + "</div>" : empty("문제를 풀면 취약 단원이 분석됩니다.");
    h += '</div><div class="card"><div class="row"><h2 style="margin:0">최근 오답 문제</h2><span class="sp"></span><a href="#/wrong">전체 보기</a></div>';
    h += wrongIds.length ? '<div class="list">' + wrongIds.map(function (id) { var q = st.questionById(id); if (!q) return ""; return '<div class="it"><div class="t"><b>' + esc(q.text) + "</b><small>" + subjName(q.subjectId) + " · " + esc(chapName(q.chapterId)) + " · " + S.wrong[id].count + '회 오답</small></div><button class="btn sm sec" data-act="one" data-id="' + id + '">다시 풀기</button></div>'; }).join("") + "</div>" : empty("아직 오답이 없습니다.");
    h += "</div></div>";
    if (!o.solved) h += '<div class="card" style="margin-top:14px"><h2>처음이신가요?</h2><p class="sub">‘문제 풀이’에서 과목을 골라 시작해 보세요. 현재 포함된 문제는 모두 <b>테스트용 샘플</b>이며 실제 기출이 아닙니다. 마이페이지 → 문제 데이터 관리에서 직접 확인한 기출/자료를 CSV·JSON으로 등록할 수 있습니다.</p></div>';
    $v.innerHTML = h;
  }
  function stat(k, v, s) { return '<div class="card stat"><div class="k">' + k + '</div><div class="v">' + v + '</div><div class="s">' + (s || "&nbsp;") + "</div></div>"; }

  /* ---------- 문제 카드(공용) ---------- */
  function choiceBtns(q, sel, answered) {
    return q.choices.map(function (c, i) {
      var n = i + 1, cls = "ch";
      if (answered) { if (n === q.answer) cls += " right"; else if (n === sel) cls += " wrong"; } else if (n === sel) cls += " sel";
      return '<button class="' + cls + '" data-act="pick" data-n="' + n + '"' + (answered ? " disabled" : "") + '><span class="n">' + n + '</span><span>' + esc(c) +
        (answered && q.why && q.why[i] ? '<span class="why">' + (n === q.answer ? "✔ 정답 · " : "✘ ") + esc(q.why[i]) + "</span>" : "") + "</span></button>";
    }).join("");
  }
  function qBody(q) {
    var h = '<div class="qtext">' + esc(q.text) + "</div>";
    if (q.image && /^img\/[\w.-]+$/.test(q.image)) h += '<img class="qimg" src="' + esc(q.image) + '" alt="문제 도식">';
    return h;
  }
  function qHead(q, no, total, showFlag) {
    return '<div class="qhead"><span class="qno">Q' + no + " / " + total + '</span><span class="badge b-subj">' + subjName(q.subjectId) + "</span>" + badge(q) +
      '<span style="color:var(--mut);font-size:13px">' + esc(chapName(q.chapterId)) + (q.year ? " · 기준 " + q.year : "") + " · " + stars(q.difficulty || 1) + "</span><span class=\"sp\"></span>" +
      (showFlag ? '<button class="btn sm sec" data-act="flag">' + (S.examRun && S.examRun.flags[q.id] ? "🚩 표시 해제" : "🚩 표시") + "</button>" : '<button class="btn sm sec" data-act="bm" aria-label="북마크">' + (S.bookmarks[q.id] ? "★ 북마크됨" : "☆ 북마크") + '</button><button class="btn sm sec" data-act="report">신고</button>') + "</div>";
  }

  /* ---------- 문제 풀이 ---------- */
  function vPractice(args) {
    var se = S.session;
    if (se && !se.closed) return se.summary ? practiceSummary() : practiceRun();
    practiceSetup();
  }
  function practiceSetup() {
    var f = setup, pool = st.buildPool(f), chs = st.chapters(f.subjectId);
    var h = '<h1>문제 풀이</h1><p class="sub">과목·연도·단원·난이도를 골라 원하는 문제만 풀 수 있어요.</p><div class="card">';
    h += '<div class="fgrid"><div><label class="f">과목</label><select id="f-subj" data-set="subjectId">' + opts(st.subjects().map(function (s) { return [s.id, s.name]; }), f.subjectId, "전체 과목") + "</select></div>" +
      '<div><label class="f">기준 연도</label><select data-set="year">' + opts(st.years().map(function (y) { return [y, y + "년"]; }), f.year, "전체 연도") + "</select></div>" +
      '<div><label class="f">단원</label><select data-set="chapterId">' + opts(chs.map(function (c) { return [c.id, c.name]; }), f.chapterId, "전체 단원") + "</select></div>" +
      '<div><label class="f">난이도</label><select data-set="difficulty">' + opts([[1, "하 ★"], [2, "중 ★★"], [3, "상 ★★★"]], f.difficulty, "전체") + "</select></div>" +
      '<div><label class="f">문제 유형</label><select data-set="type">' + opts([["past", "기출문제"], ["sample", "샘플(자체제작)"], ["ai", "AI 생성"], ["unverified", "출처 미확인"]], f.type, "전체") + "</select></div>" +
      '<div><label class="f">문제 수</label><select data-set="count">' + opts([[5, "5문제"], [10, "10문제"], [20, "20문제"], [30, "30문제"], [999, "전체"]], f.count) + "</select></div></div>";
    h += '<label class="f" style="margin-top:14px">출제 방식</label><div class="chips">' + [["random", "전체 랜덤"], ["wrong", "이전에 틀린 문제"], ["unsolved", "풀지 않은 문제"], ["bookmark", "북마크한 문제"]].map(function (m) { return '<button class="chip' + (f.mode === m[0] ? " on" : "") + '" data-act="setmode" data-v="' + m[0] + '">' + m[1] + "</button>"; }).join("") + "</div>";
    h += '<label style="display:flex;gap:8px;margin-top:12px;align-items:center"><input type="checkbox" data-set="ordered"' + (f.ordered ? " checked" : "") + '> 출제 번호순으로 (기출 시험지 순서)</label>';
    h += '<div class="row" style="margin-top:18px"><b>조건에 맞는 문제 ' + pool.length + '개</b><span class="sp"></span><button class="btn" data-act="start"' + (pool.length ? "" : " disabled") + ">문제 풀이 시작</button></div>";
    if (!pool.length) h += '<p class="warn" style="margin-top:10px">조건에 맞는 문제가 없습니다. 조건을 바꾸거나 마이페이지에서 문제를 추가하세요.</p>';
    h += "</div>";
    $v.innerHTML = h;
  }
  function startSession(ids, label) {
    S.session = { ids: ids, idx: 0, ans: {}, pend: {}, startedAt: Date.now(), label: label || "" };
    st.save(); go("#/practice"); route();
  }
  function startFromSetup() {
    var pool = setup.ordered ? st.buildPool(setup).sort(st.paperOrder) : st.shuffle(st.buildPool(setup)), n = +setup.count || 10;
    if (!pool.length) return toast("조건에 맞는 문제가 없습니다");
    startSession(pool.slice(0, n).map(function (q) { return q.id; }));
  }
  function curQ() { var se = S.session; return se && st.questionById(se.ids[se.idx]); }
  function practiceRun() {
    var se = S.session, q = curQ();
    if (!q) { // 삭제된 문제 등 → 건너뛰기
      se.ids.splice(se.idx, 1); if (se.idx >= se.ids.length) { se.summary = true; } st.save(); return vPractice(); }
    var a = se.ans[q.id], answered = !!a, sel = answered ? a.sel : se.pend[q.id];
    if (!answered) qStart = Date.now();
    var last = se.idx === se.ids.length - 1;
    var h = '<div class="qwrap">' + qHead(q, se.idx + 1, se.ids.length) + '<div class="prog" style="margin-bottom:12px"><i style="width:' + (Object.keys(se.ans).length / se.ids.length * 100) + '%"></i></div>';
    h += qBody(q) + choiceBtns(q, sel, answered);
    if (answered) h += feedback(q, a);
    h += '<div class="actions"><button class="btn sec" data-act="prev"' + (se.idx === 0 ? " disabled" : "") + ">← 이전</button>" +
      (answered ? '<button class="btn" data-act="next">' + (last ? "결과 보기" : "다음 문제 →") + "</button>" : '<button class="btn" data-act="submit"' + (sel ? "" : " disabled") + ">정답 제출</button>" +
        '<button class="btn sec" data-act="next">' + (last ? "결과 보기" : "건너뛰기 →") + "</button>") + "</div>";
    h += '<p style="text-align:center"><button class="btn sm sec" data-act="endsession">풀이 종료</button></p></div>';
    $v.innerHTML = h;
  }
  function feedback(q, a) {
    var h = '<div class="result ' + (a.ok ? "ok" : "ng") + '">' + (a.ok ? "⭕ 정답입니다!" : "❌ 오답입니다") + " · 정답: " + q.answer + "번 " + (a.ok ? "" : '<span style="font-weight:400">(내 선택: ' + a.sel + "번)</span>") + "</div>";
    h += '<div class="card" style="margin-bottom:12px"><h2>상세 해설</h2><div class="expl">' + esc(q.explanation) + "</div>";
    h += '<p style="margin:12px 0 0;font-size:14px;color:var(--mut)">출제 단원: <b>' + subjName(q.subjectId) + " › " + esc(chapName(q.chapterId)) + "</b> · " + TYPE_LABEL[q.type] + (q.source && q.source.name ? " · 출처: " + esc(q.source.name) : "") + "</p>";
    if (q.type !== "past") h += '<p class="warn" style="margin-top:8px">이 문제는 실제 기출이 아닌 ' + TYPE_LABEL[q.type] + ' 문제입니다. 내용은 시험 전 교재·법령으로 재확인하세요.</p>';
    else if (q.answerStatus === "provisional") h += '<p class="warn" style="margin-top:8px">정답은 <b>가답안</b> 기준입니다. 최종 확정 답안은 소방청 공고로 확인하세요. 법령은 시험일(' + (q.year || "") + ') 시행 기준이라 현행과 다를 수 있습니다.</p>';
    h += "</div>";
    h += '<div class="card" style="margin-bottom:12px"><h2>관련 법령·근거</h2>' + ((q.laws || []).length ? q.laws.map(function (l) {
      return '<div class="law"><b>' + esc(l.name) + " " + esc(l.article) + "</b>" + (l.note ? " — " + esc(l.note) : "") + '<br><small style="color:var(--mut)">' + (l.basis === "exam-year" ? "시험 연도 적용 법령" : "현행 법령 기준") + (l.verified ? " · 확인됨" : " · ⚠ 조문 번호 미검증 — 국가법령정보센터(law.go.kr)에서 확인 필요") + "</small></div>";
    }).join("") : '<div class="empty">등록된 근거 법령이 없습니다. (근거를 찾을 수 없는 경우 임의로 조문을 표기하지 않습니다)</div>') + "</div>";
    var sim = st.similar(q, 3);
    h += '<div class="card" style="margin-bottom:12px"><h2>유사 문제 추천</h2>' + (sim.length ? '<div class="list">' + sim.map(function (x) { return '<div class="it"><div class="t"><b>' + esc(x.text) + "</b><small>" + esc(chapName(x.chapterId)) + '</small></div><button class="btn sm sec" data-act="one" data-id="' + x.id + '">풀기</button></div>'; }).join("") + "</div>" : empty("추천할 문제가 없습니다.")) + "</div>";
    h += '<div class="card"><h2>AI 해설 ' + (FE.ai.enabled() ? "" : '<span class="badge b-unverified">AI 미연결 · 저장된 해설 모드</span>') + '</h2><div class="chips">' +
      ["easy", "terms", "choices", "concept", "generate"].map(function (m) { return '<button class="chip" data-act="ai" data-m="' + m + '">' + FE.ai.MODES[m] + "</button>"; }).join("") + '</div>' +
      '<div class="row" style="margin-top:10px"><input type="text" id="ai-q" placeholder="이 문제에 대해 궁금한 점을 질문하세요" style="flex:1;min-width:200px"><button class="btn sm" data-act="ai" data-m="ask">질문</button></div><div id="ai-out"></div></div>';
    return h;
  }
  function submitAnswer() {
    var se = S.session, q = curQ(), sel = se.pend[q.id];
    if (!sel || se.ans[q.id]) return;
    var ok = st.recordAnswer(q, sel, "practice", (Date.now() - qStart) / 1000);
    se.ans[q.id] = { sel: sel, ok: ok }; st.save(); practiceRun();
  }
  function practiceSummary() {
    var se = S.session, ids = se.ids, ans = se.ans, done = ids.filter(function (i) { return ans[i]; }), okN = done.filter(function (i) { return ans[i].ok; }).length;
    var wrong = done.filter(function (i) { return !ans[i].ok; });
    var h = '<div class="qwrap"><h1>풀이 결과</h1><div class="grid g3"><div class="card stat"><div class="k">푼 문제</div><div class="v">' + done.length + " / " + ids.length + '</div></div><div class="card stat"><div class="k">정답</div><div class="v">' + okN + '</div></div><div class="card stat"><div class="k">정답률</div><div class="v">' + pct(st.pct(okN, done.length)) + "</div></div></div>";
    h += '<div class="card" style="margin-top:14px"><h2>틀린 문제 (' + wrong.length + ')</h2>' + (wrong.length ? '<div class="list">' + wrong.map(function (id) { var q = st.questionById(id); return '<div class="it"><div class="t"><b>' + esc(q.text) + "</b><small>" + esc(chapName(q.chapterId)) + " · 정답 " + q.answer + "번</small></div></div>"; }).join("") + "</div>" : empty("틀린 문제가 없습니다. 훌륭해요! 🎉")) + "</div>";
    h += '<div class="row" style="margin-top:14px">' + (wrong.length ? '<button class="btn" data-act="retrywrong">틀린 문제 다시 풀기</button>' : "") + '<button class="btn sec" data-act="newsession">새로 시작</button></div></div>';
    $v.innerHTML = h;
  }

  /* ---------- 모의고사 ---------- */
  function vExam(args) {
    if (args[0] === "result") return examResult(args[1]);
    if (S.examRun) { if (Date.now() >= S.examRun.endAt) return finishExam(true); return examRun(); }
    examSetupView();
  }
  function examSetupView() {
    var es = examSetup, subs = st.subjects(), ex = st.pastExams()[0];
    var KIND = [["real", "기출 그대로 (" + ex.year + "년)"], ["mix", "실전 난이도 랜덤"], ["custom", "맞춤 구성"]];
    var h = '<h1>모의고사</h1><p class="sub">실제 시험과 같은 환경에서 정답 표시 없이 풀고, 제출 후 결과를 분석합니다.</p>';
    h += examAnalysisCard(ex);
    h += '<div class="card" style="margin-top:14px"><label class="f">출제 방식</label><div class="chips">' + KIND.map(function (k) { return '<button class="chip' + (es.kind === k[0] ? " on" : "") + '" data-act="setkind" data-v="' + k[0] + '">' + k[1] + "</button>"; }).join("") + "</div>" +
      '<p class="sub" style="margin:8px 0 12px">' + ({ real: ex.name + "(" + ex.date + " 시행) 문제를 시험지 순서 그대로 출제합니다. 과목 순서·문항 수·시간이 실제와 같습니다.", mix: "과목별로 " + ex.year + "년 시험과 같은 난이도 분포(하/중/상 문항 수)로 문제 은행에서 무작위 추출합니다. 문제 데이터가 부족하면 다른 난이도로 채웁니다.", custom: "과목·문항 수·시간을 직접 정합니다." })[es.kind] + '</p><div class="fgrid">' +
      '<div><label class="f">시험 범위</label><select data-eset="scope">' + opts([["all", "전체 과목"]].concat(subs.map(function (s) { return [s.id, s.name]; })), es.scope) + "</select></div>" +
      (es.kind === "custom" ? '<div><label class="f">과목당 문제 수</label><select data-eset="count">' + opts([[5, "5"], [10, "10"], [20, "20"], [25, "25 (실제 시험 규모)"]], es.count) + "</select></div>" : "") +
      '<div><label class="f">제한 시간(분) · 0 = 문항당 1분</label><input type="number" min="0" max="300" data-eset="minutes" value="' + es.minutes + '"></div></div>' +
      (es.kind !== "real" ? '<label style="display:flex;gap:8px;margin-top:14px;align-items:center"><input type="checkbox" data-eset="pastOnly"' + (es.pastOnly ? " checked" : "") + '> 기출문제만 사용 (샘플·기타 제외)</label><label style="display:flex;gap:8px;margin-top:8px;align-items:center"><input type="checkbox" data-eset="wrongOnly"' + (es.wrongOnly ? " checked" : "") + "> 오답노트 문제만으로 구성</label>" : "");
    var ids = examPick(); h += '<div class="row" style="margin-top:16px"><b>출제 ' + ids.length + '문항 · 제한 ' + Math.round(examLimit(ids.length) / 60) + '분</b><span class="sp"></span><button class="btn" data-act="startexam"' + (ids.length ? "" : " disabled") + ">시험 시작</button></div>";
    if (!ids.length) h += '<p class="warn" style="margin-top:10px">출제할 문제가 없습니다. (오답이 없거나 해당 과목에 문제가 없음)</p>';
    h += '<p class="sub" style="margin:12px 0 0">※ 과목당 40점 미만이면 과락이 되는 시험이 일반적이나, 실제 기준은 해당 연도 시험 공고를 확인하세요. 점수 = 정답 수 ÷ 문항 수 × 100.</p></div>';
    h += '<div class="card" style="margin-top:14px"><h2>응시 기록</h2>' + (S.exams.length ? '<table><tr><th>일시</th><th>범위</th><th>점수</th><th>정답률</th><th>시간</th><th></th></tr>' + S.exams.slice().reverse().slice(0, 10).map(function (e) { return "<tr><td>" + new Date(e.ts).toLocaleDateString("ko-KR") + "</td><td>" + esc(e.scopeName) + "</td><td><b>" + e.score + "점</b></td><td>" + e.correct + "/" + e.total + "</td><td>" + dur(e.sec) + '</td><td><a href="#/exam/result/' + e.id + '">결과</a></td></tr>'; }).join("") + "</table>" : empty("아직 응시 기록이 없습니다.")) + "</div>";
    $v.innerHTML = h;
  }
  function examPick() {
    var es = examSetup;
    return st.buildPaper({ examId: st.pastExams()[0].id, kind: es.kind, scope: es.scope, count: es.count, wrongOnly: es.kind !== "real" && es.wrongOnly, pastOnly: es.pastOnly });
  }
  var DIFF_NAME = { 1: "하", 2: "중", 3: "상" }, SUBJ_SHORT = {};
  function examAnalysisCard(ex) {
    var a = st.analyzeExam(ex), h = '<div class="card"><h2>' + esc(ex.name) + " 출제 분석</h2>";
    h += '<p class="sub" style="margin:0 0 10px">' + ex.date + " 시행 · " + ex.order.length + "과목 × " + ex.perSubject + "문항 = " + ex.totalQuestions + "문항 · " + ex.choices + "지선다 · 시험시간 " + ex.timeMinutes + '분(공고 기준, 응시 전 최신 공고 확인) · 정답은 <b>가답안</b> 기준</p><div class="grid g3">';
    h += '<div><b style="font-size:14px">과목·난이도 분포</b><table><tr><th>과목</th><th>하</th><th>중</th><th>상</th></tr>' + ex.order.map(function (sid) { var s = a.subjects[sid]; return "<tr><td>" + subjName(sid) + "</td><td>" + s.diff[1] + "</td><td>" + s.diff[2] + "</td><td>" + s.diff[3] + "</td></tr>"; }).join("") + "<tr><th>합계</th><th>" + a.diff[1] + "</th><th>" + a.diff[2] + "</th><th>" + a.diff[3] + "</th></tr></table></div>";
    var fk = ["부정형", "긍정형", "보기형", "계산형", "판례형", "도식형"];
    h += '<div><b style="font-size:14px">문항 유형</b><table>' + fk.filter(function (k) { return a.format[k]; }).map(function (k) { return "<tr><td>" + k + "</td><td><b>" + a.format[k] + "</b>문항</td></tr>"; }).join("") + '</table><div style="font-size:12px;color:var(--mut)">부정형 = ‘옳지 않은/해당하지 않는 것’, 보기형 = &lt;보기&gt; 조합</div></div>';
    var ck = Object.keys(a.chapters).sort(function (x, y) { return a.chapters[y] - a.chapters[x]; }).slice(0, 6);
    h += '<div><b style="font-size:14px">많이 출제된 분야</b><table>' + ck.map(function (c) { return "<tr><td>" + esc(chapName(c)) + "</td><td><b>" + a.chapters[c] + "</b>문항</td></tr>"; }).join("") + "</table></div></div>";
    return h + '<p class="warn" style="margin-top:10px">난이도(하·중·상)는 공식 통계가 아닌 <b>자체 추정</b>입니다. 기준: 하=단일 개념, 중=보기 조합·법령 수치 1개, 상=계산·판례 세부·복수 수치 암기. 실제 응시자 정답률 데이터가 확보되면 교체하세요.</p></div>';
  }
  var examPreview = null;
  function examLimit(total) { return (+examSetup.minutes > 0 ? +examSetup.minutes : total) * 60; }
  function startExam() {
    var ids = examPick(); if (!ids.length) return;
    var limit = (+examSetup.minutes > 0 ? +examSetup.minutes * 60 : ids.length * 60);
    S.examRun = { id: st.uid("e"), ids: ids, answers: {}, flags: {}, idx: 0, startedAt: Date.now(), endAt: Date.now() + limit * 1000, limit: limit, scope: examSetup.scope, wrongOnly: examSetup.wrongOnly, kind: examSetup.kind };
    st.save(); route();
  }
  function examRun() {
    var er = S.examRun, q = st.questionById(er.ids[er.idx]);
    if (!q) { er.ids.splice(er.idx, 1); er.idx = Math.min(er.idx, er.ids.length - 1); st.save(); return er.ids.length ? examRun() : (S.examRun = null, st.save(), route()); }
    var sel = er.answers[q.id], left = (er.endAt - Date.now()) / 1000;
    var h = '<div class="qwrap"><div class="row" style="margin-bottom:10px"><b>' + (er.scope === "all" ? "전체 과목" : subjName(er.scope)) + ' 모의고사</b><span class="sp"></span><span>남은 시간</span> <span class="timer' + (left < 60 ? " low" : "") + '" id="timer">' + mmss(left) + "</span></div>";
    h += '<div class="card" style="margin-bottom:12px"><div class="nav-q">' + er.ids.map(function (id, i) { return '<button data-act="goq" data-i="' + i + '" class="' + (er.answers[id] ? "ans " : "") + (i === er.idx ? "cur " : "") + (er.flags[id] ? "flag" : "") + '">' + (i + 1) + "</button>"; }).join("") + '</div><div style="font-size:12px;color:var(--mut);margin-top:8px">답안 ' + Object.keys(er.answers).length + "/" + er.ids.length + " · 🟨 테두리 = 표시한 문제</div></div>";
    h += qHead(q, er.idx + 1, er.ids.length, true).replace(badge(q), "") + qBody(q) + choiceBtns(q, sel, false);
    h += '<div class="actions"><button class="btn sec" data-act="eprev"' + (er.idx === 0 ? " disabled" : "") + '>← 이전</button><button class="btn sec" data-act="enext"' + (er.idx === er.ids.length - 1 ? " disabled" : "") + '>다음 →</button><button class="btn" data-act="esubmit">제출하기</button></div></div>';
    $v.innerHTML = h;
    timerId = setInterval(function () {
      var l = (S.examRun.endAt - Date.now()) / 1000, t = document.getElementById("timer");
      if (l <= 0) { clearInterval(timerId); toast("시간 종료! 자동 제출합니다"); return finishExam(true); }
      if (t) { t.textContent = mmss(l); t.className = "timer" + (l < 60 ? " low" : ""); }
    }, 500);
  }
  function confirmExamSubmit() {
    var er = S.examRun, un = er.ids.map(function (id, i) { return er.answers[id] ? null : i + 1; }).filter(Boolean);
    var m = modal("<h2>제출 전 최종 확인</h2><p>전체 " + er.ids.length + "문항 중 <b>" + (er.ids.length - un.length) + "문항</b>에 답했습니다.</p>" +
      (un.length ? '<p class="warn">답을 선택하지 않은 문제: <b>' + un.join(", ") + "번</b><br>미선택 문제는 오답 처리됩니다.</p>" : "<p>모든 문제에 답했습니다.</p>") +
      '<div class="row" style="margin-top:14px">' + (un.length ? '<button class="btn sec" data-act="gofirst" data-i="' + (un[0] - 1) + '">미선택 문제로 이동</button>' : "") + '<span class="sp"></span><button class="btn sec" data-act="closemodal">계속 풀기</button><button class="btn" data-act="finalsubmit">최종 제출</button></div>');
  }
  function finishExam() {
    var er = S.examRun; if (!er) return route();
    clearInterval(timerId); closeModal();
    var elapsed = Math.min((Date.now() - er.startedAt) / 1000, er.limit), per = elapsed / er.ids.length, bySub = {}, byDiff = {}, correct = 0, wrongIds = [], prov = false;
    er.ids.forEach(function (id) {
      var q = st.questionById(id); if (!q) return;
      var sel = er.answers[id] || 0, ok = sel === q.answer;
      st.recordAnswer(q, sel, "exam", per);
      if (q.answerStatus === "provisional") prov = true;
      var b = bySub[q.subjectId] || (bySub[q.subjectId] = { n: 0, c: 0 }); b.n++; if (ok) { b.c++; correct++; } else wrongIds.push(id);
      var d = byDiff[q.difficulty] || (byDiff[q.difficulty] = { n: 0, c: 0 }); d.n++; if (ok) d.c++;
    });
    var KN = { real: "기출 그대로", mix: "실전 난이도 랜덤", custom: "맞춤" };
    var res = { id: er.id, ts: Date.now(), scope: er.scope, kind: er.kind || "custom", byDiff: byDiff, provisional: prov, scopeName: (er.scope === "all" ? "전체 과목" : subjName(er.scope)) + " · " + (KN[er.kind] || "맞춤"), total: er.ids.length, correct: correct, score: Math.round(correct / er.ids.length * 1000) / 10, sec: Math.round(elapsed), limit: er.limit, bySub: bySub, ids: er.ids, answers: er.answers, wrongIds: wrongIds };
    S.exams.push(res); S.examRun = null; st.save(); go("#/exam/result/" + res.id);
  }
  function examResult(id) {
    var e = S.exams.find(function (x) { return x.id === id; });
    if (!e) return go("#/exam");
    var prev = null; for (var i = S.exams.length - 1; i >= 0; i--) if (S.exams[i].ts < e.ts && S.exams[i].scope === e.scope) { prev = S.exams[i]; break; }
    var diff = prev ? Math.round((e.score - prev.score) * 10) / 10 : null;
    var chW = {}; e.wrongIds.forEach(function (qid) { var q = st.questionById(qid); if (q) chW[q.chapterId] = (chW[q.chapterId] || 0) + 1; });
    var weak = Object.keys(chW).sort(function (a, b) { return chW[b] - chW[a]; });
    var h = '<h1>모의고사 결과</h1><p class="sub">' + esc(e.scopeName) + " · " + new Date(e.ts).toLocaleString("ko-KR") + '</p><div class="grid g4">' + stat("총점", e.score + "점", "100점 만점") + stat("정답", e.correct + " / " + e.total, "정답률 " + pct(st.pct(e.correct, e.total))) + stat("소요 시간", dur(e.sec), "제한 " + dur(e.limit)) +
      stat("이전 대비", diff == null ? "첫 응시" : (diff >= 0 ? "▲ " : "▼ ") + Math.abs(diff) + "점", prev ? "직전 " + prev.score + "점" : "같은 범위 기록 없음") + "</div>";
    h += '<div class="grid g2" style="margin-top:14px"><div class="card"><h2>과목별 점수</h2>' + FE.charts.hbars(Object.keys(e.bySub).map(function (sid) { var b = e.bySub[sid], sc = st.pct(b.c, b.n); return { label: subjName(sid), value: sc, sub: b.c + "/" + b.n + (sc < 40 ? " 과락 위험" : "") }; })) + "</div>";
    h += '<div class="card"><h2>취약 단원</h2>' + (weak.length ? '<div class="list">' + weak.slice(0, 5).map(function (c) { return '<div class="it"><div class="t"><b>' + esc(chapName(c)) + "</b><small>" + subjName((st.chapterById(c) || {}).subjectId) + "</small></div><b>" + chW[c] + "문제 오답</b></div>"; }).join("") + "</div>" : empty("틀린 문제가 없습니다 🎉")) + "</div></div>";
    if (e.byDiff) h += '<div class="card" style="margin-top:14px"><h2>난이도별 정답률 (자체 추정 난이도)</h2>' + FE.charts.hbars([1, 2, 3].filter(function (d) { return e.byDiff[d]; }).map(function (d) { var b = e.byDiff[d]; return { label: "난이도 " + DIFF_NAME[d], value: st.pct(b.c, b.n), sub: b.c + "/" + b.n }; })) + "</div>";
    if (e.provisional) h += '<p class="warn" style="margin-top:14px">이 시험의 정답은 <b>가답안</b> 기준입니다. 이의제기로 최종 확정 답안이 달라졌을 수 있으니 소방청 확정 답안을 확인하세요.</p>';
    h += '<div class="card" style="margin-top:14px"><h2>틀린 문제 (' + e.wrongIds.length + ")</h2>" + (e.wrongIds.length ? e.wrongIds.map(function (qid) {
      var q = st.questionById(qid); if (!q) return ""; var sel = e.answers[qid];
      return "<details style=\"border-bottom:1px solid var(--line);padding:8px 0\"><summary><b>" + esc(q.text) + '</b> <small style="color:var(--mut)">(' + esc(chapName(q.chapterId)) + ")</small></summary><div style=\"padding:8px 0\">내 답: " + (sel ? sel + "번" : "미선택") + " · <b>정답: " + q.answer + "번 " + esc(q.choices[q.answer - 1]) + "</b><div class=\"expl\" style=\"margin-top:6px\">" + esc(q.explanation) + "</div></div></details>";
    }).join("") : empty("모두 정답!")) + "</div>";
    h += '<div class="row" style="margin-top:14px">' + (e.wrongIds.length ? '<button class="btn" data-act="reviewexam" data-id="' + e.id + '">틀린 문제 다시 풀기</button>' : "") + '<a class="btn sec" href="#/exam">모의고사 홈</a></div>';
    $v.innerHTML = h;
  }

  /* ---------- 오답노트 ---------- */
  var wf = { subjectId: "", chapterId: "", mastery: "open" };
  function vWrong() {
    var att = {}; S.attempts.forEach(function (a) { var o = att[a.qid] || (att[a.qid] = { n: 0, c: 0 }); o.n++; if (a.ok) o.c++; });
    var ids = Object.keys(S.wrong).filter(function (id) {
      var q = st.questionById(id); if (!q) return false; var w = S.wrong[id];
      if (wf.subjectId && q.subjectId !== wf.subjectId) return false;
      if (wf.chapterId && q.chapterId !== wf.chapterId) return false;
      if (wf.mastery === "open" && w.mastery >= 3) return false;
      if (wf.mastery === "done" && w.mastery < 3) return false;
      return true;
    }).sort(function (a, b) { return S.wrong[b].last - S.wrong[a].last; });
    var total = Object.keys(S.wrong).length, mast = Object.keys(S.wrong).filter(function (i) { return S.wrong[i].mastery >= 3; }).length;
    var h = '<h1>오답노트</h1><p class="sub">틀린 문제는 자동 저장됩니다. 한 번 맞혀도 삭제되지 않고, 연속 정답 3회 이상이면 ‘숙련’이 됩니다.</p><div class="grid g3">' + stat("저장된 오답", total + "문제", "") + stat("숙련 완료", mast + "문제", "연속 3회 이상 정답") + stat("복습 필요", (total - mast) + "문제", "") + "</div>";
    h += '<div class="card" style="margin-top:14px"><div class="fgrid"><div><label class="f">과목</label><select data-wf="subjectId">' + opts(st.subjects().map(function (s) { return [s.id, s.name]; }), wf.subjectId, "전체") + '</select></div><div><label class="f">단원</label><select data-wf="chapterId">' + opts(st.chapters(wf.subjectId).map(function (c) { return [c.id, c.name]; }), wf.chapterId, "전체") + '</select></div><div><label class="f">상태</label><select data-wf="mastery">' + opts([["open", "복습 필요"], ["done", "숙련"], ["all", "전체"]], wf.mastery) + "</select></div></div>";
    h += '<div class="row" style="margin-top:14px"><button class="btn" data-act="wrongpractice"' + (ids.length ? "" : " disabled") + '>이 목록 전체 풀기 (' + ids.length + ')</button><button class="btn sec" data-act="wrongexam"' + (total ? "" : " disabled") + ">오답 모의고사</button></div></div>";
    h += '<div class="card" style="margin-top:14px">' + (ids.length ? '<div class="list">' + ids.map(function (id) {
      var q = st.questionById(id), w = S.wrong[id], a = att[id] || { n: 0, c: 0 };
      return '<div class="it"><div class="t"><b>' + esc(q.text) + "</b><small>" + subjName(q.subjectId) + " › " + esc(chapName(q.chapterId)) + " · 틀린 횟수 " + w.count + "회 · 정답률 " + pct(st.pct(a.c, a.n)) + ' · 숙련도 <span class="mast">' + [1, 2, 3, 4, 5].map(function (i) { return '<i class="' + (i <= w.mastery ? "on" : "") + '"></i>'; }).join("") + "</span>" + (w.mastery >= 3 ? " <b style=\"color:var(--ok)\">숙련</b>" : "") + '</small></div><button class="btn sm sec" data-act="one" data-id="' + id + '">다시 풀기</button><button class="btn sm dng" data-act="delwrong" data-id="' + id + '">삭제</button></div>';
    }).join("") + "</div>" : empty(total ? "조건에 맞는 오답이 없습니다." : "저장된 오답이 없습니다. 문제를 풀다 틀리면 자동으로 쌓입니다.")) + "</div>";
    $v.innerHTML = h;
  }

  /* ---------- 학습 통계 ---------- */
  var statRange = "week";
  function vStats() {
    var o = st.overall(), days = st.lastDays(14), bs = st.bySubject(), bc = st.byChapter();
    var vol = statRange === "week" ? st.weekly(8) : st.monthly(6);
    var chRows = st.chapters().map(function (c) { var g = bc[c.id]; return { c: c, g: g }; }).filter(function (r) { return r.g; }).sort(function (a, b) { return a.g.rate - b.g.rate; });
    var rep = []; Object.keys(S.wrong).forEach(function (id) { var q = st.questionById(id); if (q) rep.push({ q: q, n: S.wrong[id].count }); }); rep.sort(function (a, b) { return b.n - a.n; });
    var bd = st.byDifficulty();
    var h = '<h1>학습 통계</h1><p class="sub">내 실력을 숫자와 그래프로 확인하세요.</p><div class="grid g4">' + stat("총 풀이", o.solved, "") + stat("정답률", pct(o.rate), "") + stat("학습 시간", dur(o.sec), "") + stat("연속 학습", st.streakDays() + "일", "") + "</div>";
    if (!o.solved) h += '<div style="margin-top:14px">' + empty("아직 풀이 기록이 없습니다. 문제를 풀면 통계가 채워집니다.", '<br><a class="btn" style="margin-top:10px" href="#/practice">문제 풀러 가기</a>') + "</div>";
    h += '<div class="grid g2" style="margin-top:14px"><div class="card"><h2>날짜별 문제 풀이 수 (최근 14일)</h2>' + FE.charts.bar(days.map(function (d) { return { label: d.label, value: d.solved }; }), { title: "날짜별 풀이 수" }) + "</div>" +
      '<div class="card"><h2>날짜별 정답률 (%)</h2>' + FE.charts.line(days.map(function (d) { return { label: d.label, value: d.rate }; }), { title: "날짜별 정답률" }) + "</div></div>";
    h += '<div class="card" style="margin-top:14px"><div class="row"><h2 style="margin:0">' + (statRange === "week" ? "주간" : "월간") + ' 학습량</h2><span class="sp"></span><div class="seg"><button data-act="range" data-v="week" class="' + (statRange === "week" ? "on" : "") + '">주간</button><button data-act="range" data-v="month" class="' + (statRange === "month" ? "on" : "") + '">월간</button></div></div>' + FE.charts.bar(vol.map(function (d) { return { label: d.label, value: d.solved }; }), { title: "학습량" }) + "</div>";
    h += '<div class="grid g2" style="margin-top:14px"><div class="card"><h2>과목별 정답률</h2>' + FE.charts.hbars(st.subjects().map(function (s) { var g = bs[s.id]; return { label: s.name, value: g ? g.rate : null, sub: g ? g.n + "문제" : "미풀이" }; })) + "</div>" +
      '<div class="card"><h2>단원별 정답률</h2>' + (chRows.length ? FE.charts.hbars(chRows.map(function (r) { return { label: r.c.name, value: r.g.rate, sub: r.g.n + "문제" }; })) : empty("데이터 없음")) + "</div></div>";
    h += '<div class="card" style="margin-top:14px"><h2>난이도별 정답률 (자체 추정 난이도)</h2>' + FE.charts.hbars([1, 2, 3].map(function (d) { var g = bd[d]; return { label: "난이도 " + DIFF_NAME[d], value: g ? g.rate : null, sub: g ? g.n + "문제" : "미풀이" }; })) + "</div>";
    h += '<div class="grid g2" style="margin-top:14px"><div class="card"><h2>취약 단원 순위</h2>' + (chRows.length ? '<table><tr><th>#</th><th>단원</th><th>정답률</th></tr>' + chRows.slice(0, 5).map(function (r, i) { return "<tr><td>" + (i + 1) + "</td><td>" + esc(r.c.name) + " <small style=\"color:var(--mut)\">" + subjName(r.c.subjectId) + "</small></td><td><b>" + pct(r.g.rate) + "</b></td></tr>"; }).join("") + "</table>" : empty("데이터 없음")) + "</div>" +
      '<div class="card"><h2>오답 반복 횟수 TOP</h2>' + (rep.length ? '<table><tr><th>문제</th><th>횟수</th></tr>' + rep.slice(0, 5).map(function (r) { return "<tr><td>" + esc(r.q.text.slice(0, 40)) + (r.q.text.length > 40 ? "…" : "") + "</td><td><b>" + r.n + "회</b></td></tr>"; }).join("") + "</table>" : empty("오답 없음")) + "</div></div>";
    $v.innerHTML = h;
  }

  /* ---------- 마이페이지 ---------- */
  function vMe() {
    var bms = Object.keys(S.bookmarks).map(function (id) { return st.questionById(id); }).filter(Boolean);
    var standalone = window.matchMedia && matchMedia("(display-mode: standalone)").matches;
    var h = '<h1>마이페이지</h1><div class="card" style="margin-bottom:14px"><h2>앱으로 설치</h2>' + (standalone ? '<p class="sub" style="margin:0">이미 앱으로 실행 중입니다. 오프라인에서도 사용할 수 있어요.</p>' :
      '<p class="sub" style="margin:0 0 10px">홈 화면/바탕화면에 앱처럼 설치하면 주소 입력 없이 바로 열리고 인터넷이 없어도 풀 수 있어요.</p><div class="row"><button class="btn" data-act="install"' + (window.__installEv ? "" : " disabled") + '>앱 설치하기</button><span class="sub" style="margin:0">' + (window.__installEv ? "" : "설치 버튼이 비활성이면: Android Chrome 메뉴(⋮) → ‘앱 설치’ / Windows Chrome·Edge 주소창 오른쪽 설치 아이콘. (https 주소에서만 가능)") + "</span></div>") + '</div><div class="grid g2"><div class="card"><h2>내 정보·목표</h2><label class="f">이름(닉네임)</label><input type="text" id="p-name" value="' + esc(S.profile.name) + '"><div class="fgrid" style="margin-top:10px"><div><label class="f">하루 목표 문제 수</label><input type="number" id="p-goal" min="1" max="500" value="' + S.profile.goal + '"></div><div><label class="f">응시 연도</label><select id="p-year">' + opts(st.years().map(function (y) { return [y, y + "년"]; }), S.profile.examYear) + '</select></div></div><div class="row" style="margin-top:12px"><button class="btn" data-act="saveprofile">저장</button><span class="badge b-unverified">요금제: 무료 (구독/회원제는 추후 연동)</span></div></div>';
    h += '<div class="card"><h2>AI 해설 설정</h2><label class="f">AI 엔드포인트 URL (비우면 저장된 해설만 사용)</label><input type="url" id="p-ai" placeholder="예: /api/ai" value="' + esc(S.settings.aiEndpoint) + '"><p class="sub" style="margin:8px 0">API 키는 브라우저에 저장하지 않고 서버(api/ai.js)의 환경변수 ANTHROPIC_API_KEY에 둡니다.</p><button class="btn" data-act="saveai">저장</button></div></div>';
    h += '<div class="card" style="margin-top:14px"><h2>북마크 (' + bms.length + ')</h2>' + (bms.length ? '<div class="list">' + bms.map(function (q) { return '<div class="it"><div class="t"><b>' + esc(q.text) + "</b><small>" + subjName(q.subjectId) + " · " + esc(chapName(q.chapterId)) + '</small></div><button class="btn sm sec" data-act="one" data-id="' + q.id + '">풀기</button><button class="btn sm dng" data-act="bm" data-id="' + q.id + '">해제</button></div>'; }).join("") + '</div><div style="margin-top:10px"><button class="btn sm" data-act="bmpractice">북마크 문제 모두 풀기</button></div>' : empty("북마크한 문제가 없습니다.")) + "</div>";
    h += '<div class="grid g2" style="margin-top:14px"><div class="card"><h2>문제 신고 내역 (' + S.reports.length + ')</h2>' + (S.reports.length ? '<div class="list">' + S.reports.slice().reverse().slice(0, 8).map(function (r) { return '<div class="it"><div class="t"><b>' + esc(r.qid) + " · " + esc(r.reason) + "</b><small>" + new Date(r.ts).toLocaleDateString("ko-KR") + "</small></div></div>"; }).join("") + "</div>" : empty("신고 내역 없음")) + "</div>";
    h += '<div class="card"><h2>데이터 관리</h2><p class="sub">학습 기록은 이 브라우저에 저장됩니다. 기기 변경 전 백업하세요.</p><div class="row"><a class="btn sec" href="#/admin">문제 데이터 관리(관리자)</a><button class="btn sec" data-act="backup">학습 기록 백업(JSON)</button><label class="btn sec" style="cursor:pointer">백업 복원<input type="file" id="restore" accept=".json" hidden></label><button class="btn dng" data-act="resetall">전체 초기화</button></div></div></div>';
    $v.innerHTML = h;
  }

  /* ---------- 문제 데이터 관리 ---------- */
  function vAdmin() {
    var a = adminState, list = st.allQuestions().filter(function (q) {
      return (!a.subjectId || q.subjectId === a.subjectId) && (!a.type || q.type === a.type) && (!a.q || (q.text + q.id).indexOf(a.q) >= 0);
    });
    var h = '<div class="row"><h1 style="margin:0">문제 데이터 관리</h1><span class="sp"></span><a href="#/me">← 마이페이지</a></div><p class="sub">문제·정답·해설은 코드와 분리된 데이터로 관리됩니다. (현재 버전은 로그인 없는 단일 기기 관리자 모드입니다)</p>';
    h += '<div class="card"><h2>' + (a.editing ? "문제 수정" : "문제 등록") + "</h2>" + qForm(a.editing) + "</div>";
    h += '<div class="card" style="margin-top:14px"><h2>CSV / JSON 가져오기·내보내기</h2><p class="sub">엑셀은 ‘CSV UTF-8’로 저장해 업로드하세요. 실제 기출(type=past)은 출처(source)와 verified=Y가 모두 있어야 기출로 표시되며, 아니면 ‘출처 미확인’으로 등록됩니다. 중복 문제는 자동 제외됩니다.</p><div class="row"><label class="btn sec" style="cursor:pointer">파일 선택<input type="file" id="imp" accept=".csv,.json,.txt" hidden></label><button class="btn sec" data-act="tplcsv">CSV 양식 받기</button><button class="btn sec" data-act="expjson">전체 문제 JSON 내보내기</button></div><div id="imp-out"></div></div>';
    h += '<div class="card" style="margin-top:14px"><h2>분류 관리 (단원·시험 연도)</h2><div class="row"><select id="nc-s" style="width:auto">' + opts(st.subjects().map(function (s) { return [s.id, s.name]; })) + '</select><input type="text" id="nc-n" placeholder="새 단원 이름" style="width:200px"><button class="btn sm" data-act="addch">단원 추가</button><span class="sp"></span><input type="number" id="ny" placeholder="연도" style="width:100px"><button class="btn sm" data-act="addyear">연도 추가</button></div></div>';
    h += '<div class="card" style="margin-top:14px"><div class="row"><h2 style="margin:0">문제 목록 (' + list.length + "/" + st.allQuestions().length + ')</h2><span class="sp"></span><select data-af="subjectId" style="width:auto">' + opts(st.subjects().map(function (s) { return [s.id, s.name]; }), a.subjectId, "전체 과목") + '</select><select data-af="type" style="width:auto">' + opts(Object.keys(TYPE_LABEL).map(function (k) { return [k, TYPE_LABEL[k]]; }), a.type, "전체 유형") + '</select><input type="text" data-af="q" placeholder="검색" value="' + esc(a.q) + '" style="width:140px"></div><div class="list" style="margin-top:8px">' +
      list.slice(0, 60).map(function (q) { return '<div class="it"><div class="t"><b>' + esc(q.text) + "</b><small>" + esc(q.id) + " · " + subjName(q.subjectId) + " › " + esc(chapName(q.chapterId)) + " · " + TYPE_LABEL[q.type] + " · 정답 " + q.answer + '번</small></div><button class="btn sm sec" data-act="editq" data-id="' + esc(q.id) + '">수정</button><button class="btn sm dng" data-act="delq" data-id="' + esc(q.id) + '">삭제</button></div>'; }).join("") + "</div>" + (list.length > 60 ? '<p class="sub">상위 60개만 표시됩니다. 검색/필터를 사용하세요.</p>' : "") + "</div>";
    h += '<div class="card" style="margin-top:14px"><h2>신고된 문제 (' + S.reports.filter(function (r) { return r.status === "open"; }).length + ')</h2>' + (S.reports.length ? '<div class="list">' + S.reports.slice().reverse().map(function (r) { return '<div class="it"><div class="t"><b>' + esc(r.qid) + " · " + esc(r.reason) + "</b><small>" + new Date(r.ts).toLocaleString("ko-KR") + " · " + r.status + '</small></div><button class="btn sm sec" data-act="editq" data-id="' + esc(r.qid) + '">문제 열기</button><button class="btn sm sec" data-act="resolve" data-id="' + r.id + '">처리 완료</button></div>'; }).join("") + "</div>" : empty("신고 없음")) + "</div>";
    $v.innerHTML = h;
  }
  function qForm(q) {
    q = q || { subjectId: "s1", chapterId: "", year: st.years()[0], difficulty: 2, type: "unverified", source: { name: "", verified: false }, text: "", choices: ["", "", "", ""], answer: 1, explanation: "", why: [], laws: [] };
    var ch = q.choices.slice(); while (ch.length < 5) ch.push("");
    var law = (q.laws || [])[0] || {};
    return '<div class="fgrid"><div><label class="f">과목</label><select id="q-s" data-qs>' + opts(st.subjects().map(function (s) { return [s.id, s.name]; }), q.subjectId) + '</select></div><div><label class="f">단원</label><select id="q-c">' + opts(st.chapters(q.subjectId).map(function (c) { return [c.id, c.name]; }), q.chapterId) + '</select></div><div><label class="f">기준 연도</label><select id="q-y">' + opts(st.years().map(function (y) { return [y, y + "년"]; }), q.year) + '</select></div><div><label class="f">난이도</label><select id="q-d">' + opts([[1, "하"], [2, "중"], [3, "상"]], q.difficulty) + '</select></div><div><label class="f">문제 유형</label><select id="q-t">' + opts(Object.keys(TYPE_LABEL).map(function (k) { return [k, TYPE_LABEL[k]]; }), q.type) + '</select></div><div><label class="f">출처(기출은 필수)</label><input type="text" id="q-src" value="' + esc(q.source && q.source.name) + '"></div><div><label class="f">출처·저작권 확인 완료</label><select id="q-v">' + opts([["0", "아니오"], ["1", "예"]], q.source && q.source.verified ? "1" : "0") + "</select></div></div>" +
      '<label class="f" style="margin-top:12px">문제 내용</label><textarea id="q-text">' + esc(q.text) + "</textarea>" +
      [1, 2, 3, 4, 5].map(function (i) { return '<label class="f" style="margin-top:8px">선택지 ' + i + (i === 5 ? " (선택)" : "") + '</label><input type="text" id="q-c' + i + '" value="' + esc(ch[i - 1]) + '"><input type="text" id="q-w' + i + '" placeholder="이 선택지가 맞거나 틀린 이유" value="' + esc((q.why || [])[i - 1] || "") + '" style="margin-top:4px">'; }).join("") +
      '<div class="fgrid" style="margin-top:10px"><div><label class="f">정답 번호</label><select id="q-a">' + opts([[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]], q.answer) + '</select></div><div><label class="f">근거 법령명</label><input type="text" id="q-ln" value="' + esc(law.name) + '"></div><div><label class="f">조문</label><input type="text" id="q-la" value="' + esc(law.article) + '"></div><div><label class="f">조문 확인 여부</label><select id="q-lv">' + opts([["0", "미확인"], ["1", "확인함"]], law.verified ? "1" : "0") + '</select></div></div>' +
      '<label class="f" style="margin-top:10px">상세 해설</label><textarea id="q-e">' + esc(q.explanation) + '</textarea><div class="row" style="margin-top:12px"><button class="btn" data-act="saveq" data-id="' + esc(q.id || "") + '">' + (q.id ? "수정 저장" : "등록") + "</button>" + (q.id ? '<button class="btn sec" data-act="cancelq">취소</button>' : "") + "</div>";
  }
  function readForm(id) {
    var choices = [], why = [];
    for (var i = 1; i <= 5; i++) { var c = val("q-c" + i).trim(); if (c || i <= 4) { choices.push(c); why.push(val("q-w" + i).trim()); } }
    var ln = val("q-ln").trim();
    return { id: id || undefined, subjectId: val("q-s"), chapterId: val("q-c"), year: +val("q-y"), difficulty: +val("q-d"), type: val("q-t"), source: { name: val("q-src").trim(), verified: val("q-v") === "1" }, text: val("q-text").trim(), choices: choices, why: why, answer: +val("q-a"), explanation: val("q-e").trim(), laws: ln ? [{ name: ln, article: val("q-la").trim(), note: "", basis: "current", verified: val("q-lv") === "1" }] : [] };
  }

  /* CSV/JSON 가져오기 */
  function parseCSV(t) {
    t = t.replace(/^﻿/, ""); var rows = [], row = [], cur = "", q = false;
    for (var i = 0; i < t.length; i++) {
      var c = t[i];
      if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true; else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some(function (x) { return x.trim(); })) rows.push(row); row = []; }
      else cur += c;
    }
    row.push(cur); if (row.some(function (x) { return x.trim(); })) rows.push(row);
    if (!rows.length) return [];
    var head = rows[0].map(function (x) { return x.trim().toLowerCase(); });
    return rows.slice(1).map(function (r) { var o = {}; head.forEach(function (k, i) { o[k] = (r[i] || "").trim(); }); return o; });
  }
  function toQuestion(r) {
    var sj = st.subjects().find(function (s) { return s.id === (r.subjectid || r.subjectId) || s.name === (r.subject || r.subjectName); });
    if (!sj && r.subjectId) sj = st.subjectById(r.subjectId);
    if (!sj) throw new Error("과목을 찾을 수 없음: " + (r.subject || r.subjectId || r.subjectid));
    var chName = r.chapter || (r.chapterId && chapName(r.chapterId)); var chap = chName ? st.addChapter(sj.id, chName) : null;
    var choices = Array.isArray(r.choices) ? r.choices.slice() : [r.choice1, r.choice2, r.choice3, r.choice4, r.choice5].filter(function (x) { return x && String(x).trim(); });
    var why = Array.isArray(r.why) ? r.why : [];
    var laws = Array.isArray(r.laws) ? r.laws : (r.law ? [{ name: r.law, article: r.article || "", note: "", basis: "current", verified: false }] : []);
    var src = r.source && typeof r.source === "object" ? r.source : { name: r.source || "", verified: /^(y|yes|true|1|예)$/i.test(String(r.verified || "")) };
    var y = +r.year; if (y) st.addYear(y);
    return { id: r.id && !/\s/.test(r.id) ? r.id : undefined, subjectId: sj.id, chapterId: chap ? chap.id : "", year: y || st.years()[0], difficulty: +r.difficulty || 2, type: r.type || "unverified", source: src, text: r.text, choices: choices, why: why, answer: +r.answer, explanation: r.explanation || "", laws: laws };
  }
  function importText(name, text) {
    var rows;
    try { rows = /\.json$/i.test(name) || /^\s*[\[{]/.test(text) ? JSON.parse(text) : parseCSV(text); } catch (e) { return { added: 0, dup: 0, errs: ["파일을 읽을 수 없습니다: " + e.message] }; }
    if (!Array.isArray(rows)) rows = rows.questions || [rows];
    var added = 0, dup = 0, errs = [];
    rows.forEach(function (r, i) {
      try {
        var q = toQuestion(r), res = st.addQuestion(q);
        if (res.ok) added++; else if (/중복/.test(res.error)) dup++; else errs.push((i + 1) + "행: " + res.error);
      } catch (e) { errs.push((i + 1) + "행: " + e.message); }
    });
    return { added: added, dup: dup, errs: errs };
  }
  function download(name, text, mime) { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: mime || "text/plain" })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); }

  /* ---------- AI 패널 ---------- */
  function runAI(mode) {
    var q = curQ(); if (!q) return; var out = document.getElementById("ai-out"), msg = mode === "ask" ? val("ai-q").trim() : "";
    if (mode === "ask" && !msg) return toast("질문을 입력하세요");
    out.innerHTML = '<div class="aibox">불러오는 중…</div>';
    FE.ai.ask(q, mode, msg).then(function (r) {
      out.innerHTML = '<div class="aibox">' + fmt(r.text) + '</div><p class="sub" style="margin:6px 0 0">' + (r.source === "llm" ? "AI 응답 — 제공된 문제 데이터 기준이며 법령 근거는 반드시 원문으로 확인하세요." + (r.uncertain ? " ⚠ 불확실한 내용이 포함되어 있습니다." : "") : "저장된 해설·개념 데이터 기반 응답입니다.") + "</p>";
    });
  }

  /* ---------- 클릭 처리 ---------- */
  var A = {
    pick: function (d) { var se = S.session; if (S.examRun && location.hash.indexOf("#/exam") === 0) { var er = S.examRun, q = st.questionById(er.ids[er.idx]); er.answers[q.id] = +d.n; st.save(); return examRun(); } var q2 = curQ(); if (!q2 || se.ans[q2.id]) return; se.pend[q2.id] = +d.n; st.save(); practiceRun(); },
    setmode: function (d) { setup.mode = d.v; practiceSetup(); },
    start: startFromSetup, submit: submitAnswer,
    next: function () { var se = S.session; if (se.idx >= se.ids.length - 1) { se.summary = true; } else se.idx++; st.save(); vPractice(); window.scrollTo(0, 0); },
    prev: function () { var se = S.session; if (se.idx > 0) { se.idx--; st.save(); practiceRun(); window.scrollTo(0, 0); } },
    endsession: function () { var se = S.session; if (Object.keys(se.ans).length) { se.summary = true; st.save(); vPractice(); } else { S.session = null; st.save(); vPractice(); } },
    newsession: function () { S.session = null; st.save(); vPractice(); },
    retrywrong: function () { var se = S.session, ids = se.ids.filter(function (i) { return se.ans[i] && !se.ans[i].ok; }); startSession(ids); },
    one: function (d) { startSession([d.id]); },
    quick: function (d) { if (d.m === "chapter") { var c = st.chapterById(d.id); setup = { mode: "random", subjectId: c.subjectId, chapterId: c.id, year: "", difficulty: "", count: 10 }; S.session = null; st.save(); go("#/practice"); } },
    bm: function (d) { var id = d.id || (curQ() || {}).id; var on = st.toggleBookmark(id); toast(on ? "북마크에 추가했어요" : "북마크를 해제했어요"); if (d.id) vMe(); else practiceRun(); },
    report: function () {
      var q = curQ(); modal("<h2>문제 신고</h2><p class=\"sub\">" + esc(q.id) + " · 오류가 있다면 알려주세요.</p><select id=\"rp-r\"><option>정답이 틀렸어요</option><option>해설이 틀렸어요</option><option>문제/선택지 오타</option><option>법령 근거가 다릅니다</option><option>중복 문제</option><option>기타</option></select><textarea id=\"rp-t\" placeholder=\"자세한 내용(선택)\" style=\"margin-top:8px\"></textarea><div class=\"row\" style=\"margin-top:12px\"><span class=\"sp\"></span><button class=\"btn sec\" data-act=\"closemodal\">취소</button><button class=\"btn\" data-act=\"sendreport\">신고하기</button></div>");
    },
    sendreport: function () { var q = curQ(), r = val("rp-r"), t = val("rp-t").trim(); st.addReport(q.id, r + (t ? " - " + t : "")); closeModal(); toast("신고가 접수되었습니다"); },
    closemodal: closeModal,
    install: function () { var ev = window.__installEv; if (!ev) return toast("브라우저 메뉴에서 ‘앱 설치’를 선택하세요"); ev.prompt(); ev.userChoice.then(function () { window.__installEv = null; if (location.hash === "#/me") vMe(); }); },
    ai: function (d) { if (d.m === "similar") return; runAI(d.m); },
    startexam: startExam,
    goq: function (d) { S.examRun.idx = +d.i; st.save(); examRun(); }, gofirst: function (d) { closeModal(); S.examRun.idx = +d.i; st.save(); examRun(); },
    eprev: function () { S.examRun.idx--; st.save(); examRun(); }, enext: function () { S.examRun.idx++; st.save(); examRun(); },
    flag: function () { var er = S.examRun, id = er.ids[er.idx]; if (er.flags[id]) delete er.flags[id]; else er.flags[id] = 1; st.save(); examRun(); },
    esubmit: confirmExamSubmit, finalsubmit: finishExam,
    reviewexam: function (d) { var e = S.exams.find(function (x) { return x.id === d.id; }); startSession(e.wrongIds.slice()); },
    wrongpractice: function () { var ids = $v.querySelectorAll("[data-act=one]"), arr = Array.prototype.map.call(ids, function (b) { return b.dataset.id; }); startSession(st.shuffle(arr)); },
    wrongexam: function () { examSetup.wrongOnly = true; examSetup.kind = "custom"; examSetup.pastOnly = false; examSetup.scope = "all"; go("#/exam"); examSetupView(); },
    setkind: function (d) { examSetup.kind = d.v; examSetupView(); },
    delwrong: function (d) { if (confirm("오답노트에서 삭제할까요? (풀이 기록은 유지됩니다)")) { st.removeWrong(d.id); vWrong(); } },
    range: function (d) { statRange = d.v; vStats(); },
    saveprofile: function () { S.profile.name = val("p-name").trim() || "수험생"; S.profile.goal = Math.max(1, +val("p-goal") || 20); S.profile.examYear = +val("p-year"); st.save(); toast("저장했어요"); },
    saveai: function () { S.settings.aiEndpoint = val("p-ai").trim(); st.save(); toast(S.settings.aiEndpoint ? "AI 연결 설정을 저장했어요" : "AI 미연결(저장된 해설 모드)"); },
    bmpractice: function () { startSession(Object.keys(S.bookmarks)); },
    backup: function () { download("fire-exam-backup-" + st.dateKey() + ".json", st.exportAll(), "application/json"); },
    resetall: function () { if (confirm("모든 학습 기록·추가 문제가 삭제됩니다. 정말 초기화할까요?") && confirm("되돌릴 수 없습니다. 계속할까요?")) { st.resetAll(); S = st.S; toast("초기화했습니다"); go("#/home"); route(); } },
    saveq: function (d) { var q = readForm(d.id), r = st.addQuestion(q); if (!r.ok) return toast(r.error); adminState.editing = null; toast("저장했어요 (" + r.id + ")"); vAdmin(); },
    editq: function (d) { adminState.editing = st.questionById(d.id); vAdmin(); window.scrollTo(0, 0); }, cancelq: function () { adminState.editing = null; vAdmin(); },
    delq: function (d) { if (confirm("이 문제를 삭제할까요?")) { st.deleteQuestion(d.id); vAdmin(); } },
    resolve: function (d) { var r = S.reports.find(function (x) { return x.id === d.id; }); if (r) r.status = "done"; st.save(); vAdmin(); },
    addch: function () { var c = st.addChapter(val("nc-s"), val("nc-n")); toast(c ? "단원을 추가했어요" : "이름을 입력하세요"); vAdmin(); },
    addyear: function () { st.addYear(val("ny")); vAdmin(); },
    tplcsv: function () { download("questions-template.csv", "﻿subject,chapter,year,difficulty,type,source,verified,text,choice1,choice2,choice3,choice4,choice5,answer,explanation,law\n소방학개론,연소이론,2026,2,unverified,,N,\"문제 내용\",보기1,보기2,보기3,보기4,,2,\"해설\",소방기본법 제1조\n", "text/csv"); },
    expjson: function () { download("questions.json", JSON.stringify(st.allQuestions(), null, 2), "application/json"); }
  };
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act]"); if (!el) return;
    var fn = A[el.dataset.act]; if (!fn) return;
    if (el.tagName === "A" && el.dataset.act === "quick") { fn(el.dataset); return; }
    fn(el.dataset);
  });
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (t.dataset.set !== undefined) { var k = t.dataset.set; setup[k] = t.type === "checkbox" ? t.checked : t.value; if (k === "subjectId") setup.chapterId = ""; return practiceSetup(); }
    if (t.dataset.eset !== undefined) { var ek = t.dataset.eset; examSetup[ek] = t.type === "checkbox" ? t.checked : t.value; return examSetupView(); }
    if (t.dataset.wf !== undefined) { wf[t.dataset.wf] = t.value; if (t.dataset.wf === "subjectId") wf.chapterId = ""; return vWrong(); }
    if (t.dataset.af !== undefined) { adminState[t.dataset.af] = t.value; adminState.editing = adminState.editing; return vAdmin(); }
    if (t.id === "q-s") { var c = document.getElementById("q-c"); c.innerHTML = opts(st.chapters(t.value).map(function (x) { return [x.id, x.name]; })); return; }
    if (t.id === "imp" && t.files[0]) { var f = t.files[0], rd = new FileReader(); rd.onload = function () { var r = importText(f.name, rd.result); document.getElementById("imp-out").innerHTML = '<div class="aibox">등록 ' + r.added + "건 · 중복 제외 " + r.dup + "건 · 오류 " + r.errs.length + "건" + (r.errs.length ? "\n" + esc(r.errs.slice(0, 10).join("\n")) : "") + "</div>"; }; rd.readAsText(f, "utf-8"); }
    if (t.id === "restore" && t.files[0]) { var rd2 = new FileReader(); rd2.onload = function () { try { st.importAll(rd2.result); S = st.S; toast("복원했어요"); route(); } catch (er) { toast("복원 실패: " + er.message); } }; rd2.readAsText(t.files[0]); }
  });
  document.addEventListener("input", function (e) { if (e.target.dataset.af === "q") { adminState.q = e.target.value; clearTimeout(window.__aft); window.__aft = setTimeout(function () { var p = e.target.selectionStart; vAdmin(); var n = document.querySelector("[data-af=q]"); n.focus(); n.setSelectionRange(p, p); }, 300); } });
  document.addEventListener("keydown", function (e) {
    if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || document.querySelector(".modal-bg")) return;
    var hash = location.hash;
    if (hash.indexOf("#/practice") === 0 && S.session && !S.session.closed && !S.session.summary) {
      var q = curQ(), a = q && S.session.ans[q.id];
      if (/^[1-5]$/.test(e.key) && !a && +e.key <= q.choices.length) A.pick({ n: e.key });
      else if (e.key === "Enter") { e.preventDefault(); a ? A.next() : submitAnswer(); }
      else if (e.key === "ArrowLeft") A.prev(); else if (e.key === "ArrowRight" && a) A.next();
    } else if (hash.indexOf("#/exam") === 0 && S.examRun) {
      var eq = st.questionById(S.examRun.ids[S.examRun.idx]);
      if (/^[1-5]$/.test(e.key) && eq && +e.key <= eq.choices.length) A.pick({ n: e.key });
    }
  });
  document.addEventListener("fe-installable", function () { if (location.hash === "#/me") vMe(); });
  window.addEventListener("hashchange", route);
  window.addEventListener("beforeunload", function () { st.save(); });
  FE.app = { route: route, parseCSV: parseCSV, importText: importText };
  route();
})();
