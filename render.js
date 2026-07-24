/* 渲染脚本：读取 content.js 里的 window.CONTENT，生成页面并驱动特效。
 * 普通维护不需要看这个文件；想改文字请改 content.js，
 * 想改样式请改 style.css。 */

(function () {
  "use strict";

  var data = window.CONTENT || {};
  var root = document.getElementById("app");

  var reducedMotion = !!(
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  /* ============================================================
   *  深浅色主题（详情页右上角的「开关灯」）
   *  手动选择存 localStorage，优先于系统偏好；没选过就跟随系统。
   *  themeDark 是可变状态：各背景画布把换色逻辑注册进
   *  themeListeners，每次开/关灯由 applyTheme() 统一通知。
   * ============================================================ */
  var themeDark = false;
  var themeListeners = [];

  function systemDark() {
    return !!(
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  }

  // 启动时读回上次的手动选择（localStorage 可能被禁用，兜底忽略）
  try {
    var savedTheme = window.localStorage && window.localStorage.getItem("theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      document.documentElement.dataset.theme = savedTheme;
    }
  } catch (ignore) {}

  // 重算当前生效的深浅色，并通知所有注册了回调的特效
  function applyTheme() {
    var explicit = document.documentElement.dataset.theme;
    themeDark = explicit ? explicit === "dark" : systemDark();
    themeListeners.forEach(function (fn) {
      fn(themeDark);
    });
  }

  // 系统深浅色在页面打开期间变化时自动跟随
  //（用户手动选过时 applyTheme 里手动选择优先，所以直接重算即可）
  if (window.matchMedia) {
    var sysThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    var onSystemThemeChange = function () {
      applyTheme();
    };
    if (sysThemeQuery.addEventListener) {
      sysThemeQuery.addEventListener("change", onSystemThemeChange);
    } else if (sysThemeQuery.addListener) {
      sysThemeQuery.addListener(onSystemThemeChange); // 老版 Safari 兜底
    }
  }

  // 创建元素的小工具：tag 标签名，className 样式类，text 纯文本内容
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

  // 生成 logo 图片：只写文件名时自动到 logos/ 文件夹找；
  // 填完整网址或带路径时原样使用；图片加载失败就自动隐藏，不影响文字
  function logoImg(file, className) {
    var img = document.createElement("img");
    img.className = className;
    img.alt = "";
    img.loading = "lazy";
    img.src =
      /^(https?:)?\/\//.test(file) || file.indexOf("/") !== -1 ? file : "logos/" + file;
    img.onerror = function () {
      img.style.display = "none";
    };
    return img;
  }

  /* ============================================================
   *  详情页背景画布：「波源干涉涟漪 + 漂浮微粒」
   *  灵感来自物理主题的官网首页；纯 Canvas 实现，无外部依赖。
   *  配色随主题即时切换（开灯/关灯各一套），无需刷新页面。
   * ============================================================ */
  function initBackground() {
    var canvas = document.createElement("canvas");
    canvas.id = "bg-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.insertBefore(canvas, document.body.firstChild);
    if (reducedMotion) return; // 减弱动态：只保留 CSS 渐变背景

    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0;
    var H = 0;

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener("resize", resize);
    resize();

    // 涟漪配色（物理感的蓝/青/紫），深浅色各一套；
    // 由主题回调写入，开关灯立即生效
    var palette = [];

    var rings = [];
    var sources = [];
    var i;
    for (i = 0; i < 3; i++) {
      sources.push({
        a1: 0.00021 + i * 0.00007, // 利萨如曲线角速度
        a2: 0.00016 + i * 0.00005,
        p1: i * 2.1, // 相位错开，波源各自漂移
        p2: i * 1.3,
        last: -i * 650, // 初始相位错开，别一起发波
        interval: 1950 + i * 420, // 每个波源发波周期不同，形成干涉感
        color: "", // 颜色由下方主题回调填入
        x: 0,
        y: 0,
      });
    }

    // 主题变化：换整套涟漪配色（波源颜色一并更新）
    themeListeners.push(function (dark) {
      palette = dark
        ? ["96,165,250", "34,211,238", "167,139,250"]
        : ["37,99,235", "8,145,178", "124,58,237"];
      for (var j = 0; j < sources.length; j++) {
        sources[j].color = palette[j % palette.length];
      }
    });

    // 漂浮微粒（星点感）
    var dots = [];
    for (i = 0; i < 70; i++) {
      dots.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.000012,
        vy: (Math.random() - 0.5) * 0.000012,
        r: 0.8 + Math.random() * 1.4,
      });
    }

    // 点击/触摸页面时，在指尖位置激起一圈涟漪
    window.addEventListener("pointerdown", function (e) {
      if (!palette.length) return; // 配色尚未就绪（理论上不会，稳妥起见）
      if (window.scrollY <= 1) return; // 还在第一页夜空：涟漪留给详情页，夜空有流星
      rings.push({
        x: e.clientX,
        y: e.clientY,
        r: 4,
        maxR: Math.max(W, H) * 0.45,
        color: palette[Math.floor(Math.random() * palette.length)],
        width: 2,
        dr: 0.16,
      });
    });

    var prev = 0;
    function frame(t) {
      var dt = Math.min(t - prev || 16.7, 50);
      prev = t;

      // 停在第一页时涟漪层被深空层整个遮住，跳过绘制省电
      if (window.scrollY <= 1) {
        requestAnimationFrame(frame);
        return;
      }

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = themeDark ? "lighter" : "source-over";

      // 微粒
      ctx.fillStyle = themeDark ? "rgba(226,232,240,0.25)" : "rgba(30,41,59,0.15)";
      dots.forEach(function (d) {
        d.x = (d.x + d.vx * dt + 1) % 1;
        d.y = (d.y + d.vy * dt + 1) % 1;
        ctx.beginPath();
        ctx.arc(d.x * W, d.y * H, d.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // 波源：沿利萨如轨迹漂移，周期性发波，自带光晕
      sources.forEach(function (s) {
        s.x = W * (0.5 + 0.38 * Math.sin(t * s.a1 + s.p1));
        s.y = H * (0.5 + 0.34 * Math.sin(t * s.a2 + s.p2));

        if (t - s.last > s.interval) {
          s.last = t;
          rings.push({
            x: s.x,
            y: s.y,
            r: 8,
            maxR: Math.sqrt(W * W + H * H) * 0.55,
            color: s.color,
            width: 1.4,
            dr: 0.05,
          });
        }

        var glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 90);
        glow.addColorStop(0, "rgba(" + s.color + (themeDark ? ",0.10)" : ",0.08)"));
        glow.addColorStop(1, "rgba(" + s.color + ",0)");
        ctx.fillStyle = glow;
        ctx.fillRect(s.x - 90, s.y - 90, 180, 180);
      });

      // 扩散中的涟漪
      for (var j = rings.length - 1; j >= 0; j--) {
        var ring = rings[j];
        ring.r += ring.dr * dt;
        var k = 1 - ring.r / ring.maxR;
        if (k <= 0) {
          rings.splice(j, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
        ctx.strokeStyle =
          "rgba(" + ring.color + "," + (0.35 * k * (themeDark ? 1 : 0.7)).toFixed(3) + ")";
        ctx.lineWidth = ring.width;
        ctx.stroke();
      }

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ============================================================
   *  第一页背景：#space-layer 深空层。
   *  深空渐变、星云辉光和暗角由 CSS 负责（见 style.css），
   *  这个画布只画星星：缓慢闪烁 + 极慢上飘的星点，
   *  偶发一颗拖着渐变尾迹的流星。
   *  翻到详情页（body.page-2）后停止绘制；第一页不受开关灯影响。
   * ============================================================ */
  function initSpace() {
    var layer = document.createElement("div");
    layer.id = "space-layer";
    layer.setAttribute("aria-hidden", "true");
    var canvas = document.createElement("canvas");
    canvas.id = "space-canvas";
    layer.appendChild(canvas);
    document.body.insertBefore(layer, document.body.firstChild);

    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0;
    var H = 0;
    var stars = [];
    var meteors = [];
    var nextMeteorAt = 2000; // 第一颗流星稍微等一下，别一进门就划过

    // 星星配色：大多蓝白色，少数青/紫，呼应详情页涟漪的蓝/青/紫
    var starColors = [
      "219,234,254",
      "226,232,240",
      "147,197,253",
      "103,232,249",
      "196,181,253",
    ];

    /* —— 粒子星系（形态参考 phybench.cn 首页）——
       银盘旋臂 + 核心星团 + 晕层大颗粒，全部带 3D 坐标；
       每帧做「自转 + 视角旋转 + 透视投影」，再用预渲染的软圆 sprite
       以叠加发光模式画出（加法混合与顺序无关，省去深度排序）。 */
    var disk = []; // 银盘粒子：两条旋臂，中心留空洞给名字
    var core = []; // 核心星团：小而亮，向银心聚集
    var halo = []; // 晕层：大而淡的 bokeh 光斑，烘出景深氛围
    var dust = []; // 尘埃带：沿旋臂内侧分布的暗色吸光云（真实星系的尘埃道）
    var fgStars = []; // 前景亮星：带十字星芒，屏幕空间固定，不随星系转
    var bgGalaxies = []; // 远景星系：淡淡的椭圆光斑，增加纵深

    // 预渲染一颗软边圆点（径向渐变），所有粒子共用这几种颜色的 sprite
    function makeSprite(color) {
      var c = document.createElement("canvas");
      c.width = 64;
      c.height = 64;
      var g = c.getContext("2d");
      if (!g) return c;
      var grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, "rgba(" + color + ",1)");
      grad.addColorStop(0.35, "rgba(" + color + ",0.5)");
      grad.addColorStop(1, "rgba(" + color + ",0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      return c;
    }

    // 星系专用补充色：暖金/暖白（核心与内盘）、紫粉（旋臂上的电离氢区）、深黑（尘埃带）
    var galaxyColors = ["255,224,170", "255,236,200", "224,170,210", "10,8,20"];
    var sprites = starColors.concat(galaxyColors).map(makeSprite);

    // 预渲染带十字星芒的亮星 sprite（前景亮星用，哈勃照片里的衍射星芒）
    function makeSpikeSprite(color) {
      var c = document.createElement("canvas");
      c.width = 128;
      c.height = 128;
      var g = c.getContext("2d");
      if (!g) return c;
      // 中心亮点
      var core = g.createRadialGradient(64, 64, 0, 64, 64, 12);
      core.addColorStop(0, "rgba(" + color + ",1)");
      core.addColorStop(1, "rgba(" + color + ",0)");
      g.fillStyle = core;
      g.fillRect(0, 0, 128, 128);
      // 十字芒：水平/垂直两条两端渐隐的细线
      var lh = g.createLinearGradient(0, 0, 128, 0);
      lh.addColorStop(0, "rgba(" + color + ",0)");
      lh.addColorStop(0.5, "rgba(" + color + ",0.9)");
      lh.addColorStop(1, "rgba(" + color + ",0)");
      g.fillStyle = lh;
      g.fillRect(0, 63.2, 128, 1.6);
      var lv = g.createLinearGradient(0, 0, 0, 128);
      lv.addColorStop(0, "rgba(" + color + ",0)");
      lv.addColorStop(0.5, "rgba(" + color + ",0.9)");
      lv.addColorStop(1, "rgba(" + color + ",0)");
      g.fillStyle = lv;
      g.fillRect(63.2, 0, 1.6, 128);
      return c;
    }

    var spikeSprite = makeSpikeSprite("219,234,254");

    // 视角状态：yaw/pitch 由拖拽改变，vYaw/vPitch 是松手后的惯性速度
    var view = {
      yaw: 0,
      pitch: 0.72, // 初始俯仰角：星系呈斜放的椭圆盘，旋臂可见
      vYaw: 0,
      vPitch: 0,
      down: false,
      lastX: 0,
      lastY: 0,
      moved: 0,
    };

    // 三个随机数取平均近似正态（旋臂散射、核心聚集都用它）
    function gauss3() {
      return (Math.random() + Math.random() + Math.random()) / 1.5 - 1;
    }

    // 银盘粒子配色按半径渐变（真实星系的年龄分层）：
    // 内盘偏暖白/暖金（老年星），中盘蓝/青（年轻热星），外盘偏蓝紫；
    // 旋臂上撒少量紫粉结点（电离氢区，星系照片里的粉红 HII 区）
    function pickDiskColor(r, inArm) {
      var v = Math.random();
      if (inArm && r > 0.4 && r < 0.9 && v < 0.05) return 7; // HII 区
      if (r < 0.42) {
        if (v < 0.35) return 6; // 暖白
        if (v < 0.55) return 5; // 暖金
        if (v < 0.8) return 0;
        return 2;
      }
      if (r < 0.7) {
        if (v < 0.35) return 2; // 蓝
        if (v < 0.6) return 3; // 青
        if (v < 0.8) return 4; // 紫
        return Math.floor(Math.random() * 2);
      }
      if (v < 0.4) return 4; // 紫外盘为主
      if (v < 0.7) return 2;
      if (v < 0.9) return 3;
      return 1;
    }

    // 核心粒子：暖白/暖金为主（老年星组成的核球）
    function pickCoreColor() {
      var v = Math.random();
      if (v < 0.45) return 6;
      if (v < 0.75) return 5;
      return 0;
    }

    // 按视口面积撒星，小屏自动变少
    function seed() {
      stars = [];
      var count = Math.min(240, Math.round((W * H) / 8000));
      for (var i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: 0.4 + Math.random() * 1.4,
          base: 0.25 + Math.random() * 0.55, // 基础亮度
          speed: 0.0004 + Math.random() * 0.0012, // 闪烁角速度
          phase: Math.random() * Math.PI * 2,
          vy: 0.0008 + Math.random() * 0.0015, // 上飘速度（px/ms）
          color: starColors[Math.floor(Math.random() * starColors.length)],
        });
      }
    }

    // 撒星系：粒子数量随视口面积缩放；坐标用「银心距 r + 方位角 a」存，
    // 自转就是给所有粒子的 a 统一加一个随时间增长的相位
    function seedGalaxy() {
      disk = [];
      core = [];
      halo = [];
      dust = [];
      fgStars = [];
      bgGalaxies = [];
      var area = W * H;
      var diskCount = Math.min(1800, Math.round(area / 950));
      var coreCount = Math.min(240, Math.round(area / 6400));
      var haloCount = Math.min(300, Math.round(area / 5000));
      var dustCount = Math.min(420, Math.round(area / 2600));
      var i;

      // 银盘：指数盘（pow>1 把半径压向内侧，越靠内越密，真实星系的面密度）
      for (i = 0; i < diskCount; i++) {
        var r = 0.26 + 0.74 * Math.pow(Math.random(), 1.3);
        var a;
        var inArm = Math.random() < 0.85;
        if (inArm) {
          // 两条主旋臂：对数螺旋（角度随半径扭转）+ 越往外越散的散射
          a = (i % 2) * Math.PI + r * 2.6 + gauss3() * (0.18 + r * 0.24);
        } else {
          a = Math.random() * Math.PI * 2; // 臂间弥散粒子
        }
        disk.push({
          r: r,
          a: a,
          y: gauss3() * (0.03 + r * 0.02), // 银盘很薄，外沿略厚
          size: 1.4 + Math.random() * 2.4,
          alpha: 0.5 + Math.random() * 0.45,
          color: pickDiskColor(r, inArm),
          tw: 0.0005 + Math.random() * 0.0011,
          ph: Math.random() * Math.PI * 2,
        });
      }

      // 尘埃带：沿旋臂内侧（旋转方向的后沿）的暗色吸光云，
      // 真实星系照片里旋臂旁那道暗纹就是它
      for (i = 0; i < dustCount; i++) {
        var dr = 0.3 + 0.65 * Math.pow(Math.random(), 1.3);
        dust.push({
          r: dr,
          a: (i % 2) * Math.PI + dr * 2.6 - (0.16 + dr * 0.1) + gauss3() * 0.12,
          y: gauss3() * 0.03,
          size: 7 + Math.random() * 13,
          alpha: 0.2 + Math.random() * 0.2,
          color: 8, // 深黑尘埃 sprite
          tw: 0, // 尘埃不闪烁
          ph: 0,
        });
      }

      // 核心星团：暖色，向银心聚集
      for (i = 0; i < coreCount; i++) {
        core.push({
          r: Math.abs(gauss3()) * 0.15,
          a: Math.random() * Math.PI * 2,
          y: gauss3() * 0.05,
          size: 1.4 + Math.random() * 2.6,
          alpha: 0.45 + Math.random() * 0.5,
          color: pickCoreColor(),
          tw: 0.0006 + Math.random() * 0.0012,
          ph: Math.random() * Math.PI * 2,
        });
      }

      // 晕层大颗粒（淡而虚的 bokeh，只用冷色系）
      for (i = 0; i < haloCount; i++) {
        halo.push({
          r: 0.45 + Math.random() * 1.35,
          a: Math.random() * Math.PI * 2,
          y: gauss3() * 0.55,
          size: 9 + Math.random() * 26,
          alpha: 0.035 + Math.random() * 0.085,
          color: Math.floor(Math.random() * 5),
          tw: 0.0003 + Math.random() * 0.0006,
          ph: Math.random() * Math.PI * 2,
        });
      }

      // 前景亮星（带星芒）：屏幕空间固定，不随星系转，像照片前景的亮星
      var fgCount = Math.min(12, Math.round(area / 90000));
      for (i = 0; i < fgCount; i++) {
        fgStars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          size: 14 + Math.random() * 22, // 星芒整体尺寸
          alpha: 0.35 + Math.random() * 0.4,
          tw: 0.0004 + Math.random() * 0.0008,
          ph: Math.random() * Math.PI * 2,
        });
      }

      // 远景星系：几个 tiny 的椭圆光斑，增加纵深
      var bgCount = Math.min(6, Math.round(area / 250000));
      for (i = 0; i < bgCount; i++) {
        bgGalaxies.push({
          x: Math.random() * W,
          y: Math.random() * H,
          w: 40 + Math.random() * 60,
          h: 12 + Math.random() * 20,
          rot: Math.random() * Math.PI,
          alpha: 0.05 + Math.random() * 0.06,
          color: Math.floor(Math.random() * 3),
        });
      }
    }

    // 画一组星系粒子：自转（绕银心）→ 视角旋转（yaw 绕 Y、pitch 绕 X）→ 透视投影
    function drawGalaxySet(list, spin, proj) {
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        var ang = p.a + spin;
        var x = Math.cos(ang) * p.r;
        var z = Math.sin(ang) * p.r;
        var y = p.y;
        var x1 = x * proj.cosYaw - z * proj.sinYaw;
        var z1 = x * proj.sinYaw + z * proj.cosYaw;
        var y1 = y * proj.cosPitch - z1 * proj.sinPitch;
        var z2 = y * proj.sinPitch + z1 * proj.cosPitch;
        // 透视：近大远小；分母钳制下限，防止粒子飞到相机背后时投影爆炸
        var k = proj.cam / Math.max(0.5, proj.cam + z2);
        var sx = proj.cx + x1 * k * proj.S;
        var sy = proj.cy + y1 * k * proj.S;
        if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue;
        var sz = p.size * k * proj.sizeK;
        ctx.globalAlpha =
          p.alpha * (0.72 + 0.28 * Math.sin(proj.t * p.tw + p.ph)) * Math.min(1, k * 1.05);
        ctx.drawImage(sprites[p.color], sx - sz / 2, sy - sz / 2, sz, sz);
      }
    }

    // 画整个星系：远景星系 → 晕层 → 银盘 → 尘埃带 → 核心 → 银心辉光 → 前景亮星
    function drawGalaxy(t) {
      var S = Math.min(W, H) * 0.44; // 星系半径对应的屏幕像素
      var proj = {
        t: t,
        S: S,
        cx: W / 2,
        cy: H * 0.5, // 银心在屏幕正中，名字坐在环心空洞里
        cam: 3.0, // 相机距离（以星系半径为 1）
        sizeK: S / 260, // 粒子尺寸随屏幕缩放
        cosYaw: Math.cos(view.yaw),
        sinYaw: Math.sin(view.yaw),
        cosPitch: Math.cos(view.pitch),
        sinPitch: Math.sin(view.pitch),
      };
      var spin = t * 0.00006; // 自转：约 105 秒一圈
      var i;

      // 远景星系：屏幕空间的淡淡椭圆光斑（默认 source-over）
      for (i = 0; i < bgGalaxies.length; i++) {
        var bg = bgGalaxies[i];
        ctx.save();
        ctx.translate(bg.x, bg.y);
        ctx.rotate(bg.rot);
        ctx.globalAlpha = bg.alpha;
        ctx.drawImage(sprites[bg.color], -bg.w / 2, -bg.h / 2, bg.w, bg.h);
        ctx.restore();
      }

      ctx.globalCompositeOperation = "lighter";
      drawGalaxySet(halo, spin, proj);
      drawGalaxySet(disk, spin, proj);

      // 尘埃带：切回普通模式，暗色软斑叠在亮臂上「吸光」，
      // 形成旋臂内侧的暗纹（真实星系照片里的尘埃道）
      ctx.globalCompositeOperation = "source-over";
      drawGalaxySet(dust, spin, proj);

      // 核心星团 + 三层银心辉光（暖金大晕 → 暖白中晕 → 亮核）
      ctx.globalCompositeOperation = "lighter";
      drawGalaxySet(core, spin, proj);
      var glows = [
        [5, 0.3, S * 1.05],
        [6, 0.35, S * 0.5],
        [6, 0.7, S * 0.13],
      ];
      for (i = 0; i < glows.length; i++) {
        ctx.globalAlpha = glows[i][1];
        var gs = glows[i][2];
        ctx.drawImage(sprites[glows[i][0]], proj.cx - gs / 2, proj.cy - gs / 2, gs, gs);
      }

      // 前景亮星：带十字星芒，屏幕空间固定，不随星系转
      for (i = 0; i < fgStars.length; i++) {
        var fs = fgStars[i];
        ctx.globalAlpha = fs.alpha * (0.7 + 0.3 * Math.sin(t * fs.tw + fs.ph));
        ctx.drawImage(spikeSprite, fs.x - fs.size / 2, fs.y - fs.size / 2, fs.size, fs.size);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    // 画一遍远景星星：闪烁 + 极慢上飘（dt=0 时即静止，静态模式也用它）
    function drawStars(t, dt) {
      ctx.clearRect(0, 0, W, H);
      stars.forEach(function (s) {
        s.y -= s.vy * dt;
        if (s.y < -2) s.y = H + 2; // 飘出顶部回到底部
        var alpha = s.base * (0.55 + 0.45 * Math.sin(t * s.speed + s.phase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + s.color + "," + alpha.toFixed(3) + ")";
        ctx.fill();
      });
    }

    // 偶发流星：从上半部随机位置斜向划过，线性渐隐，带渐变拖尾
    function spawnMeteor(t) {
      var dir = Math.random() < 0.5 ? 1 : -1;
      meteors.push({
        x: W * (0.15 + Math.random() * 0.7),
        y: H * (0.05 + Math.random() * 0.35),
        vx: dir * (0.5 + Math.random() * 0.45), // px/ms
        vy: 0.2 + Math.random() * 0.2,
        born: t,
        life: 700 + Math.random() * 400,
      });
    }

    function drawMeteors(t, dt) {
      for (var i = meteors.length - 1; i >= 0; i--) {
        var m = meteors[i];
        var age = t - m.born;
        if (age > m.life) {
          meteors.splice(i, 1);
          continue;
        }
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        var k = 1 - age / m.life;
        var tailX = m.x - m.vx * 90; // 拖尾：沿速度反方向约 90ms 的轨迹
        var tailY = m.y - m.vy * 90;
        var grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
        grad.addColorStop(0, "rgba(219,234,254," + (0.85 * k).toFixed(3) + ")");
        grad.addColorStop(1, "rgba(219,234,254,0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
      }
    }

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
      seedGalaxy();
      if (reducedMotion) {
        drawStars(0, 0); // 静态模式：变化后补画一次
        drawGalaxy(0);
      }
    }
    window.addEventListener("resize", resize);
    resize();

    // 减弱动态：静态星空 + 静态星系，整层随第一页自然滚走（见 style.css 的 .static）
    if (reducedMotion) {
      layer.classList.add("static");
      return;
    }

    /* —— 拖拽转视角 + 点击划流星 ——
       按住拖动：水平改 yaw、垂直改 pitch（触屏的垂直拖动留给页面滚动，不抢）；
       松手后带惯性滑行；若几乎没动（<6px）算点击，从指尖划出一颗流星。
       只在第一页生效：翻到详情页后夜空层已淡出，不抢涟漪的戏 */
    function onPointerDown(e) {
      if (document.body.classList.contains("page-2")) return;
      if (e.target.closest && e.target.closest("a, button")) return; // 链接/按钮正常点击
      view.down = true;
      view.moved = 0;
      view.lastX = e.clientX;
      view.lastY = e.clientY;
      view.vYaw = 0;
      view.vPitch = 0;
      document.body.classList.add("galaxy-dragging");
    }

    function onPointerMove(e) {
      if (!view.down) return;
      var dx = e.clientX - view.lastX;
      var dy = e.clientY - view.lastY;
      view.lastX = e.clientX;
      view.lastY = e.clientY;
      view.moved += Math.abs(dx) + Math.abs(dy);
      var dYaw = dx * 0.005;
      view.yaw += dYaw;
      view.vYaw = view.vYaw * 0.7 + dYaw * 0.3; // 平滑出松手后的惯性速度
      if (e.pointerType !== "touch") {
        var dPitch = dy * 0.005;
        view.pitch = Math.min(1.35, Math.max(-1.35, view.pitch + dPitch));
        view.vPitch = view.vPitch * 0.7 + dPitch * 0.3;
      }
    }

    function onPointerUp(e) {
      if (!view.down) return;
      view.down = false;
      document.body.classList.remove("galaxy-dragging");
      if (view.moved < 6) {
        // 点击（没拖动）：从指尖划出一颗流星
        var dir = Math.random() < 0.5 ? 1 : -1;
        meteors.push({
          x: e.clientX,
          y: e.clientY,
          vx: dir * (0.55 + Math.random() * 0.4),
          vy: 0.22 + Math.random() * 0.18,
          born: performance.now(), // 与 rAF 时间戳同一时钟，drawMeteors 里直接相减
          life: 700 + Math.random() * 300,
        });
      }
    }

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp); // 触屏手势被浏览器接管时收尾

    var prev = 0;
    function frame(t) {
      var dt = Math.min(t - prev || 16.7, 50);
      prev = t;

      // 松手后的惯性滑行：速度按帧率无关的方式衰减
      if (!view.down && (view.vYaw || view.vPitch)) {
        var decay = Math.pow(0.94, dt / 16.7);
        view.yaw += view.vYaw * (dt / 16.7);
        view.pitch = Math.min(1.35, Math.max(-1.35, view.pitch + view.vPitch * (dt / 16.7)));
        view.vYaw *= decay;
        view.vPitch *= decay;
        if (Math.abs(view.vYaw) < 0.00001) view.vYaw = 0;
        if (Math.abs(view.vPitch) < 0.00001) view.vPitch = 0;
      }

      // 翻到详情页后整层已淡出，停止绘制省电
      if (!document.body.classList.contains("page-2")) {
        drawStars(t, dt);
        drawGalaxy(t);
        if (t > nextMeteorAt) {
          spawnMeteor(t);
          nextMeteorAt = t + 2500 + Math.random() * 3000; // 平均约 4 秒一颗
        }
        drawMeteors(t, dt);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ============================================================
   *  换页特效：从第一页（星空 + 名字/引言）滚向详情页时，
   *  hero 滞后、略缩小并淡出；深空层按 smoothstep 曲线交叉淡出，
   *  露出详情页的渐变 + 涟漪背景。临界点：视口高度的 72%。
   * ============================================================ */
  function initPageTransition(heroEl) {
    var layer = document.getElementById("space-layer");
    if (!layer) return;

    // 滚动超过临界点的九成，视为已进入详情页：
    // body.page-2 控制开关灯按钮出现、星空层停止绘制
    function updatePageClass() {
      document.body.classList.toggle("page-2", window.scrollY >= window.innerHeight * 0.65);
    }

    // 减弱动态：不做视差和淡出，只按滚动位置切换 page-2
    if (reducedMotion) {
      window.addEventListener("scroll", updatePageClass, { passive: true });
      updatePageClass();
      return;
    }

    var ticking = false;
    function update() {
      ticking = false;
      var threshold = window.innerHeight * 0.72; // 临界点
      var t = Math.min(Math.max(window.scrollY / threshold, 0), 1);
      var fade = t * t * (3 - 2 * t); // smoothstep：淡入淡出两头更柔和
      heroEl.style.opacity = (1 - t).toFixed(3);
      heroEl.style.transform =
        "translateY(" + (window.scrollY * 0.35).toFixed(1) + "px) scale(" + (1 - 0.06 * t).toFixed(3) + ")";
      layer.style.opacity = (1 - fade).toFixed(3);
      updatePageClass();
    }

    // 滚动事件用 rAF 节流，避免一帧内重复计算
    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          ticking = true;
          requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    window.addEventListener("resize", function () {
      requestAnimationFrame(update);
    });
    update();
  }

  /* ============================================================
   *  开关灯：详情页右上角的圆形按钮，手动切浅色(开灯)/深色(关灯)。
   *  涟漪配色、页面底色、文字颜色都随之切换；选择存 localStorage，
   *  下次访问保持。第一页始终是夜空，不受此开关影响。
   * ============================================================ */
  function initThemeToggle() {
    var btn = el("button", "theme-toggle");
    btn.type = "button";
    btn.setAttribute("aria-label", "Toggle dark / light background");

    function refreshIcon() {
      btn.textContent = themeDark ? "☀️" : "🌙"; // 图标提示「点下去会变成什么」
    }

    btn.addEventListener("click", function () {
      document.documentElement.dataset.theme = themeDark ? "light" : "dark";
      try {
        window.localStorage &&
          window.localStorage.setItem("theme", document.documentElement.dataset.theme);
      } catch (ignore) {}
      applyTheme();
      refreshIcon();
    });

    refreshIcon();
    document.body.appendChild(btn);
  }

  /* ================= 开始渲染页面 ================= */

  initBackground(); // 详情页背景：涟漪 + 渐变
  initSpace(); // 第一页背景：星空（整层盖在涟漪之上）
  applyTheme(); // 按当前主题给背景画布配色

  if (data.name) document.title = data.name;

  // —— 首页大字区（Hero）——
  var hero = el("header", "hero");

  if (data.name) {
    var h1 = el("h1", "name");
    h1.setAttribute("aria-label", data.name);
    if (reducedMotion) {
      h1.textContent = data.name;
    } else {
      // 逐字升起：每个字一个 span，依次延迟出现；
      // 第二个延迟给流光动画（负值错位，形成扫过整行名字的波浪）
      String(data.name).split("").forEach(function (ch, index) {
        // 空格必须换成不换行空格：inline-block 的 span 里普通空格会塌成
        // 零宽，名字里的空格就丢了（"Dingyan Jiang" 变成 "DingyanJiang"）
        var span = el("span", "char", ch === " " ? " " : ch);
        span.style.animationDelay =
          (0.05 * index).toFixed(2) + "s, " + (-0.45 * index).toFixed(2) + "s";
        h1.appendChild(span);
      });
    }
    hero.appendChild(h1);
  }

  // —— 引言（名字正下方的一行名言，可选）——
  if (data.quote) {
    var quoteP = el("p", "quote");
    appendMultiline(quoteP, data.quote);
    hero.appendChild(quoteP);
  }

  // —— 生活页入口（引言下方的小按钮，可选）——
  if (data.lifeLink && data.lifeLink.url) {
    var lifeA = document.createElement("a");
    lifeA.className = "life-link";
    lifeA.href = data.lifeLink.url;
    lifeA.textContent = data.lifeLink.label || "Life →";
    hero.appendChild(lifeA);
  }

  // —— 向下滚动提示箭头 ——
  if (!reducedMotion) hero.appendChild(el("div", "scroll-hint", ""));
  root.appendChild(hero);

  // —— Self-Introduction ——
  if (Array.isArray(data.intro) && data.intro.length > 0) {
    var introSection = el("section", "reveal");
    introSection.appendChild(el("h2", null, "Self-Introduction"));
    data.intro.forEach(function (paragraph) {
      var p = el("p");
      appendMultiline(p, paragraph);
      introSection.appendChild(p);
    });
    root.appendChild(introSection);
  }

  // —— Education（教育经历，每条一行，可带校徽；支持 "文字" 或 { logo, text } 两种写法）——
  var eduLines = [];
  if (Array.isArray(data.education)) {
    eduLines = data.education.filter(function (line) { return line; });
  } else if (data.education) {
    eduLines = [data.education];
  }
  if (eduLines.length > 0) {
    var eduSection = el("section", "reveal");
    eduSection.appendChild(el("h2", null, "Education"));
    var eduList = el("div", "edu-lines");
    eduLines.forEach(function (entry) {
      var line = el("span", "edu-line");
      if (entry && typeof entry === "object") {
        if (entry.logo) line.appendChild(logoImg(entry.logo, "logo-chip"));
        appendMultiline(line, entry.text || "");
      } else {
        appendMultiline(line, String(entry));
      }
      eduList.appendChild(line);
    });
    eduSection.appendChild(eduList);
    root.appendChild(eduSection);
  }

  // —— Experience（实习 / 科研经历时间轴）——
  if (Array.isArray(data.experience) && data.experience.length > 0) {
    var expSection = el("section", "reveal");
    expSection.appendChild(el("h2", null, "Experience"));
    var timeline = el("ol", "timeline");

    data.experience.forEach(function (exp) {
      var item = el("li");
      var dotBody = el("span", "tl-body");

      // 第一行：可选 logo + 标题（可加粗/链接）· 单位
      var head = el("span", "tl-head");
      if (exp.logo) head.appendChild(logoImg(exp.logo, "logo-chip tl-logo"));
      var titleEl = el("span", "tl-title");
      if (exp.link) {
        var expLink = document.createElement("a");
        expLink.href = exp.link;
        expLink.target = "_blank";
        expLink.rel = "noopener noreferrer";
        appendMultiline(expLink, exp.title || "");
        titleEl.appendChild(expLink);
      } else {
        appendMultiline(titleEl, exp.title || "");
      }
      head.appendChild(titleEl);
      if (exp.org) head.appendChild(el("span", "tl-org", " · " + exp.org));
      dotBody.appendChild(head);

      // 第二行：起止时间；之后是可选的一句话描述
      dotBody.appendChild(el("span", "tl-time", exp.time || ""));
      if (exp.desc) {
        var expDesc = el("span", "tl-desc");
        appendMultiline(expDesc, exp.desc);
        dotBody.appendChild(expDesc);
      }

      item.appendChild(dotBody);
      timeline.appendChild(item);
    });

    expSection.appendChild(timeline);
    root.appendChild(expSection);
  }

  // —— Selected work ——
  if (Array.isArray(data.works) && data.works.length > 0) {
    var worksSection = el("section", "reveal");
    worksSection.appendChild(el("h2", null, "Selected work"));
    var list = el("ul", "works");

    data.works.forEach(function (work, index) {
      var item = el("li");
      if (!reducedMotion) item.style.transitionDelay = (0.06 * index).toFixed(2) + "s";
      item.appendChild(el("span", "work-emoji", work.emoji || ""));

      var body = el("span", "work-body");
      var titleLine = el("span", "work-title");
      if (work.link) {
        var link = document.createElement("a");
        link.href = work.link;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        appendMultiline(link, work.title || "");
        titleLine.appendChild(link);
      } else {
        appendMultiline(titleLine, work.title || "");
      }
      if (work.desc) {
        var desc = el("span", "work-desc");
        appendMultiline(desc, work.desc);
        body.appendChild(titleLine);
        body.appendChild(desc);
      } else {
        body.appendChild(titleLine);
      }
      item.appendChild(body);
      list.appendChild(item);
    });

    worksSection.appendChild(list);
    root.appendChild(worksSection);
  }

  // —— 联系方式（底部一行，用 / 分隔）——
  if (Array.isArray(data.contacts) && data.contacts.length > 0) {
    var footer = el("footer", "contacts reveal");
    data.contacts.forEach(function (contact, index) {
      if (index > 0) footer.appendChild(el("span", "sep", " / "));
      var item = el("span", "contact");
      if (contact.link) {
        var contactLink = document.createElement("a");
        contactLink.href = contact.link;
        contactLink.textContent = contact.label || "";
        item.appendChild(contactLink);
      } else {
        item.appendChild(document.createTextNode(contact.label || ""));
      }
      if (contact.value) {
        item.appendChild(document.createTextNode(": " + contact.value));
      }
      footer.appendChild(item);
    });
    root.appendChild(footer);
  }

  // —— 换页特效（星空→详情）+ 开关灯按钮 ——
  initPageTransition(hero);
  initThemeToggle();

  /* ============================================================
   *  滚动显现：区块进入视口时淡入上移（IntersectionObserver）
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
