/**
 * Stdio smoke test. Serves this repo over localhost and points the MCP
 * server at that origin, so it does not depend on the live Pages deploy.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";

const require = createRequire(import.meta.url);
const WL = require("../media.js");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SITE = "https://everclear077.github.io/ai-interview-watchlist";

function assert(name, cond) {
  if (!cond) throw new Error("FAIL " + name);
  console.log("ok  " + name);
}

function startStatic(root) {
  const rootResolved = path.resolve(root);
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url || "/", "http://127.0.0.1");
        const rel = decodeURIComponent(url.pathname);
        const file = path.resolve(rootResolved, "." + rel);
        if (file !== rootResolved && !file.startsWith(rootResolved + path.sep)) {
          res.writeHead(403);
          res.end();
          return;
        }
        fs.readFile(file, (err, buf) => {
          if (err) {
            res.writeHead(404);
            res.end("not found");
            return;
          }
          res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
          res.end(buf);
        });
      } catch {
        res.writeHead(400);
        res.end();
      }
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function textOf(result) {
  const block = result && result.content && result.content[0];
  return block && typeof block.text === "string" ? block.text : "";
}

function jsonOf(result) {
  return JSON.parse(textOf(result));
}

async function call(client, name, args) {
  return client.callTool({ name, arguments: args || {} });
}

async function main() {
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "index.json"), "utf8"));
  const server = await startStatic(ROOT);
  const address = server.address();
  const base = "http://127.0.0.1:" + address.port;
  const client = new Client({ name: "long-lens-ai-smoke", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(__dirname, "server.js")],
    cwd: __dirname,
    stderr: "pipe",
    env: {
      ...getDefaultEnvironment(),
      PATH: process.env.PATH || "",
      LONG_LENS_BASE_URL: base
    }
  });
  let stderr = "";
  if (transport.stderr) {
    transport.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
  }
  try {
    await client.connect(transport);
    const listed = await client.listTools();
    const names = listed.tools.map((tool) => tool.name).sort();
    assert("tools are read-only trio", names.join(",") === "get_episode,list_episodes,site_info");
    listed.tools.forEach((tool) => {
      assert(tool.name + " readOnlyHint", !!(tool.annotations && tool.annotations.readOnlyHint === true));
      assert(tool.name + " not destructive", !(tool.annotations && tool.annotations.destructiveHint === true));
    });
    const listTool = listed.tools.filter((tool) => tool.name === "list_episodes")[0];
    const props = listTool.inputSchema && listTool.inputSchema.properties;
    ["query", "show", "topic", "category", "hasEssay", "hasAnalysis", "hasTranscript", "limit"].forEach((key) => {
      assert("list_episodes schema " + key, !!(props && props[key]));
    });

    const infoResult = await call(client, "site_info", {});
    assert("site_info not error", infoResult.isError !== true);
    const info = jsonOf(infoResult);
    assert("site_info lastUpdated", info.lastUpdated === index.lastUpdated);
    assert("site_info count", info.counts.episodes === index.items.length && info.counts.episodes > 0);
    assert("site_info feed", info.feedUrl === SITE + "/feed.xml");
    assert("site_info brand", info.brand.zh === "长镜 · AI" && info.brand.en === "Long Lens AI");
    assert("site_info readOnly", info.readOnly === true);

    const head = index.items[0];
    const limited = jsonOf(await call(client, "list_episodes", { limit: 1 }));
    assert("limit 1", limited.returned === 1 && limited.items.length === 1 && limited.total === index.items.length);
    assert("newest page url", limited.items[0].pageUrl === SITE + "/#/ep/" + encodeURIComponent(limited.items[0].id));

    const byTitle = jsonOf(await call(client, "list_episodes", { query: head.title, limit: 5 }));
    assert("query finds title", byTitle.items.some((item) => item.id === head.id));

    const a16z = jsonOf(await call(client, "list_episodes", { show: "a16z", limit: 100 }));
    assert("show a16z has rows", a16z.total > 0 && a16z.items.length > 0);
    assert("show a16z only", a16z.items.every((item) => WL.showSlug(item.show) === "a16z"));

    const china = jsonOf(await call(client, "list_episodes", { topic: "china", category: "中国·科技媒体", limit: 100 }));
    assert("topic china has rows", china.total > 0);
    assert("topic china only", china.items.every((item) => WL.topicSlug(item.category) === "china"));

    const essays = jsonOf(await call(client, "list_episodes", { hasEssay: true, limit: 100 }));
    assert("hasEssay true", essays.total > 0 && essays.items.every((item) => item.hasEssay === true));
    const noTranscript = jsonOf(await call(client, "list_episodes", { hasTranscript: false, limit: 5 }));
    assert("hasTranscript false", noTranscript.total > 0 && noTranscript.items.every((item) => item.hasTranscript === false));

    const episode = jsonOf(await call(client, "get_episode", { id: head.id }));
    assert("get_episode id", episode.id === head.id && episode.episode && episode.episode.id === head.id);
    assert("get_episode page", episode.pageUrl === SITE + "/#/ep/" + encodeURIComponent(head.id));
    if (head.hasEssay) assert("get_episode keeps essay", !!(episode.episode.essay && episode.episode.essay.zh));
    assert("get_episode strips coverDataUri", !episode.episode.coverDataUri);

    const missing = await call(client, "get_episode", { id: "missing-episode-zzz" });
    assert("missing episode is error", missing.isError === true && /No published episode/.test(textOf(missing)));

    let rejected = false;
    try {
      const bad = await call(client, "get_episode", { id: "../data.json" });
      rejected = bad.isError === true;
    } catch {
      rejected = true;
    }
    assert("path-like id rejected", rejected);

    console.log("mcp smoke passed");
    if (stderr && !/read-only/.test(stderr)) console.log(stderr.trim());
  } catch (err) {
    if (stderr) console.error(stderr);
    throw err;
  } finally {
    try { await client.close(); } catch { /* already closed */ }
    await new Promise((resolve) => server.close(resolve));
  }
}

const timer = setTimeout(() => {
  console.error("smoke timed out");
  process.exit(1);
}, 45000);

main().then(() => {
  clearTimeout(timer);
  process.exit(0);
}).catch((err) => {
  clearTimeout(timer);
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
