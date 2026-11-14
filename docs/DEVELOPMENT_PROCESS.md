# CRM development and release gates

## 1. Implementing requested changes

- Implement requested CRM changes without a separate owner/MD approval, meeting, written approval or meeting-tracker finalization prerequisite.
- Keep the change within the requested scope. Clarify genuinely ambiguous requirements; clarification is not an approval gate.
- Preserve records, existing business rules and access boundaries. Test changed behavior with isolated fixtures; never create invented customer records to demonstrate success.
- A development request permits implementation and preview verification, not unrelated production actions.

## 2. Business authorization

- Existing server-checked business approvals remain mandatory: booking approval, HQ accountability decisions, Architect payment verification and other role-scoped operations.
- Lead assignment remains exclusively through LeadHub Nexus; imports remain unassigned.
- Ownership checks, PIN/session scope, append-only history, quota rules and briefing checks remain unchanged.
- Implementing a workflow does not authorize executing that workflow or grant its privileges. Meeting history remains preserved even though its workspace UI is retired.

## 3. Security review

- Security review is independent of both development permission and business approval.
- Before publishing, inspect persisted security findings and run fresh basic checks. A requested full security review also starts the deep scan.
- Distinguish basic database checks, dependency advisories and deep code review; a basic pass does not establish overall safety.
- Report timestamps, stale results, disabled checks, unresolved findings and actual coverage. Do not describe a scheduled/running scan as completed or hide dependency risks.
- Deep scans complete asynchronously. Wait for their completion notification; do not repeatedly poll or restart them.
- Findings do not justify weakening security controls. Respect the publishing tool's enforced gates; surface critical findings before requesting publication.

## 4. Publishing and production actions

- Publishing requires an explicit publish/deploy request, not an additional owner/MD approval. Existing tool-required permissions remain in force.
- Database migrations, financial/customer writes and external messages require their own explicit requested scope; a publish request does not authorize them.
- App code becomes live only on publication. Shared database changes apply immediately; preserve the verified-backup and isolated-staging requirements.
- A publish tool response proves only scheduling. State the expected domain without claiming deployment completion.

## 5. Release verification

- When verification is requested after a security review, perform it after the fresh review completes, not from stale earlier results.
- Verify the canonical public domain and required release markers with `bun scripts/check-live-release.ts`: manual version, $35.29 maintenance amount and 50-company-lead limit.
- Inspect `/hq`, `/system`, `/leadhub` and `/desk` outside preview. IT Console and System share `/system`; they are not separate deployments.
- Confirm the removed Meeting approvals section is absent in signed-in HQ/IT views while billing notices and site-visit alerts remain. Keep each workspace's access gate.
- A successful HTTP response or signed-out PIN gate proves reachability only, not authenticated functionality. Report session-gated views separately if they could not be exercised safely.
- Retain unresolved findings and verification blockers in the roadmap; never mark wide agent rollout safe from deployment markers alone.