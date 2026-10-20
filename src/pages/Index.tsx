import { useState, useMemo } from "react";
import { CalcInput, calculateRest } from "@/lib/calculations";
import RestForm, { DEFAULT_INPUT } from "@/components/RestForm";
import ResultDisplay from "@/components/ResultDisplay";
import DetailedBreakdown from "@/components/DetailedBreakdown";

import InfoBox from "@/components/InfoBox";
import RestInfoBox from "@/components/RestInfoBox";
import WeekView from "@/components/WeekView";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Shield } from "lucide-react";
import { useWebMCP } from "use-webmcp-tool";
import { runWebMCPTool } from "@/lib/webmcp-telemetry";

export default function Index() {
  const [input, setInput] = useState<CalcInput>({ ...DEFAULT_INPUT });
  const [showDetailed, setShowDetailed] = useState(false);
  const [mode, setMode] = useState<"day" | "week">("day");


  const isComplete =
    input.activeWorkStart !== "" &&
    input.activeWorkEnd !== "" &&
    (input.prevDayOff || (input.prevWorkDayStart !== "" && input.prevWorkDayEnd !== "")) &&
    (input.nextDayOff || (input.workDayStart !== "" && input.workDayEnd !== ""));

  const result = useMemo(() => {
    if (!isComplete) return null;
    return calculateRest(input);
  }, [input, isComplete]);

  useWebMCP({
    name: "read_rest_result",
    description:
      "Read the rest calculation result currently shown on the 'En dag' tab: mandatory rest, restricted daily rest, and paid on-call rest hours.",
    annotations: { readOnlyHint: true },
    execute: () =>
      runWebMCPTool("read_rest_result", () => {
        if (mode !== "day") throw new Error("Beräkningen visas bara på fliken En dag.");
        if (!result) throw new Error("Formuläret är inte komplett ifyllt ännu.");
        return (
          `Obligatorisk vila: ${result.mandatoryRestHours} h. ` +
          `Inskränkt dygnsvila: ${result.totalInskranktDygnsvila} h. ` +
          `Beredskapsvila med lön: ${result.beredskapsvila} h. ` +
          `Tidigast åter i arbete: ${result.earliestReturn}.`
        );
      }),
  });


  const handleReset = () => {
    setInput({ ...DEFAULT_INPUT });
    setShowDetailed(false);
  };


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container py-6">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary p-2.5">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Vila vid beredskap{" "}
                <span className="text-xs font-normal text-muted-foreground">Testversion 1.9</span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Räkna ut vilken vila du ska och får ta ut efter aktivt arbete under beredskap
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6 pb-20">
        {/* Disclaimer */}
        <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
          <p className="text-sm text-muted-foreground">
            Det här verktyget är ett stöd för att räkna ut ledighet och vila efter störning under
            beredskap. Slutlig bedömning görs tillsammans med chef eller beredskapsledare enligt gällande regler
            och lokala rutiner. Observera att du får ha beredskap en vecka i taget och inte arbeta mer än 12 dagar i rad enligt gällande regler och lokala rutiner.
          </p>
        </div>

        {/* Mode tabs */}
        <Tabs value={mode} onValueChange={(v) => setMode(v as "day" | "week")}>
          <TabsList className="w-full">
            <TabsTrigger value="day" className="flex-1">En dag</TabsTrigger>
            <TabsTrigger value="week" className="flex-1">Hel vecka</TabsTrigger>
          </TabsList>

          <TabsContent value="day" className="space-y-6 mt-6">
            {/* Form */}
            <RestForm input={input} onChange={setInput} onReset={handleReset} />

            {/* Show detailed toggle */}
            {isComplete && (
              <div className="flex items-center gap-2">
                <Switch
                  id="detailed"
                  checked={showDetailed}
                  onCheckedChange={setShowDetailed}
                />
                <Label htmlFor="detailed" className="text-sm text-muted-foreground cursor-pointer">
                  Visa detaljerad uträkning
                </Label>
              </div>
            )}




            {/* Results */}
            {result && (
              <>
                <ResultDisplay result={result} workDayStart={input.workDayStart} workDayEnd={input.workDayEnd} nextDayOff={input.nextDayOff} disturbanceDayOff={input.disturbanceDayOff} />
                {showDetailed && <DetailedBreakdown result={result} />}
              </>
            )}

          </TabsContent>

          <TabsContent value="week" className="mt-6">
            <WeekView />
          </TabsContent>
        </Tabs>

        {/* Info */}
        <RestInfoBox />
        <InfoBox />
      </main>
    </div>
  );
}
