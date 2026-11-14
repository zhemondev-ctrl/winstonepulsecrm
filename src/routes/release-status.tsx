import { createFileRoute } from "@tanstack/react-router";
import { Layers } from "lucide-react";
import { AppShell } from "@/components/crm/AppShell";
import { RoleGate } from "@/components/crm/RoleGate";
import { ReleaseStatusDashboard } from "@/components/crm/ReleaseStatusDashboard";

export const Route = createFileRoute("/release-status")({
  head: () => ({ meta: [
    { title: "Implementation & Release Status — Winstone Pulse" },
    { name: "description", content: "Authority dashboard for CRM implementation, business authorization, dated security review and publication evidence." },
    { property: "og:title", content: "Implementation & Release Status — Winstone Pulse" },
    { property: "og:description", content: "Recorded workspace verification and outstanding release checks, without inferred safety or live monitoring." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <AppShell><RoleGate surface="hq" allow={["authority"]} icon={<Layers className="size-7" />} title="বাস্তবায়ন ও প্রকাশ · Release status" description="HQ / IT · পিন দিয়ে খুলুন"><ReleaseStatusDashboard /></RoleGate></AppShell>,
});