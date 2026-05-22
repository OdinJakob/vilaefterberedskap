import { useState, useMemo } from "react";
import { CalcInput, calculateRest } from "@/lib/calculations";
import RestForm, { DEFAULT_INPUT } from "@/components/RestForm";
import ResultDisplay from "@/components/ResultDisplay";
import DetailedBreakdown from "@/components/DetailedBreakdown";
import ExampleScenarios from "@/components/ExampleScenarios";
import InfoBox from "@/components/InfoBox";
import WeekView from "@/components/WeekView";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Shield } from "lucide-react";

export default function Index() {
  const [input, setInput] = useState<CalcInput>({ ...DEFAULT_INPUT });
  const [showDetailed, setShowDetailed] = useState(false);
  const [mode, setMode] = useState<"day" | "week">("day");

  const isComplete =
    input.activeWorkStart !== "" &&
    input.activeWorkEnd !== "" &&
    input.prevWorkDayStart !== "" &&
    input.prevWorkDayEnd !== "" &&
    input.workDayStart !== "" &&
    input.workDayEnd !== "";

  const result = useMemo(() => {
    if (!isComplete) return null;
    return calculateRest(input);
  }, [input, isComplete]);

  const handleReset = () => {
    setInput({ ...DEFAULT_INPUT });
    setShowDetailed(false);
  };

  const handleExampleSelect = (exInput: CalcInput) => {
    setInput({ ...exInput });
    setMode("day");
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
                <span className="text-xs font-normal text-muted-foreground">Testversion 1.0</span>
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
            Det här verktyget är ett stöd för att räkna ut ledighet efter störning under
            beredskap. Slutlig bedömning görs tillsammans med chef enligt gällande regler
            och lokala rutiner.
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
                <ResultDisplay result={result} workDayStart={input.workDayStart} />
                {showDetailed && <DetailedBreakdown result={result} />}
              </>
            )}

            {/* Examples */}
            <ExampleScenarios onSelect={handleExampleSelect} />
          </TabsContent>

          <TabsContent value="week" className="mt-6">
            <WeekView />
          </TabsContent>
        </Tabs>

        {/* Info */}
        <InfoBox />
      </main>
    </div>
  );
}
