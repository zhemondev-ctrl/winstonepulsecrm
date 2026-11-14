import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CollectedLeadInput, LeadDraftFields } from "./lead-collection";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, "Invalid date");
const Filters = z.object({ mode: z.enum(["drafts", "receipts", "assigned"]).default("receipts"), query: z.string().trim().max(120).default(""), from: date.nullable().optional(), to: date.nullable().optional(), offset: z.number().int().min(0).max(50000).default(0) }).refine(v => !v.from || !v.to || v.from <= v.to, "From must not follow To");
export const readMyLeadCollection = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => Filters.parse(value ?? {}))
  .handler(async ({ data }) => {
    const { collectionActor, readCollection } = await import("./lead-collection.server");
    return readCollection(await collectionActor(), data);
  });

export const saveMyLeadDraft = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => z.object({ id: z.string().uuid(), revision: z.number().int().min(0), fields: LeadDraftFields }).parse(value))
  .handler(async ({ data }) => {
    const { collectionActor, collectionDb, collectionError } = await import("./lead-collection.server");
    const agent = await collectionActor(true);
    const { data: result, error } = await (await collectionDb()).rpc("save_agent_lead_draft", { _agent: agent, _id: data.id, _revision: data.revision, _fields: data.fields });
    if (error) throw collectionError(error);
    return z.object({ id: z.string().uuid(), revision: z.number().int(), updatedAt: z.string(), fields: LeadDraftFields }).parse(result);
  });

export const submitMyCollectedLead = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => z.object({ requestKey: z.string().uuid(), fields: CollectedLeadInput, draftId: z.string().uuid().nullable().optional(), revision: z.number().int().nullable().optional() }).parse(value))
  .handler(async ({ data }) => {
    const { collectionActor, submitCollection } = await import("./lead-collection.server");
    return submitCollection(await collectionActor(true), data.requestKey, [data.fields], data.draftId, data.revision);
  });