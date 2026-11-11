type PasswordAuth = {
  getUser: () => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  updateUser: (input: { password: string; current_password: string }) => Promise<{ error: unknown }>;
};

/** The auth provider selects the session owner; no target email or user ID is accepted. */
export async function changeOwnPassword(auth: PasswordAuth, current: string, next: string, confirmation: string) {
  if (!current) throw new Error("বর্তমান পাসওয়ার্ড দিন।");
  if (next.length < 8) throw new Error("নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।");
  if (next !== confirmation) throw new Error("নতুন পাসওয়ার্ড দুটি মেলেনি।");
  if (current === next) throw new Error("নতুন পাসওয়ার্ডটি বর্তমান পাসওয়ার্ড থেকে আলাদা হতে হবে।");
  const { data, error } = await auth.getUser();
  if (error || !data.user) throw new Error("আবার নিজের IT অ্যাকাউন্টে লগইন করুন।");
  const result = await auth.updateUser({ password: next, current_password: current });
  if (result.error) throw new Error("পাসওয়ার্ড পরিবর্তন হয়নি। বর্তমান পাসওয়ার্ড ও সংযোগ যাচাই করে আবার চেষ্টা করুন।");
}