# AI / 科技访谈 · 观看列表

纯静态站点：浏览 / 筛选 AI 与科技访谈清单。在线地址：

**https://everclear077.github.io/ai-interview-watchlist/**

## 本地预览

```bash
# 任意静态服务器即可，例如：
python3 -m http.server 8080
# 打开 http://localhost:8080
```

相对路径资源，可直接部署到 GitHub Pages（仓库根目录）。

## 功能

- 按分类、优先级筛选；清除筛选
- 默认排序：优先级（P0→P2）再按日期（新→旧）
- 「已看」勾选：仅写入浏览器 `localStorage`（键 `watchlist-watched-v1`），不写回 `data.json`
- 状态筛选：全部 / 待看 / 已看

## 刷新数据

权威数据源（只读）：

```
/cursor/stores/store-e433f652-c028-4750-8952-bc438657b43c/watchlists/data.json
```

同步到本仓库并上线：

```bash
cp /cursor/stores/store-e433f652-c028-4750-8952-bc438657b43c/watchlists/data.json \
   /path/to/ai-interview-watchlist/data.json
cd /path/to/ai-interview-watchlist
git add data.json
git commit -m "chore: refresh watchlist data"
git push origin main
```

或使用仓库内脚本（在能访问该 store 路径的环境中）：

```bash
./scripts/sync-data.sh
```

推送后 GitHub Pages 通常 1–2 分钟内更新。

## 文件

| 文件 | 说明 |
|------|------|
| `index.html` | 页面结构 |
| `styles.css` | 样式 |
| `app.js` | 筛选 / 排序 / 已看状态 |
| `data.json` | 列表数据（运行时 `fetch`） |
