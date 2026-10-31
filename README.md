# 长镜 · AI

纯静态站点（夜馆目录：ink chrome + paper 阅读页）。在线地址（GitHub Pages）：

**https://everclear077.github.io/ai-interview-watchlist/**

精选 AI / 科技长视频访谈，带精读、解读与文稿。按栏目、主题、内容形态查找后阅读，不是私人观看列表，也没有已看 / 待看。

## 本地预览

```bash
python3 -m http.server 8080
# 打开 http://localhost:8080
# 单集：http://localhost:8080/#/ep/<id>
# 栏目：http://localhost:8080/#/show/sv101
# 主题：http://localhost:8080/#/topic/china
```

相对路径资源，可直接部署到 GitHub Pages（仓库根目录，base `/ai-interview-watchlist/`）。

部署后若样式看起来还是旧版，对页面做一次硬刷新（Windows/Linux：`Ctrl+Shift+R`，macOS：`Cmd+Shift+R`）。`index.html` 给 `styles.css` / `app.js` / `media.js` 加了短版本查询（`?v=…`），一般会绕过旧缓存。Google Fonts 可能在部分网络打不开；CSS 字体栈已回退到 PingFang / Songti / 系统字体。

## 语言 / Language

界面铬（顶栏、筛选、货架标题、空状态、页签、按钮、`aria-label`、页脚）可在中文与英文之间切换。品牌随语言切换：中文 **长镜 · AI**，英文 **Long Lens AI**。栏目名、主题名保持数据里的原文。

精读 / 解读 / 文稿按语言选已有字段，**不做机翻**：
- 精读 / 解读：中文用 `essay.zh` / `analysis.zh`；英文只用 `essay.en` / `analysis.en`（或同级英文键）。没有英文正文时显示 “English close read/analysis not available yet”，不留下中文正文。
- 文稿：英文优先 `transcript.en`，否则在 `transcript.language === "en"` 时用官方/ASR 的 `md` 或 `turns`；中文路径与原来一样（`md` → `turns` → `en`）。中文文稿在 EN 下同样显示英文不可用提示。
- 标题：有 `title_en` 时英文用它，否则用条目原标题（西语节目标题多半已经是英文）。

- 存储：`localStorage` 键 `wl-lang` = `zh` | `en`。一旦写下（含点选 中文 / EN），存储值优先于时区。
- 默认（没有存储值时）：IANA 时区是中国相关（`Asia/Shanghai`、`Asia/Chongqing`、`Asia/Urumqi`、`Asia/Harbin`）则为 `zh`；否则 `en`。拿不到 IANA 名时，UTC+8（`getTimezoneOffset() === -480`，即 CST）也算中文默认。
- 顶栏在主题开关旁有紧凑的 **中文 | EN**。`<html>` 会设 `lang`（`zh-CN` / `en`）和 `data-lang`。`index.html` 的 FOUC 脚本会尽早写上这两项。

## 路由

**Hash SPA**（GitHub Pages project site 不依赖生成多页 HTML）

| 地址 | 页面 |
|------|------|
| `#/` | 发现页：搜索 + 可组合筛选 |
| `#/show/<slug>` | 按栏目浏览（显示名用原节目名；URL 会归并别名） |
| `#/topic/<slug>` | 按主题浏览 |
| `#/ep/<id>` | 单集：中文精读 / 详细解读 / 完整文稿 |

筛选写在 hash query 里，链接可分享，例如 `#/?form=essay&sort=oldest`、`#/?period=week`、`#/show/a16z?topic=vc`。

`404.html` 会把 Pages 上的 `/ep/<id>/`、`/show/<slug>/`、`/topic/<slug>/` 重定向到对应 hash。

## 功能

