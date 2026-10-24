# AI / 科技访谈 · 观看列表

纯静态站点（**skin = midnight**：graphite + muted gold）。在线地址（GitHub Pages）：

**https://everclear077.github.io/ai-interview-watchlist/**

多源观看列表（a16z / Latent Space / All-In / 硅谷101 / B站访谈等）。交互对齐 [lex.qiaomu.ai](https://lex.qiaomu.ai/) 的列表→单集深读，**不是** Lex 单栏目克隆；颜色保持 midnight，无样式切换。

## 本地预览

```bash
# 任意静态服务器即可，例如：
python3 -m http.server 8080
# 打开 http://localhost:8080
# 单集：http://localhost:8080/#/ep/<id>
```

相对路径资源，可直接部署到 GitHub Pages（仓库根目录）。

## 路由

**Hash SPA（主路径）**

| 地址 | 页面 |
|------|------|
| `#/` | 列表 |
| `#/ep/<id>` | 单集 |

选用 hash 是因为仓库以 GitHub Pages **project site**（`/ai-interview-watchlist/`）从 `main` 根目录发布：不依赖生成 46 个 HTML、本地 `python3 -m http.server` 即可深链刷新。

`404.html` 会把 Pages 上的 `/ep/<id>/` 重定向到 `/#/ep/<id>`（HTTP 404 + 跳转，仅作兼容）。本地 python 服务器不会提供这份 404。

## 功能

- 列表：封面、标题层级、一行 meta（嘉宾 · 节目 · 日期 · 时长 · P0–P2 · 分类）、分类 / 优先级筛选、嘉宾/主题搜索、「建议今天看」chips、已看勾选
- 条目含精读时显示徽章 **有精读**（列表看 `hasEssay`；单集仍看 `essay.zh`）
- 单集：顶栏返回列表；标题 / 嘉宾 / 节目 / 日期 / 时长 / 优先级；媒体条（「看视频」封面点击后才嵌入 YouTube / Bilibili，否则外链按钮）
- 有 `media.audioUrl` 才显示音频条（播放/暂停、±15s、倍速、按 id 断点续听）；无则整段隐藏
- 单集正文三个页签（空字段隐藏）：**中文精读** `essay.zh`、**详细解读** `analysis.zh`、**完整文稿** `transcript.md`（否则 `transcript.turns[]`，兼容旧字段 `transcript.en`）
- 默认选中「中文精读」（有 `essay.zh` 时）；否则选三个里第一个有内容的。精读 / 详细解读有标题时显示 TOC（`data-toc-target` + `#/ep/<id>?h=`，不用裸 `#slug`）
- 有 `evidence[]`（`src` / `caption` / `t` / `section`）时在精读与详细解读中展示出处截图；空则隐藏
- 「已看」写入浏览器 `localStorage`（键 **`ai-interviews-watched-v1`**），列表与单集同步，不写回数据文件
- 音频进度键：`ai-interviews-audio-pos-v1`（与已看键分开）
- 封面：只用相对路径 `cover`（如 `thumbs/...`）。`coverDataUri` 不发布（体积过大）

## 嵌入规则

从 `urls[]` 的 `href` 识别，**不**看 label：

- YouTube（`youtube.com/watch?v=`、`youtu.be/`、`/embed/`、`/shorts/`、`/live/`）→ `youtube-nocookie.com/embed/<id>`
- Bilibili（`/video/BVxxx` 或 `/video/av123`）→ `player.bilibili.com/player.html?...`
- 其他（Apple Podcasts、小宇宙等）→ 「外链打开」按钮
- 默认不自动嵌入；点「看视频」后才插入 iframe

## Phase 2/3 字段（有则渲染，空则隐藏）

R 可往**单体** `data.json` 条目追加，W 不编造正文；上线前用 splitter 拆成模块文件：

```json
{
  "essay": {
    "zh": "markdown 精读（压缩改写，可带小标题）",
    "title": "精读标题（可同 title）",
    "wordCount": 8033,
    "disclaimer": "AI 改写精读，非官方翻译；请以原音视频为准"
  },
  "analysis": {
    "zh": "markdown 详细解读（比精读更长：论证展开、背景、分歧、可核对要点）",
    "title": "详细解读标题",
    "wordCount": 12000,
    "disclaimer": "AI 详细解读，非官方；请以原音视频为准"
  },
  "transcript": {
    "md": "**主持人名：** 说过的话…\\n\\n**嘉宾名：** 说过的话…",
    "turns": [
      { "speaker": "主持人名", "text": "说过的话…" },
      { "speaker": "嘉宾名", "text": "说过的话…" }
    ],
    "language": "zh|en|mixed",
    "source": "official|asr|none",
    "disclaimer": "完整文稿可能含 ASR/整理误差；说话人标注以可辨认发言为准",
    "en": "（兼容旧字段）全文稿正文"
  },
  "evidence": [
    {
      "src": "thumbs/frames/<id>-01.jpg",
      "caption": "一句话说明画面在论证什么",
      "t": "12:34",
      "section": "可选：对应小标题"
    }
  ],
  "media": {
    "videoUrl": "https://...",
    "audioUrl": "https://....mp3",
    "audioSource": "podcast-rss|official|none"
  }
}
```

W 优先渲染 `transcript.md`；无 md 有 `turns` 时按 `**{speaker}：** {text}` 拼接。列表徽章「有精读」看 slim 条目的 `hasEssay`（由 splitter 根据 `essay.zh` 写出）。空模块不写入单集文件，对应页签不出现。

## 数据布局

Pages 不再发布约 24MB 的单体 `data.json`（主要是 `coverDataUri` + 长文稿）。

| 路径 | 谁读 | 内容 |
|------|------|------|
| `data/index.json` | 列表 `#/` | 站点 meta（`version` `title` `lastUpdated` `categories` `priorities` `notes`）+ slim `items[]`：id / title / guest / show / date / category / priority / cover / summary / advice / duration / urls / media / addedAt / `hasEssay` / `hasAnalysis` / `hasTranscript`。无正文、无 `coverDataUri` |
| `data/episodes/<id>.json` | 单集 `#/ep/<id>` | 同上 meta + 有内容的 `essay` / `analysis` / `transcript` / `evidence`。一集一个文件（一次请求） |
| `data.json` | 不作为目录 | 弃用 stub，指向上面两个路径，避免误把单体挂上 Pages |

相对 URL，在 GitHub Pages project site `/ai-interview-watchlist/` 下可用。

## 刷新数据

权威数据源（只读；R 仍产出一台单体 `data.json`）：

```
/cursor/stores/store-e433f652-c028-4750-8952-bc438657b43c/watchlists/
```

W 每日同步 = 拷 thumbs + `bilibili-monitors.json` + 对 R 的单体跑 splitter（若 store 已是拆好的 `data/` 树则直接拷）：

```bash
./scripts/sync-data.sh          # thumbs + monitors + split
./scripts/sync-data.sh --push   # 同上并 commit / push（当 remote 存在）
```

单独重拆（输入必须是 R 的单体，不能是根目录 stub）：

```bash
node scripts/split-data.mjs /path/to/R/data.json
# 幂等：清空并重写 data/episodes/、data/index.json、根目录 stub
```

**不要**把 R 的嵌入式 `index.html` / `index-midnight.html` 提交进本仓库。推送后 GitHub Pages 通常 1–2 分钟内更新。

辅助校验（解析 / 嵌入 / 空字段 / 拆分后体积）：

```bash
node scripts/selftest.js
```

## 文件

| 文件 | 说明 |
|------|------|
| `index.html` | 瘦页面壳（不要换成 R 的胖 HTML） |
| `styles.css` | midnight 样式（无主题切换） |
| `media.js` | 路由、嵌入识别、markdown、字段探测 |
| `app.js` | 列表 / 单集 UI、已看、音频；列表只拉 slim index |
| `404.html` | Pages 路径 `/ep/<id>/` → hash |
| `data/index.json` | 列表用瘦目录 |
| `data/episodes/<id>.json` | 单集正文（按需加载） |
| `data.json` | 弃用 stub，不再承载目录 |
| `thumbs/` | 封面缩略图；出处帧可放 `thumbs/frames/` |
| `scripts/split-data.mjs` | 单体 → 模块树（剥 `coverDataUri`） |
| `scripts/sync-data.sh` | thumbs + monitors + split |
