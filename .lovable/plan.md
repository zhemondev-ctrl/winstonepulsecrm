# Download button for the MD approval report

## What you get
A "Download MD approval report (PDF)" button on the HQ page. Only HQ and IT staff see it and can download it. Agents cannot open it.

## Why not a simple public file
The report contains named agent audit details. A plain file in the app would be reachable by anyone with the link, so it will be stored privately instead.

## Steps
1. Create a private storage area for HQ documents (no public access).
2. Upload the existing report `Winstone_Pulse_MD_Approval_Report_2026-11-11.pdf` into it. The original in Files stays unchanged.
3. Add a server check: confirm the signed-in person has HQ/IT authority, then create a 60-second download link that saves the file as a PDF.
4. Add the button on the HQ page (Bangla/English label, works on phone). Clicking it gets the link and starts the download; if access is denied it shows a clear message.
5. Verify: HQ user downloads a non-empty PDF; agent account is refused.

## Technical details
- Private bucket `hq-documents`, no anon/authenticated SELECT policy; reads only via server admin client after authority check.
- `createServerFn` with `requireSupabaseAuth`, reusing the existing HQ/IT authority helper; `createSignedUrl(path, 60, { download: filename })`.
- No changes to leads, assignments, KPIs or other records. Not published.
