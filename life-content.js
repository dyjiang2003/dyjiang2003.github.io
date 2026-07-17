/* ============================================================
 *   生活页内容配置 —— 想改生活页上的任何文字/照片，只改这一个文件！
 * ------------------------------------------------------------
 *   规则和首页的 content.js 一样：
 *   1. 文字一律放在英文双引号 "..." 里面，引号别删。
 *   2. 每一行末尾的英文逗号 , 别删（最后一行可以没有）。
 *   3. 标注「可选」的行：不想要就整行删掉。
 *   4. 照片：把照片文件（jpg/png）放进 photos/ 文件夹，
 *      然后在卡片里加一行  photo: "文件名.jpg",
 *      没有 photo 的卡片自动变成纯文字卡片，也很好看。
 *   5. 想加卡片：整段复制 { ... }, 再改文字；
 *      想加整个板块：整段复制一个 { heading: ..., items: [...] },。
 * ============================================================ */

window.LIFE = {

  /* —— 页面大标题 + 下面的一句开场白 —— */
  title: "Life beyond work&research",
  intro: "Ultimately, it is all for the sake of a happy life.",

  sections: [

    /* —— 板块一：爱好 —— */
    {
      heading: "Hobbies",
      items: [
        {
          emoji: "🏸",
          title: "Badminton",
          photo: "badminton.svg", // （可选）照片放 photos/ 文件夹；删掉这行就是纯文字卡片
          desc: "Weekend regular at the campus gym; my footwork still trails my enthusiasm.",
        },
        {
          emoji: "🥾",
          title: "Hiking",
          photo: "hiking.svg",
          desc: "Slow miles with good views. Recent favorite: the hills west of Beijing before sunset.",
        },
        {
          emoji: "📷",
          title: "Photography",
          photo: "camera.svg",
          desc: "Mostly street shots and skylines; learning to see light before pressing the shutter.",
        },
      ],
    },

    /* —— 板块二：最近在读的书 —— */
    {
      heading: "what I've been reading recently",
      items: [
        {
          emoji: "📖",
          title: "Surely You're Joking, Mr. Feynman!",
          photo: "book-feynman.svg",
          desc: "Third time through; the bongo-drum chapters never get old.",
        },
        {
          emoji: "📗",
          title: "Seven Brief Lessons on Physics",
          photo: "book-rovelli.svg",
          desc: "Carlo Rovelli's poetry of quantum gravity — short, dense, rereadable.",
        },
        {
          emoji: "📘",
          title: "Sapiens",
          photo: "book-sapiens.svg",
          desc: "Halfway in; taking notes on the chapters about shared myths.",
        },
      ],
    },

    /* —— 板块三：最近在学的特长 —— */
    {
      heading: "Learning",
      items: [
        {
          emoji: "🎹",
          title: "Piano",
          photo: "piano.svg",
          desc: "Six months in. Summer goal: the first page of Clair de lune without mistakes.",
        },
        {
          emoji: "🏊",
          title: "Swimming",
          photo: "swimming.svg",
          desc: "From gasping at 25m to a steady 400m freestyle. Next up: flip turns.",
        },
        {
          emoji: "🗣️",
          title: "Japanese",
          // 这张卡片故意不放照片，纯文字卡片的效果
          desc: "N5 prep — anime subtitles are finally starting to make sense.",
        },
      ],
    },

  ],

};
