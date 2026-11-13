import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run migrations.");
}

const pool = new Pool({ connectionString, max: 1 });
try {
  for (const migrationName of ["001_initial.sql", "002_multi_user.sql"]) {
    const migration = await readFile(new URL(`../db/migrations/${migrationName}`, import.meta.url), "utf8");
    await pool.query(migration);
    console.log(`Applied db/migrations/${migrationName}`);
  }
} finally {
  await pool.end();
}
