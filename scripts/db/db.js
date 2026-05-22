import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

export function createPool() {
  const connectionString = process.env.DATABASE_POOLER_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL or DATABASE_POOLER_URL is required");
  }

  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 4,
  });
}

export function formatDbError(error) {
  if (error?.code === "EHOSTUNREACH" || error?.code === "ENETUNREACH") {
    return [
      `${error.code}: cannot reach the configured Postgres host.`,
      "Supabase direct database URLs require IPv6. If this network is IPv4-only, add DATABASE_POOLER_URL from Supabase Dashboard > Connect > Session pooler and rerun the command.",
    ].join(" ");
  }

  return error?.message ?? String(error);
}

export async function withClient(callback) {
  const pool = createPool();
  const client = await pool.connect();

  try {
    return await callback(client);
  } finally {
    client.release();
    await pool.end();
  }
}

export async function transaction(client, callback) {
  await client.query("begin");
  try {
    const result = await callback();
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}
