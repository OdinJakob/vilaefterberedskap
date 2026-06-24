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
  const [dygnsbryt, setDygnsbryt] = useState<string>("06:00");

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
    setDygnsbryt("06:00");
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

      // Vilofönster: 24 h med dygnsbryt som ankare.
      // Inom fönstret placeras dagens ordinarie schema (om ej ledig)
      // och alla störningar. Längsta sammanhängande vila = största
      // lucka mellan dessa event inom fönstret.
      const anchor = toMin(dygnsbryt || "06:00");
      const fwd = (t: number) => {
        const a = ((t - anchor) % 1440 + 1440) % 1440;
        return a > 720 ? a - 1440 : a;
      };

      type Iv = { s: number; e: number; kind: "shift" | "dist"; start: string; end: string };
      const rawEvents: Iv[] = [];
      const ownShift = effectiveShifts[i];
      if (!ownShift.ledig && ownShift.start && ownShift.end) {
        const sM = toMin(ownShift.start);
        const eM = toMin(ownShift.end);
        const dur = eM >= sM ? eM - sM : 1440 - sM + eM;
        const absS = fwd(sM);
        rawEvents.push({ s: absS, e: absS + dur, kind: "shift", start: ownShift.start, end: ownShift.end });
      }
      for (const d of validDists) {
        const sM = toMin(d.start);
        const eM = toMin(d.end);
        const dur = eM > sM ? eM - sM : 1440 - sM + eM;
        const absS = fwd(sM);
        rawEvents.push({ s: absS, e: absS + dur, kind: "dist", start: d.start, end: d.end });
      }
      // Klipp mot fönstret [0, 1440]
      const items = rawEvents
        .map((iv) => {
          const cs = Math.max(0, iv.s);
          const ce = Math.min(1440, iv.e);
          const dur = Math.max(0, ce - cs);
          const sClock = (((anchor + cs) % 1440) + 1440) % 1440;
          const eClock = (((anchor + ce) % 1440) + 1440) % 1440;
          return {
            ...iv,
            absS: cs,
            absE: ce,
            dur,
            night: iv.kind === "dist" && dur > 0
              ? nightOverlap(sClock, eClock <= sClock ? sClock + dur : eClock)
              : 0,
          };
        })
        .filter((it) => it.dur > 0)
        .sort((a, b) => a.absS - b.absS);

      // Slå ihop ev. överlapp (störning vinner)
      const merged: typeof items = [];
      for (const it of items) {
        const last = merged[merged.length - 1];
        if (last && it.absS <= last.absE) {
          last.absE = Math.max(last.absE, it.absE);
          if (it.kind === "dist") last.kind = "dist";
        } else {
          merged.push({ ...it });
        }
      }

      // Längsta vila + vila före/efter första störning (för label)
      let longestMin = 0;
      let restBeforeMin = 0;
      let restAfterMin = 0;
      let prevEnd = 0;
      let firstDistFound = false;
      for (let j = 0; j < merged.length; j++) {
        const gap = merged[j].absS - prevEnd;
        longestMin = Math.max(longestMin, gap);
        if (merged[j].kind === "dist" && !firstDistFound) {
          restBeforeMin = gap;
          firstDistFound = true;
        }
        if (merged[j].kind === "dist") {
          const ns = j + 1 < merged.length ? merged[j + 1].absS : 1440;
          restAfterMin = ns - merged[j].absE;
        }
        prevEnd = Math.max(prevEnd, merged[j].absE);
      }
      longestMin = Math.max(longestMin, 1440 - prevEnd);

      const longestContinuousRest = longestMin / 60;
      const distItems = items.filter((it) => it.kind === "dist");
      const activeWorkHours = distItems.reduce((s, it) => s + it.dur, 0) / 60;
      const nightWorkHours = distItems.reduce((s, it) => s + it.night, 0) / 60;
      const mandatoryRestHours = nightWorkHours;
      const rawInskrankt = Math.max(0, 11 - longestContinuousRest);
      const totalInskranktDygnsvila = Math.min(rawInskrankt, activeWorkHours);
      const additionalInskranktHours = Math.max(0, totalInskranktDygnsvila - mandatoryRestHours);
      const totalRestHours = mandatoryRestHours + additionalInskranktHours;

      totalMandatory += mandatoryRestHours;
      totalAdditional += additionalInskranktHours;

      const distLabel = distItems.map((it) => `${it.start}–${it.end}`).join(", ");
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

    // Vila mellan torsdagens (idx 7) och fredagens (idx 8) arbetspass
    const thuEnd = effectiveShifts[7]?.end;
    const friStart = effectiveShifts[8]?.start;
    let restThuFri: number | null = null;
    if (thuEnd && friStart && !effectiveShifts[7]?.ledig && !effectiveShifts[8]?.ledig) {
      const toMinLocal = (t: string) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
      };
      const e = toMinLocal(thuEnd);
      const s = toMinLocal(friStart);
      const diff = s >= e ? s - e : 1440 - e + s;
      restThuFri = diff / 60;
    }
    const availableAtEnd = restThuFri !== null
      ? Math.max(0, totalEarned - (typeof inskranktUsed === "number" ? inskranktUsed : 0) + 11 - restThuFri)
      : 0;
    return { totalMandatory, totalAdditional, totalEarned, remaining, used, breakdowns, restThuFri, availableAtEnd };
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-stretch">
          <div className="flex flex-col">
            <p className="text-xs text-muted-foreground h-[4.5rem]">Återstående veckoberedskap med lön</p>
            <p className="text-xl font-bold text-primary">
              {formatHoursShort(Math.max(0, 8 - (typeof vilaUsed === "number" ? vilaUsed : 0)))}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Det går inte att ta ut mer veckoberedskap med lön än vad störningen varat
            </p>
          </div>
          <div className="flex flex-col">
            <p className="text-xs text-muted-foreground h-[4.5rem]">Upparbetad vila pga inskränkt dygnsvila</p>
            <p className="text-xl font-bold text-foreground">
              {formatHoursShort(summary.totalEarned)}
            </p>
          </div>
          <div className="flex flex-col">
            <p className="text-xs text-muted-foreground h-[4.5rem]">Redan uttagen betald vila pga inskränkt dygnsvila</p>
            <p className="text-xl font-bold text-foreground">
              {formatHoursShort(typeof inskranktUsed === "number" ? inskranktUsed : 0)}
            </p>
          </div>
          <div className="flex flex-col">
            <p className="text-xs text-muted-foreground h-[4.5rem]">Vila pga inskränkt dygnsvila som kan tas ut i samband med dygnsvila vid beredskapsperiodens slut</p>
            <p className="text-xl font-bold text-primary">
              {formatHoursShort(summary.availableAtEnd)}
            </p>
          </div>
        </div>

        {showSummaryBreakdown && (
          <div className="mt-4 pt-4 border-t border-border/50 space-y-2 animate-fade-in">
            <h3 className="text-sm font-medium text-foreground mb-2">Så räknas summeringskorten ut</h3>
            <div className="space-y-4 text-sm">
              {/* Card 1 */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Återstående veckoberedskap med lön
                </p>
                <div className="flex justify-between py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Maxuttag per vecka</span>
                  <span className="font-medium text-foreground">8 h</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Redan uttagen veckoberedskap med lön</span>
                  <span className="font-medium text-foreground">− {formatHoursShort(typeof vilaUsed === "number" ? vilaUsed : 0)}</span>
                </div>
                <div className="flex justify-between py-1.5 bg-muted/30 -mx-2 px-2 rounded">
                  <span className="text-foreground font-medium">Återstående</span>
                  <span className="font-bold text-primary">
                    {formatHoursShort(Math.max(0, 8 - (typeof vilaUsed === "number" ? vilaUsed : 0)))}
                  </span>
                </div>
              </div>

              {/* Card 2 */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Upparbetad vila pga inskränkt dygnsvila
                </p>
                <div className="flex justify-between py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Du måste vara ledig (00–06-regeln)</span>
                  <span className="font-medium text-foreground">{formatHoursShort(summary.totalMandatory)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Du får vara ledig (inskränkt dygnsvila)</span>
                  <span className="font-medium text-foreground">+ {formatHoursShort(summary.totalAdditional)}</span>
                </div>
                <div className="flex justify-between py-1.5 bg-muted/30 -mx-2 px-2 rounded">
                  <span className="text-foreground font-medium">Summa upparbetad vila</span>
                  <span className="font-bold text-primary">{formatHoursShort(summary.totalEarned)}</span>
                </div>
              </div>

              {/* Card 3 */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Vila som kan tas ut i samband med dygnsvila vid beredskapsperiodens slut
                </p>
                <div className="flex justify-between py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Upparbetad vila pga inskränkt dygnsvila</span>
                  <span className="font-medium text-foreground">{formatHoursShort(summary.totalEarned)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Redan uttagen betald vila pga inskränkt dygnsvila denna beredskapsvecka</span>
                  <span className="font-medium text-foreground">− {formatHoursShort(typeof inskranktUsed === "number" ? inskranktUsed : 0)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">Lagstadgad dygnsvila</span>
                  <span className="font-medium text-foreground">+ 11 h</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-border/30">
                  <span className="text-muted-foreground">
                    Vila mellan torsdagens och fredagens arbetspass
                  </span>
                  <span className="font-medium text-foreground">
                    − {summary.restThuFri !== null ? formatHoursShort(summary.restThuFri) : "–"}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 bg-muted/30 -mx-2 px-2 rounded">
                  <span className="text-foreground font-medium">Vila att ta ut vid periodens slut</span>
                  <span className="font-bold text-primary">{formatHoursShort(summary.availableAtEnd)}</span>
                </div>
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
              {/* Samma schema som dagen innan */}
              <tr className="border-b">
                <td className="p-2 text-muted-foreground sticky left-0 bg-card z-10">Samma schema som dagen innan</td>
                {days.map((d, i) => (
                  <td key={i} className="p-2 text-center">
                    {i === 0 ? null : (
                      <Checkbox
                        checked={d.sameAsPrev}
                        disabled={d.ledig}
                        onCheckedChange={(c) => updateDay(i, { sameAsPrev: !!c })}
                      />
                    )}
                  </td>
                ))}
              </tr>
              {/* Start */}
              <tr className="border-b">
                <td className="p-2 text-muted-foreground sticky left-0 bg-card z-10">Start ordinarie schema</td>
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
                <td className="p-2 text-muted-foreground sticky left-0 bg-card z-10">Slut ordinarie schema</td>
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
              {/* Ledig enligt ordinarie schema */}
              <tr className="border-b">
                <td className="p-2 text-muted-foreground sticky left-0 bg-card z-10">Ledig enligt ordinarie schema</td>
                {days.map((d, i) => (
                  <td key={i} className="p-2 text-center">
                    <Checkbox
                      checked={d.ledig}
                      onCheckedChange={(c) => updateDay(i, { ledig: !!c, sameAsPrev: c ? false : d.sameAsPrev })}
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
              Redan uttagen veckoberedskap med lön denna beredskapsvecka
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
