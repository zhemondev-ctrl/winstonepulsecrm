/** Do not open a database subscription for a visitor with no snapshot access. */
export function shouldSubscribeToCrm(accountPending: boolean, scope: string): boolean {
  return !accountPending && scope !== "none";
}