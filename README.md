# AI / 科技访谈 · 观看列表

纯静态站点（**skin = midnight**：graphite + muted gold）。在线地址（GitHub Pages）：

**https://everclear077.github.io/ai-interview-watchlist/**

## 本地预览

```bash
# 任意静态服务器即可，例如：
python3 -m http.server 8080
# 打开 http://localhost:8080
```

相对路径资源，可直接部署到 GitHub Pages（仓库根目录）。

## 功能

- 按分类、优先级筛选；清除筛选；搜索
- 默认排序：优先级（P0→P2）再按日期（新→旧）
- 「已看」勾选：仅写入浏览器 `localStorage`（键 **`ai-interviews-watched-v1`**），不写回 `data.json`
- 状态筛选：全部 / 待看 / 已看
- 封面：优先 `coverDataUri`，否则相对路径 `cover`（如 `thumbs/...`）

## 刷新数据

权威数据源（只读）：

```
/cursor/stores/store-e433f652-c028-4750-8952-bc438657b43c/watchlists/
```

同步 `data.json` + `thumbs/` 到本仓库并上线：

```bash
./scripts/sync-data.sh          # copy only
./scripts/sync-data.sh --push   # copy, commit, push (when remote exists)
```

推送后 GitHub Pages 通常 1–2 分钟内更新。

## 文件

| 文件 | 说明 |
|------|------|
| `index.html` | 自包含 midnight UI（CSS + JS）；运行时 `fetch("./data.json")` |
| `data.json` | 列表数据（含 cover / coverDataUri） |
| `thumbs/` | 封面缩略图（`cover` 相对路径回退） |
| `scripts/sync-data.sh` | 从 store 同步 data.json + thumbs/ |
