import { env } from "cloudflare:workers";

type ImportKind = "Creative" | "Livestream";
type ImportRecord = { id:string; brand:string; file:string; kind:ImportKind; period:string; rows:number; importedAt:string; builtin?:boolean };
type ChunkRow = { import_id:string; kind:ImportKind; chunk_index:number; payload_json:string };

declare global {
  var __GMV_MAX_ENV__: { DB?: D1Database } | undefined;
}

const database = () => (env as { DB?: D1Database }).DB || globalThis.__GMV_MAX_ENV__?.DB;

async function ensureTables(db: D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS brands (name TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE TABLE IF NOT EXISTS imports (id TEXT PRIMARY KEY, brand TEXT NOT NULL, file TEXT NOT NULL, kind TEXT NOT NULL, period TEXT NOT NULL, rows INTEGER NOT NULL DEFAULT 0, imported_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
    db.prepare("CREATE INDEX IF NOT EXISTS imports_lookup ON imports (brand, kind, period)"),
    db.prepare("CREATE TABLE IF NOT EXISTS import_chunks (import_id TEXT NOT NULL, chunk_index INTEGER NOT NULL, kind TEXT NOT NULL, payload_json TEXT NOT NULL, PRIMARY KEY(import_id, chunk_index))"),
  ]);
}

const json = (payload: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(payload), { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });

export async function GET() {
  const db = database();
  if (!db) return json({ brands: [], imports: [], creative: [], live: [] });
  await ensureTables(db);
  const brandsResult = await db.prepare("SELECT name FROM brands ORDER BY created_at ASC").all<{ name:string }>();
  const importsResult = await db.prepare("SELECT id, brand, file, kind, period, rows, imported_at AS importedAt FROM imports ORDER BY created_at DESC").all<ImportRecord>();
  const chunksResult = await db.prepare("SELECT import_id, kind, chunk_index, payload_json FROM import_chunks ORDER BY import_id ASC, chunk_index ASC").all<ChunkRow>();
  const creative: unknown[] = [];
  const live: unknown[] = [];
  for (const chunk of chunksResult.results || []) {
    const rows = JSON.parse(chunk.payload_json || "[]") as unknown[];
    if (chunk.kind === "Creative") creative.push(...rows);
    if (chunk.kind === "Livestream") live.push(...rows);
  }
  return json({ brands: (brandsResult.results || []).map((row) => row.name), imports: importsResult.results || [], creative, live });
}

export async function POST(request: Request) {
  const db = database();
  if (!db) return new Response("D1 binding DB belum tersedia di deployment ini.", { status: 503 });
  await ensureTables(db);
  const body = await request.json() as { action?:string; record?:ImportRecord; importId?:string; kind?:ImportKind; chunkIndex?:number; rows?:unknown[]|number };

  if (body.action === "start" && body.record) {
    const record = body.record;
    const previous = await db.prepare("SELECT id FROM imports WHERE brand = ? AND kind = ? AND period = ?").bind(record.brand, record.kind, record.period).all<{ id:string }>();
    const deletes = (previous.results || []).flatMap((row) => [
      db.prepare("DELETE FROM import_chunks WHERE import_id = ?").bind(row.id),
      db.prepare("DELETE FROM imports WHERE id = ?").bind(row.id),
    ]);
    await db.batch([
      ...deletes,
      db.prepare("INSERT OR IGNORE INTO brands (name) VALUES (?)").bind(record.brand),
      db.prepare("INSERT INTO imports (id, brand, file, kind, period, rows, imported_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(record.id, record.brand, record.file, record.kind, record.period, 0, record.importedAt),
    ]);
    return json({ ok: true });
  }

  if (body.action === "chunk" && body.importId && typeof body.chunkIndex === "number" && Array.isArray(body.rows)) {
    await db.prepare("INSERT OR REPLACE INTO import_chunks (import_id, chunk_index, kind, payload_json) VALUES (?, ?, ?, ?)")
      .bind(body.importId, body.chunkIndex, body.kind || "Creative", JSON.stringify(body.rows)).run();
    return json({ ok: true });
  }

  if (body.action === "finish" && body.importId && typeof body.rows === "number") {
    await db.prepare("UPDATE imports SET rows = ? WHERE id = ?").bind(body.rows, body.importId).run();
    return json({ ok: true });
  }

  return new Response("Payload import tidak lengkap.", { status: 400 });
}

export async function DELETE(request: Request) {
  const db = database();
  if (!db) return new Response("D1 binding DB belum tersedia di deployment ini.", { status: 503 });
  await ensureTables(db);
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return new Response("Import ID wajib diisi.", { status: 400 });
  await db.batch([
    db.prepare("DELETE FROM import_chunks WHERE import_id = ?").bind(id),
    db.prepare("DELETE FROM imports WHERE id = ?").bind(id),
  ]);
  return json({ ok: true });
}
