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
    var bandStars = []; // 银河带的密集小星
    var bandAngle = -0.55; // 银河带倾角：从左下到右上（弧度）
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

    // 撒银河带：沿一条斜贯屏幕的带轴，用近似正态分布把密集小星
    // 堆在带轴附近，越靠边越稀，形成银河的朦胧星雾
    function seedBand() {
      bandStars = [];
      var len = Math.sqrt(W * W + H * H); // 带轴长度（覆盖整条对角线）
      var halfWidth = Math.min(W, H) * 0.24; // 带半宽
      var count = Math.min(650, Math.round((W * H) / 2200));
      var dirX = Math.cos(bandAngle);
      var dirY = Math.sin(bandAngle);
      for (var i = 0; i < count; i++) {
        var along = (Math.random() - 0.5) * len * 1.1;
        // 三个随机数取平均近似正态，让星星向带轴中心聚集
        var gauss = (Math.random() + Math.random() + Math.random()) / 1.5 - 1;
        var across = gauss * halfWidth;
        bandStars.push({
          x: W / 2 + dirX * along - dirY * across,
          y: H / 2 + dirY * along + dirX * across,
          r: 0.35 + Math.random() * 1.0,
          base: 0.12 + Math.random() * 0.34,
          speed: 0.0003 + Math.random() * 0.0006, // 比普通星星闪得更慢
          phase: Math.random() * Math.PI * 2,
          color: starColors[Math.floor(Math.random() * starColors.length)],
        });
      }
    }

    // 画银河带的柔光底色：两层沿带轴的横向渐变，中间亮、两边淡出
    function drawBandGlow() {
      var len = Math.sqrt(W * W + H * H) * 1.2;
      var width = Math.min(W, H) * 0.55;
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(bandAngle);

      var grad = ctx.createLinearGradient(0, -width / 2, 0, width / 2);
      grad.addColorStop(0, "rgba(147,197,253,0)");
      grad.addColorStop(0.5, "rgba(186,215,251,0.065)");
      grad.addColorStop(1, "rgba(147,197,253,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(-len / 2, -width / 2, len, width);

      var w2 = width * 0.42; // 更窄更亮的带芯
      var grad2 = ctx.createLinearGradient(0, -w2 / 2, 0, w2 / 2);
      grad2.addColorStop(0, "rgba(224,242,254,0)");
      grad2.addColorStop(0.5, "rgba(224,242,254,0.06)");
      grad2.addColorStop(1, "rgba(224,242,254,0)");
      ctx.fillStyle = grad2;
      ctx.fillRect(-len / 2, -w2 / 2, len, w2);

      ctx.restore();
    }

    // 画一遍星星：银河带柔光 → 银河带小星 → 普通星星（闪烁 + 极慢上飘，
    // dt=0 时即静止，静态模式也用它）
    function drawStars(t, dt) {
      ctx.clearRect(0, 0, W, H);
      drawBandGlow();
      bandStars.forEach(function (s) {
        var alpha = s.base * (0.7 + 0.3 * Math.sin(t * s.speed + s.phase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + s.color + "," + alpha.toFixed(3) + ")";
        ctx.fill();
      });
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
      seedBand();
      if (reducedMotion) drawStars(0, 0); // 静态模式：变化后补画一次
    }
    window.addEventListener("resize", resize);
    resize();

    // 减弱动态：静态星空，整层随第一页自然滚走（见 style.css 的 .static）
    if (reducedMotion) {
      layer.classList.add("static");
      return;
    }

    var prev = 0;
    function frame(t) {
      var dt = Math.min(t - prev || 16.7, 50);
      prev = t;

      // 翻到详情页后整层已淡出，停止绘制省电
      if (!document.body.classList.contains("page-2")) {
        drawStars(t, dt);
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
    btn.setAttribute("aria-label", "开关灯：切换深色 / 浅色背景");

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
        var span = el("span", "char", ch === " " ? " " : ch);
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
