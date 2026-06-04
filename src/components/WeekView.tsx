import { Fragment, useState, useMemo } from "react";
import { CalcResult, formatHoursShort } from "@/lib/calculations";
import DetailedBreakdown from "@/components/DetailedBreakdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Info, RotateCcw } from "lucide-react";

const WEEKDAYS = ["Torsdag", "Fredag", "Lördag", "Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag"];
const SHORT = ["Tor", "Fre", "Lör", "Sön", "Mån", "Tis", "Ons", "Tor", "Fre"];

interface Disturbance {
  start: string;
  end: string;
}

interface DayCol {
  workStart: string;
  workEnd: string;
  ledig: boolean;
  sameAsPrev: boolean;
  disturbances: Disturbance[];
}

function newDay(): DayCol {
  return { workStart: "07:00", workEnd: "15:30", ledig: false, sameAsPrev: false, disturbances: [] };
}

export default function WeekView() {
  const [days, setDays] = useState<DayCol[]>(() => WEEKDAYS.map(() => newDay()));
  const [disturbanceCount, setDisturbanceCount] = useState(1);
  const [vilaUsed, setVilaUsed] = useState<number | "">("");
  const [inskranktUsed, setInskranktUsed] = useState<number | "">("");
  const [showSummaryBreakdown, setShowSummaryBreakdown] = useState(false);

  // Ensure each day's disturbance array is at least disturbanceCount long
  const ensureDisturbances = (d: DayCol): DayCol => {
    if (d.disturbances.length >= disturbanceCount) return d;
    return {
      ...d,
      disturbances: [
        ...d.disturbances,
        ...Array.from({ length: disturbanceCount - d.disturbances.length }, () => ({ start: "", end: "" })),
      ],
    };
  };

  const updateDay = (idx: number, patch: Partial<DayCol>) => {
    setDays((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const updateDisturbance = (dayIdx: number, distIdx: number, patch: Partial<Disturbance>) => {
    setDays((prev) =>
      prev.map((d, i) => {
        if (i !== dayIdx) return d;
        const ensured = ensureDisturbances(d);
        const disturbances = ensured.disturbances.map((dist, j) => (j === distIdx ? { ...dist, ...patch } : dist));
        return { ...ensured, disturbances };
      }),
    );
  };

  const addDisturbance = () => setDisturbanceCount((n) => n + 1);
  const removeDisturbance = (idx: number) => {
    if (disturbanceCount <= 1) return;
    setDays((prev) => prev.map((d) => ({ ...d, disturbances: d.disturbances.filter((_, j) => j !== idx) })));
    setDisturbanceCount((n) => n - 1);
  };

  const resetAll = () => {
    setDays(WEEKDAYS.map(() => newDay()));
    setDisturbanceCount(1);
    setVilaUsed("");
  };

  // Resolve effective shift for each day (handle sameAsPrev + ledig)
  const effectiveShifts = useMemo(() => {
    return days.map((d, i) => {
      if (d.ledig) return { start: "", end: "", ledig: true };
      if (d.sameAsPrev && i > 0) {
        // walk back to find the most recent manually-filled day (skip ledig and other sameAsPrev)
        for (let k = i - 1; k >= 0; k--) {
          const prev = days[k];
          if (prev.ledig) continue;
          if (prev.sameAsPrev) continue;
          return { start: prev.workStart, end: prev.workEnd, ledig: false };
        }
      }
      return { start: d.workStart, end: d.workEnd, ledig: false };
    });
  }, [days]);

  // Compute totals per day, aggregating disturbances within the same rest window
  const summary = useMemo(() => {
    let totalMandatory = 0;
    let totalAdditional = 0;
    const breakdowns: { label: string; result: CalcResult }[] = [];

    const toMin = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      return h * 60 + m;
    };
    const forward = (anchor: number, t: number) => (t >= anchor ? t - anchor : t + 1440 - anchor);
    const nightOverlap = (sM: number, eM: number) => {
      // minutes of [sM..eM) (handles midnight crossing) intersected with [0,360)
      const crosses = eM <= sM;
      if (!crosses) {
        return Math.max(0, Math.min(eM, 360) - Math.max(sM, 0));
      }
      const part1 = sM < 360 ? 360 - sM : 0;
      const part2 = Math.min(eM, 360);
      return part1 + part2;
    };

    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      const validDists = (day.disturbances || [])
        .slice(0, disturbanceCount)
        .filter((d) => d && d.start && d.end);
      if (validDists.length === 0) continue;

      // prev workday end
      let prevEnd = "";
      let prevStart = "";
      for (let k = i - 1; k >= 0; k--) {
        const sh = effectiveShifts[k];
        if (!sh.ledig && sh.end) {
          prevEnd = sh.end;
          prevStart = sh.start;
          break;
        }
      }
      // next workday start (this day's shift if any, else next day's)
      let nextStart = effectiveShifts[i].start;
      let nextEnd = effectiveShifts[i].end;
      if (!nextStart) {
        for (let k = i + 1; k < days.length; k++) {
          const sh = effectiveShifts[k];
          if (!sh.ledig && sh.start) {
            nextStart = sh.start;
            nextEnd = sh.end;
            break;
          }
        }
      }
      // Fallback
      if (!prevEnd || !prevStart) {
        for (let k = 0; k < days.length; k++) {
          const sh = effectiveShifts[k];
          if (!sh.ledig && sh.start && sh.end) {
            prevEnd = prevEnd || sh.end;
            prevStart = prevStart || sh.start;
            break;
          }
        }
      }
      if (!nextStart || !nextEnd) {
        for (let k = 0; k < days.length; k++) {
          const sh = effectiveShifts[k];
          if (!sh.ledig && sh.start && sh.end) {
            nextStart = nextStart || sh.start;
            nextEnd = nextEnd || sh.end;
            break;
          }
        }
      }
      prevEnd = prevEnd || "15:30";
      prevStart = prevStart || "07:00";
      nextStart = nextStart || "07:00";
      nextEnd = nextEnd || "15:30";

      const anchor = toMin(prevEnd);
      const restEnd = forward(anchor, toMin(nextStart));

      // Build absolute timeline (minutes since prev workday end)
      const items = validDists
        .map((d) => {
          const sM = toMin(d.start);
          const eM = toMin(d.end);
          const absS = forward(anchor, sM);
          const dur = eM > sM ? eM - sM : 1440 - sM + eM;
          return {
            start: d.start,
            end: d.end,
            absS,
            absE: absS + dur,
            dur,
            night: nightOverlap(sM, eM),
          };
        })
        .sort((a, b) => a.absS - b.absS);

      // Longest continuous rest = max gap before/between/after disturbances inside rest window
      let longestMin = 0;
      let cursor = 0;
      let restBeforeMin = 0;
      let restAfterMin = 0;
      for (let j = 0; j < items.length; j++) {
        const gap = Math.max(0, items[j].absS - cursor);
        if (j === 0) restBeforeMin = gap;
        longestMin = Math.max(longestMin, gap);
        cursor = Math.max(cursor, items[j].absE);
      }
      restAfterMin = Math.max(0, restEnd - cursor);
      longestMin = Math.max(longestMin, restAfterMin);

      const longestContinuousRest = longestMin / 60;
      const activeWorkHours = items.reduce((s, it) => s + it.dur, 0) / 60;
      const nightWorkHours = items.reduce((s, it) => s + it.night, 0) / 60;
      const mandatoryRestHours = nightWorkHours;
      const rawInskrankt = Math.max(0, 11 - longestContinuousRest);
      const totalInskranktDygnsvila = Math.min(rawInskrankt, activeWorkHours);
      const additionalInskranktHours = Math.max(0, totalInskranktDygnsvila - mandatoryRestHours);
      const totalRestHours = mandatoryRestHours + additionalInskranktHours;

      totalMandatory += mandatoryRestHours;
      totalAdditional += additionalInskranktHours;

      const distLabel = items.map((it) => `${it.start}–${it.end}`).join(", ");
      const result: CalcResult = {
        activeWorkHours,
        nightWorkHours,
        mandatoryRestHours,
        longestContinuousRest,
        totalInskranktDygnsvila,
        additionalInskranktHours,
        totalRestHours,
        beredskapsvila: Math.min(totalRestHours, 6),
        inskanktDygnsvila: Math.max(0, totalRestHours - Math.min(totalRestHours, 6)),
        earliestReturn: "",
        remainingWeeklyBeredskapsvila: 0,
        restBeforeDisturbance: restBeforeMin / 60,
        restAfterDisturbance: restAfterMin / 60,
        requiresManagerConsultation: additionalInskranktHours > 0,
        warnings: [],
      };
      breakdowns.push({
        label: `${WEEKDAYS[i]} (${distLabel})`,
        result,
      });
    }

    const totalEarned = totalMandatory + totalAdditional;
    const used =
      (typeof vilaUsed === "number" ? vilaUsed : 0) +
      (typeof inskranktUsed === "number" ? inskranktUsed : 0);
    const remaining = Math.max(0, totalEarned - used);
    return { totalMandatory, totalAdditional, totalEarned, remaining, used, breakdowns };
  }, [days, disturbanceCount, effectiveShifts, vilaUsed, inskranktUsed]);

  const distIndices = Array.from({ length: disturbanceCount }, (_, i) => i);

  return (
    <div className="space-y-6">
      {/* Weekly Summary */}
      <div className="bg-card rounded-lg border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Veckosummering</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSummaryBreakdown(!showSummaryBreakdown)}
            className="text-muted-foreground hover:text-foreground gap-1.5 text-xs"
          >
            <Info className="h-3.5 w-3.5" />
            {showSummaryBreakdown ? "Dölj uträkning" : "Visa uträkning"}
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Upparbetad vila</p>
            <p className="text-xl font-bold text-foreground">
              {formatHoursShort(summary.totalEarned)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Redan uttagen betald beredskapsvila och vila pga inskränkt dygnsvila</p>
            <p className="text-xl font-bold text-foreground">
              {formatHoursShort(summary.used)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Kvar att ta ut</p>
            <p className="text-xl font-bold text-primary">
              {formatHoursShort(summary.remaining)}
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.remaining > 6
                ? "Ta ut som inskränkt dygnsvila"
                : "Ta ut som betald beredskapsvila"}
            </p>
          </div>
        </div>

        {showSummaryBreakdown && (
          <div className="mt-4 pt-4 border-t border-border/50 space-y-2 animate-fade-in">
            <h3 className="text-sm font-medium text-foreground mb-2">Så räknas nyckeltalen ut</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between py-1.5 border-b border-border/30">
                <span className="text-muted-foreground">Du måste vara ledig (00–06-regeln)</span>
                <span className="font-medium text-foreground">{formatHoursShort(summary.totalMandatory)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/30">
                <span className="text-muted-foreground">Du får vara ledig (inskränkt dygnsvila)</span>
                <span className="font-medium text-foreground">{formatHoursShort(summary.totalAdditional)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/30 bg-muted/30 -mx-2 px-2 rounded">
                <span className="text-foreground font-medium">Upparbetad vila (summa)</span>
                <span className="font-bold text-primary">{formatHoursShort(summary.totalEarned)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/30">
                <span className="text-muted-foreground">Vila redan uttagen</span>
                <span className="font-medium text-foreground">− {formatHoursShort(summary.used)}</span>
              </div>
              <div className="flex justify-between py-1.5 bg-muted/30 -mx-2 px-2 rounded">
                <span className="text-foreground font-medium">Kvar att ta ut</span>
                <span className="font-bold text-primary">{formatHoursShort(summary.remaining)}</span>
              </div>
            </div>

            {summary.breakdowns.length > 0 && (
              <div className="mt-6 space-y-4">
                <h3 className="text-sm font-medium text-foreground">Uträkning per störning</h3>
                {summary.breakdowns.map((b, idx) => (
                  <div key={idx} className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {b.label}
                    </p>
                    <DetailedBreakdown result={b.result} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Schedule table */}
      <div className="bg-card rounded-lg border shadow-sm">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-foreground">Veckoschema och störningar</h2>
          <Button variant="ghost" size="sm" onClick={resetAll} className="text-muted-foreground">
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Nollställ
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left font-medium text-muted-foreground p-1.5 sticky left-0 bg-muted/30 z-10 min-w-[96px]">
                  Dag
                </th>
                {SHORT.map((d, i) => (
                  <th key={i} className="font-medium text-foreground p-1.5 min-w-[72px]">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Start */}
              <tr className="border-b">
                <td className="p-2 text-muted-foreground sticky left-0 bg-card z-10">Start</td>
                {days.map((d, i) => (
                  <td key={i} className="p-1">
                    <Input
                      type="time"
                      value={effectiveShifts[i].start}
                      disabled={d.ledig || d.sameAsPrev}
                      onChange={(e) => updateDay(i, { workStart: e.target.value })}
                      className="h-9 text-sm px-2"
                    />
                  </td>
                ))}
              </tr>
              {/* Slut */}
              <tr className="border-b">
                <td className="p-2 text-muted-foreground sticky left-0 bg-card z-10">Slut</td>
                {days.map((d, i) => (
                  <td key={i} className="p-1">
                    <Input
                      type="time"
                      value={effectiveShifts[i].end}
                      disabled={d.ledig || d.sameAsPrev}
                      onChange={(e) => updateDay(i, { workEnd: e.target.value })}
                      className="h-9 text-sm px-2"
                    />
                  </td>
                ))}
              </tr>
              {/* Ledig */}
              <tr className="border-b">
                <td className="p-2 text-muted-foreground sticky left-0 bg-card z-10">Ledig</td>
                {days.map((d, i) => (
                  <td key={i} className="p-2 text-center">
                    <Checkbox
                      checked={d.ledig}
                      onCheckedChange={(c) => updateDay(i, { ledig: !!c, sameAsPrev: c ? false : d.sameAsPrev })}
                    />
                  </td>
                ))}
              </tr>
              {/* Samma som dagen innan */}
              <tr className="border-b">
                <td className="p-2 text-muted-foreground sticky left-0 bg-card z-10">Samma som dagen innan</td>
                {days.map((d, i) => (
                  <td key={i} className="p-2 text-center">
                    <Checkbox
                      checked={d.sameAsPrev}
                      disabled={i === 0 || d.ledig}
                      onCheckedChange={(c) => updateDay(i, { sameAsPrev: !!c })}
                    />
                  </td>
                ))}
              </tr>
              {/* Disturbances */}
              {distIndices.map((dIdx) => (
                <Fragment key={dIdx}>
                  <tr className="border-b bg-muted/10">
                    <td className="p-2 text-muted-foreground sticky left-0 bg-card z-10">
                      <div className="flex items-center justify-between gap-1">
                        <span>Start störning {disturbanceCount > 1 ? dIdx + 1 : ""}</span>
                        {disturbanceCount > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDisturbance(dIdx)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                    {days.map((d, i) => (
                      <td key={i} className="p-1">
                        <Input
                          type="time"
                          value={d.disturbances[dIdx]?.start ?? ""}
                          onChange={(e) => updateDisturbance(i, dIdx, { start: e.target.value })}
                          className="h-9 text-sm px-2"
                        />
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b bg-muted/10">
                    <td className="p-2 text-muted-foreground sticky left-0 bg-card z-10">
                      Slut störning {disturbanceCount > 1 ? dIdx + 1 : ""}
                    </td>
                    {days.map((d, i) => (
                      <td key={i} className="p-1">
                        <Input
                          type="time"
                          value={d.disturbances[dIdx]?.end ?? ""}
                          onChange={(e) => updateDisturbance(i, dIdx, { end: e.target.value })}
                          className="h-9 text-sm px-2"
                        />
                      </td>
                    ))}
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t">
          <Button variant="outline" size="sm" onClick={addDisturbance} className="w-full">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Lägg till fler störningar
          </Button>
        </div>
      </div>

      {/* Vila redan uttagen */}
      <div className="bg-card rounded-lg border p-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Redan uttagen betald beredskapsvila denna beredskapsvecka
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step={0.5}
                value={vilaUsed}
                onChange={(e) => {
                  const v = e.target.value;
                  setVilaUsed(v === "" ? "" : parseFloat(v) || 0);
                }}
                className="w-28 h-11 text-lg"
              />
              <span className="text-sm text-muted-foreground">timmar</span>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Redan uttagen betald vila pga inskränkt dygnsvila denna beredskapsvecka
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step={0.5}
                value={inskranktUsed}
                onChange={(e) => {
                  const v = e.target.value;
                  setInskranktUsed(v === "" ? "" : parseFloat(v) || 0);
                }}
                className="w-28 h-11 text-lg"
              />
              <span className="text-sm text-muted-foreground">timmar</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
