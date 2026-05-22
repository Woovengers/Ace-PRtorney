import dotenv from "dotenv";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer as createViteServer } from "vite";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const apiDir = path.join(rootDir, "api");
const port = Number(process.env.PORT ?? 3000);

function splitPathname(url) {
  return new URL(url, `http://localhost:${port}`).pathname.split("/").filter(Boolean);
}

function matchRoute(routeParts, requestParts) {
  if (routeParts.length !== requestParts.length) return null;
  const params = {};

  for (let index = 0; index < routeParts.length; index += 1) {
    const routePart = routeParts[index];
    const requestPart = requestParts[index];
    const dynamic = routePart.match(/^\[([^\]]+)\]$/);

    if (dynamic) {
      params[dynamic[1]] = decodeURIComponent(requestPart);
      continue;
    }

    if (routePart !== requestPart) return null;
  }

  return params;
}

async function discoverApiRoutes(dir = apiDir, prefix = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const routes = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      routes.push(...await discoverApiRoutes(fullPath, [...prefix, entry.name]));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".js") && !prefix.includes("_lib")) {
      routes.push({
        file: fullPath,
        parts: [...prefix, entry.name.replace(/\.js$/, "")],
      });
    }
  }

  return routes;
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return undefined;

  const contentType = request.headers["content-type"] ?? "";
  if (contentType.includes("application/json")) return JSON.parse(raw);
  return raw;
}

function createApiResponse(response) {
  return {
    statusCode: 200,
    getHeader(name) {
      return response.getHeader(name);
    },
    setHeader(name, value) {
      response.setHeader(name, value);
    },
    status(code) {
      this.statusCode = code;
      response.statusCode = code;
      return this;
    },
    json(payload) {
      if (!response.hasHeader("Content-Type")) {
        response.setHeader("Content-Type", "application/json; charset=utf-8");
      }
      response.statusCode = this.statusCode;
      response.end(JSON.stringify(payload));
    },
    end(value) {
      response.statusCode = this.statusCode;
      response.end(value);
    },
  };
}

const routes = await discoverApiRoutes();
const vite = await createViteServer({
  root: rootDir,
  server: { middlewareMode: true },
  appType: "spa",
});

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://localhost:${port}`);
  if (!url.pathname.startsWith("/api/")) {
    vite.middlewares(request, response);
    return;
  }

  const requestParts = splitPathname(url.pathname).slice(1);
  const route = routes
    .map((candidate) => ({ candidate, params: matchRoute(candidate.parts, requestParts) }))
    .find((result) => result.params);

  if (!route) {
    response.statusCode = 404;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: "not_found", message: "API route not found" }));
    return;
  }

  try {
    const module = await import(`${pathToFileURL(route.candidate.file).href}?t=${Date.now()}`);
    const apiRequest = Object.assign(request, {
      body: await readBody(request),
      query: Object.fromEntries(url.searchParams.entries()),
    });
    Object.assign(apiRequest.query, route.params);

    await module.default(apiRequest, createApiResponse(response));
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ error: "dev_api_failed", message: error.message }));
  }
});

server.listen(port, () => {
  console.log(`Local app with API routes: http://localhost:${port}`);
});
