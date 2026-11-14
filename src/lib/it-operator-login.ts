export type OperatorAccount = {
  scope: string;
  readOnly: boolean;
  active: boolean | null;
  approval: string | null;
  profile: { role: string } | null;
};

export async function verifyItOperator(readAccount: () => Promise<OperatorAccount>, signOut: () => Promise<unknown>) {
  const account = await readAccount();
  if (account.scope !== "authority" || account.readOnly || account.profile?.role !== "admin" || account.active !== true || account.approval !== "approved") {
    await signOut();
    throw new Error("এই অ্যাকাউন্টের সক্রিয় ও অনুমোদিত IT Operator অনুমতি নেই।");
  }
}