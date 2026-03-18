import { Pool, type QueryResult, type QueryResultRow } from "pg";

let cachedPool: Pool | null = null;

function isLocalDatabaseUrl(databaseUrl: string): boolean {
  try {
    const url = new URL(databaseUrl);
    return ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch {
    return false;
  }
}

function createPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  return new Pool({
    connectionString: databaseUrl,
    ssl: isLocalDatabaseUrl(databaseUrl) ? false : { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000
  });
}

function getPool(): Pool {
  if (cachedPool) {
    return cachedPool;
  }

  cachedPool = createPool();
  return cachedPool;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function query<T extends QueryResultRow>(
  text: string,
  values: unknown[] = []
): Promise<QueryResult<T>> {
  const pool = getPool();
  return pool.query<T>(text, values);
}

export async function withTransaction<T>(fn: (queryFn: typeof query) => Promise<T>): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();

  const queryFn = async <Row extends QueryResultRow>(
    text: string,
    values: unknown[] = []
  ): Promise<QueryResult<Row>> => {
    return client.query<Row>(text, values);
  };

  try {
    await client.query("BEGIN");
    const result = await fn(queryFn as typeof query);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
