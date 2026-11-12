/* 의존성 없는 SVG 차트 */
FE.charts = (function () {
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var W = 640, H = 220, P = { l: 34, r: 10, t: 14, b: 28 };

  function axes(max, ticks, unit) {
    var s = "";
    for (var i = 0; i <= ticks; i++) {
      var v = max * i / ticks, y = H - P.b - (H - P.b - P.t) * i / ticks;
      s += '<line x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + y + '" y2="' + y + '" class="grid"/>' +
        '<text x="' + (P.l - 6) + '" y="' + (y + 4) + '" text-anchor="end" class="ax">' + Math.round(v) + (unit || "") + "</text>";
    }
    return s;
  }
  // items: [{label, value}] value null => 데이터 없음
  function bar(items, opt) {
    opt = opt || {};
    var max = opt.max || Math.max(5, Math.max.apply(null, items.map(function (i) { return i.value || 0; })));
    if (!opt.max) max = Math.ceil(max / 4) * 4;
    var bw = (W - P.l - P.r) / items.length, s = '<svg viewBox="0 0 ' + W + " " + H + '" class="chart" role="img" aria-label="' + esc(opt.title || "막대 차트") + '">' + axes(max, 4, opt.unit);
    items.forEach(function (it, i) {
      var v = it.value || 0, h = (H - P.b - P.t) * v / max, x = P.l + i * bw + bw * 0.18, w = bw * 0.64;
      s += '<rect x="' + x + '" y="' + (H - P.b - h) + '" width="' + w + '" height="' + h + '" rx="3" class="bar"/>';
      if (it.value != null && (items.length <= 14)) s += '<text x="' + (x + w / 2) + '" y="' + (H - P.b - h - 4) + '" text-anchor="middle" class="val">' + v + "</text>";
      if (items.length <= 16 || i % 2 === 0) s += '<text x="' + (x + w / 2) + '" y="' + (H - 8) + '" text-anchor="middle" class="ax">' + esc(it.label) + "</text>";
    });
    return s + "</svg>";
  }
  function line(items, opt) {
    opt = opt || {};
    var max = opt.max || 100, n = items.length, dx = (W - P.l - P.r) / Math.max(1, n - 1);
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" class="chart" role="img" aria-label="' + esc(opt.title || "선 차트") + '">' + axes(max, 4, opt.unit);
    var pts = [], seg = [];
    items.forEach(function (it, i) {
      var x = P.l + i * dx;
      if (it.value == null) { if (seg.length) pts.push(seg); seg = []; }
      else seg.push([x, H - P.b - (H - P.b - P.t) * it.value / max, it.value]);
      if (n <= 16 || i % 2 === 0) s += '<text x="' + x + '" y="' + (H - 8) + '" text-anchor="middle" class="ax">' + esc(it.label) + "</text>";
    });
    if (seg.length) pts.push(seg);
    pts.forEach(function (sg) {
      if (sg.length > 1) s += '<polyline fill="none" class="ln" points="' + sg.map(function (p) { return p[0] + "," + p[1]; }).join(" ") + '"/>';
      sg.forEach(function (p) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.5" class="dot"><title>' + p[2] + '</title></circle>'; });
    });
    return s + "</svg>";
  }
  // 가로 막대 리스트(과목/단원 정답률)
  function hbars(rows) {
    return '<div class="hbars">' + rows.map(function (r) {
      var v = r.value == null ? 0 : r.value, cls = r.value == null ? "none" : r.value < 50 ? "low" : r.value < 70 ? "mid" : "high";
      return '<div class="hb"><div class="hb-l">' + esc(r.label) + '</div><div class="hb-t"><div class="hb-f ' + cls + '" style="width:' + v + '%"></div></div><div class="hb-v">' +
        (r.value == null ? "-" : r.value + "%") + (r.sub ? ' <small>' + esc(r.sub) + "</small>" : "") + "</div></div>";
    }).join("") + "</div>";
  }
  return { bar: bar, line: line, hbars: hbars };
})();
