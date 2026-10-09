import { beforeAll, beforeEach, afterAll } from "vitest";
import { db } from "../db.ts";

beforeAll(async () => {
  // Get current database name and throw if it doesn't end in test
  const row = await db.one("SELECT current_database()");
  const dbName: string = row.current_database;
  if (!dbName.endsWith("_test"))
    throw new Error(
      `Refusing to run tests against "${dbName}". The database name must end in "_test".`,
    );
});

beforeEach(async () => {
  await db.none("TRUNCATE auth CASCADE");
});

afterAll(async () => {
  await db.$pool.end();
});
