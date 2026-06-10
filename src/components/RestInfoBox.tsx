import { useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";

export default function RestInfoBox() {
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
            Hur registreras vila efter aktivt arbete under beredskap?
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
          <p>
            Om man under sin beredskap går in och arbetar övertid mellan 00.00-06.00 ska vila läggas ut med timme per timme motsvarande det antal timmar som arbetats mellan kl 00.00-06.00. Vilan ska läggas ut samma dag (arbetspasset som börjar efter störningen). Tiden kan registreras som veckoberedskap med lön, vila pga inskränkt dygnsvila, komptid eller veckoberedskap utan lön.
          </p>
          <p>
            Om omfattande störningar inträffar under beredskapsperioden kan situationer uppstå då ytterligare vila, på grund av arbetsmiljöskäl, behöver förläggas tidigare än efter beredskapsperiodens slut. Tiden kan registreras som veckoberedskap med lön, vila pga inskränkt dygnsvila, komptid eller veckoberedskap utan lön.
          </p>
        </div>
      )}
    </div>
  );
}
