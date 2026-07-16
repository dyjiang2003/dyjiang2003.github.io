/* ============================================================
 *   网页内容配置 —— 想改网页上的任何文字，只改这一个文件！
 * ------------------------------------------------------------
 *   规则只有三条：
 *   1. 文字一律放在英文双引号 "..." 里面，引号别删。
 *   2. 每一行末尾的英文逗号 , 别删（最后一行可以没有）。
 *   3. 标注「可选」的行：不想要就整行删掉。
 *   改完保存，刷新浏览器就能看到效果。
 * ============================================================ */

window.CONTENT = {

  /* —— 你的姓名（页面最上方的大标题）—— */
  name: "张三 / San Zhang",

  /* —— 一句话头衔，显示在名字下方（可选，不想要就整行删掉）—— */
  tagline: "XX大学 · XX学院 · 2026届",

  /* —— 自我介绍（Self-Introduction）——
     一段文字一对引号；想加段落就复制一行再改文字。 */
  intro: [
    "第一段自我介绍：我是谁。例如：我现在就读于 XX大学 XX专业，将于 2026 年毕业，同时辅修 XX。",
    "第二段写你正在做的事。例如：目前在 XX 团队实习，关注 direction A 与 direction B。",
    "第三段写研究/兴趣方向。例如：研究兴趣：RL, agent, coding。",
  ],

  /* —— Selected work：作品 / 论文 / 奖项列表 ——
     想加一条：整段复制 { ... }, 然后改里面的文字。
     emoji 可以从 https://emojipedia.org 复制喜欢的图标。 */
  works: [
    {
      emoji: "🔭",
      title: "代表作项目 Project A",
      link: "https://github.com/yourname/project-a", // （可选）点击名称跳转的链接，没有就整行删掉
      desc: "一句话补充说明，会缩进显示在名称下一行", // （可选）不想要就整行删掉
    },
    {
      emoji: "📄",
      title: "我的论文 Paper Title (Conference 2025)",
      link: "https://arxiv.org/abs/0000.00000",
    },
    {
      emoji: "🚀",
      title: "开源工具 Tool-B —— 一句话 slogan",
      link: "https://github.com/yourname/tool-b",
      desc: "已有 1K+ stars，被 XX 采用",
    },
    {
      emoji: "🥈",
      title: "20XX 年 XX 比赛 —— 银奖", // 奖项类条目一般不需要链接
    },
  ],

  /* —— 联系方式（页面最下方一行，自动用 / 分隔）——
     label：显示的分类名；value：显示的具体内容；
     link：（可选）点击后跳转的链接，没有就整行删掉。 */
  contacts: [
    { label: "Email",  value: "you@example.com",        link: "mailto:you@example.com" },
    { label: "GitHub", value: "github.com/yourname",    link: "https://github.com/yourname" },
    { label: "WeChat", value: "your-wechat-id" },  // 微信没有链接，纯文本展示
  ],

};
