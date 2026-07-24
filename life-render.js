/* 生活页渲染脚本：读取 life-content.js 里的 window.LIFE，生成页面。
 * 想改生活页的文字/照片：请改 life-content.js。想改外观：请改 style.css。
 * 背景是油画/插画风（N.C. Wyeth 感）的「窗边读书台」场景：
 * 两分钟一昼夜，光影色彩随时间流动，页面配色也随场景的昼夜自动切换。
 * 小调试：网址后加 ?t=0.5 可以把时间定格在正午（0~1 之间任意值）。 */

(function () {
  "use strict";

  var data = window.LIFE || {};
  var root = document.getElementById("life-app");

  var reducedMotion = !!(
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  // —— 小工具 ——

  // 创建元素：tag 标签名，className 样式类，text 纯文本内容
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  // 把文字追加到 node 里，并把 \n 变成真正的换行
  function appendMultiline(node, text) {
    String(text).split("\n").forEach(function (part, index) {
      if (index > 0) node.appendChild(document.createElement("br"));
      node.appendChild(document.createTextNode(part));
    });
  }

  // 生成卡片照片：只写文件名时自动到 photos/ 文件夹找；
  // 填完整网址或带路径时原样使用；加载失败自动隐藏（卡片退化为纯文字）
  function photoImg(file, altText) {
    var img = document.createElement("img");
    img.className = "life-photo";
    img.alt = altText || "";
    img.loading = "lazy";
    img.src =
      /^(https?:)?\/\//.test(file) || file.indexOf("/") !== -1 ? file : "photos/" + file;
    img.onerror = function () {
      img.style.display = "none";
    };
    return img;
  }

  /* ============================================================
   *  背景画布：油画风的窗边读书角（全程序化绘制，无图片素材）
   *
   *  两层结构（兼顾质感和性能）：
   *    ① 油画底层 roomC —— 墙、木地板、窗帘、书桌、扶手椅等静物，
   *       用几百条低透明短笔触叠在多层渐变上烘出笔触感；
   *       只在加载和窗口尺寸变化时烘焙一次。
   *    ② 动态层 —— 窗内天空（云/日/月/星/树影）、晨光光束、
   *       地板上的窗影（方向与太阳移动相反）、台灯暖光、
   *       昼夜氛围罩色，每帧重绘。
   *
   *  时间：t ∈ [0,1) 是一天（120 秒），颜色在关键帧间线性插值。
   *  夜里页面文字配色（CSS 深浅变量）跟场景一起翻转为暗色。
   * ============================================================ */
  function initScene() {
    var canvas = document.createElement("canvas");
    canvas.id = "bg-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.insertBefore(canvas, document.body.firstChild);

    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var DAY_MS = 120000; // 两分钟一昼夜
    var W = 0;
    var H = 0;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    // 窗口几何（左上方的大木窗），bake/动态层共用
    var wx0, wy0, wx1, wy1, ww, wh, fy0, ft;

    // 定格参数：?t=0.62 固定在某个时刻（调试用；减弱动态时也走这条路）
    var fixedT = null;
    try {
      var q = new URLSearchParams(window.location.search).get("t");
      if (q !== null && !isNaN(parseFloat(q))) fixedT = Math.min(Math.max(parseFloat(q), 0), 0.999);
    } catch (ignore) {}

    function clamp(v, a, b) {
      return Math.min(Math.max(v, a), b);
    }

    function lerp(a, b, k) {
      return a + (b - a) * k;
    }

    function rgb(c) {
      return "rgb(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + ")";
    }

    function rgba(c, a) {
      return (
        "rgba(" + Math.round(c[0]) + "," + Math.round(c[1]) + "," + Math.round(c[2]) + "," + a.toFixed(3) + ")"
      );
    }

    /* —— 调色关键帧：凌晨→清晨→上午→正午→黄昏→入夜→深夜 ——
       skyTop/skyBot：窗内天空上下色；star：星星强度；lamp：台灯亮度；
       shade：夜色罩色强度；glow：暖日罩色强度；
       patch：日光窗影强度；patchC：月色窗影强度；beam：晨光束强度 */
    var STOPS = [
      { t: 0.00, skyTop: [110, 120, 170], skyBot: [235, 185, 140], star: 0.50, lamp: 0.35, shade: 0.30, glow: 0.05, patch: 0.08, patchC: 0.06, beam: 0.10 },
      { t: 0.08, skyTop: [135, 165, 205], skyBot: [255, 214, 160], star: 0.15, lamp: 0.12, shade: 0.12, glow: 0.08, patch: 0.24, patchC: 0.0, beam: 0.20 },
      { t: 0.18, skyTop: [158, 189, 222], skyBot: [250, 230, 190], star: 0.0, lamp: 0.0, shade: 0.02, glow: 0.10, patch: 0.36, patchC: 0.0, beam: 0.22 },
      { t: 0.30, skyTop: [170, 200, 230], skyBot: [245, 238, 215], star: 0.0, lamp: 0.0, shade: 0.0, glow: 0.12, patch: 0.42, patchC: 0.0, beam: 0.12 },
      { t: 0.50, skyTop: [185, 212, 235], skyBot: [235, 242, 230], star: 0.0, lamp: 0.0, shade: 0.0, glow: 0.13, patch: 0.44, patchC: 0.0, beam: 0.08 },
      { t: 0.62, skyTop: [198, 141, 94], skyBot: [247, 192, 106], star: 0.0, lamp: 0.05, shade: 0.04, glow: 0.16, patch: 0.38, patchC: 0.0, beam: 0.30 },
      { t: 0.72, skyTop: [96, 74, 114], skyBot: [224, 138, 84], star: 0.08, lamp: 0.30, shade: 0.16, glow: 0.05, patch: 0.16, patchC: 0.0, beam: 0.15 },
      { t: 0.80, skyTop: [42, 48, 80], skyBot: [90, 74, 106], star: 0.50, lamp: 0.75, shade: 0.30, glow: 0.0, patch: 0.04, patchC: 0.12, beam: 0.0 },
      { t: 0.90, skyTop: [20, 26, 48], skyBot: [42, 51, 80], star: 0.90, lamp: 1.0, shade: 0.38, glow: 0.0, patch: 0.0, patchC: 0.10, beam: 0.0 },
      // 深夜绕回凌晨（与第一帧相同，只是时间记为 1，用来平滑衔接）
      { t: 1.00, skyTop: [110, 120, 170], skyBot: [235, 185, 140], star: 0.50, lamp: 0.35, shade: 0.30, glow: 0.05, patch: 0.08, patchC: 0.06, beam: 0.10 },
    ];

    // 取 t 时刻的插值调色板
    function sample(t) {
      var i = 0;
      while (i < STOPS.length - 2 && STOPS[i + 1].t <= t) i++;
      var a = STOPS[i];
      var b = STOPS[i + 1];
      var k = (t - a.t) / (b.t - a.t);
      var out = {};
      for (var key in a) {
        if (key === "t") continue;
        out[key] = Array.isArray(a[key])
          ? [lerp(a[key][0], b[key][0], k), lerp(a[key][1], b[key][1], k), lerp(a[key][2], b[key][2], k)]
          : lerp(a[key], b[key], k);
      }
      return out;
    }

    /* —— 窗内星星（只画在窗口区域，随夜色渐显）—— */
    var stars = [];
    function seedStars() {
      stars = [];
      for (var i = 0; i < 60; i++) {
        stars.push({
          x: Math.random(), // 窗口内的相对坐标
          y: Math.random() * 0.85,
          r: 0.4 + Math.random() * 1.0,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    /* —— 画纸颗粒：预渲染一张 160×160 的噪点布纹，全屏平铺 —— */
    var grain = null;
    function makeGrain() {
      grain = document.createElement("canvas");
      grain.width = 160;
      grain.height = 160;
      var g = grain.getContext("2d");
      if (!g) return;
      for (var i = 0; i < 2600; i++) {
        var v = Math.random();
        g.fillStyle =
          v < 0.5
            ? "rgba(60,44,26," + (Math.random() * 0.5).toFixed(2) + ")"
            : "rgba(255,246,220," + (Math.random() * 0.4).toFixed(2) + ")";
        g.fillRect(Math.random() * 160, Math.random() * 160, 1.2, 1.2);
      }
    }

    /* ================= 油画底层：静物房间（烘焙一次） ================= */
    var roomC = document.createElement("canvas");

    // 在矩形区域里撒短笔触：颜色围绕 base 抖动，方向大致 angle —— 这是「油画感」的来源
    function strokes(g, x, y, w, h, base, count, angle, len, alpha) {
      for (var i = 0; i < count; i++) {
        var cx = x + Math.random() * w;
        var cy = y + Math.random() * h;
        var j = (Math.random() - 0.5) * 44; // 颜料的明暗抖动
        g.strokeStyle = rgba(
          [clamp(base[0] + j, 0, 255), clamp(base[1] + j, 0, 255), clamp(base[2] + j, 0, 255)],
          alpha * (0.5 + Math.random() * 0.5)
        );
        g.lineWidth = 2 + Math.random() * 4;
        g.lineCap = "round";
        var a = angle + (Math.random() - 0.5) * 0.6;
        var L = len * (0.5 + Math.random());
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(a) * L, cy + Math.sin(a) * L);
        g.stroke();
      }
    }

    // 柔边椭圆阴影：一层层同心椭圆叠出羽化效果
    function softShadow(g, cx, cy, rx, ry, strength) {
      for (var i = 8; i >= 1; i--) {
        g.beginPath();
        g.ellipse(cx, cy, (rx * i) / 8, (ry * i) / 8, 0, 0, Math.PI * 2);
        g.fillStyle = "rgba(30,18,10," + ((strength * i) / 8 / 3).toFixed(3) + ")";
        g.fill();
      }
    }

    function bake() {
      roomC.width = W * dpr;
      roomC.height = H * dpr;
      var g = roomC.getContext("2d");
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);

      /* —— 墙面（挖掉窗口，露出后面的动态天空）——
         灰泥墙三层做法：大渐变定调 → 大块柔边色斑「破色」→ 多向干刷短笔触 */
      g.save();
      var wallPath = new Path2D();
      wallPath.rect(0, 0, W, H);
      wallPath.rect(wx0 - ft, wy0 - ft, ww + 2 * ft, wh + 2 * ft);
      g.clip(wallPath, "evenodd");

      var wall = g.createLinearGradient(0, 0, W * 0.2, fy0);
      wall.addColorStop(0, "#8f6f4b");
      wall.addColorStop(0.5, "#7a5b3c");
      wall.addColorStop(1, "#5c4530");
      g.fillStyle = wall;
      g.fillRect(0, 0, W, fy0);

      // 破色色团：赭石/橄榄/熟褐的大块柔边色斑，墙面不死板
      var wallPatches = [
        [W * 0.10, H * 0.12, W * 0.30, [166, 128, 84], 0.2],
        [W * 0.62, H * 0.08, W * 0.26, [139, 122, 80], 0.16],
        [W * 0.85, H * 0.42, W * 0.3, [96, 72, 50], 0.22],
        [W * 0.3, H * 0.5, W * 0.34, [120, 88, 58], 0.18],
        [W * 0.58, H * 0.6, W * 0.24, [88, 66, 46], 0.16],
      ];
      wallPatches.forEach(function (p) {
        var rg = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], p[2]);
        rg.addColorStop(0, rgba(p[3], p[4]));
        rg.addColorStop(1, rgba(p[3], 0));
        g.fillStyle = rg;
        g.fillRect(p[0] - p[2], p[1] - p[2], p[2] * 2, p[2] * 2);
      });

      // 干刷肌理：多方向、多色、多长度的短笔触叠出灰泥感
      strokes(g, 0, 0, W, fy0, [120, 92, 62], Math.round((W * fy0) / 2200), Math.PI / 2.6, 26, 0.12);
      strokes(g, 0, 0, W, fy0, [150, 118, 80], Math.round((W * fy0) / 4200), Math.PI / 3.2, 18, 0.1);
      strokes(g, 0, 0, W, fy0, [96, 74, 52], Math.round((W * fy0) / 5000), 0.2, 30, 0.08);
      strokes(g, 0, 0, W, fy0, [134, 110, 70], Math.round((W * fy0) / 6000), -0.4, 22, 0.07);
      g.restore();

      /* —— 木地板：每块板单独定调 + 顺纹干刷 + 木节 —— */
      var floor = g.createLinearGradient(0, fy0, 0, H);
      floor.addColorStop(0, "#9a6e40");
      floor.addColorStop(0.6, "#7a5533");
      floor.addColorStop(1, "#5e422a");
      g.fillStyle = floor;
      g.fillRect(0, fy0, W, H - fy0);
      // 地板板块：竖缝向画面中线微微收拢，相邻板明暗交替
      var plankN = 12;
      for (var pi = 0; pi < plankN; pi++) {
        var px0 = (W * pi) / plankN - W * 0.02;
        var px1 = (W * (pi + 1)) / plankN - W * 0.02;
        g.fillStyle = pi % 2 === 0 ? "rgba(255,220,160,0.05)" : "rgba(40,24,12,0.05)";
        g.beginPath();
        g.moveTo(px0, fy0);
        g.lineTo(px1, fy0);
        g.lineTo(px1 + W * 0.03, H);
        g.lineTo(px0 + W * 0.03, H);
        g.closePath();
        g.fill();
        g.strokeStyle = "rgba(40,26,14,0.35)";
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(px0, fy0);
        g.lineTo(px0 + W * 0.03, H);
        g.stroke();
      }
      // 木纹笔触（横向顺纹，三层色）
      strokes(g, 0, fy0, W, H - fy0, [150, 106, 62], Math.round((W * (H - fy0)) / 1800), 0, 44, 0.11);
      strokes(g, 0, fy0, W, H - fy0, [94, 64, 38], Math.round((W * (H - fy0)) / 3000), 0, 30, 0.1);
      strokes(g, 0, fy0, W, H - fy0, [176, 132, 84], Math.round((W * (H - fy0)) / 4500), 0.05, 36, 0.07);
      // 几处木节（同心双圈）
      for (var kn = 0; kn < 6; kn++) {
        var kx = Math.random() * W;
        var ky = fy0 + 20 + Math.random() * (H - fy0 - 30);
        g.beginPath();
        g.ellipse(kx, ky, 6, 3.5, 0.3, 0, Math.PI * 2);
        g.strokeStyle = "rgba(58,38,20,0.4)";
        g.lineWidth = 2;
        g.stroke();
        g.beginPath();
        g.ellipse(kx, ky, 2.5, 1.4, 0.3, 0, Math.PI * 2);
        g.strokeStyle = "rgba(58,38,20,0.3)";
        g.stroke();
      }
      // 踢脚线：顶面受光、立面偏暗
      g.fillStyle = "#5a4130";
      g.fillRect(0, fy0 - 7, W, 9);
      g.fillStyle = "rgba(255,220,160,0.28)";
      g.fillRect(0, fy0 - 7, W, 2);

      /* —— 椭圆编织地毯（新英格兰味儿）：同心色带 + 沿带的编织短针脚 —— */
      var rugCX = W * 0.47;
      var rugCY = H * 0.885;
      var rugRX = W * 0.3;
      var rugRY = H * 0.078;
      var rugBands = [
        [1.0, [96, 74, 52]],
        [0.86, [150, 110, 62]],
        [0.7, [110, 96, 58]],
        [0.54, [140, 84, 52]],
        [0.38, [120, 92, 62]],
        [0.22, [96, 74, 52]],
      ];
      rugBands.forEach(function (b, bi) {
        g.beginPath();
        g.ellipse(rugCX, rugCY, rugRX * b[0], rugRY * b[0], 0, 0, Math.PI * 2);
        g.fillStyle = rgb(b[1]);
        g.fill();
        if (bi > 0) {
          g.strokeStyle = "rgba(40,26,14,0.3)";
          g.lineWidth = 1.2;
          g.stroke();
        }
      });
      // 编织针脚：沿每圈色带撒短斜线
      for (var rb = 0; rb < rugBands.length; rb++) {
        var brx = rugRX * rugBands[rb][0];
        var bry = rugRY * rugBands[rb][0];
        g.strokeStyle = "rgba(60,44,28,0.16)";
        g.lineWidth = 1;
        for (var si = 0; si < 60; si++) {
          var sa = (si / 60) * Math.PI * 2;
          var sx2 = rugCX + Math.cos(sa) * brx;
          var sy2 = rugCY + Math.sin(sa) * bry;
          g.beginPath();
          g.moveTo(sx2, sy2);
          g.lineTo(sx2 + Math.cos(sa + 0.35) * 5, sy2 + Math.sin(sa + 0.35) * 3);
          g.stroke();
        }
      }

      /* —— 落地阴影（家具还没画，影子先垫在下面）—— */
      softShadow(g, W * 0.37, H * 0.88, W * 0.21, H * 0.032, 0.5);
      softShadow(g, W * 0.8, H * 0.94, W * 0.17, H * 0.026, 0.45);

      /* —— 窗帘：左缘波浪起伏的垂坠褶皱（右侧）—— */
      var cx0 = wx1 - ww * 0.04;
      var cw = W * 0.085;
      var cH = wy1 + H * 0.07;
      g.beginPath();
      g.moveTo(cx0 + cw, 0);
      g.lineTo(cx0 + cw, cH - H * 0.01);
      // 下摆波浪边
      g.quadraticCurveTo(cx0 + cw * 0.8, cH + H * 0.012, cx0 + cw * 0.6, cH - H * 0.004);
      g.quadraticCurveTo(cx0 + cw * 0.4, cH + H * 0.014, cx0 + cw * 0.22, cH - H * 0.006);
      g.quadraticCurveTo(cx0 + cw * 0.1, cH + H * 0.01, cx0 + cw * 0.06, cH - H * 0.02);
      // 左缘：之字形褶皱一路上行
      g.lineTo(cx0 + cw * 0.16, cH * 0.78);
      g.lineTo(cx0 + cw * 0.04, cH * 0.62);
      g.lineTo(cx0 + cw * 0.15, cH * 0.47);
      g.lineTo(cx0 + cw * 0.03, cH * 0.31);
      g.lineTo(cx0 + cw * 0.13, cH * 0.16);
      g.lineTo(cx0 + cw * 0.02, 0);
      g.closePath();
      var curtain = g.createLinearGradient(cx0, 0, cx0 + cw, 0);
      curtain.addColorStop(0, "#8a5640");
      curtain.addColorStop(0.5, "#7a4a38");
      curtain.addColorStop(1, "#5e3626");
      g.fillStyle = curtain;
      g.fill();
      // 褶皱明暗：竖向交替的亮纹与暗纹（裁在帘形内）
      g.save();
      g.clip();
      strokes(g, cx0, 0, cw, cH, [150, 92, 64], 110, Math.PI / 2, 46, 0.14);
      strokes(g, cx0, 0, cw, cH, [70, 40, 26], 90, Math.PI / 2, 42, 0.14);
      strokes(g, cx0, 0, cw, cH, [176, 120, 84], 40, Math.PI / 2, 30, 0.08);
      g.restore();
      // 窗帘杆 + 端头小球
      g.fillStyle = "#3a2a1a";
      g.fillRect(cx0 - cw * 0.18, H * 0.004, cw * 1.36, H * 0.008);
      g.beginPath();
      g.arc(cx0 - cw * 0.18, H * 0.008, H * 0.008, 0, Math.PI * 2);
      g.fill();

      /* —— 木窗框：木纹 + 朝光倒角 + 墙面投影 —— */
      g.fillStyle = "rgba(30,18,10,0.25)";
      g.fillRect(wx0 - ft + 4, wy1 + ft * 1.4, ww + 2 * ft, 5); // 窗台下沿投影
      g.fillRect(wx1 + ft, wy0 - ft + 4, 5, wh + ft + ft * 1.4); // 右框外侧投影

      // 画一根木框条：底色 + 顺纹 + 朝窗一侧的受光边
      function frameBar(x, y, w, h, horiz) {
        g.fillStyle = "#4a3322";
        g.fillRect(x, y, w, h);
        strokes(g, x, y, Math.max(w, 1), Math.max(h, 1), [110, 78, 48], 14, horiz ? 0 : Math.PI / 2, 8, 0.22);
        g.fillStyle = "rgba(230,180,120,0.4)";
        if (horiz) g.fillRect(x, y, w, 1.6);
        else g.fillRect(x, y, 1.6, h);
      }
      frameBar(wx0 - ft, wy0 - ft, ww + 2 * ft, ft, true); // 上
      frameBar(wx0 - ft, wy1, ww + 2 * ft, ft * 1.4, true); // 窗台（稍厚）
      frameBar(wx0 - ft, wy0 - ft, ft, wh + ft + ft * 1.4, false); // 左
      frameBar(wx1, wy0 - ft, ft, wh + ft + ft * 1.4, false); // 右
      frameBar(wx0 + ww / 2 - ft / 4, wy0, ft / 2, wh, false); // 竖棂
      frameBar(wx0, wy0 + wh / 2 - ft / 4, ww, ft / 2, true); // 横棂

      /* —— 窗台上的一小盆绿植（逆光剪影感）—— */
      var potX = wx0 + ww * 0.12;
      var potY = wy1;
      g.fillStyle = "#7a4a30";
      g.beginPath();
      g.moveTo(potX - W * 0.012, potY - H * 0.035);
      g.lineTo(potX + W * 0.012, potY - H * 0.035);
      g.lineTo(potX + W * 0.009, potY);
      g.lineTo(potX - W * 0.009, potY);
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(255,200,140,0.25)";
      g.fillRect(potX - W * 0.012, potY - H * 0.035, W * 0.004, H * 0.03);
      // 叶子：几笔带弯度的弧线
      for (var lf = 0; lf < 7; lf++) {
        var la = -Math.PI / 2 + (lf - 3) * 0.35;
        var ll = H * (0.05 + (lf % 3) * 0.015);
        g.strokeStyle =
          "rgba(" + (58 + (lf % 3) * 12) + "," + (84 + (lf % 4) * 10) + ",44,0.9)";
        g.lineWidth = 2.5 + (lf % 2);
        g.lineCap = "round";
        g.beginPath();
        g.moveTo(potX, potY - H * 0.035);
        g.quadraticCurveTo(
          potX + Math.cos(la) * ll * 0.4,
          potY - H * 0.035 + Math.sin(la) * ll * 0.6,
          potX + Math.cos(la) * ll,
          potY - H * 0.035 + Math.sin(la) * ll
        );
        g.stroke();
      }

      /* —— 墙上的小挂画：木框 + 迷你风景（远山两重 + 干笔田野 + 玻璃反光）—— */
      var px0 = W * 0.67;
      var py0 = H * 0.15;
      var pw = W * 0.12;
      var ph = H * 0.15;
      // 木框：底色 + 受光边/背光边
      g.fillStyle = "#3a2a1a";
      g.fillRect(px0 - 6, py0 - 6, pw + 12, ph + 12);
      g.fillStyle = "rgba(230,180,120,0.35)";
      g.fillRect(px0 - 6, py0 - 6, pw + 12, 2);
      g.fillRect(px0 - 6, py0 - 6, 2, ph + 12);
      g.fillStyle = "rgba(20,12,6,0.5)";
      g.fillRect(px0 - 6, py0 + ph + 4, pw + 12, 2);
      // 画芯：天空 → 远山 → 田野
      var pic = g.createLinearGradient(0, py0, 0, py0 + ph);
      pic.addColorStop(0, "#9db4c8");
      pic.addColorStop(0.55, "#d8bd8a");
      pic.addColorStop(1, "#7a6a42");
      g.fillStyle = pic;
      g.fillRect(px0, py0, pw, ph);
      g.fillStyle = "rgba(70,80,52,0.75)"; // 远山
      g.beginPath();
      g.moveTo(px0, py0 + ph);
      g.quadraticCurveTo(px0 + pw * 0.35, py0 + ph * 0.5, px0 + pw * 0.7, py0 + ph * 0.72);
      g.quadraticCurveTo(px0 + pw * 0.85, py0 + ph * 0.8, px0 + pw, py0 + ph * 0.74);
      g.lineTo(px0 + pw, py0 + ph);
      g.closePath();
      g.fill();
      g.fillStyle = "rgba(52,60,40,0.8)"; // 近坡
      g.beginPath();
      g.moveTo(px0, py0 + ph);
      g.quadraticCurveTo(px0 + pw * 0.25, py0 + ph * 0.68, px0 + pw * 0.55, py0 + ph * 0.85);
      g.lineTo(px0 + pw, py0 + ph * 0.9);
      g.lineTo(px0 + pw, py0 + ph);
      g.closePath();
      g.fill();
      // 田野和天空的干笔
      strokes(g, px0, py0 + ph * 0.6, pw, ph * 0.4, [150, 128, 80], 40, 0.1, 8, 0.2);
      strokes(g, px0, py0, pw, ph * 0.5, [170, 180, 200], 20, 0.3, 6, 0.12);
      // 玻璃反光（斜向一道）
      g.fillStyle = "rgba(255,255,255,0.06)";
      g.beginPath();
      g.moveTo(px0 + pw * 0.15, py0);
      g.lineTo(px0 + pw * 0.45, py0);
      g.lineTo(px0 + pw * 0.2, py0 + ph);
      g.lineTo(px0, py0 + ph);
      g.closePath();
      g.fill();

      /* —— 书桌：厚桌面 + 倒角高光 + 圆柱感的腿 + 横撑 —— */
      var deskTopY = H * 0.6;
      var deskX0 = W * 0.2;
      var deskW = W * 0.34;
      var deskG = g.createLinearGradient(0, deskTopY, 0, deskTopY + H * 0.035);
      deskG.addColorStop(0, "#a67c4e");
      deskG.addColorStop(1, "#6e4c2e");
      g.fillStyle = deskG;
      g.fillRect(deskX0, deskTopY, deskW, H * 0.035);
      strokes(g, deskX0, deskTopY, deskW, H * 0.035, [168, 128, 82], 110, 0, 26, 0.16);
      strokes(g, deskX0, deskTopY, deskW, H * 0.035, [94, 64, 38], 60, 0, 20, 0.12);
      g.fillStyle = "rgba(255,224,170,0.4)"; // 桌面朝光的高光
      g.fillRect(deskX0, deskTopY, deskW, 3);
      g.fillStyle = "rgba(40,24,12,0.35)"; // 正面沿底部的暗线
      g.fillRect(deskX0, deskTopY + H * 0.035 - 2, deskW, 2);
      // 腿：横向渐变做出圆柱感（中间亮、两边暗）
      function deskLeg(lx) {
        var lw = W * 0.014;
        var lg = g.createLinearGradient(lx, 0, lx + lw, 0);
        lg.addColorStop(0, "#4e3420");
        lg.addColorStop(0.45, "#7a5636");
        lg.addColorStop(1, "#3c2818");
        g.fillStyle = lg;
        g.fillRect(lx, deskTopY + H * 0.035, lw, H * 0.24);
        strokes(g, lx, deskTopY + H * 0.035, lw, H * 0.24, [110, 78, 48], 24, Math.PI / 2, 20, 0.14);
      }
      deskLeg(W * 0.225);
      deskLeg(W * 0.5);
      // 两腿之间的横撑
      g.fillStyle = "#54381f";
      g.fillRect(W * 0.225, deskTopY + H * 0.2, W * 0.289, H * 0.012);

      /* —— 桌左一摞书（布面书脊 + 书页侧）—— */
      var bkX = W * 0.205;
      var bkW = W * 0.04;
      var bkY = deskTopY;
      var bookCols = ["#6b7c3a", "#8c4a2f", "#4a5a6e"];
      bookCols.forEach(function (bc, bi) {
        var bh = H * 0.012;
        bkY -= bh;
        var off = (bi % 2) * W * 0.003; // 微微错开，像随手摞的
        g.fillStyle = bc;
        g.fillRect(bkX + off, bkY, bkW, bh);
        g.fillStyle = "rgba(240,230,200,0.85)"; // 书页侧
        g.fillRect(bkX + off + bkW * 0.14, bkY + bh * 0.25, bkW * 0.86, bh * 0.5);
        g.fillStyle = "rgba(20,12,6,0.25)"; // 书底阴影线
        g.fillRect(bkX + off, bkY + bh - 1, bkW, 1);
      });

      /* —— 桌上摊开的书（书页微卷 + 字迹 + 红书签带）—— */
      g.fillStyle = "#ead9b8";
      g.beginPath();
      g.moveTo(W * 0.295, deskTopY);
      g.quadraticCurveTo(W * 0.325, deskTopY - H * 0.012, W * 0.355, deskTopY - H * 0.004);
      g.quadraticCurveTo(W * 0.385, deskTopY - H * 0.012, W * 0.415, deskTopY);
      g.closePath();
      g.fill();
      // 右页背光微影，书页有了起伏
      g.fillStyle = "rgba(120,90,50,0.18)";
      g.beginPath();
      g.moveTo(W * 0.355, deskTopY - H * 0.004);
      g.quadraticCurveTo(W * 0.385, deskTopY - H * 0.012, W * 0.415, deskTopY);
      g.closePath();
      g.fill();
      // 中缝
      g.strokeStyle = "rgba(90,65,30,0.5)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(W * 0.355, deskTopY - H * 0.004);
      g.lineTo(W * 0.355, deskTopY + 1);
      g.stroke();
      // 书页上的字迹小短线（长短不一更像手写行）
      g.strokeStyle = "rgba(70,50,28,0.4)";
      for (var bl = 0; bl < 8; bl++) {
        var bx = bl < 4 ? W * 0.302 : W * 0.362;
        var by = deskTopY - H * 0.0095 + (bl % 4) * 3.0;
        g.beginPath();
        g.moveTo(bx, by);
        g.lineTo(bx + W * (0.038 + (bl % 3) * 0.004), by + 0.5);
        g.stroke();
      }
      // 红书签带从书页间垂下
      g.strokeStyle = "#8c2f2f";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(W * 0.385, deskTopY - H * 0.006);
      g.quadraticCurveTo(W * 0.39, deskTopY + H * 0.01, W * 0.388, deskTopY + H * 0.022);
      g.stroke();

      /* —— 茶杯 + 杯碟（杯口有茶汤）—— */
      g.fillStyle = "#7a5636";
      g.beginPath();
      g.ellipse(W * 0.264, deskTopY - H * 0.001, W * 0.016, H * 0.004, 0, 0, Math.PI * 2);
      g.fill(); // 碟
      g.fillStyle = "#8c4a2f";
      g.fillRect(W * 0.255, deskTopY - H * 0.02, W * 0.018, H * 0.019); // 杯身
      g.beginPath();
      g.arc(W * 0.264, deskTopY - H * 0.024, W * 0.009, 0, Math.PI * 2);
      g.fill(); // 杯口
      g.fillStyle = "rgba(60,30,16,0.6)";
      g.beginPath();
      g.arc(W * 0.264, deskTopY - H * 0.024, W * 0.006, 0, Math.PI * 2);
      g.fill(); // 茶汤
      g.fillStyle = "rgba(255,224,180,0.5)";
      g.fillRect(W * 0.257, deskTopY - H * 0.018, 2.5, H * 0.014); // 杯身高光

      /* —— 台灯：椭圆铜底座 + 铜灯杆 + 梯形灯罩（底层画「未点亮」状态，
              夜里的点亮效果由动态层在灯罩位置叠加暖光）—— */
      var lampX = W * 0.475;
      g.fillStyle = "#3a2a1a";
      g.beginPath();
      g.ellipse(lampX, deskTopY - H * 0.004, W * 0.014, H * 0.005, 0, 0, Math.PI * 2);
      g.fill(); // 椭圆底座
      var poleG = g.createLinearGradient(lampX - 2, 0, lampX + 2, 0);
      poleG.addColorStop(0, "#4e3a20");
      poleG.addColorStop(0.5, "#a8823f");
      poleG.addColorStop(1, "#3a2a14");
      g.fillStyle = poleG;
      g.fillRect(lampX - 1.5, deskTopY - H * 0.075, 3, H * 0.071); // 铜灯杆
      var shadeG = g.createLinearGradient(lampX - W * 0.02, 0, lampX + W * 0.02, 0);
      shadeG.addColorStop(0, "#8a6a42");
      shadeG.addColorStop(0.45, "#785634");
      shadeG.addColorStop(1, "#4e3420");
      g.fillStyle = shadeG;
      g.beginPath();
      g.moveTo(lampX - W * 0.02, deskTopY - H * 0.075);
      g.lineTo(lampX + W * 0.02, deskTopY - H * 0.075);
      g.lineTo(lampX + W * 0.014, deskTopY - H * 0.115);
      g.lineTo(lampX - W * 0.014, deskTopY - H * 0.115);
      g.closePath();
      g.fill();
      strokes(g, lampX - W * 0.02, deskTopY - H * 0.115, W * 0.04, H * 0.04, [150, 108, 66], 18, Math.PI / 2, 12, 0.2);
      // 灯罩左沿的受光边
      g.strokeStyle = "rgba(255,220,150,0.4)";
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(lampX - W * 0.02, deskTopY - H * 0.075);
      g.lineTo(lampX - W * 0.014, deskTopY - H * 0.115);
      g.stroke();

      /* —— 翼背扶手椅：高靠背 + 鼓座垫 + 双扶手 + 短木腿，
              左扶手上搭一条薄毯（窗在左边，左沿受光）—— */
      var chairX = W * 0.66;
      var chairW = W * 0.27;
      var chairTop = H * 0.52;
      var armTop = H * 0.7;
      var seatTop = H * 0.78; // 座垫顶面
      // 短木腿（先画，上部被椅身挡住）
      g.fillStyle = "#3c2818";
      g.fillRect(chairX + chairW * 0.12, H * 0.86, W * 0.012, H * 0.08);
      g.fillRect(chairX + chairW * 0.84, H * 0.86, W * 0.012, H * 0.08);
      // 座垫下的前档横板
      g.fillStyle = "#452e1e";
      g.fillRect(chairX + chairW * 0.1, H * 0.86, chairW * 0.8, H * 0.035);
      // 靠背大形：顶部微拱，两侧下到座面
      g.beginPath();
      g.moveTo(chairX + chairW * 0.06, seatTop + H * 0.02);
      g.lineTo(chairX + chairW * 0.06, chairTop + H * 0.07);
      g.quadraticCurveTo(chairX + chairW * 0.07, chairTop, chairX + chairW * 0.5, chairTop);
      g.quadraticCurveTo(chairX + chairW * 0.94, chairTop, chairX + chairW * 0.94, chairTop + H * 0.08);
      g.lineTo(chairX + chairW * 0.94, seatTop + H * 0.02);
      g.closePath();
      var chairG = g.createLinearGradient(chairX, chairTop, chairX + chairW, seatTop);
      chairG.addColorStop(0, "#7d563c");
      chairG.addColorStop(0.55, "#5a3a26");
      chairG.addColorStop(1, "#3c2618");
      g.fillStyle = chairG;
      g.fill();
      // 呢料肌理：轮廓内叠三层笔触
      g.save();
      g.clip();
      strokes(g, chairX, chairTop, chairW, H * 0.3, [126, 86, 60], 240, Math.PI / 2.3, 24, 0.12);
      strokes(g, chairX, chairTop, chairW, H * 0.3, [66, 42, 26], 180, Math.PI / 1.9, 22, 0.11);
      strokes(g, chairX, chairTop, chairW, H * 0.3, [150, 108, 74], 80, Math.PI / 2.1, 16, 0.07);
      g.restore();
      // 靠背左沿受光
      g.strokeStyle = "rgba(255,214,160,0.28)";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(chairX + chairW * 0.065, seatTop);
      g.lineTo(chairX + chairW * 0.065, chairTop + H * 0.07);
      g.stroke();
      // 座垫：饱满微鼓，顶面亮、前面暗
      var cushX0 = chairX + chairW * 0.1;
      var cushX1 = chairX + chairW * 0.9;
      g.beginPath();
      g.moveTo(cushX0, H * 0.86);
      g.lineTo(cushX0, seatTop + H * 0.02);
      g.quadraticCurveTo((cushX0 + cushX1) / 2, seatTop - H * 0.025, cushX1, seatTop + H * 0.02);
      g.lineTo(cushX1, H * 0.86);
      g.closePath();
      var cushG = g.createLinearGradient(0, seatTop - H * 0.02, 0, H * 0.87);
      cushG.addColorStop(0, "#9a6a46");
      cushG.addColorStop(0.6, "#8a5c3e");
      cushG.addColorStop(1, "#5e3c26");
      g.fillStyle = cushG;
      g.fill();
      g.save();
      g.clip();
      strokes(g, cushX0, seatTop - H * 0.03, cushX1 - cushX0, H * 0.12, [170, 122, 84], 80, 0, 18, 0.14);
      strokes(g, cushX0, seatTop - H * 0.03, cushX1 - cushX0, H * 0.12, [80, 52, 34], 50, 0.2, 14, 0.1);
      g.restore();
      // 双扶手：顶面圆润受光，与靠背之间留一道暗缝分出前后
      function armrest(ax, seamOnRight) {
        g.fillStyle = "rgba(30,18,10,0.35)";
        if (seamOnRight) g.fillRect(ax + chairW * 0.09, armTop + H * 0.02, 3, H * 0.14);
        else g.fillRect(ax - 3, armTop + H * 0.02, 3, H * 0.14);
        var ag = g.createLinearGradient(ax, 0, ax + chairW * 0.09, 0);
        ag.addColorStop(0, "#5e4028");
        ag.addColorStop(0.5, "#4e3423");
        ag.addColorStop(1, "#3a2618");
        g.fillStyle = ag;
        g.beginPath();
        g.moveTo(ax, H * 0.88);
        g.lineTo(ax, armTop + H * 0.02);
        g.quadraticCurveTo(ax, armTop, ax + chairW * 0.09, armTop);
        g.lineTo(ax + chairW * 0.09, H * 0.88);
        g.closePath();
        g.fill();
        g.fillStyle = "rgba(255,214,160,0.25)";
        g.fillRect(ax, armTop, chairW * 0.09, 3);
        strokes(g, ax, armTop, chairW * 0.09, H * 0.18, [110, 76, 52], 40, Math.PI / 2, 16, 0.12);
      }
      armrest(chairX + chairW * 0.05, true);
      armrest(chairX + chairW * 0.86, false);
      // 搭在左扶手上的薄毯：赭红色，垂坠褶皱 + 波浪底边
      var blX = chairX + chairW * 0.02;
      var blW = chairW * 0.16;
      g.beginPath();
      g.moveTo(blX, armTop - H * 0.015);
      g.quadraticCurveTo(blX + blW * 0.5, armTop - H * 0.03, blX + blW, armTop - H * 0.01);
      g.lineTo(blX + blW * 0.92, H * 0.94);
      g.quadraticCurveTo(blX + blW * 0.75, H * 0.955, blX + blW * 0.6, H * 0.94);
      g.quadraticCurveTo(blX + blW * 0.4, H * 0.96, blX + blW * 0.25, H * 0.945);
      g.quadraticCurveTo(blX + blW * 0.1, H * 0.955, blX + blW * 0.05, H * 0.94);
      g.lineTo(blX + blW * 0.08, H * 0.8);
      g.closePath();
      g.fillStyle = "#8c4a35";
      g.fill();
      g.save();
      g.clip();
      strokes(g, blX, armTop - H * 0.03, blW, H * 0.2, [150, 84, 60], 60, Math.PI / 2, 18, 0.16);
      strokes(g, blX, armTop - H * 0.03, blW, H * 0.2, [80, 40, 28], 45, Math.PI / 2, 16, 0.14);
      g.restore();

      /* —— 统一罩染：极淡的暖色大笔触把各元素「揉」进同一幅画（避开窗口）—— */
      g.save();
      var unifyPath = new Path2D();
      unifyPath.rect(0, 0, W, H);
      unifyPath.rect(wx0 - ft, wy0 - ft, ww + 2 * ft, wh + 2 * ft);
      g.clip(unifyPath, "evenodd");
      strokes(g, 0, 0, W, H, [140, 110, 80], Math.round((W * H) / 9000), 0.6, 60, 0.05);
      strokes(g, 0, 0, W, H, [90, 70, 50], Math.round((W * H) / 11000), -0.8, 50, 0.05);
      g.restore();
    }

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      wx0 = W * 0.14;
      wy0 = H * 0.09;
      wx1 = W * 0.54;
      wy1 = H * 0.55;
      ww = wx1 - wx0;
      wh = wy1 - wy0;
      fy0 = H * 0.68;
      ft = Math.max(6, W * 0.008); // 窗框条宽度

      seedStars();
      bake();
    }
    window.addEventListener("resize", resize);
    resize();
    makeGrain();

    /* ================= 画一帧（动态层） ================= */
    function draw(t) {
      var s = sample(t);
      ctx.clearRect(0, 0, W, H);

      /* —— A. 窗内天空（云 / 日 / 月 / 星 / 树影，全部限制在窗口里）—— */
      ctx.save();
      ctx.beginPath();
      ctx.rect(wx0, wy0, ww, wh);
      ctx.clip();

      var sky = ctx.createLinearGradient(0, wy0, 0, wy1);
      sky.addColorStop(0, rgb(s.skyTop));
      sky.addColorStop(1, rgb(s.skyBot));
      ctx.fillStyle = sky;
      ctx.fillRect(wx0, wy0, ww, wh);

      // 星星（只有夜里明显）
      if (s.star > 0.02) {
        stars.forEach(function (st) {
          var a = s.star * (0.5 + 0.5 * Math.sin(t * 900 * st.r + st.phase));
          ctx.beginPath();
          ctx.arc(wx0 + st.x * ww, wy0 + st.y * wh, st.r, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(240,244,255," + a.toFixed(3) + ")";
          ctx.fill();
        });
      }

      // 云：三团缓慢的云，颜色从天空色里提取，白天白、黄昏橙、夜晚融进夜幕；
      // 每团由几个交叠的椭圆 + 云底暗部组成，画出体积感
      var cloudLift = 0.45;
      var cloudCol = [
        lerp(s.skyBot[0], 255, cloudLift),
        lerp(s.skyBot[1], 248, cloudLift),
        lerp(s.skyBot[2], 238, cloudLift),
      ];
      var cloudShadow = [
        lerp(cloudCol[0], 90, 0.45),
        lerp(cloudCol[1], 80, 0.45),
        lerp(cloudCol[2], 90, 0.45),
      ];
      var cloudA = clamp(0.55 - s.shade * 1.4, 0.06, 0.55);
      for (var ci = 0; ci < 3; ci++) {
        var drift = ((t * 0.6 + ci * 0.37) % 1.3) - 0.15; // 一整天飘过窗口
        var cx = wx0 + ww * drift;
        var cy = wy0 + wh * (0.18 + ci * 0.16);
        var ca = cloudA * (0.5 + ci * 0.2);
        ctx.fillStyle = rgba(cloudCol, ca);
        ctx.beginPath();
        ctx.ellipse(cx, cy, ww * 0.15, wh * 0.05, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + ww * 0.08, cy - wh * 0.025, ww * 0.09, wh * 0.038, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx - ww * 0.07, cy - wh * 0.015, ww * 0.07, wh * 0.03, 0, 0, Math.PI * 2);
        ctx.fill();
        // 云底暗部
        ctx.fillStyle = rgba(cloudShadow, ca * 0.5);
        ctx.beginPath();
        ctx.ellipse(cx + ww * 0.01, cy + wh * 0.022, ww * 0.12, wh * 0.02, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 太阳 / 月亮沿弧线划过窗口
      var srcX; // 光源的 x（决定地板窗影的偏斜方向）
      if (t < 0.75) {
        var df = t / 0.75; // 白天进度
        srcX = wx0 + ww * df;
        var sx = srcX;
        var sy = wy1 - wh * (0.12 + 0.78 * Math.sin(Math.PI * df));
        var halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, wh * 0.42);
        halo.addColorStop(0, "rgba(255,232,170,0.85)");
        halo.addColorStop(0.25, "rgba(255,214,130,0.4)");
        halo.addColorStop(1, "rgba(255,200,110,0)");
        ctx.fillStyle = halo;
        ctx.fillRect(wx0, wy0, ww, wh);
        ctx.beginPath();
        ctx.arc(sx, sy, wh * 0.075, 0, Math.PI * 2);
        ctx.fillStyle = "#fff3cf";
        ctx.fill();
      } else {
        var nf = (t - 0.75) / 0.25; // 夜晚进度
        srcX = wx0 + ww * nf;
        var my = wy1 - wh * (0.12 + 0.78 * Math.sin(Math.PI * nf));
        var mhalo = ctx.createRadialGradient(srcX, my, 0, srcX, my, wh * 0.3);
        mhalo.addColorStop(0, "rgba(220,230,255,0.5)");
        mhalo.addColorStop(1, "rgba(220,230,255,0)");
        ctx.fillStyle = mhalo;
        ctx.fillRect(wx0, wy0, ww, wh);
        ctx.beginPath();
        ctx.arc(srcX, my, wh * 0.06, 0, Math.PI * 2);
        ctx.fillStyle = "#e8eeff";
        ctx.fill();
      }

      // 窗下沿的远树剪影（固定的起伏轮廓）
      ctx.fillStyle = "rgb(58,54,50)";
      ctx.beginPath();
      ctx.moveTo(wx0, wy1);
      ctx.lineTo(wx0, wy1 - wh * 0.10);
      for (var ti = 0; ti <= 10; ti++) {
        var tx = wx0 + (ww * ti) / 10;
        var ty = wy1 - wh * (0.08 + 0.09 * Math.abs(Math.sin(ti * 2.4)));
        ctx.lineTo(tx, ty);
      }
      ctx.lineTo(wx1, wy1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      /* —— B. 穿过窗户的斜向光束（清晨和黄昏最美；
              落地方向与光源位置相反：光源偏左，光束倒向右）—— */
      var skew = (W * 0.34 - srcX) * 0.6;
      if (s.beam > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        var beamGrad = ctx.createLinearGradient(wx0, wy0, wx0 + ww * 0.9 + skew, H * 0.95);
        beamGrad.addColorStop(0, rgba([255, 220, 150], s.beam * 0.30));
        beamGrad.addColorStop(1, rgba([255, 220, 150], 0));
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(wx0 + ww * 0.08, wy0);
        ctx.lineTo(wx0 + ww * 0.45, wy0);
        ctx.lineTo(wx0 + ww * 0.45 + skew + ww * 0.75, H * 0.95);
        ctx.lineTo(wx0 + ww * 0.08 + skew + ww * 0.45, H * 0.95);
        ctx.closePath();
        ctx.fill();
        // 光束 2：更窄的一条
        ctx.beginPath();
        ctx.moveTo(wx0 + ww * 0.50, wy0);
        ctx.lineTo(wx0 + ww * 0.68, wy0);
        ctx.lineTo(wx0 + ww * 0.68 + skew + ww * 0.85, H * 0.95);
        ctx.lineTo(wx0 + ww * 0.50 + skew + ww * 0.55, H * 0.95);
        ctx.closePath();
        ctx.globalAlpha = 0.6;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      /* —— C. 叠上油画房间层（墙/地板/家具，窗口处透明露出天空）—— */
      ctx.drawImage(roomC, 0, 0, W, H);

      /* —— C2. 照进房间的光束（叠在房间层之上：清晨/黄昏时光斜扫进屋内；
              与 B 段窗内光束同一偏斜方向，物理一致；避开窗口防重复叠加）—— */
      if (s.beam > 0.01) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.rect(wx0, wy0, ww, wh);
        ctx.clip("evenodd");
        ctx.globalCompositeOperation = "lighter";
        var roomBeam = ctx.createLinearGradient(wx0, wy0, wx0 + ww * 0.9 + skew, H * 0.95);
        roomBeam.addColorStop(0, rgba([255, 220, 150], s.beam * 0.12));
        roomBeam.addColorStop(1, rgba([255, 220, 150], 0));
        ctx.fillStyle = roomBeam;
        ctx.beginPath();
        ctx.moveTo(wx0 + ww * 0.08, wy0);
        ctx.lineTo(wx0 + ww * 0.45, wy0);
        ctx.lineTo(wx0 + ww * 0.45 + skew + ww * 0.75, H * 0.95);
        ctx.lineTo(wx0 + ww * 0.08 + skew + ww * 0.45, H * 0.95);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(wx0 + ww * 0.5, wy0);
        ctx.lineTo(wx0 + ww * 0.68, wy0);
        ctx.lineTo(wx0 + ww * 0.68 + skew + ww * 0.85, H * 0.95);
        ctx.lineTo(wx0 + ww * 0.5 + skew + ww * 0.55, H * 0.95);
        ctx.closePath();
        ctx.globalAlpha = 0.6;
        ctx.fill();
        ctx.globalAlpha = 1;

        // 光束里的浮尘：沿光束缓慢飘落、轻轻闪烁
        for (var mi = 0; mi < 16; mi++) {
          var u = (mi * 0.618 + t * (0.4 + (mi % 3) * 0.15)) % 1; // 沿光束的下落进度
          var bx0 = wx0 + ww * (0.15 + (mi % 5) * 0.12);
          var by0 = wy0 + wh * 0.1;
          var mx = bx0 + (skew + ww * 0.55) * u + Math.sin(t * 40 + mi * 2.1) * 6;
          var my = by0 + (H * 0.93 - by0) * u;
          var ma = s.beam * (0.25 + 0.2 * Math.sin(t * 60 + mi * 1.3));
          ctx.fillStyle = "rgba(255,236,190," + ma.toFixed(3) + ")";
          ctx.beginPath();
          ctx.arc(mx, my, 0.8 + (mi % 3) * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      /* —— D. 投在地板上的窗影：
              方向与太阳移动【相反】（早晨太阳在东边，窗影偏西），
              叠三层带错位的描边，把硬边打散成笔触感 —— */
      function floorPatch(color, alpha) {
        if (alpha <= 0.01) return;
        for (var o = -1; o <= 1; o++) {
          var jitter = o * 7;
          var g2 = ctx.createLinearGradient(0, fy0, 0, H);
          g2.addColorStop(0, rgba(color, (alpha * 0.5) / (o === 0 ? 1 : 2.2)));
          g2.addColorStop(1, rgba(color, 0));
          ctx.fillStyle = g2;
          ctx.beginPath();
          ctx.moveTo(wx0 + ft, fy0 + 2);
          ctx.lineTo(wx1 - ft, fy0 + 2);
          ctx.lineTo(wx1 - ft + skew + W * 0.04 + jitter, H * 0.99);
          ctx.lineTo(wx0 + ft + skew - W * 0.02 + jitter, H * 0.99);
          ctx.closePath();
          ctx.fill();
        }
        // 窗棂在光斑里的影子
        ctx.fillStyle = rgba([60, 40, 24], alpha * 0.35);
        var mid1 = wx0 + ww / 2 + skew * 0.5;
        ctx.fillRect(mid1, fy0 + 2, 4, H * 0.30);
      }
      floorPatch([255, 214, 140], s.patch);
      if (s.patchC > 0.01) floorPatch([150, 175, 220], s.patchC);

      /* —— 茶杯的热气：两缕，随时间轻轻摆动（画在罩色之前，随昼夜一起变暗）—— */
      var cupY = H * 0.6; // 与书桌同高
      ctx.save();
      ctx.strokeStyle = "rgba(240,230,210,0.1)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      for (var sti = 0; sti < 2; sti++) {
        var steamX = W * (0.262 + sti * 0.006);
        var sway = Math.sin(t * 50 + sti * 2.4) * W * 0.004;
        ctx.beginPath();
        ctx.moveTo(steamX, cupY - H * 0.028);
        ctx.bezierCurveTo(
          steamX + sway,
          cupY - H * 0.05,
          steamX - sway,
          cupY - H * 0.07,
          steamX + sway * 0.5,
          cupY - H * 0.09
        );
        ctx.stroke();
      }
      ctx.restore();

      /* —— E. 昼夜氛围罩色（让整个房间的光统一变化）—— */
      if (s.glow > 0.005) {
        ctx.fillStyle = rgba([255, 222, 160], s.glow);
        ctx.fillRect(0, 0, W, H);
      }
      if (s.shade > 0.005) {
        ctx.fillStyle = rgba([26, 38, 74], s.shade);
        ctx.fillRect(0, 0, W, H);
      }

      /* —— F. 台灯的暖光（夜里才登场，叠加发光）—— */
      var lampX = W * 0.475;
      var deskTopY = H * 0.60;
      if (s.lamp > 0.02) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        // 灯罩本身被点亮
        ctx.fillStyle = rgba([255, 205, 120], s.lamp * 0.85);
        ctx.beginPath();
        ctx.moveTo(lampX - W * 0.020, deskTopY - H * 0.075);
        ctx.lineTo(lampX + W * 0.020, deskTopY - H * 0.075);
        ctx.lineTo(lampX + W * 0.014, deskTopY - H * 0.115);
        ctx.lineTo(lampX - W * 0.014, deskTopY - H * 0.115);
        ctx.closePath();
        ctx.fill();
        var lampGlow = ctx.createRadialGradient(lampX, deskTopY - H * 0.09, 0, lampX, deskTopY - H * 0.09, H * 0.42);
        lampGlow.addColorStop(0, rgba([255, 196, 100], s.lamp * 0.34));
        lampGlow.addColorStop(0.5, rgba([255, 170, 80], s.lamp * 0.12));
        lampGlow.addColorStop(1, rgba([255, 170, 80], 0));
        ctx.fillStyle = lampGlow;
        ctx.fillRect(0, 0, W, H);
        // 桌面上的一小摊灯光
        var pool = ctx.createRadialGradient(lampX, deskTopY + 4, 0, lampX, deskTopY + 4, W * 0.16);
        pool.addColorStop(0, rgba([255, 205, 130], s.lamp * 0.4));
        pool.addColorStop(1, rgba([255, 205, 130], 0));
        ctx.fillStyle = pool;
        ctx.fillRect(lampX - W * 0.2, deskTopY - H * 0.04, W * 0.4, H * 0.10);
        ctx.restore();
      }

      /* —— G. 画纸颗粒 + 四周暗角（油画的最后一层罩染）—— */
      if (grain) {
        var pattern = ctx.createPattern(grain, "repeat");
        if (pattern) {
          ctx.globalAlpha = 0.055;
          ctx.fillStyle = pattern;
          ctx.fillRect(0, 0, W, H);
          ctx.globalAlpha = 1;
        }
      }
      var vig = ctx.createRadialGradient(W * 0.5, H * 0.45, Math.min(W, H) * 0.35, W * 0.5, H * 0.45, Math.max(W, H) * 0.85);
      vig.addColorStop(0, "rgba(20,14,8,0)");
      vig.addColorStop(1, "rgba(20,14,8,0.30)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      /* —— H. 让页面文字配色跟场景一起入夜 —— */
      var night = t >= 0.76 || t < 0.08;
      if (night !== draw.lastNight) {
        draw.lastNight = night;
        document.documentElement.dataset.theme = night ? "dark" : "light";
      }
    }

    /* ================= 驱动昼夜循环 ================= */
    if (reducedMotion || fixedT !== null) {
      // 定格：减弱动态时取黄昏金色时刻（最耐看），或按 ?t= 指定值
      var still = fixedT !== null ? fixedT : 0.62;
      draw(still);
      window.addEventListener("resize", function () {
        draw(still);
      });
      return;
    }

    var start = performance.now() - DAY_MS * 0.25; // 从上午开始，一进来就是明亮的画面
    function frame(now) {
      var t = (((now - start) / DAY_MS) % 1 + 1) % 1;
      draw(t);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ================= 开始渲染页面 ================= */

  initScene();

  // —— 顶部：返回首页 + 页面标题 + 开场白 ——
  var header = el("header", "life-hero reveal");
  var nav = el("p", "life-nav");
  var back = document.createElement("a");
  back.href = "index.html";
  back.textContent = "← Home";
  nav.appendChild(back);
  header.appendChild(nav);

  if (data.title) header.appendChild(el("h1", "life-title", data.title));
  if (data.intro) {
    var introP = el("p", "life-intro");
    appendMultiline(introP, data.intro);
    header.appendChild(introP);
  }
  root.appendChild(header);

  // —— 各板块：小标题 + 卡片网格 ——
  if (Array.isArray(data.sections)) {
    data.sections.forEach(function (section) {
      if (!section || !Array.isArray(section.items) || section.items.length === 0) return;
      var sec = el("section", "life-section reveal");
      if (section.heading) sec.appendChild(el("h2", null, section.heading));

      var grid = el("div", "life-grid");
      section.items.forEach(function (it) {
        if (!it) return;
        var card = el("article", "life-card");
        if (it.photo) card.appendChild(photoImg(it.photo, it.title));
        var body = el("div", "life-card-body");
        var title = el("span", "life-card-title");
        appendMultiline(title, (it.emoji ? it.emoji + " " : "") + (it.title || ""));
        body.appendChild(title);
        if (it.desc) {
          var desc = el("span", "life-card-desc");
          appendMultiline(desc, it.desc);
          body.appendChild(desc);
        }
        card.appendChild(body);
        grid.appendChild(card);
      });

      sec.appendChild(grid);
      root.appendChild(sec);
    });
  }

  // —— 底部：回到首页（页面长了以后，底部也有个出口）——
  var footNav = el("p", "life-nav life-foot reveal");
  var backBottom = document.createElement("a");
  backBottom.href = "index.html";
  backBottom.textContent = "← Home";
  footNav.appendChild(backBottom);
  root.appendChild(footNav);

  /* ============================================================
   *  滚动显现：区块进入视口时淡入上移（与首页相同）
   * ============================================================ */
  var revealNodes = document.querySelectorAll(".reveal");
  if (reducedMotion || !("IntersectionObserver" in window)) {
    for (var r = 0; r < revealNodes.length; r++) revealNodes[r].classList.add("in");
  } else {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    for (var r2 = 0; r2 < revealNodes.length; r2++) observer.observe(revealNodes[r2]);
  }
})();
