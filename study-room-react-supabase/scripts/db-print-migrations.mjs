import fs from "node:fs";
import path from "node:path";

const migrationsDir = path.resolve("supabase", "migrations");
if (!fs.existsSync(migrationsDir)) {
  console.error(`Missing migrations dir: ${migrationsDir}`);
  process.exit(1);
}

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort((a, b) => a.localeCompare(b));

const out = [];
out.push("-- Compiled migrations");
out.push(`-- Generated at: ${new Date().toISOString()}`);
out.push("");

for (const f of files) {
  const full = path.join(migrationsDir, f);
  const sql = fs.readFileSync(full, "utf8").trimEnd();
  out.push(`-- ===== ${f} =====`);
  out.push(sql);
  out.push("");
}

process.stdout.write(out.join("\n"));
