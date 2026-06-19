import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SESSION_FILE = join(process.cwd(), ".session-id");

export async function saveSession(sessionId: string): Promise<void> {
  await writeFile(SESSION_FILE, sessionId, "utf8");
  console.log(`Session saved: ${sessionId}`);
}

export async function loadSession(): Promise<string | null> {
  try {
    return (await readFile(SESSION_FILE, "utf8")).trim();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
