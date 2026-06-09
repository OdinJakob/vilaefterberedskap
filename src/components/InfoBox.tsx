import { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";

export default function InfoBox() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="result-card-info rounded-lg border p-5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-start gap-3 w-full text-left"
      >
        <Info className="h-4 w-4 text-info mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-foreground font-medium">
            Vad är skillnaden mellan beredskapsvila och inskränkt dygnsvila?
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="mt-4 space-y-3 text-sm text-muted-foreground animate-fade-in">
          <div>
            <h4 className="font-medium text-foreground">Veckoberedskapsvila med lön</h4>
            <p className="mt-1">
              Enligt lokalt kollektivavtal har du rätt till 8 timmars betald beredskapsvila
              per beredskapsvecka. Max 6 timmar kan tas ut vid ett enskilt tillfälle.
              Beredskapsvila är en kompensation för att du blivit störd under din beredskap.
              Beredskapsvila registreras som veckoberedskap med lön i Personnec.
            </p>
          </div>
          <div>
            <h4 className="font-medium text-foreground">Inskränkt dygnsvila</h4>
            <p className="mt-1">
              Enligt arbetstidslagen har du rätt till 11 timmars sammanhängande dygnsvila
              under varje 24-timmarsperiod. Om din dygnsvila blivit inskränkt (mindre
              än 11 timmar) på grund av aktivt arbete under beredskap, ska du kompenseras
              med motsvarande viloperiod. Detta är en rättighet enligt lag, inte enligt
              kollektivavtal.
            </p>
          </div>
          <div className="bg-card/60 rounded-md p-3 border border-border/50">
            <p className="text-xs">
              <strong>Viktigt:</strong> Slutlig bedömning görs alltid tillsammans med chef
              enligt gällande regler och lokala rutiner. Detta verktyg ger ett beslutstöd,
              inte juridisk rådgivning.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
