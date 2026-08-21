/* ============================================================
 *   网页内容配置 —— 想改网页上的任何文字，只改这一个文件！
 * ------------------------------------------------------------
 *   规则只有四条：
 *   1. 文字一律放在英文双引号 "..." 里面，引号别删。
 *   2. 每一行末尾的英文逗号 , 别删（最后一行可以没有）。
 *   3. 标注「可选」的行：不想要就整行删掉。
 *   4. 想手动换行：在文字里写 \n（反斜杠+n），例如 "第一行\n第二行"。
 *      下面凡是写成 [ ... ] 列表的，每一项自动各占一段/一行，不用写 \n。
 *   改完保存，刷新浏览器就能看到效果。
 * ============================================================ */

window.CONTENT = {

  /* —— 你的姓名（首页大字标题，带逐字升起+流光效果）—— */
  name: "Dingyan Jiang",

  /* —— 引言（可选）：名字正下方的一行名言，不想要就整行删掉 —— */
  quote: "ALL human by nature desire to know.——Aristotle",

  /* —— 生活页入口（可选）：引言下方的小按钮，点击跳到生活页 —— */
  lifeLink: { label: "Life ✦", url: "life.html" },

  /* —— 自我介绍（Self-Introduction）——
     一段文字一对引号；想加段落就复制一行再改文字。
     段落内部想换行，在文字里写 \n 即可。 */
  intro: [
    "Bachelor's degree in Nuclear Engineering and Technology, with a minor in Public Administration @Shanghai Jiao Tong University. Currently pursuing a Master's degree in Nuclear Science and Technology @Peking University. Expected to graduate in 2028.",
    "I'm now an intern at Ant Group, focusing on model physics-capability evaluation, data generation, and post-training.",
    "I'm interested in everything that helps to understand the world and transform it!",
  ],

  /* —— Education：教育经历（在自我介绍下面、实习经历上面）——
     每一项单独占一行。
     想在文字旁边显示校徽：写成
       { logo: "文件名.png", text: "文字" },
     图片放在 logos/ 文件夹里（logo 也可以直接填完整网址 https://...）。
     不想要 logo 的话，直接写 "一行文字" 就行。 */
  education: [
    { logo: "pku.png",  text: "Peking University · School of Physics · 2025~now" },
    { logo: "sjtu.png", text: "Shanghai Jiao Tong University · School of Mechanical Engineering · 2021~2025" },
  ],

  /* —— Experience：实习 / 科研经历时间轴（竖排，按时间从新到旧排列）——
     想加一段：整段复制 { ... }, 然后改里面的文字。
     title：岗位/身份；org：公司/团队；time：起止时间。
     logo、link、desc 都是可选的，不想要就整行删掉。 */
  experience: [
    {
      time: "Sep 2026 – Present",
      title: "Intern",
      org: "Ant Group · Foundation Intelligence Technology Department · Language and Machine Intelligence Department",
      logo: "antgroup.jpg", // （可选）公司/学校的 logo，图片放在 logos/ 文件夹里；没有就整行删掉
      desc: "Responsible for building the model physics-capability evaluation system, data generation, and post-training.", // （可选）不想要就整行删掉
    },
    {
      time: "Jul 2026 – Sep 2026",
      title: "Intern",
      org: "Moonshot AI · Data Department",
      logo: "moonshot.jpeg", // （可选）公司/学校的 logo，图片放在 logos/ 文件夹里；没有就整行删掉
      desc: "Responsible for building the model physics-capability evaluation system, data generation, and post-training.", // （可选）不想要就整行删掉
    },
    {
      time: "Jun 2024 – Aug 2024",
      title: "Intern",
      org: "Shanghai Nuclear Engineering Research and Design Institute · Control Department",
      logo: "snerdi.png",
      desc: "Developed a concentrate-parameter model of the SP-100 space nuclear reactor based on publicly available U.S. documents, solved the model's coupled partial differential equations numerically, and obtained the responses of key parameters under multiple operating conditions, providing support for the project's control system development.",
    },
  ],

  /* —— Selected work：作品 / 论文 / 奖项列表 ——
     想加一条：整段复制 { ... }, 然后改里面的文字。
     emoji 可以从 https://emojipedia.org 复制喜欢的图标。 */
  works: [
    {
      emoji: "🔭",
      title: "Flagship Project A",
      link: "https://github.com/yourname/project-a", // （可选）点击名称跳转的链接，没有就整行删掉
      desc: "One-line note shown indented under the title", // （可选）不想要就整行删掉
    },
    {
      emoji: "📄",
      title: "Paper Title (Conference 2025)",
      link: "https://arxiv.org/abs/0000.00000",
    },
    {
      emoji: "🚀",
      title: "Open-source Tool-B — one-line slogan",
      link: "https://github.com/yourname/tool-b",
      desc: "1K+ stars, adopted by XX",
    },
    {
      emoji: "🥈",
      title: "20XX XX Competition — Silver Medal", // 奖项类条目一般不需要链接
    },
  ],

  /* —— 联系方式（页面最下方一行，自动用 / 分隔）——
     label：显示的分类名；value：显示的具体内容；
     link：（可选）点击后跳转的链接，没有就整行删掉。
     目前只给 GitHub 设置了超链接，其余均为纯文本。 */
  contacts: [
    { label: "Email",  value: "dyjiang2003@163.com" },
    { label: "GitHub", value: "github.com/yourname", link: "https://github.com/yourname" },
    { label: "WeChat", value: "your-wechat-id" },
  ],

};
