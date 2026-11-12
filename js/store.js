/* 데이터 계층: 문제/학습기록 저장·조회. 현재는 localStorage, 추후 Supabase 어댑터로 교체 가능하도록 이 파일에만 의존. */
window.FE = window.FE || {};
FE.store = (function () {
  var KEY = "fireexam.v1";
  var mem = null; // localStorage 불가 시 메모리 폴백
  function defaults() {
    return {
      v: 1,
      profile: { name: "수험생", goal: 20, examYear: 2026, plan: "free" },
      settings: { aiEndpoint: "" },
      custom: [],          // 관리자가 추가한 문제
      edits: {},           // 시드 문제 수정본 {id: question}
      deleted: [],         // 삭제된 시드 문제 id
      customChapters: [],  // 관리자가 추가한 단원
      years: null,         // 시험 연도 목록(null이면 시드 사용)
      attempts: [],        // {qid, sel, ok, ts, mode, sec}
      wrong: {},           // {qid:{count, rights, streak, mastery, last}}
      bookmarks: {},       // {qid: ts}
      reports: [],         // {id, qid, reason, ts, status}
      exams: [],           // 모의고사 결과
      daily: {},           // {YYYY-MM-DD:{solved, correct, sec}}
      session: null,       // 진행 중 문제풀이
      examRun: null        // 진행 중 모의고사
    };
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      var d = defaults();
      if (!raw) return d;
      var o = JSON.parse(raw);
      for (var k in o) d[k] = o[k];
      return d;
    } catch (e) { return mem || defaults(); }
  }
  var S = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { mem = S; }
  }
  function uid(p) { return (p || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function dateKey(ts) {
    var d = ts ? new Date(ts) : new Date();
    var m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + "-" + (m < 10 ? "0" : "") + m + "-" + (day < 10 ? "0" : "") + day;
  }
  function norm(s) { return String(s || "").replace(/[\s .,!?;:'"‘’“”「」()\[\]·~\-]/g, "").toLowerCase(); }
  function hashQ(q) {
    var s = norm(q.text) + "|" + (q.choices || []).map(norm).join("|");
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
  }

  /* ---------- 과목/단원/문제 ---------- */
  function subjects() { return FE_SEED.subjects; }
  function subjectById(id) { return subjects().find(function (s) { return s.id === id; }); }
  function chapters(subjectId) {
    var all = FE_SEED.chapters.concat(S.customChapters);
    return subjectId ? all.filter(function (c) { return c.subjectId === subjectId; }) : all;
  }
  function chapterById(id) { return chapters().find(function (c) { return c.id === id; }); }
  function years() {
    var base = S.years || FE_SEED.examYears;
    return base.slice().sort(function (a, b) { return b - a; });
  }
  function pastExams() { return window.FE_EXAMS || []; }
  function seedQuestions() {
    var out = FE_SEED.questions.slice();
    pastExams().forEach(function (e) { out = out.concat(e.questions); });
    return out;
  }
  function examById(id) { return pastExams().find(function (e) { return e.id === id; }); }
  function allQuestions() {
    var del = {}; S.deleted.forEach(function (i) { del[i] = 1; });
    var out = [];
    seedQuestions().forEach(function (q) { if (!del[q.id]) out.push(S.edits[q.id] || q); });
    return out.concat(S.custom);
  }
  function questionById(id) { return allQuestions().find(function (q) { return q.id === id; }); }

  function validateQ(q) {
    var err = [];
    if (!q.text || !String(q.text).trim()) err.push("문제 내용이 없습니다");
    if (!q.choices || q.choices.length < 4 || q.choices.length > 5 || q.choices.some(function (c) { return !String(c).trim(); })) err.push("선택지는 4~5개여야 합니다");
    if (!q.answer || q.answer < 1 || q.answer > (q.choices || []).length) err.push("정답 번호가 올바르지 않습니다");
    if (!subjectById(q.subjectId)) err.push("과목이 올바르지 않습니다");
    return err;
  }
  function sanitizeType(q) {
    // 실제 기출 표시는 출처가 있고 verified일 때만 허용
    if (q.type === "past" && !(q.source && q.source.name && q.source.verified)) q.type = "unverified";
    if (["past", "ai", "sample", "unverified"].indexOf(q.type) < 0) q.type = "unverified";
    return q;
  }
  function addQuestion(q) {
    q = sanitizeType(q);
    var errs = validateQ(q);
    if (errs.length) return { ok: false, error: errs.join(", ") };
    var h = hashQ(q);
    var dup = allQuestions().find(function (x) { return hashQ(x) === h && x.id !== q.id; });
    if (dup) return { ok: false, error: "중복 문제입니다 (" + dup.id + ")" };
    q.id = q.id || uid("Q");
    q.why = q.why || [];
    q.laws = q.laws || [];
    if (seedQuestions().some(function (x) { return x.id === q.id; })) S.edits[q.id] = q;
    else {
      var i = S.custom.findIndex(function (x) { return x.id === q.id; });
      if (i >= 0) S.custom[i] = q; else S.custom.push(q);
    }
    save();
    return { ok: true, id: q.id };
  }
  function updateQuestion(q) { return addQuestion(q); }
  function deleteQuestion(id) {
    var i = S.custom.findIndex(function (x) { return x.id === id; });
    if (i >= 0) S.custom.splice(i, 1);
    else if (S.deleted.indexOf(id) < 0) S.deleted.push(id);
    save();
  }
  function addChapter(subjectId, name) {
    name = String(name || "").trim();
    if (!name) return null;
    var ex = chapters(subjectId).find(function (c) { return c.name === name; });
    if (ex) return ex;
    var c = { id: uid("c"), subjectId: subjectId, name: name, note: "" };
    S.customChapters.push(c); save(); return c;
  }
  function addYear(y) {
    y = parseInt(y, 10);
    if (!y) return;
    var list = (S.years || FE_SEED.examYears).slice();
    if (list.indexOf(y) < 0) list.push(y);
    S.years = list; save();
  }

  /* ---------- 학습 기록 ---------- */
  function recordAnswer(q, sel, mode, sec) {
    var ts = Date.now();
    sec = Math.max(0, Math.min(sec || 0, 180));
    var ok = sel === q.answer;
    S.attempts.push({ qid: q.id, sel: sel, ok: ok, ts: ts, mode: mode, sec: sec });
    var k = dateKey(ts);
    var d = S.daily[k] || (S.daily[k] = { solved: 0, correct: 0, sec: 0 });
    d.solved++; if (ok) d.correct++; d.sec += sec;
    var w = S.wrong[q.id];
    if (!ok) {
      if (!w) w = S.wrong[q.id] = { count: 0, rights: 0, streak: 0, mastery: 0, last: ts };
      w.count++; w.streak = 0; w.mastery = 0; w.last = ts;
    } else if (w) {
      // 한 번 맞혔다고 삭제하지 않고, 연속 정답 수로 숙련도를 올림
      w.rights++; w.streak++; w.mastery = Math.min(5, w.streak); w.last = ts;
    }
    save();
    return ok;
  }
  function removeWrong(id) { delete S.wrong[id]; save(); }
  function toggleBookmark(id) {
    if (S.bookmarks[id]) delete S.bookmarks[id]; else S.bookmarks[id] = Date.now();
    save(); return !!S.bookmarks[id];
  }
  function addReport(qid, reason) {
    S.reports.push({ id: uid("r"), qid: qid, reason: reason, ts: Date.now(), status: "open" });
    save();
  }
  function addStudyTime(sec) {
    var k = dateKey();
    var d = S.daily[k] || (S.daily[k] = { solved: 0, correct: 0, sec: 0 });
    d.sec += Math.max(0, Math.min(sec, 600));
    save();
  }

  /* ---------- 통계 ---------- */
  function pct(a, b) { return b ? Math.round(a / b * 1000) / 10 : null; }
  function overall() {
    var n = S.attempts.length, c = S.attempts.filter(function (a) { return a.ok; }).length;
    var sec = 0; for (var k in S.daily) sec += S.daily[k].sec;
    return { solved: n, correct: c, rate: pct(c, n), sec: sec };
  }
  function lastAttemptMap() {
    var m = {}; S.attempts.forEach(function (a) { m[a.qid] = a; }); return m;
  }
  function groupStats(keyFn) {
    var g = {};
    S.attempts.forEach(function (a) {
      var q = questionById(a.qid); if (!q) return;
      var k = keyFn(q);
      var o = g[k] || (g[k] = { n: 0, c: 0 });
      o.n++; if (a.ok) o.c++;
    });
    for (var k in g) g[k].rate = pct(g[k].c, g[k].n);
    return g;
  }
  function byDifficulty() { return groupStats(function (q) { return q.difficulty; }); }
  function bySubject() { return groupStats(function (q) { return q.subjectId; }); }
  function byChapter() { return groupStats(function (q) { return q.chapterId; }); }
  function weakChapters(limit) {
    var g = byChapter(), arr = [];
    for (var id in g) {
      var c = chapterById(id); if (!c) continue;
      arr.push({ chapter: c, n: g[id].n, rate: g[id].rate });
    }
    arr.sort(function (a, b) { return a.rate - b.rate || b.n - a.n; });
    return arr.slice(0, limit || 5);
  }
  function streakDays() {
    var n = 0, d = new Date();
    if (!(S.daily[dateKey(d)] && S.daily[dateKey(d)].solved)) d.setDate(d.getDate() - 1); // 오늘 아직 안 풀었으면 어제부터
    while (S.daily[dateKey(d)] && S.daily[dateKey(d)].solved) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function today() { return S.daily[dateKey()] || { solved: 0, correct: 0, sec: 0 }; }
  function lastDays(n) {
    var out = [], d = new Date();
    d.setDate(d.getDate() - (n - 1));
    for (var i = 0; i < n; i++) {
      var k = dateKey(d), v = S.daily[k] || { solved: 0, correct: 0, sec: 0 };
      out.push({ key: k, label: (d.getMonth() + 1) + "/" + d.getDate(), solved: v.solved, correct: v.correct, sec: v.sec, rate: pct(v.correct, v.solved) });
      d.setDate(d.getDate() + 1);
    }
    return out;
  }
  function weekly(nWeeks) {
    var out = [], now = new Date(); now.setHours(0, 0, 0, 0);
    for (var w = nWeeks - 1; w >= 0; w--) {
      var s = 0, c = 0;
      for (var i = 0; i < 7; i++) {
        var d = new Date(now); d.setDate(now.getDate() - w * 7 - i);
        var v = S.daily[dateKey(d)]; if (v) { s += v.solved; c += v.correct; }
      }
      out.push({ label: w === 0 ? "이번주" : w + "주 전", solved: s, rate: pct(c, s) });
    }
    return out;
  }
  function monthly(nMonths) {
    var out = [], now = new Date();
    for (var m = nMonths - 1; m >= 0; m--) {
      var d = new Date(now.getFullYear(), now.getMonth() - m, 1), pre = d.getFullYear() + "-" + (d.getMonth() + 1 < 10 ? "0" : "") + (d.getMonth() + 1);
      var s = 0, c = 0;
      for (var k in S.daily) if (k.indexOf(pre) === 0) { s += S.daily[k].solved; c += S.daily[k].correct; }
      out.push({ label: (d.getMonth() + 1) + "월", solved: s, rate: pct(c, s) });
    }
    return out;
  }

  /* ---------- 문제 풀이 대상 선정 ---------- */
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function buildPool(f) {
    var last = lastAttemptMap();
    var pool = allQuestions().filter(function (q) {
      if (f.subjectId && q.subjectId !== f.subjectId) return false;
      if (f.year && q.year !== +f.year) return false;
      if (f.chapterId && q.chapterId !== f.chapterId) return false;
      if (f.difficulty && q.difficulty !== +f.difficulty) return false;
      if (f.type && q.type !== f.type) return false;
      if (f.mode === "wrong" && !S.wrong[q.id]) return false;
      if (f.mode === "unsolved" && last[q.id]) return false;
      if (f.mode === "bookmark" && !S.bookmarks[q.id]) return false;
      return true;
    });
    return pool;
  }
  function paperOrder(a, b) {
    return String(a.examId || "").localeCompare(String(b.examId || "")) || String(a.subjectId).localeCompare(String(b.subjectId)) || (a.no || 0) - (b.no || 0);
  }
  /* 시험 회차의 출제 구조 분석(과목별 문항 수·난이도·유형·분야) */
  function analyzeExam(exam) {
    var out = { total: exam.questions.length, subjects: {}, diff: { 1: 0, 2: 0, 3: 0 }, format: {}, chapters: {} };
    exam.questions.forEach(function (q) {
      var s = out.subjects[q.subjectId] || (out.subjects[q.subjectId] = { n: 0, diff: { 1: 0, 2: 0, 3: 0 } });
      s.n++; s.diff[q.difficulty]++; out.diff[q.difficulty]++;
      (q.format || []).forEach(function (f) { out.format[f] = (out.format[f] || 0) + 1; });
      out.chapters[q.chapterId] = (out.chapters[q.chapterId] || 0) + 1;
    });
    return out;
  }
  /* 모의고사 출제: kind = real(기출 원본 순서) | mix(기출과 같은 난이도 분포로 랜덤) | custom */
  function buildPaper(o) {
    var exam = examById(o.examId) || pastExams()[0], subs = o.scope === "all" ? exam.order : [o.scope], ids = [];
    var all = allQuestions();
    subs.forEach(function (sid) {
      var paper = exam.questions.filter(function (q) { return q.subjectId === sid; }).sort(paperOrder);
      if (o.kind === "real") {
        ids = ids.concat(paper.map(function (q) { return q.id; }));
        return;
      }
      var pool = all.filter(function (q) { return q.subjectId === sid && (!o.pastOnly || q.type === "past") && (!o.wrongOnly || S.wrong[q.id]); });
      if (o.kind === "custom") { ids = ids.concat(shuffle(pool).slice(0, +o.count).map(function (q) { return q.id; })); return; }
      // mix: 회차의 난이도 분포(하/중/상 문항 수)를 그대로 맞춰 추출
      var need = { 1: 0, 2: 0, 3: 0 }; paper.forEach(function (q) { need[q.difficulty]++; });
      var picked = [], used = {};
      [1, 2, 3].forEach(function (d) {
        shuffle(pool.filter(function (q) { return q.difficulty === d; })).slice(0, need[d]).forEach(function (q) { picked.push(q); used[q.id] = 1; });
      });
      var lack = paper.length - picked.length;
      if (lack > 0) shuffle(pool.filter(function (q) { return !used[q.id]; })).slice(0, lack).forEach(function (q) { picked.push(q); });
      ids = ids.concat(shuffle(picked).map(function (q) { return q.id; }));
    });
    return ids;
  }
  function similar(q, limit) {
    var last = lastAttemptMap();
    var c = allQuestions().filter(function (x) { return x.id !== q.id && x.subjectId === q.subjectId; });
    c.sort(function (a, b) {
      var sa = (a.chapterId === q.chapterId ? 2 : 0) + (last[a.id] ? 0 : 1);
      var sb = (b.chapterId === q.chapterId ? 2 : 0) + (last[b.id] ? 0 : 1);
      return sb - sa;
    });
    return c.slice(0, limit || 3);
  }

  /* ---------- 백업 ---------- */
  function exportAll() { return JSON.stringify(S); }
  function importAll(json) {
    var o = JSON.parse(json);
    if (!o || typeof o !== "object" || !o.attempts) throw new Error("백업 파일 형식이 아닙니다");
    S = Object.assign(defaults(), o); save();
  }
  function resetAll() { S = defaults(); save(); }

  return {
    get S() { return S; }, save: save, uid: uid, dateKey: dateKey, hashQ: hashQ, pct: pct, shuffle: shuffle,
    subjects: subjects, subjectById: subjectById, chapters: chapters, chapterById: chapterById, years: years,
    allQuestions: allQuestions, questionById: questionById, addQuestion: addQuestion, updateQuestion: updateQuestion,
    deleteQuestion: deleteQuestion, addChapter: addChapter, addYear: addYear, validateQ: validateQ,
    recordAnswer: recordAnswer, removeWrong: removeWrong, toggleBookmark: toggleBookmark, addReport: addReport, addStudyTime: addStudyTime,
    pastExams: pastExams, examById: examById, analyzeExam: analyzeExam, buildPaper: buildPaper, paperOrder: paperOrder, byDifficulty: byDifficulty,
    overall: overall, bySubject: bySubject, byChapter: byChapter, weakChapters: weakChapters, streakDays: streakDays,
    today: today, lastDays: lastDays, weekly: weekly, monthly: monthly, buildPool: buildPool, similar: similar,
    lastAttemptMap: lastAttemptMap, exportAll: exportAll, importAll: importAll, resetAll: resetAll
  };
})();
