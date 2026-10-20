import { defineMcp } from "@lovable.dev/mcp-js";
import beraknaVilaTool from "./tools/berakna-vila";

export default defineMcp({
  name: "beredskapsvila-guide",
  title: "Beredskapsvila Guide",
  version: "0.1.0",
  instructions:
    "Verktyg för att beräkna vila vid beredskap enligt veckoberedskapsavtalet. " +
    "Använd `berakna-vila` för att räkna ut obligatorisk vila, inskränkt dygnsvila och beredskapsvila med lön för en störning.",
  tools: [beraknaVilaTool],
});