- 发现页：大搜索（标题 / 嘉宾 / 节目 / 摘要）+ 栏目、主题、形态（有精读 / 有解读 / 有文稿）、时段（本周 / 本月 / 更早）与新旧排序
- 未筛选时按时间货架 + 栏目货架浏览（大 16:9 封面卡，不是细行账本）；筛选后是同语言的卡片网格
- 封面悬停：略放大、抬升、半透明遮罩与「打开」；有精读 / 解读 / 文稿时在遮罩上标出
- 空结果会提示如何清除筛选
- 单集：顶栏返回文库；媒体条（点「打开视频」后才嵌入 YouTube / Bilibili）；有 `media.audioUrl` 才显示音频条
- 三个页签（空字段隐藏）：**中文精读** / **Close read**、**详细解读** / **Analysis**、**完整文稿** / **Transcript**
- 中文正文：`essay.zh`、`analysis.zh`、`transcript.md`（否则 `transcript.turns[]`）。英文正文只用数据里的英文字段或 `language=en` 的文稿；没有则显示英文不可用提示
- 默认选中「中文精读」（有精读时）。精读 / 详细解读有标题时显示 TOC（`#/ep/<id>?h=`）
- 有 `evidence[]` 时在精读与详细解读中穿插出处截图
- 音频进度键：`ai-interviews-audio-pos-v1`（本机续听，无账号）
- 封面：只用相对路径 `cover`（如 `thumbs/...`）。`coverDataUri` 不发布
- 数据里的 `priority`（P0/P1/P2）不作为公开分类，界面不展示

## 栏目 URL 归并

乱的节目名会归一到稳定 slug，页面仍显示规范名：

| slug | 显示名 | 原始名例子 |
|------|--------|------------|
| `all-in` | All-In Podcast | All-In Podcast、All-In Podcast #293 |
| `a16z` | a16z Podcast | a16z Podcast、The a16z Show |
| `sv101` | 硅谷101 | 硅谷101、硅谷101播客 |
| `lex-fridman` | Lex Fridman Podcast | Lex Fridman、Lex Fridman Podcast |
| `late-talk` | 晚点聊 LateTalk | 晚点聊 LateTalk、晚点聊LateTalk |

主题 slug：`lab` 实验室·安全·研究、`founders` 创始人·CEO·产品、`vc` VC·基建·市场、`china` 中国·科技媒体。

## 嵌入规则

从 `urls[]` 的 `href` 识别，**不**看 label：

- YouTube → `youtube-nocookie.com/embed/<id>`
- Bilibili → `player.bilibili.com/player.html?...`
- 其他 → 「打开 …」外链
- 默认不自动嵌入；点「打开视频」后才插入 iframe

## 数据布局

| 路径 | 谁读 | 内容 |
|------|------|------|
| `data/index.json` | 目录页 | 站点 meta + slim `items[]`：id / title / guest / show / date / category / priority / cover / summary / advice / urls / media / addedAt / `hasEssay` / `hasAnalysis` / `hasTranscript`。无正文、无 `coverDataUri` |
| `data/episodes/<id>.json` | `#/ep/<id>` | 同上 + 有内容的 `essay` / `analysis` / `transcript` / `evidence` |
| `data.json` | 不作为目录 | 弃用 stub |

R 仍可往单体 `data.json` 追加正文；上线前用 splitter 拆文件。空模块不写入单集文件，对应页签不出现。列表徽章看 slim 的 `hasEssay` / `hasAnalysis` / `hasTranscript`。

## 刷新数据

权威数据源（只读；R 仍产出一台单体 `data.json`）：

```
/cursor/stores/store-e433f652-c028-4750-8952-bc438657b43c/watchlists/
```

```bash
./scripts/sync-data.sh          # thumbs + monitors + split（含 feed.xml / rss.xml）
./scripts/sync-data.sh --push   # 同上并 commit / push（当 remote 存在）
node scripts/split-data.mjs /path/to/R/data.json
node scripts/build-feed.mjs     # 只根据 data/index.json 重写 feed
node scripts/selftest.js        # 含 RSS 校验；MCP 冒烟需先在 mcp/ 安装依赖
cd mcp && npm install && node smoke.mjs
```

**不要**把 R 的嵌入式 `index.html` / `index-midnight.html` 提交进本仓库。推送后 GitHub Pages 通常 1–2 分钟内更新。

## 上线后怎么给公开地址

合并到 `main` 后，对外仍用同一个 Pages 地址：

**https://everclear077.github.io/ai-interview-watchlist/**

