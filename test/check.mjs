// Checks what the workflow's action steps reported and what they sent to
// the stand-in API.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const env = process.env;
assert.equal(env.CREATE_URL, "https://my-docs.shipsite.sh");
assert.equal(env.CREATE_ID, "site_test1234");
assert.equal(env.CREATE_PERMANENT, "https://site_test1234.shipsite.sh");
assert.equal(env.CREATE_EXPIRES, "2030-01-01T00:00:00.000Z");
assert.equal(env.UPDATE_URL, "https://site_test1234.shipsite.sh");
assert.equal(env.UPDATE_EXPIRES, "", "a pinned site has no expiry");
assert.equal(env.WRONG_KEY, "failure");
assert.equal(env.NO_FOLDER, "failure");

const requests = JSON.parse(readFileSync("requests.json", "utf8")).filter((r) => r.path !== "/");
const lines = requests.map((r) => `${r.method} ${r.path}`);
assert.deepEqual(lines, [
  "POST /v1/sites",
  // Updating without "keep" first reads the site, to remove files that are gone.
  "GET /v1/sites/site_test1234",
  "PUT /v1/sites/site_test1234",
  "POST /v1/sites/site_test1234/pin",
  // The wrong key is refused by the API; the missing folder never reaches it.
  "POST /v1/sites",
]);

const [create, , update] = requests;
assert.equal(create.auth, "Bearer sk_live_fake");
assert.equal(create.body.name, "my-docs");
assert.equal(create.body.ttl, 604800);
assert.equal(create.body.password, "open-sesame");
assert.deepEqual(Object.keys(create.body.files), ["index.html"]);
// old.css is on the site but not in the folder, so the update removes it.
assert.equal(update.body.files["old.css"], null);
assert.ok("index.html" in update.body.files);

console.log("All checks passed.");
