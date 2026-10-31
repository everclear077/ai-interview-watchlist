# 长镜 · AI · 只读 MCP

GitHub Pages 只托管静态文件，不能当远程 MCP（没有 SSE / HTTP 端点）。`mcp/` 是给 Cursor、Claude Desktop 这类客户端在本机拉起的 **stdio** 服务器。它只请求已经公开的 JSON，不写数据，也不要登录。

公开目录：

- 站点：https://everclear077.github.io/ai-interview-watchlist/
- 列表：https://everclear077.github.io/ai-interview-watchlist/data/index.json
- 单集：https://everclear077.github.io/ai-interview-watchlist/data/episodes/`<id>`.json
- RSS：https://everclear077.github.io/ai-interview-watchlist/feed.xml

需要 Node.js 20 或更新。在仓库里安装一次依赖：

```bash
cd mcp
npm install
```

客户端配置（Cursor 的 `mcp.json`，或 Claude Desktop 的 `claude_desktop_config.json`）使用同一段。把路径换成你机器上的克隆目录：

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

`node server.js` 会停在 stdio 上等客户端，不要把它当成会打印目录的命令自己跑。改完依赖后重启客户端。

## 工具

| 工具 | 作用 |
|------|------|
| `list_episodes` | 在公开目录里搜索。可选 `query`（标题 / 嘉宾 / 节目 / 摘要 / id）、`show`（slug 或节目名）、`topic` 或 `category`（`lab` / `founders` / `vc` / `china` 或中文类目）、`hasEssay` / `hasAnalysis` / `hasTranscript`、`limit`（默认 20，最大 100）。条件是「与」。新的在前。 |
| `get_episode` | 按 id 取 `data/episodes/<id>.json`。正文只来自文件里已有的字段。 |
| `site_info` | 标题、`lastUpdated`、精读 / 解读 / 文稿计数、feed URL。 |

三个工具都标了 `readOnlyHint`。没有写入、删除或需要密钥的工具。

可选环境变量（一般不用设）：

- `LONG_LENS_BASE_URL`：目录 JSON 的源站，默认就是上面的 Pages 地址。
- `LONG_LENS_SITE_ORIGIN`：单集页面链接用的站点源，默认同一个 Pages 源。

自测（不访问线上，改读本仓库的静态文件）：

```bash
cd mcp && npm install && node smoke.mjs
```
