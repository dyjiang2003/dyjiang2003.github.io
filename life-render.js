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

    // 扶手椅的轮廓（填充和栽剪笔触共用一条路径）
    function chairPath(g) {
      var chairX = W * 0.66;
      var chairW = W * 0.27;
      var chairTop = H * 0.56;
      g.beginPath();
      g.moveTo(chairX + chairW * 0.10, H);
      g.lineTo(chairX + chairW * 0.10, chairTop + H * 0.06);
      g.quadraticCurveTo(chairX + chairW * 0.12, chairTop, chairX + chairW * 0.5, chairTop);
      g.quadraticCurveTo(chairX + chairW * 0.95, chairTop, chairX + chairW * 0.95, chairTop + H * 0.10);
      g.lineTo(chairX + chairW * 0.95, H);
      g.closePath();
    }

    function bake() {
      roomC.width = W * dpr;
      roomC.height = H * dpr;
      var g = roomC.getContext("2d");
      if (!g) return;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);

      /* —— 墙面（挖掉窗口，露出后面的动态天空）—— */
      g.save();
      var wallPath = new Path2D();
      wallPath.rect(0, 0, W, H);
      wallPath.rect(wx0 - ft, wy0 - ft, ww + 2 * ft, wh + 2 * ft);
      g.clip(wallPath, "evenodd");

      var wall = g.createLinearGradient(0, 0, W * 0.15, fy0);
      wall.addColorStop(0, "#8a6a48");
      wall.addColorStop(0.55, "#75573a");
      wall.addColorStop(1, "#5c4530");
      g.fillStyle = wall;
      g.fillRect(0, 0, W, fy0);
      strokes(g, 0, 0, W, fy0, [120, 92, 62], Math.round((W * fy0) / 2600), Math.PI / 2.6, 26, 0.10);
      strokes(g, 0, 0, W, fy0, [150, 118, 80], Math.round((W * fy0) / 5200), Math.PI / 3.2, 18, 0.08);
      g.restore();

      /* —— 木地板 —— */
      var floor = g.createLinearGradient(0, fy0, 0, H);
      floor.addColorStop(0, "#96683c");
      floor.addColorStop(0.6, "#7a5533");
      floor.addColorStop(1, "#5e422a");
      g.fillStyle = floor;
      g.fillRect(0, fy0, W, H - fy0);
      // 踢脚线
      g.fillStyle = "#4e3826";
      g.fillRect(0, fy0 - 6, W, 8);
      // 地板缝（向画面中线微微收拢）
      g.strokeStyle = "rgba(40,26,14,0.30)";
      g.lineWidth = 1.4;
      for (var pi = -2; pi < 14; pi++) {
        var px = (W * pi) / 10;
        g.beginPath();
        g.moveTo(px, fy0);
        g.lineTo(px + W * 0.03, H);
        g.stroke();
      }
      // 木纹笔触（横向，顺着地板方向）
      strokes(g, 0, fy0, W, H - fy0, [150, 106, 62], Math.round((W * (H - fy0)) / 2200), 0, 44, 0.09);
      strokes(g, 0, fy0, W, H - fy0, [94, 64, 38], Math.round((W * (H - fy0)) / 3600), 0, 30, 0.08);
      // 几处木节
      for (var kn = 0; kn < 5; kn++) {
        g.beginPath();
        g.ellipse(Math.random() * W, fy0 + 20 + Math.random() * (H - fy0 - 30), 6, 3.5, 0.3, 0, Math.PI * 2);
        g.strokeStyle = "rgba(58,38,20,0.35)";
        g.lineWidth = 2;
        g.stroke();
      }

      /* —— 落地阴影（家具还没画，影子先垫在下面）—— */
      softShadow(g, W * 0.37, H * 0.88, W * 0.21, H * 0.032, 0.5);
      softShadow(g, W * 0.80, H * 0.985, W * 0.18, H * 0.028, 0.45);

      /* —— 窗帘（右侧垂下，竖向褶皱笔触）—— */
      var cx0 = wx1 - ww * 0.04;
      var cw = W * 0.075;
      var cH = wy1 + H * 0.06;
      var curtain = g.createLinearGradient(cx0, 0, cx0 + cw, 0);
      curtain.addColorStop(0, "#8a5640");
      curtain.addColorStop(0.5, "#7a4a38");
      curtain.addColorStop(1, "#5e3626");
      g.fillStyle = curtain;
      g.fillRect(cx0, 0, cw, cH);
      strokes(g, cx0, 0, cw, cH, [140, 86, 60], 90, Math.PI / 2, 42, 0.12);
      strokes(g, cx0, 0, cw, cH, [70, 40, 26], 70, Math.PI / 2, 38, 0.12);
      // 窗帘下摆的波浪边
      g.fillStyle = "#7a4a38";
      g.beginPath();
      g.moveTo(cx0, cH);
      for (var fb = 0; fb <= 6; fb++) {
        g.quadraticCurveTo(
          cx0 + (cw * (fb + 0.5)) / 6,
          cH + (fb % 2 ? 12 : -4),
          cx0 + (cw * (fb + 1)) / 6,
          cH
        );
      }
      g.lineTo(cx0 + cw, 0);
      g.lineTo(cx0, 0);
      g.closePath();
      g.fill();

      /* —— 木窗框 + 十字窗棂 + 窗台 —— */
      g.fillStyle = "#4a3322";
      g.fillRect(wx0 - ft, wy0 - ft, ww + 2 * ft, ft); // 上
      g.fillRect(wx0 - ft, wy1, ww + 2 * ft, ft * 1.4); // 窗台（稍厚）
      g.fillRect(wx0 - ft, wy0 - ft, ft, wh + ft + ft * 1.4); // 左
      g.fillRect(wx1, wy0 - ft, ft, wh + ft + ft * 1.4); // 右
      g.fillRect(wx0 + ww / 2 - ft / 4, wy0, ft / 2, wh); // 竖棂
      g.fillRect(wx0, wy0 + wh / 2 - ft / 4, ww, ft / 2); // 横棂
      // 框条朝光一侧的暖色高光
      g.fillStyle = "rgba(214,166,110,0.5)";
      g.fillRect(wx0 - ft, wy0 - ft, ww + 2 * ft, 2);
      g.fillRect(wx0 - ft, wy0 - ft, 2, wh + ft);

      /* —— 墙上的小挂画（插画味的小彩蛋）—— */
      var px0 = W * 0.67;
      var py0 = H * 0.15;
      var pw = W * 0.12;
      var ph = H * 0.15;
      g.fillStyle = "#3a2a1a";
      g.fillRect(px0 - 5, py0 - 5, pw + 10, ph + 10);
      var pic = g.createLinearGradient(0, py0, 0, py0 + ph);
      pic.addColorStop(0, "#9db4c8");
      pic.addColorStop(0.65, "#d8bd8a");
      pic.addColorStop(1, "#7a6a42");
      g.fillStyle = pic;
      g.fillRect(px0, py0, pw, ph);
      g.fillStyle = "rgba(70,80,52,0.8)"; // 画里的小山坡
      g.beginPath();
      g.moveTo(px0, py0 + ph);
      g.quadraticCurveTo(px0 + pw * 0.4, py0 + ph * 0.55, px0 + pw, py0 + ph * 0.8);
      g.lineTo(px0 + pw, py0 + ph);
      g.closePath();
      g.fill();
      strokes(g, px0, py0, pw, ph, [120, 130, 100], 30, 0.2, 8, 0.15);

      /* —— 书桌：桌面木纹 + 两条腿 —— */
      var deskTopY = H * 0.60;
      var deskG = g.createLinearGradient(0, deskTopY, 0, deskTopY + H * 0.035);
      deskG.addColorStop(0, "#a67c4e");
      deskG.addColorStop(1, "#6e4c2e");
      g.fillStyle = deskG;
      g.fillRect(W * 0.20, deskTopY, W * 0.34, H * 0.035);
      strokes(g, W * 0.20, deskTopY, W * 0.34, H * 0.035, [168, 128, 82], 90, 0, 26, 0.14);
      g.fillStyle = "rgba(255,224,170,0.35)"; // 桌面朝光的高光
      g.fillRect(W * 0.20, deskTopY, W * 0.34, 3);
      g.fillStyle = "#5e4026";
      g.fillRect(W * 0.225, deskTopY + H * 0.035, W * 0.014, H * 0.24);
      g.fillRect(W * 0.50, deskTopY + H * 0.035, W * 0.014, H * 0.24);
      strokes(g, W * 0.225, deskTopY + H * 0.035, W * 0.014, H * 0.24, [110, 78, 48], 20, Math.PI / 2, 20, 0.12);

      /* —— 桌上摊开的书（书页上还画了几行「字」）—— */
      g.fillStyle = "#ead9b8";
      g.beginPath();
      g.moveTo(W * 0.295, deskTopY);
      g.quadraticCurveTo(W * 0.325, deskTopY - H * 0.012, W * 0.355, deskTopY - H * 0.004);
      g.quadraticCurveTo(W * 0.385, deskTopY - H * 0.012, W * 0.415, deskTopY);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(90,65,30,0.5)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(W * 0.355, deskTopY - H * 0.004);
      g.lineTo(W * 0.355, deskTopY + 1);
      g.stroke();
      // 书页上的字迹小短线
      g.strokeStyle = "rgba(70,50,28,0.4)";
      for (var bl = 0; bl < 6; bl++) {
        var bx = bl < 3 ? W * 0.302 : W * 0.362;
        var by = deskTopY - H * 0.009 + (bl % 3) * 3.2;
        g.beginPath();
        g.moveTo(bx, by);
        g.lineTo(bx + W * 0.045, by + 0.5);
        g.stroke();
      }

      /* —— 茶杯 —— */
      g.fillStyle = "#8c4a2f";
      g.fillRect(W * 0.255, deskTopY - H * 0.020, W * 0.018, H * 0.020);
      g.beginPath();
      g.arc(W * 0.264, deskTopY - H * 0.024, W * 0.009, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,224,180,0.5)";
      g.fillRect(W * 0.257, deskTopY - H * 0.018, 2.5, H * 0.014);

      /* —— 台灯：底座 + 灯杆 + 梯形灯罩（底层画「未点亮」状态，
              夜里的点亮效果由动态层在灯罩位置叠加暖光）—— */
      var lampX = W * 0.475;
      g.fillStyle = "#3a2a1a";
      g.fillRect(lampX - W * 0.012, deskTopY - H * 0.008, W * 0.024, H * 0.008);
      g.fillRect(lampX - 1.5, deskTopY - H * 0.075, 3, H * 0.07);
      g.fillStyle = "#785634";
      g.beginPath();
      g.moveTo(lampX - W * 0.020, deskTopY - H * 0.075);
      g.lineTo(lampX + W * 0.020, deskTopY - H * 0.075);
      g.lineTo(lampX + W * 0.014, deskTopY - H * 0.115);
      g.lineTo(lampX - W * 0.014, deskTopY - H * 0.115);
      g.closePath();
      g.fill();
      strokes(g, lampX - W * 0.02, deskTopY - H * 0.115, W * 0.04, H * 0.04, [150, 108, 66], 14, Math.PI / 2, 12, 0.2);

      /* —— 扶手椅：先铺大形，再在轮廓内叠笔触 —— */
      var chairX = W * 0.66;
      var chairW = W * 0.27;
      var chairTop = H * 0.56;
      g.save();
      chairPath(g);
      var chairG = g.createLinearGradient(chairX, chairTop, chairX + chairW, H);
      chairG.addColorStop(0, "#77503a");
      chairG.addColorStop(0.6, "#5a3a26");
      chairG.addColorStop(1, "#3c2618");
      g.fillStyle = chairG;
      g.fill();
      g.clip();
      strokes(g, chairX, chairTop, chairW, H - chairTop, [126, 86, 60], 260, Math.PI / 2.3, 24, 0.10);
      strokes(g, chairX, chairTop, chairW, H - chairTop, [66, 42, 26], 200, Math.PI / 1.9, 22, 0.09);
      g.restore();
      // 坐垫（略亮的横板）
      g.fillStyle = "#8a5c3e";
      g.fillRect(chairX + chairW * 0.04, H * 0.82, chairW * 0.95, H * 0.06);
      strokes(g, chairX + chairW * 0.04, H * 0.82, chairW * 0.95, H * 0.06, [160, 112, 74], 60, 0, 18, 0.14);
      g.fillStyle = "rgba(255,214,160,0.20)"; // 坐垫受光
      g.fillRect(chairX + chairW * 0.04, H * 0.82, chairW * 0.95, 3);
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

      // 云：三团缓慢的椭圆云，颜色从天空色里提取，白天白、黄昏橙、夜晚融进夜幕
      var cloudLift = 0.45;
      var cloudCol = [
        lerp(s.skyBot[0], 255, cloudLift),
        lerp(s.skyBot[1], 248, cloudLift),
        lerp(s.skyBot[2], 238, cloudLift),
      ];
      var cloudA = clamp(0.55 - s.shade * 1.4, 0.06, 0.55);
      for (var ci = 0; ci < 3; ci++) {
        var drift = ((t * 0.6 + ci * 0.37) % 1.3) - 0.15; // 一整天飘过窗口
        var cx = wx0 + ww * drift;
        var cy = wy0 + wh * (0.18 + ci * 0.16);
        ctx.fillStyle = rgba(cloudCol, cloudA * (0.5 + ci * 0.2));
        ctx.beginPath();
        ctx.ellipse(cx, cy, ww * 0.16, wh * 0.055, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + ww * 0.09, cy - wh * 0.03, ww * 0.10, wh * 0.04, 0, 0, Math.PI * 2);
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
