# Security history automation and live release verification

## Read-only OAuth findings
- The registered name “Winstone Pulse CRM” does not identify a provider or integration. Confirm the external provider and whether the client is for staff sign-in or provider-data access before giving registration instructions.
- Source implements managed Google sign-in, workspace Google Drive/Sheets/Search Console calls, and a separate CRM OAuth/MCP consent service.
- Hosted configuration confirms OAuth enabled, dynamic registration enabled, Site URL `https://crm.winstonebd.com`, and consent path `/.lovable/oauth/consent`. The consent page is not an external client callback.
- Google BYOK sign-in documentation specifies a Web application client and `openid`, `https://www.googleapis.com/auth/userinfo.email`, `https://www.googleapis.com/auth/userinfo.profile`. Obtain its exact callback from More → Users → Auth settings → Sign In Methods → Google; it was not exposed by the read-only configuration check.
- Current workspace connection listing is empty. Existing connector callbacks and granted scopes remain unknown. No settings or credentials have been changed.

## Proposed implementation
1. Connect an authorized Lovable API account for read-only security scan access. This is currently a blocker: no connection is available, and the connection tool requires an existing connection.
2. Replace static-only history with authority-gated reads of the supported scan listing and findings APIs, retaining curated evidence separately.
3. Refresh while the Security history view is visible, with at least 60 seconds between requests. Show completed, running, failed, and unknown states without interpreting completion as a clean scan.
4. Match each scan exclusively to its supplied `commit_sha`. Null means unknown; never infer revisions from timestamps, current code, or earlier scan requests.
5. Preserve history across sessions using provider scan history; show pagination and errors rather than silently truncating results or replacing unavailable live evidence with a success claim.
6. Add isolated tests for exact revision matching, missing revisions, repeated results, completion with findings, failures, authority access, and pagination. Verify desktop and phone presentation without changing CRM business behavior.

## Technical details
- Public API specification confirms `SecurityScan.commit_sha`, `started_at`, `finished_at`, `status`, and `requested_scanners`.
- Use server-only connector credentials and the existing authority check. Never expose credentials or allow agents to read security findings.
- Lovable's documented Events & Hooks does not list scan-completed events, so this design uses bounded API refresh, not an invented webhook.
- Update the roadmap and architecture rule only after leaving read-only/plan mode.

## Publication and acceptance
- Latest inspected deep result: 14 November 2026, 15:20:49 UTC, marked outdated; unresolved critical call-score spoofing and a WhatsApp-recipient warning remain. Do not fix or change dispositions without separate scope.
- Before publishing, obtain fresh security results and surface critical findings. Ask whether to address them first; the publish tool determines any mandatory block.
- Publish only after implementation and checks, under the user's explicit publication request; do not alter sign-in, PIN, roles, or business permissions.
- Verify HQ `/hq`, IT `/system`, Nexus `/leadhub`, and Agents `/desk` on the live domain, compare sign-in/PIN screens with preview, and run the existing release-marker check.
- Public gate visibility is not proof of successful authenticated access. Perform signed-in checks only with an authorized session/PIN; report unavailable checks explicitly.
- No publication or settings changes occur during this plan/read-only stage.