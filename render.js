/* 渲染脚本：读取 content.js 里的 window.CONTENT，生成页面。
 * 普通维护不需要看这个文件；想改文字请改 content.js，
 * 想改样式请改 style.css。 */

(function () {
  "use strict";

  var data = window.CONTENT || {};
  var root = document.getElementById("app");

  // 创建元素的小工具：tag 标签名，className 样式类，text 纯文本内容
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  // —— 浏览器标签页标题 ——
  if (data.name) document.title = data.name;

  // —— 姓名（大标题）——
  if (data.name) root.appendChild(el("h1", "name", data.name));

  // —— 一句话头衔 ——
  if (data.tagline) root.appendChild(el("p", "tagline", data.tagline));

  // —— Self-Introduction ——
  if (Array.isArray(data.intro) && data.intro.length > 0) {
    var introSection = el("section");
    introSection.appendChild(el("h2", null, "Self-Introduction"));
    data.intro.forEach(function (paragraph) {
      introSection.appendChild(el("p", null, paragraph));
    });
    root.appendChild(introSection);
  }

  // —— Selected work ——
  if (Array.isArray(data.works) && data.works.length > 0) {
    var worksSection = el("section");
    worksSection.appendChild(el("h2", null, "Selected work"));
    var list = el("ul", "works");

    data.works.forEach(function (work) {
      var item = el("li");
      item.appendChild(el("span", "work-emoji", work.emoji || ""));

      var body = el("span", "work-body");
      var titleLine = el("span", "work-title");
      if (work.link) {
        var link = document.createElement("a");
        link.href = work.link;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = work.title || "";
        titleLine.appendChild(link);
      } else {
        titleLine.appendChild(document.createTextNode(work.title || ""));
      }
      if (work.desc) titleLine.appendChild(document.createTextNode(" —— " + work.desc));
      body.appendChild(titleLine);
      item.appendChild(body);
      list.appendChild(item);
    });

    worksSection.appendChild(list);
    root.appendChild(worksSection);
  }

  // —— 联系方式（底部一行，用 / 分隔）——
  if (Array.isArray(data.contacts) && data.contacts.length > 0) {
    var footer = el("footer", "contacts");
    data.contacts.forEach(function (contact, index) {
      if (index > 0) footer.appendChild(el("span", "sep", " / "));
      var item = el("span", "contact");
      if (contact.link) {
        var link = document.createElement("a");
        link.href = contact.link;
        link.textContent = contact.label || "";
        item.appendChild(link);
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
})();
