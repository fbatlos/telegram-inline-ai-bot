import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DailyLimiter } from "../src/limiter.js";
import { JsonUsageStore } from "../src/usage-store.js";

function tempFile(): { path: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "usage-test-"));
  return {
    path: join(dir, "nested", "usage.json"),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

test("counts survive a restart (new limiter, same file)", () => {
  const f = tempFile();
  try {
    const now = () => new Date("2026-03-10T12:00:00Z");
    const first = new DailyLimiter(2, now, new JsonUsageStore(f.path));
    assert.equal(first.tryConsume(5), true);
    assert.equal(first.tryConsume(5), true);

    const restarted = new DailyLimiter(2, now, new JsonUsageStore(f.path));
    assert.equal(restarted.tryConsume(5), false, "limit must hold after restart");
  } finally {
    f.cleanup();
  }
});

test("old days are pruned from the file on write", () => {
  const f = tempFile();
  try {
    const store = new JsonUsageStore(f.path);
    new DailyLimiter(5, () => new Date("2026-03-09T12:00:00Z"), store).tryConsume(1);
    new DailyLimiter(5, () => new Date("2026-03-10T12:00:00Z"), store).tryConsume(2);
    const saved = JSON.parse(readFileSync(f.path, "utf8"));
    assert.deepEqual(Object.keys(saved), ["2"]);
  } finally {
    f.cleanup();
  }
});

test("corrupt file starts with empty counters instead of throwing", () => {
  const f = tempFile();
  try {
    new JsonUsageStore(f.path).write({});
    writeFileSync(f.path, "{not json");
    const limiter = new DailyLimiter(1, () => new Date("2026-03-10T12:00:00Z"), new JsonUsageStore(f.path));
    assert.equal(limiter.tryConsume(1), true);
  } finally {
    f.cleanup();
  }
});
