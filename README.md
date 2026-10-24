# AI / 科技访谈文库

纯静态公开文库（夜馆目录：ink chrome + paper 阅读页）。在线地址（GitHub Pages）：

**https://everclear077.github.io/ai-interview-watchlist/**

收录多档 AI / 科技访谈的中文精读、详细解读与文稿。按栏目、主题、内容形态查找后阅读，不是私人观看列表，也没有已看 / 待看。

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
- 三个页签（空字段隐藏）：**中文精读** `essay.zh`、**详细解读** `analysis.zh`、**完整文稿** `transcript.md`（否则 `transcript.turns[]`）
- 默认选中「中文精读」（有 `essay.zh` 时）。精读 / 详细解读有标题时显示 TOC（`#/ep/<id>?h=`）
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
./scripts/sync-data.sh          # thumbs + monitors + split
./scripts/sync-data.sh --push   # 同上并 commit / push（当 remote 存在）
node scripts/split-data.mjs /path/to/R/data.json
node scripts/selftest.js
```

**不要**把 R 的嵌入式 `index.html` / `index-midnight.html` 提交进本仓库。推送后 GitHub Pages 通常 1–2 分钟内更新。

## 上线后怎么给公开地址

合并到 `main` 后，对外仍用同一个 Pages 地址：

**https://everclear077.github.io/ai-interview-watchlist/**

介绍时称「访谈文库」，不要再叫观看列表。需要带人进某一面时，直接分享 hash：

- 全部精读：`https://everclear077.github.io/ai-interview-watchlist/#/?form=essay`
- 硅谷101：`https://everclear077.github.io/ai-interview-watchlist/#/show/sv101`
- 中国·科技媒体：`https://everclear077.github.io/ai-interview-watchlist/#/topic/china`

## 文件

| 文件 | 说明 |
|------|------|
| `index.html` | 瘦页面壳（不要换成 R 的胖 HTML） |
| `styles.css` | 夜馆目录 + 阅读页纸色 |
| `media.js` | 路由、slug、嵌入、markdown、字段探测 |
| `app.js` | 发现 / 栏目 / 主题 / 单集 UI 与音频 |
| `404.html` | Pages 路径 → hash |
| `data/index.json` | 列表用瘦目录 |
| `data/episodes/<id>.json` | 单集正文 |
| `thumbs/` | 封面；出处帧可放 `thumbs/frames/` |
| `scripts/split-data.mjs` | 单体 → 模块树（剥 `coverDataUri`） |
| `scripts/sync-data.sh` | thumbs + monitors + split |
