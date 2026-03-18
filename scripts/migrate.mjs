import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;

async function run() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const schemaPath = path.resolve(thisDir, "../db/schema.sql");
  const sql = await readFile(schemaPath, "utf8");

  const client = new Client({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1") ? false : { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    await client.query(sql);
    console.log("Schema migration completed.");
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
