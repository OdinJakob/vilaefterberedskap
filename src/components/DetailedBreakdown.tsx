import { CalcResult, formatHoursShort } from "@/lib/calculations";

interface DetailedBreakdownProps {
  result: CalcResult;
}

export default function DetailedBreakdown({ result }: DetailedBreakdownProps) {
  const steps = [
    {
      label: "Aktivt arbete under beredskap",
      value: formatHoursShort(result.activeWorkHours),
    },
    {
      label: "Vila före störning (föregående arbetsslut → störningens start)",
      value: formatHoursShort(result.restBeforeDisturbance),
    },
    {
      label: "Vila efter störning (störningens slut → ordinarie arbetsstart)",
      value: formatHoursShort(result.restAfterDisturbance),
    },
    {
      label: "Krävd sammanhängande vila efter störning",
      value: "7 h",
      detail: result.restAfterDisturbance >= 7
        ? "✓ Redan uppfyllt"
        : `Saknas ${formatHoursShort(7 - result.restAfterDisturbance)} → obligatorisk ledighet`,
    },
    {
      label: "Obligatorisk ledighet (ska vara ledig)",
      value: formatHoursShort(result.mandatoryRestHours),
      highlight: true,
    },
    {
      label: "Dygnsvila (11 h krav)",
      value: `Vila före (${formatHoursShort(result.restBeforeDisturbance)}) + obligatorisk vila (${formatHoursShort(result.mandatoryRestHours)}) = ${formatHoursShort(result.restBeforeDisturbance + result.mandatoryRestHours)}`,
      detail: result.restrictedDailyRestHours > 0
        ? `Saknas ${formatHoursShort(result.restrictedDailyRestHours)} → inskränkt dygnsvila`
        : "✓ Dygnsvila uppfylld med befintlig vila + obligatorisk ledighet",
    },
    {
      label: "Inskränkt dygnsvila (får vara ledig)",
      value: formatHoursShort(result.restrictedDailyRestHours),
      highlight: result.restrictedDailyRestHours > 0,
    },
    {
      label: "Total ledighet",
      value: formatHoursShort(result.totalRestHours),
      highlight: true,
    },
    {
      label: "Beredskapsvila (max 6 h/tillfälle, 8 h/vecka)",
      value: formatHoursShort(result.beredskapsvila),
    },
    {
      label: "Klassas som inskränkt dygnsvila",
      value: formatHoursShort(result.inskanktDygnsvila),
    },
    {
      label: "Kvarvarande beredskapsvila denna vecka",
      value: formatHoursShort(result.remainingWeeklyBeredskapsvila),
    },
  ];

  return (
    <div className="bg-card rounded-lg border p-5 animate-fade-in">
      <h3 className="font-semibold text-foreground mb-4">Detaljerad uträkning</h3>
      <div className="space-y-0">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`flex flex-col sm:flex-row sm:items-center justify-between py-2.5 border-b border-border/50 last:border-0 ${
              step.highlight ? "bg-muted/30 -mx-2 px-2 rounded" : ""
            }`}
          >
            <div className="flex-1">
              <span className="text-sm text-foreground">{step.label}</span>
              {step.detail && (
                <p className="text-xs text-muted-foreground mt-0.5">{step.detail}</p>
              )}
            </div>
            <span className={`text-sm font-medium mt-1 sm:mt-0 ${step.highlight ? "text-primary" : "text-foreground"}`}>
              {step.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
