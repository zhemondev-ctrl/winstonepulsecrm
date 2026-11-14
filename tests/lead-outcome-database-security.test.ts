import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

// Exercise the actual existing migration offline, never the shared live database.
const db = new PGlite();
beforeAll(async () => {
  await db.exec(`CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user_id', true),'')::uuid $$;
    CREATE TABLE public.leads(id integer PRIMARY KEY, name text, work_state text DEFAULT 'pending', status text DEFAULT 'pending', outcome_category text, temperature text, grade text, classified_at timestamptz, classified_by uuid);`);
  await db.exec(readFileSync(new URL("../drizzle/migrations/0146_guard_lead_work_outcome.sql", import.meta.url), "utf8"));
}, 30000);
beforeEach(async () => {
  await db.exec("SELECT set_config('test.user_id','',false); TRUNCATE leads; INSERT INTO leads(id,name) VALUES(1,'Synthetic lead'); SELECT set_config('test.user_id','10000000-0000-4000-8000-000000000001',false);");
});
afterAll(async () => { await db.close(); });

for (const patch of ["work_state='completed',temperature='hot',grade='A'", "status='closed'", "work_state='completed'", "temperature='hot'", "grade='A'", "classified_at=now()", "classified_by=auth.uid()", "outcome_category='not_interested'"]) {
  it(`blocks signed-in direct decision writes: ${patch}`, async () => {
    await expect(db.exec(`UPDATE leads SET ${patch} WHERE id=1`)).rejects.toThrow("submitted call report");
    expect((await db.query("SELECT work_state,status,temperature,grade FROM leads WHERE id=1")).rows[0]).toEqual({ work_state: "pending", status: "pending", temperature: null, grade: null });
  });
}
it("rejects inserting a pre-completed self-rated lead", async () => {
  await expect(db.exec("INSERT INTO leads(id,work_state,temperature,grade) VALUES(2,'completed','hot','A')")).rejects.toThrow("submitted call report");
});
it("allows ordinary non-decision edits", async () => {
  await db.exec("UPDATE leads SET name='Updated synthetic lead' WHERE id=1");
  expect((await db.query("SELECT name FROM leads")).rows[0]?.name).toBe("Updated synthetic lead");
});
it("preserves server finalization without an end-user JWT", async () => {
  await db.exec("SELECT set_config('test.user_id','',false); UPDATE leads SET work_state='completed',status='closed',temperature='hot',grade='A' WHERE id=1;");
  expect((await db.query("SELECT work_state FROM leads")).rows[0]?.work_state).toBe("completed");
});