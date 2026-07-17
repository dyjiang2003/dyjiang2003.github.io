/* 生活页渲染脚本：读取 life-content.js 里的 window.LIFE，生成页面。
 * 想改生活页的文字/照片：请改 life-content.js。想改外观：请改 style.css。
 * 背景涟漪与主题逻辑和首页 render.js 保持一致（如调整请两边同步）。 */

(function () {
  "use strict";

  var data = window.LIFE || {};
  var root = document.getElementById("life-app");

  var reducedMotion = !!(
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  /* —— 主题：沿用首页「开关灯」保存的选择，本页不放开关 —— */
  try {
    var savedTheme = window.localStorage && window.localStorage.getItem("theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      document.documentElement.dataset.theme = savedTheme;
    }
  } catch (ignore) {}

  var themeDark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === "dark"
    : !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);

  // —— 小工具（与首页 render.js 相同）——

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
   *  背景画布：「波源干涉涟漪 + 漂浮微粒」，与首页详情页一致；
   *  区别只是本页没有开关灯，主题在加载时读一次。
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

    // 涟漪配色（物理感的蓝/青/紫），深/浅色各一套，随主题二选一
    var palette = themeDark
      ? ["96,165,250", "34,211,238", "167,139,250"]
      : ["37,99,235", "8,145,178", "124,58,237"];

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
        color: palette[i % palette.length],
        x: 0,
        y: 0,
      });
    }

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

  /* ================= 开始渲染页面 ================= */

  initBackground();

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
