import { describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ fail: false }));
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => ({ inputValidator: () => ({ handler: (fn: any) => fn }) }) }));
vi.mock('@/lib/admin-gate.server', () => ({ requireAdminToken: () => {} }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: {
 from: (table: string) => {
  const b: any = { select: () => b, order: () => b, range: async () => ({ error: m.fail ? { message: 'unavailable' } : null, data: table === 'leads' ? [{ id: 'l', phone_number: '01805049666', assigned_to: null, assigned_agent_id: 'a', created_at: '2026-11-15' }] : table === 'call_recordings' ? [{ id:'1', upload_status:'pending', storage_path:null, audio_url:null, sync_status:'uploaded' }, { id:'2', upload_status:'uploaded', storage_path:'audio', sync_status:'failed', transcription_text:null }] : [] }) }; return b;
 }, storage: { from: () => ({ list: async () => ({ error:null }) }) }
} }));
import { runIngestDiagnostics } from '@/lib/ingest.functions';
describe('ingest diagnostic evidence', () => {
 it('separates absent audio from stored processing failure and never labels either an upload failure', async () => {
  m.fail = false;
  const r = await (runIngestDiagnostics as any)({ data: { adminToken:'test' } });
  const count = (key: string) => r.problems.find((p:any) => p.key === key)?.count;
  expect(count('audio_absent')).toBe(1); expect(count('analysis_failed')).toBe(1); expect(count('failed_sync')).toBe(0); expect(count('no_transcript')).toBe(1);
 });
 it('recognizes canonical assignment even if legacy assigned_to is empty', async () => {
  m.fail=false; const r=await (runIngestDiagnostics as any)({data:{adminToken:'test'}});
  expect(r.problems.find((p:any)=>p.key==='unassigned').count).toBe(0);
 });
 it('fails instead of presenting partial reads as verified totals', async () => {
  m.fail=true; await expect((runIngestDiagnostics as any)({data:{adminToken:'test'}})).rejects.toThrow('incomplete data read'); m.fail=false;
 });
});
