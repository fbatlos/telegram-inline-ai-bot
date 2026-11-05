import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { UsageEntry, UsageStore } from "./limiter.js";

/** JSON file store. Writes to a temp file and renames it, so a crash never leaves a half-written file. */
export class JsonUsageStore implements UsageStore {
  constructor(private readonly path: string) {}

  read(): Record<string, UsageEntry> {
    if (!existsSync(this.path)) return {};
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.path, "utf8"));
      return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, UsageEntry>) : {};
    } catch {
      // A corrupt file must not stop the bot; it starts with empty counters.
      return {};
    }
  }

  write(data: Record<string, UsageEntry>): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2));
    renameSync(tmp, this.path);
  }
}
