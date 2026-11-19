// A stand-in for the shipsite.sh API, for testing the action without an
// account. It records every request to requests.json next to this file's
// working directory and answers like the real API would.
import { createServer } from "node:http";
import { writeFileSync } from "node:fs";

const port = Number(process.env.PORT || 8787);
const requests = [];

const site = (overrides = {}) => ({
  id: "site_test1234",
  url: "https://site_test1234.shipsite.sh",
  permanent_url: "https://site_test1234.shipsite.sh",
  name: null,
  files: ["index.html"],
  domains: [],
  password_protected: false,
  pinned: false,
  expires_at: "2030-01-01T00:00:00.000Z",
  ...overrides,
});

createServer((req, res) => {
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    const body = raw ? JSON.parse(raw) : null;
    requests.push({ method: req.method, path: req.url, auth: req.headers.authorization, body });
    writeFileSync("requests.json", JSON.stringify(requests, null, 2));

    const send = (status, payload) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
    };

    if (req.headers.authorization !== "Bearer sk_live_fake") {
      return send(401, { error: { code: "unauthorized", message: "Invalid API key. Check the SHIPSITE_API_KEY secret." } });
    }
    if (req.method === "POST" && req.url === "/v1/sites") {
      const name = body?.name ?? null;
      return send(201, site({
        name,
        url: `https://${name || "site_test1234"}.shipsite.sh`,
        files: Object.keys(body?.files || {}),
        password_protected: typeof body?.password === "string",
      }));
    }
    if (req.method === "GET" && req.url === "/v1/sites/site_test1234") return send(200, site({ files: ["index.html", "old.css"] }));
    if (req.method === "PUT" && req.url === "/v1/sites/site_test1234") return send(200, site());
    if (req.method === "POST" && req.url === "/v1/sites/site_test1234/pin") {
      return send(200, { id: "site_test1234", pinned: true, expires_at: null });
    }
    send(404, { error: { code: "not_found", message: `No route for ${req.method} ${req.url}` } });
  });
}).listen(port, "127.0.0.1", () => console.log(`fake shipsite API on http://127.0.0.1:${port}`));
