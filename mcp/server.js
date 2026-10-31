#!/usr/bin/env node
/**
 * Read-only stdio MCP server for 长镜 · AI.
 * Tools fetch the public catalog JSON. Nothing here writes or authenticates.
 *
 *   cd mcp && npm install
 *   node server.js
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";
import { dataBase, getEpisode, listEpisodes, siteInfo } from "./catalog.js";

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true
};

function asText(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function asError(err) {
  const message = err instanceof Error ? err.message : "Request failed";
  return { isError: true, content: [{ type: "text", text: message }] };
}

export function createServer() {
  const server = new McpServer({
    name: "long-lens-ai",
    version: "1.0.0",
    title: "长镜 · AI",
    websiteUrl: "https://everclear077.github.io/ai-interview-watchlist/"
  });

  server.registerTool(
    "list_episodes",
    {
      title: "List episodes",
      description: "Search the public 长镜 · AI (Long Lens AI) catalog. Read-only. Filters combine with AND. Results are newest-first.",
      annotations: READ_ONLY,
      inputSchema: z.object({
        query: z.string().trim().max(200).optional().describe("Case-insensitive match against title, guest, show, summary, and id"),
        show: z.string().trim().max(120).optional().describe("Show slug or name, for example a16z, hard-fork, or 硅谷101"),
        topic: z.string().trim().max(120).optional().describe("Topic slug or category name: lab, founders, vc, china, or the Chinese category"),
        category: z.string().trim().max(120).optional().describe("Alias of topic"),
        hasEssay: z.boolean().optional().describe("When set, keep only episodes that have or lack a close read"),
        hasAnalysis: z.boolean().optional().describe("When set, keep only episodes that have or lack analysis"),
        hasTranscript: z.boolean().optional().describe("When set, keep only episodes that have or lack a transcript"),
        limit: z.number().int().min(1).max(100).optional().describe("Maximum rows to return. Default 20, maximum 100")
      })
    },
    async (args) => {
      try {
        return asText(await listEpisodes(args || {}));
      } catch (err) {
        return asError(err);
      }
    }
  );

  server.registerTool(
    "get_episode",
    {
      title: "Get episode",
      description: "Fetch one published episode by id from data/episodes/<id>.json. Read-only. Returns the stored JSON; it does not invent essay, analysis, or transcript text.",
      annotations: READ_ONLY,
      inputSchema: z.object({
        id: z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9._-]+$/).describe("Episode id")
      })
    },
    async ({ id }) => {
      try {
        return asText(await getEpisode(id));
      } catch (err) {
        return asError(err);
      }
    }
  );

  server.registerTool(
    "site_info",
    {
      title: "Site info",
      description: "Title, lastUpdated, episode counts, and the public RSS feed URL for 长镜 · AI. Read-only.",
      annotations: READ_ONLY,
      inputSchema: z.object({})
    },
    async () => {
      try {
        return asText(await siteInfo());
      } catch (err) {
        return asError(err);
      }
    }
  );

  return server;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  void serveStdio(createServer);
  console.error("long-lens-ai MCP server (read-only) on stdio; catalog " + dataBase());
}
