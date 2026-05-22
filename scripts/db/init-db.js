import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatDbError, withClient } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.join(__dirname, "schema.sql");

async function main() {
  const schemaSql = await fs.readFile(schemaPath, "utf8");

  await withClient(async (client) => {
    await client.query(schemaSql);
  });

  console.log("Database schema is ready.");
}

main().catch((error) => {
  console.error(formatDbError(error));
  process.exitCode = 1;
});
