import { useState } from "react";
import { CalcInput } from "@/lib/calculations";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

interface RestFormProps {
  input: CalcInput;
  onChange: (input: CalcInput) => void;
  onReset: () => void;
  hideUsedBeredskapsvila?: boolean;
}

const DEFAULT_INPUT: CalcInput = {
  activeWorkStart: "",
  activeWorkEnd: "",
  prevWorkDayStart: "07:00",
  prevWorkDayEnd: "15:30",
  workDayStart: "07:00",
  workDayEnd: "15:30",
  usedBeredskapsvila: 0,
  crossesMidnight: false,
  prevDayOff: false,
  nextDayOff: false,
};

export { DEFAULT_INPUT };

export default function RestForm({ input, onChange, onReset, hideUsedBeredskapsvila }: RestFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = (field: keyof CalcInput, value: string | number | boolean) => {
    const newInput = { ...input, [field]: value };

    // Auto-detect midnight crossing
    if (field === "activeWorkStart" || field === "activeWorkEnd") {
      const start = field === "activeWorkStart" ? (value as string) : input.activeWorkStart;
      const end = field === "activeWorkEnd" ? (value as string) : input.activeWorkEnd;
      if (start && end) {
        const [sh] = start.split(":").map(Number);
        const [eh] = end.split(":").map(Number);
        if (sh > eh || (sh === eh && start > end)) {
          newInput.crossesMidnight = true;
        }
      }
    }

    // Validering
    const newErrors: Record<string, string> = {};
    if (typeof newInput.usedBeredskapsvila === "number" && newInput.usedBeredskapsvila > 8) {
      newErrors.usedBeredskapsvila = "Max 8 timmar per beredskapsvecka";
    }
    if (typeof newInput.usedBeredskapsvila === "number" && newInput.usedBeredskapsvila < 0) {
      newErrors.usedBeredskapsvila = "Kan inte vara negativt";
    }
    setErrors(newErrors);

    onChange(newInput);
  };

  return (
    <div className="bg-card rounded-lg border p-5 space-y-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          Fyll i informationen nedan
        </h2>
        <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground">
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Nollställ
        </Button>
      </div>

      {/* Föregående arbetsdag */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-muted-foreground mb-1">
          Ordinarie schema dagen innan störningen inträffade
        </legend>
        {!input.prevDayOff && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="prevWorkStart" className="text-xs">Start</Label>
            <Input
              id="prevWorkStart"
              type="time"
              value={input.prevWorkDayStart}
              onChange={(e) => update("prevWorkDayStart", e.target.value)}
              className="mt-1 text-lg h-12"
            />
          </div>
          <div>
            <Label htmlFor="prevWorkEnd" className="text-xs">Slut</Label>
            <Input
              id="prevWorkEnd"
              type="time"
              value={input.prevWorkDayEnd}
              onChange={(e) => update("prevWorkDayEnd", e.target.value)}
              className="mt-1 text-lg h-12"
            />
          </div>
        </div>
        )}
        <div className="flex items-center gap-2">
          <Switch
            id="prevDayOff"
            checked={!!input.prevDayOff}
            onCheckedChange={(checked) => update("prevDayOff", checked)}
          />
          <Label htmlFor="prevDayOff" className="text-sm text-muted-foreground cursor-pointer">
            Jag var ledig enligt ordinarie schema (exempelvis helgdag)
          </Label>
        </div>
      </fieldset>

      {/* Aktivt arbete */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-muted-foreground mb-1">
          Aktivt arbete under beredskap (störning)
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="activeStart" className="text-xs">Starttid</Label>
            <Input
              id="activeStart"
              type="time"
              value={input.activeWorkStart}
              onChange={(e) => update("activeWorkStart", e.target.value)}
              className="mt-1 text-lg h-12"
            />
          </div>
          <div>
            <Label htmlFor="activeEnd" className="text-xs">Sluttid</Label>
            <Input
              id="activeEnd"
              type="time"
              value={input.activeWorkEnd}
              onChange={(e) => update("activeWorkEnd", e.target.value)}
              className="mt-1 text-lg h-12"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="midnight"
            checked={input.crossesMidnight}
            onCheckedChange={(checked) => update("crossesMidnight", checked)}
          />
          <Label htmlFor="midnight" className="text-sm text-muted-foreground cursor-pointer">
            Arbetspasset passerade midnatt
          </Label>
        </div>
      </fieldset>

      {/* Ordinarie arbetstid nästa dag */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-muted-foreground mb-1">
          Ordinarie arbetstid nästa dag
        </legend>
        <div className="flex items-center gap-2">
          <Switch
            id="nextDayOff"
            checked={!!input.nextDayOff}
            onCheckedChange={(checked) => update("nextDayOff", checked)}
          />
          <Label htmlFor="nextDayOff" className="text-sm text-muted-foreground cursor-pointer">
            Jag är ledig nästkommande dag
          </Label>
        </div>
        {!input.nextDayOff && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="workStart" className="text-xs">Start</Label>
            <Input
              id="workStart"
              type="time"
              value={input.workDayStart}
              onChange={(e) => update("workDayStart", e.target.value)}
              className="mt-1 text-lg h-12"
            />
          </div>
          <div>
            <Label htmlFor="workEnd" className="text-xs">Slut</Label>
            <Input
              id="workEnd"
              type="time"
              value={input.workDayEnd}
              onChange={(e) => update("workDayEnd", e.target.value)}
              className="mt-1 text-lg h-12"
            />
          </div>
        </div>
        )}
      </fieldset>


      {/* Redan uttagen beredskapsvila */}
      {!hideUsedBeredskapsvila && (
        <div className="space-y-1.5">
          <Label htmlFor="usedVila" className="text-sm font-medium text-muted-foreground">
            Redan uttagen veckoberedskap med lön denna beredskapsvecka
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="usedVila"
              type="number"
              min={0}
              max={8}
              step={0.5}
              value={input.usedBeredskapsvila === 0 ? "" : input.usedBeredskapsvila}
              onChange={(e) => {
                const val = e.target.value;
                update("usedBeredskapsvila", val === "" ? 0 : parseFloat(val));
              }}
              className="w-24 text-lg h-12"
            />
            <span className="text-sm text-muted-foreground">timmar (av 8)</span>
          </div>
          {errors.usedBeredskapsvila && (
            <p className="text-sm text-destructive">{errors.usedBeredskapsvila}</p>
          )}
        </div>
      )}
    </div>
  );
}
