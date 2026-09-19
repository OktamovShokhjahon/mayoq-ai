import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "./error-codes";

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) sources(path, out);
    else if (path.endsWith(".ts") && !path.endsWith(".test.ts")) out.push(path);
  }
  return out;
}

const corpus = sources(join(__dirname, "..")).map((path) => readFileSync(path, "utf8")).join("\n");

describe("error codes", () => {
  // The map is keyed by message, so an edited message would silently stop
  // being translated and quietly fall back to English. This catches that.
  it("maps only messages the code actually throws", () => {
    const orphans = Object.keys(ERROR_CODES).filter((message) => !corpus.includes(`"${message}"`));
    expect(orphans).toEqual([]);
  });

  it("gives every message its own code", () => {
    const codes = Object.values(ERROR_CODES);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
