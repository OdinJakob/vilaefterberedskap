import { useState, useMemo } from "react";
import { CalcInput, CalcResult, calculateRest, formatHours, formatHoursShort } from "@/lib/calculations";
import RestForm, { DEFAULT_INPUT } from "@/components/RestForm";
import ResultDisplay from "@/components/ResultDisplay";
import DetailedBreakdown from "@/components/DetailedBreakdown";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronDown, ChevronUp, Info } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface DayEntry {
  id: number;
  label: string;
  input: CalcInput;
  vilaUsed: number; // how much rest was actually taken for this day
}

const WEEKDAYS = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"];

export default function WeekView() {
  const [days, setDays] = useState<DayEntry[]>([
    { id: 1, label: WEEKDAYS[0], input: { ...DEFAULT_INPUT }, vilaUsed: 0 },
  ]);
  const [expandedDay, setExpandedDay] = useState<number>(1);
  const [showDetailed, setShowDetailed] = useState<Record<number, boolean>>({});
  const [nextId, setNextId] = useState(2);

  const addDay = () => {
    const dayIndex = days.length < 7 ? days.length : 0;
    const newDay: DayEntry = {
      id: nextId,
      label: WEEKDAYS[dayIndex],
      input: { ...DEFAULT_INPUT, usedBeredskapsvila: 0 },
      vilaUsed: 0,
    };
    setDays([...days, newDay]);
    setExpandedDay(nextId);
    setNextId(nextId + 1);
  };

  const removeDay = (id: number) => {
    setDays(days.filter((d) => d.id !== id));
    if (expandedDay === id) {
      setExpandedDay(days[0]?.id ?? -1);
    }
  };

  const updateDayInput = (id: number, input: CalcInput) => {
    setDays(days.map((d) => (d.id === id ? { ...d, input } : d)));
  };

  const updateDayLabel = (id: number, label: string) => {
    setDays(days.map((d) => (d.id === id ? { ...d, label } : d)));
  };

  const updateVilaUsed = (id: number, value: number) => {
    setDays(days.map((d) => (d.id === id ? { ...d, vilaUsed: value } : d)));
  };

  const resetDay = (id: number) => {
    setDays(days.map((d) => (d.id === id ? { ...d, input: { ...DEFAULT_INPUT, usedBeredskapsvila: 0 }, vilaUsed: 0 } : d)));
  };

  // Calculate results for each day, accumulating used beredskapsvila
  const dayResults = useMemo(() => {
    const results: { entry: DayEntry; result: CalcResult | null; cumulativeUsed: number }[] = [];
    let cumulativeUsed = 0;

    for (const day of days) {
      const isComplete =
        day.input.activeWorkStart !== "" &&
        day.input.activeWorkEnd !== "" &&
        day.input.prevWorkDayStart !== "" &&
        day.input.prevWorkDayEnd !== "" &&
        day.input.workDayStart !== "" &&
        day.input.workDayEnd !== "";

      if (isComplete) {
        const inputWithCumulative = {
          ...day.input,
          usedBeredskapsvila: cumulativeUsed,
        };
        const result = calculateRest(inputWithCumulative);
        results.push({ entry: day, result, cumulativeUsed });
        cumulativeUsed += result.beredskapsvila + day.vilaUsed;
      } else {
        results.push({ entry: day, result: null, cumulativeUsed });
        cumulativeUsed += day.vilaUsed;
      }
    }
    return results;
  }, [days]);

  // Weekly summary
  const weeklySummary = useMemo(() => {
    let totalMandatory = 0;
    let totalAdditional = 0;
    let totalBeredskapsvila = 0;
    let totalVilaUsed = 0;
    let completedDays = 0;

    for (const { result, entry } of dayResults) {
      totalVilaUsed += entry.vilaUsed;
      if (result) {
        totalMandatory += result.mandatoryRestHours;
        totalAdditional += result.additionalInskranktHours;
        totalBeredskapsvila += result.beredskapsvila;
        completedDays++;
      }
    }

    const totalEarned = totalMandatory + totalAdditional;
    const remaining = Math.max(0, totalEarned - totalVilaUsed);

    return {
      totalMandatory,
      totalAdditional,
      totalEarned,
      totalVilaUsed,
      remaining,
      completedDays,
    };
  }, [dayResults]);

  const [showSummaryBreakdown, setShowSummaryBreakdown] = useState(false);

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
              {formatHoursShort(weeklySummary.totalEarned)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Vila redan uttagen</p>
            <p className="text-xl font-bold text-foreground">
              {formatHoursShort(weeklySummary.totalVilaUsed)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Kvar att ta ut</p>
            <p className="text-xl font-bold text-primary">
              {formatHoursShort(weeklySummary.remaining)}
            </p>
            <p className="text-xs text-muted-foreground">
              {weeklySummary.remaining > 6
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
                <span className="font-medium text-foreground">{formatHoursShort(weeklySummary.totalMandatory)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/30">
                <span className="text-muted-foreground">Du får vara ledig (inskränkt dygnsvila)</span>
                <span className="font-medium text-foreground">{formatHoursShort(weeklySummary.totalAdditional)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/30 bg-muted/30 -mx-2 px-2 rounded">
                <span className="text-foreground font-medium">Upparbetad vila (summa)</span>
                <span className="font-bold text-primary">{formatHoursShort(weeklySummary.totalEarned)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-border/30">
                <span className="text-muted-foreground">Vila redan uttagen</span>
                <span className="font-medium text-foreground">− {formatHoursShort(weeklySummary.totalVilaUsed)}</span>
              </div>
              <div className="flex justify-between py-1.5 bg-muted/30 -mx-2 px-2 rounded">
                <span className="text-foreground font-medium">Kvar att ta ut</span>
                <span className="font-bold text-primary">{formatHoursShort(weeklySummary.remaining)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Day entries */}
      {dayResults.map(({ entry, result, cumulativeUsed }, index) => {
        const isExpanded = expandedDay === entry.id;
        const isComplete = result !== null;

        return (
          <div key={entry.id} className="bg-card rounded-lg border shadow-sm overflow-hidden">
            {/* Day header */}
            <button
              onClick={() => setExpandedDay(isExpanded ? -1 : entry.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <select
                  value={entry.label}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => updateDayLabel(entry.id, e.target.value)}
                  className="text-sm font-semibold bg-transparent border-none text-foreground cursor-pointer focus:outline-none"
                >
                  {WEEKDAYS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                <span className="text-xs text-muted-foreground">
                  Störning {index + 1}
                </span>
                {isComplete && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    Vila: {formatHoursShort(result.totalRestHours)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {days.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeDay(entry.id);
                    }}
                    className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {/* Day content */}
            {isExpanded && (
              <div className="border-t p-4 space-y-4">
                <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                  Redan använd beredskapsvila (ackumulerat): {formatHoursShort(cumulativeUsed)}
                </div>

                <RestForm
                  input={entry.input}
                  onChange={(newInput) => updateDayInput(entry.id, newInput)}
                  onReset={() => resetDay(entry.id)}
                  hideUsedBeredskapsvila
                />

                {/* Vila already taken for this day */}
                <div className="bg-card rounded-lg border p-4 space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">
                    Vila redan uttagen för denna störning
                  </Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={6}
                      step={0.5}
                      value={entry.vilaUsed}
                      onChange={(e) => updateVilaUsed(entry.id, parseFloat(e.target.value) || 0)}
                      className="w-24 h-12 text-lg rounded-md border border-input bg-background px-3 text-foreground"
                    />
                    <span className="text-sm text-muted-foreground">timmar</span>
                  </div>
                </div>

                {isComplete && (
                  <>
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`detailed-${entry.id}`}
                        checked={showDetailed[entry.id] ?? false}
                        onCheckedChange={(checked) =>
                          setShowDetailed({ ...showDetailed, [entry.id]: checked })
                        }
                      />
                      <Label htmlFor={`detailed-${entry.id}`} className="text-sm text-muted-foreground cursor-pointer">
                        Visa detaljerad uträkning
                      </Label>
                    </div>

                    <ResultDisplay result={result} workDayStart={entry.input.workDayStart} />
                    {showDetailed[entry.id] && <DetailedBreakdown result={result} />}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Add day button */}
      {days.length < 7 && (
        <Button variant="outline" onClick={addDay} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Lägg till störning
        </Button>
      )}
    </div>
  );
}
