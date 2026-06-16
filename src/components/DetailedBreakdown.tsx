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
      label: "Varav arbete mellan 00:00–06:00",
      value: formatHoursShort(result.nightWorkHours),
      detail: result.nightWorkHours > 0
        ? "Vila läggs ut timme för timme antingen i början av nästa arbetspass, i slutet av nästa arbetspass eller en kombination av dem"
        : "Inget arbete mellan 00:00–06:00",
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
      label: "Längsta sammanhängande vila",
      value: formatHoursShort(result.longestContinuousRest),
      detail: `max(${formatHoursShort(result.restBeforeDisturbance)}, ${formatHoursShort(result.restAfterDisturbance)})`,
    },
    {
      label: "Obligatorisk ledighet (ska vara ledig, 00–06-regeln)",
      value: formatHoursShort(result.mandatoryRestHours),
      highlight: true,
    },
    {
      label: "Inskränkt dygnsvila (11 h krav)",
      value: `11 h − ${formatHoursShort(result.longestContinuousRest)} = ${formatHoursShort(result.totalInskranktDygnsvila)}`,
      detail: result.totalInskranktDygnsvila > 0
        ? result.totalInskranktDygnsvila <= result.mandatoryRestHours
          ? "Täcks redan av obligatorisk vila"
          : undefined
        : "✓ Dygnsvila uppfylld",
    },
    {
      label: "Vila med lön pga. Inskränkt dygnsvila (resultatet kan aldrig överstiga störningens längd)",
      value: formatHoursShort(
        Math.min(result.activeWorkHours, result.totalInskranktDygnsvila)
      ),
      highlight: Math.min(result.activeWorkHours, result.totalInskranktDygnsvila) > 0,
    },
    {
      label: "Total ledighet",
      value: formatHoursShort(result.totalRestHours),
      highlight: true,
    },
    {
      label: "Beredskapsvila med lön (max 6 h/tillfälle, 8 h/vecka)",
      value: formatHoursShort(result.beredskapsvila),
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
