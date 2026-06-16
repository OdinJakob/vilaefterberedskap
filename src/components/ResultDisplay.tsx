import { CalcResult, formatHours, formatHoursShort } from "@/lib/calculations";
import { Clock, Shield, AlertTriangle, Info, Banknote } from "lucide-react";

interface ResultDisplayProps {
  result: CalcResult;
  workDayStart: string;
}

export default function ResultDisplay({ result, workDayStart }: ResultDisplayProps) {
  const paidLeaveHours = Math.max(
    result.activeWorkHours,
    6 + result.totalInskranktDygnsvila,
    result.remainingWeeklyBeredskapsvila + result.beredskapsvila + result.totalInskranktDygnsvila
  );

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Ska vara ledig – 00–06-regeln */}
      <div className="result-card-must rounded-lg border p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-must-rest p-2 mt-0.5">
            <Shield className="h-4 w-4 text-must-rest-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-must-rest text-sm uppercase tracking-wide">
              Du måste vara ledig
            </h3>
            <p className="text-2xl font-bold text-foreground mt-1">
              {formatHours(result.mandatoryRestHours)}
            </p>
            {result.mandatoryRestHours > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Du arbetade {formatHoursShort(result.nightWorkHours)} mellan kl 00:00–06:00.
                Vila läggs ut timme för timme antingen i början av nästa arbetspass, i slutet av nästa arbetspass eller en kombination av dem.
              </p>
            )}
            {result.mandatoryRestHours === 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Inget aktivt arbete utfördes mellan kl 00:00–06:00
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Inskränkt dygnsvila */}
      <div className="result-card-may rounded-lg border p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-may-rest p-2 mt-0.5">
            <Clock className="h-4 w-4 text-may-rest-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-may-rest text-sm uppercase tracking-wide">
              Inskränkt dygnsvila
            </h3>
            <p className="text-2xl font-bold text-foreground mt-1">
              {formatHours(result.totalInskranktDygnsvila)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Dygnsvilan inskränktes med {formatHoursShort(result.totalInskranktDygnsvila)} (längsta sammanhängande vila var {formatHoursShort(result.longestContinuousRest)} av 11 h)
            </p>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
              Huvudregeln är att kompensation vid inskränkt dygnsvila ska ske i samband med dygnsvila vid beredskapsperiodens slut. Om behov finns av att ta ut vila i samband med nästa arbetspass stäms detta av med beredskapsledare eller chef.
            </p>
          </div>
        </div>
      </div>

      {/* Beredskapsvila info (only when no additional inskränkt) */}
      {result.totalInskranktDygnsvila === 0 && result.beredskapsvila > 0 && (
        <div className="result-card-may rounded-lg border p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-may-rest p-2 mt-0.5">
              <Clock className="h-4 w-4 text-may-rest-foreground" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-may-rest text-sm uppercase tracking-wide">
                Veckoberedskap med lön
              </h3>
              <p className="text-2xl font-bold text-foreground mt-1">
                {formatHours(result.beredskapsvila)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Du kan använda {formatHoursShort(result.beredskapsvila)} veckoberedskap med lön
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="space-y-2">
          {result.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
