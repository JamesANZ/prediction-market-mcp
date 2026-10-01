import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { itemsFromCommandOutput } from "../src/evidence/normalize.js";
import { buildSearchQueries } from "../src/evidence/queries.js";
import { prepareEvidence } from "../src/evidence/rank.js";
import { RetrievedItem } from "../src/evidence/types.js";
import { NOW } from "./helpers.js";

const start = new Date(NOW.getTime() - 24 * 60 * 60 * 1000);

function item(overrides: Partial<RetrievedItem>): RetrievedItem {
  return {
    source: "web",
    backend: "exa-via-mcporter",
    title: "Fed holds rates",
    url: "https://example.com/story",
    publishedAt: "2026-09-30T12:00:00.000Z",
    author: "Desk",
    excerpt: "The Fed left rates unchanged.",
    retrievedAt: NOW.toISOString(),
    truncated: false,
    ...overrides,
  };
}

describe("evidence preparation", () => {
  it("builds one executed query and keeps caller queries in order", () => {
    const generated = buildSearchQueries("Will the Fed cut rates?", "Yes");
    assert.deepEqual(generated, [{ text: "Will the Fed cut rates", origin: "generated", executed: true }]);

    const named = buildSearchQueries("Will the Fed cut rates?", "50 bps");
    assert.equal(named[1].executed, false);
    assert.match(named[1].text, /50 bps/);

    const caller = buildSearchQueries("ignored", "Yes", [" first query \n", "second"]);
    assert.equal(caller[0].origin, "caller");
    assert.equal(caller[0].executed, true);
    assert.equal(caller[0].text, "first query");
    assert.equal(caller[1].executed, false);
  });

  it("drops duplicate urls and near-duplicate titles, and keeps distinct stories", () => {
    const prepared = prepareEvidence(
      [
        item({ url: "https://example.com/story?utm_source=x", publishedAt: "2026-09-30T10:00:00.000Z" }),
        item({ url: "https://example.com/story", publishedAt: "2026-09-30T18:00:00.000Z", excerpt: "newer" }),
        item({ title: "The Fed holds rates", url: "https://example.com/copy", publishedAt: "2026-09-30T11:00:00.000Z" }),
        item({
          title: "Senate passes a shipping bill",
          url: "https://example.com/senate",
          publishedAt: "2026-09-30T16:00:00.000Z",
          excerpt: "Unrelated legislation advanced.",
        }),
      ],
      "Will the Fed cut rates?",
      start,
      NOW,
      8,
    );
    assert.equal(prepared.evidence.length, 2);
    assert.equal(prepared.evidence.find((entry) => entry.url.includes("example.com/story"))?.excerpt, "newer");
    assert.ok(prepared.evidence.some((entry) => entry.url.includes("senate")));
  });

  it("ranks an in-window item ahead of a stale item", () => {
    const prepared = prepareEvidence(
      [
        item({
          title: "Old Fed comment",
          url: "https://example.com/old",
          publishedAt: "2026-09-20T00:00:00.000Z",
          excerpt: "Fed officials spoke last week.",
        }),
        item({
          title: "Fresh Fed comment",
          url: "https://example.com/new",
          publishedAt: "2026-09-30T22:00:00.000Z",
          excerpt: "Fed officials spoke today.",
        }),
      ],
      "Fed officials",
      start,
      NOW,
      8,
    );
    assert.equal(prepared.evidence[0].url, "https://example.com/new");
    assert.equal(prepared.evidence[0].stale, false);
    assert.equal(prepared.evidence[1].stale, true);
  });

  it("truncates very large retrieved text", () => {
    const parsed = itemsFromCommandOutput(
      "web",
      "exa-via-mcporter",
      JSON.stringify({
        results: [
          {
            title: "Fed desk",
            url: "https://example.com/long",
            publishedDate: "2026-09-30T12:00:00.000Z",
            text: `${"word ".repeat(20)}${"x".repeat(50_000)}`,
          },
        ],
      }),
      NOW.toISOString(),
    );
    assert.equal(parsed.items.length, 1);
    assert.equal(parsed.items[0].truncated, true);
    assert.ok(parsed.items[0].excerpt.length <= 480);
  });

  it("rejects non-http urls and unparseable documents", () => {
    const parsed = itemsFromCommandOutput(
      "web",
      "exa-via-mcporter",
      JSON.stringify({ results: [{ title: "bad", url: "javascript:alert(1)", text: "nope" }] }),
      NOW.toISOString(),
    );
    assert.equal(parsed.items.length, 0);
    assert.equal(parsed.skipped, 1);

    const garbage = itemsFromCommandOutput("web", "exa-via-mcporter", "not json {{{", NOW.toISOString());
    assert.equal(garbage.items.length, 0);
  });
});
