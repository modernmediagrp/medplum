/*
 * Generated by @medplum/generator
 * Do not edit manually.
 */

import { PoolClient } from 'pg';

export async function run(client: PoolClient): Promise<void> {
  await client.query(`ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMPTZ`);
  await client.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "Task_dueDate_idx" ON "Task" ("dueDate")`);
}