介绍时称「长镜 · AI」，不要再叫访谈文库或观看列表。需要带人进某一面时，直接分享 hash：

- 全部精读：`https://everclear077.github.io/ai-interview-watchlist/#/?form=essay`
- 硅谷101：`https://everclear077.github.io/ai-interview-watchlist/#/show/sv101`
- 中国·科技媒体：`https://everclear077.github.io/ai-interview-watchlist/#/topic/china`

## RSS

订阅地址（GitHub Pages 静态文件，阅读器直接添加）：

**https://everclear077.github.io/ai-interview-watchlist/feed.xml**

`rss.xml` 是同一份 RSS 2.0 的副本。NetNewsWire、Feedly、Inoreader、Thunderbird 等：选「添加订阅 / Add feed」，粘贴上面的地址。首页和 `404.html` 带了 `<link rel="alternate" type="application/rss+xml">`，支持发现订阅的浏览器也会认。

每条是一集：`guid` 是 episode id，标题、`pubDate`（条目 `date`）、绝对链接 `https://everclear077.github.io/ai-interview-watchlist/#/ep/<id>`、摘要。摘要用 `summary`；没有 summary 时从 `essay.zh` 截一段，不编正文。按日期从新到旧，当前目录全部收入（超过 500 条时只留最新 500）。频道标题是「长镜 · AI」，说明里带 Long Lens AI；`lastBuildDate` 来自 `data/index.json` 的 `lastUpdated`。

`scripts/split-data.mjs` 在拆分单体，或 `--stub-from-index` 时，会重写 `feed.xml` 和 `rss.xml`。每日 `scripts/sync-data.sh` 因此会把 feed 一起更新。只改了已发布的 `data/index.json` 时，也可以单独跑 `node scripts/build-feed.mjs`。

## MCP（只读）

Pages 上没有远程 MCP 进程。仓库里的 `mcp/` 是本机 stdio 服务器（当前 MCP TypeScript SDK v2：`@modelcontextprotocol/server`，也就是原先 `@modelcontextprotocol/sdk` 的现行包），只读取上面的公开 JSON。

```bash
cd mcp
npm install
```

Cursor 或 Claude Desktop 使用同一段配置。把路径换成你的克隆目录：

```json
{
  "mcpServers": {
    "long-lens-ai": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/ai-interview-watchlist/mcp/server.js"]
    }
  }
}
```

工具只有三个，都是只读、无需登录：

- `list_episodes`：按 query / show / topic（或 category）/ hasEssay / hasAnalysis / hasTranscript / limit 筛选公开目录
- `get_episode`：按 id 读取 `data/episodes/<id>.json`
- `site_info`：标题、`lastUpdated`、计数、feed URL

不要把 `https://everclear077.github.io/ai-interview-watchlist/` 配成 SSE 或 HTTP MCP 地址。更全的说明在 `docs/mcp.md`。

## 文件

| 文件 | 说明 |
|------|------|
| `index.html` | 瘦页面壳（不要换成 R 的胖 HTML） |
| `styles.css` | 夜馆目录 + 阅读页纸色 |
| `media.js` | 路由、slug、嵌入、markdown、字段探测、主题与 `t()` 文案表 |
| `app.js` | 发现 / 栏目 / 主题 / 单集 UI 与音频 |
| `404.html` | Pages 路径 → hash；也带 RSS alternate |
| `feed.xml` | RSS 2.0 订阅（Pages 静态文件） |
| `rss.xml` | 与 `feed.xml` 相同的副本 |
| `data/index.json` | 列表用瘦目录 |
| `data/episodes/<id>.json` | 单集正文 |
| `thumbs/` | 封面；出处帧可放 `thumbs/frames/` |
| `scripts/build-feed.mjs` | 目录 → `feed.xml` / `rss.xml` |
| `scripts/split-data.mjs` | 单体 → 模块树（剥 `coverDataUri`），并重写 feed |
| `scripts/sync-data.sh` | thumbs + monitors + split |
| `mcp/` | 只读 stdio MCP 服务器 |
| `docs/mcp.md` | MCP 安装与工具说明 |
