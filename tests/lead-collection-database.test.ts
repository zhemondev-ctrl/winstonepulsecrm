import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
const db = new PGlite();
const agent = "10000000-0000-4000-8000-000000000001";
const other = "10000000-0000-4000-8000-000000000002";
const key = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const fields = (n: number) => ({ name: "Synthetic customer", phoneNumber: `88017${String(n).padStart(8,"0")}`, notes: "Supplied note", address: "Supplied address", referenceBy: "Customer-supplied reference" });
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE profiles(id uuid PRIMARY KEY,user_id uuid,is_active boolean,approval_status text,name text);
    CREATE TABLE user_roles(user_id uuid,role text);
    CREATE TABLE agent_briefing_acknowledgements(agent_id uuid,business_date date,policy_version text);
    CREATE TABLE leads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text,phone_number text UNIQUE,company text,notes text,address text,serial_no text,work_date date,reference_by text,source text,status text,assigned_to uuid,assigned_agent_id uuid,assignment_source text,created_at timestamptz DEFAULT now());
    CREATE TABLE lead_events(id uuid DEFAULT gen_random_uuid(),lead_id uuid,agent_id uuid,kind text,detail text);
    CREATE TABLE audit_logs(id uuid DEFAULT gen_random_uuid(),action text,entity_type text,entity_id text,actor_profile_id uuid,metadata jsonb);
    CREATE FUNCTION extract_bd_phones(raw text) RETURNS SETOF text LANGUAGE sql AS $$ SELECT regexp_replace(raw,'[^0-9]','','g') WHERE length(regexp_replace(raw,'[^0-9]','','g'))>=10 $$;
    CREATE FUNCTION lead_phone_status(raw text) RETURNS TABLE(canonical_phones text[],existing_lead_id uuid,already_worked boolean) LANGUAGE sql AS $$
      SELECT ARRAY[regexp_replace(raw,'[^0-9]','','g')],(SELECT id FROM leads WHERE regexp_replace(phone_number,'[^0-9]','','g')=regexp_replace(raw,'[^0-9]','','g') LIMIT 1),false $$;`);
  await db.exec(readFileSync(new URL("../docs/agent-lead-collection.sql", import.meta.url),"utf8"));
}, 30000);
beforeEach(async () => {
  await db.exec("TRUNCATE agent_lead_submission_requests,agent_lead_receipts,agent_lead_drafts,lead_events,audit_logs,leads,agent_briefing_acknowledgements,user_roles,profiles CASCADE");
  await db.query("INSERT INTO profiles VALUES($1,$1,true,'approved','Agent'),($2,$2,true,'approved','Other');", [agent,other]);
  await db.query("INSERT INTO user_roles VALUES($1,'agent'),($2,'agent');", [agent,other]);
  await db.query("INSERT INTO agent_briefing_acknowledgements SELECT id,(now() AT TIME ZONE 'Asia/Dhaka')::date,'2026-09-30-v1' FROM profiles");
});
afterAll(async () => { await db.close(); });
const submit = async (n: number, rows = [fields(n)], who = agent) => (await db.query<{ result: { results: { status: string; receiptId: string | null }[]; used: number } }>("SELECT submit_collected_leads_atomic($1,$2,$3::jsonb) result", [who,key(n),JSON.stringify(rows)])).rows[0]?.result;
const count = async (table: string) => (await db.query<{ n: number }>(`SELECT count(*)::int n FROM ${table}`)).rows[0]?.n;
describe("atomic private agent collection", () => {
  it("accepts ten new personal leads and refuses the eleventh without partial rows", async () => {
    const result = await submit(1,Array.from({ length: 10 },(_,i)=>fields(i+1))); expect(result?.used).toBe(10);
    await expect(submit(11)).rejects.toThrow("Daily self lead cap"); expect(await count("leads")).toBe(10); expect(await count("agent_lead_receipts")).toBe(10);
  });
  it("replays exactly once and never clears an existing duplicate", async () => {
    const first = await submit(1); expect(await submit(1)).toEqual(first);
    const dup = await submit(2,[fields(1)]); expect(dup?.results[0]?.status).toBe("duplicate"); expect(dup?.results[0]?.receiptId).toBeNull(); expect(dup?.used).toBe(1); expect(await count("leads")).toBe(1);
  });
  it("new leads are unassigned and preserve supplied details, collector and evidence", async () => {
    await submit(1); const row = (await db.query("SELECT * FROM leads")).rows[0];
    expect(row).toMatchObject({ assigned_to: null, assigned_agent_id: null, assignment_source: null, source: "agent_app", notes: "Supplied note", address: "Supplied address", reference_by: "Customer-supplied reference" });
    expect(await count("audit_logs")).toBe(1); expect(await count("lead_events")).toBe(0);
    const receipt = (await db.query("SELECT agent_id FROM agent_lead_receipts")).rows[0]; expect(receipt?.agent_id).toBe(agent);
  });
  it("a failed audit rolls back the lead, receipt and request together", async () => {
    await db.exec("CREATE FUNCTION collection_test_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit fault'; END $$; CREATE TRIGGER collection_fault BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION collection_test_audit_fault()");
    try { await expect(submit(1)).rejects.toThrow("synthetic audit fault"); expect(await count("leads")).toBe(0); expect(await count("agent_lead_receipts")).toBe(0); expect(await count("agent_lead_submission_requests")).toBe(0); }
    finally { await db.exec("DROP TRIGGER collection_fault ON audit_logs; DROP FUNCTION collection_test_audit_fault()"); }
  });
  it("drafts do not consume allowance and another agent cannot change them", async () => {
    const draft = key(50); await db.query("SELECT save_agent_lead_draft($1,$2,0,$3::jsonb)",[agent,draft,JSON.stringify(fields(1))]);
    expect(await count("leads")).toBe(0); expect(await count("agent_lead_receipts")).toBe(0);
    await expect(db.query("SELECT save_agent_lead_draft($1,$2,1,$3::jsonb)",[other,draft,JSON.stringify(fields(2))])).rejects.toThrow("Draft changed");
    const own = (await db.query<{ r: { drafts: unknown[] } }>("SELECT read_agent_lead_collection($1) r",[other])).rows[0]?.r; expect(own?.drafts).toHaveLength(0);
  });
  it("transfer hides lead identity and cannot restore the collector's daily slots", async () => {
    await submit(1); await db.query("UPDATE leads SET assigned_to=$1,assigned_agent_id=$1",[other]);
    const r = (await db.query<{ r: { used: number; receipts: { lead: unknown; state: string }[] } }>("SELECT read_agent_lead_collection($1) r",[agent])).rows[0]?.r;
    expect(r?.used).toBe(1); expect(r?.receipts[0]).toMatchObject({ lead: null,state: "unavailable" });
  });
  it("ordinary browser callers cannot invoke privileged submission or read tables", async () => {
    await db.exec("SET ROLE authenticated");
    try { await expect(submit(1)).rejects.toThrow("permission denied"); await expect(db.query("SELECT * FROM agent_lead_drafts")).rejects.toThrow("permission denied"); }
    finally { await db.exec("RESET ROLE"); }
  });
  it("receipts and request history are immutable", async () => {
    await submit(1); await expect(db.exec("DELETE FROM agent_lead_receipts")).rejects.toThrow("append-only"); await expect(db.exec("UPDATE agent_lead_submission_requests SET result='{}'")).rejects.toThrow("append-only");
  });
  it("a lost draft-save response replays without duplicating or changing its fields", async () => {
    const args = [agent,key(99),JSON.stringify(fields(1))];
    const first = await db.query("SELECT save_agent_lead_draft($1,$2,0,$3::jsonb) r",args);
    expect((await db.query("SELECT save_agent_lead_draft($1,$2,0,$3::jsonb) r",args)).rows).toEqual(first.rows);
    expect(await count("agent_lead_drafts")).toBe(1);
  });
  it("reopens a private draft, submits it, and reads its receipt back", async () => {
    const id=key(99); const payload=JSON.stringify(fields(1));
    await db.query("SELECT save_agent_lead_draft($1,$2,0,$3::jsonb)",[agent,id,payload]);
    const draft=(await db.query<{ r: { drafts: { fields: unknown }[] } }>("SELECT read_agent_lead_collection($1) r",[agent])).rows[0]?.r.drafts[0]; expect(draft?.fields).toEqual(fields(1));
    await db.query("SELECT submit_collected_leads_atomic($1,$2,$3::jsonb,$4,1)",[agent,key(1),JSON.stringify([fields(1)]),id]);
    const result=(await db.query<{ r: { drafts: unknown[]; receipts: { state: string; lead: unknown }[] } }>("SELECT read_agent_lead_collection($1) r",[agent])).rows[0]?.r;
    expect(result?.drafts).toHaveLength(0); expect(result?.receipts[0]).toMatchObject({ state: "awaiting_leadhub",lead: null });
  });
});