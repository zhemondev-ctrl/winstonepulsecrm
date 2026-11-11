export type ItAccessStep = "entry" | "pin" | "operator" | "password";

export function visibleItStep(step: unknown, pinVerified: boolean, operatorVerified: boolean): ItAccessStep {
  if (step === "pin") return "pin";
  if (!pinVerified) return "entry";
  if (step === "password" && operatorVerified) return "password";
  if (step === "operator" || step === "password") return "operator";
  return "entry";
}