import { EXAMPLE_SCENARIOS, CalcInput } from "@/lib/calculations";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";

interface ExampleScenariosProps {
  onSelect: (input: CalcInput) => void;
}

export default function ExampleScenarios({ onSelect }: ExampleScenariosProps) {
  return (
    <div className="bg-card rounded-lg border p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground mb-3">Vanliga exempel</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Klicka på ett exempel för att fylla i formuläret automatiskt.
      </p>
      <div className="space-y-2">
        {EXAMPLE_SCENARIOS.map((scenario, i) => (
          <button
            key={i}
            onClick={() => onSelect(scenario.input)}
            className="w-full text-left rounded-lg border border-border/60 hover:border-primary/40 hover:bg-secondary/50 transition-colors p-4 group"
          >
            <div className="flex items-start gap-3">
              <FileText className="h-4 w-4 text-muted-foreground mt-0.5 group-hover:text-primary transition-colors" />
              <div>
                <p className="font-medium text-sm text-foreground">{scenario.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{scenario.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
