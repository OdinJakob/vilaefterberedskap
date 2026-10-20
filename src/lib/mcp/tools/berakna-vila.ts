import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { calculateRest } from "../../calculations";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const timeField = (description: string) =>
  z.string().regex(timePattern, "Ange tid i formatet HH:mm").describe(description);

export default defineTool({
  name: "berakna-vila",
  title: "Beräkna beredskapsvila",
  description:
    "Beräknar obligatorisk vila, inskränkt dygnsvila och beredskapsvila med lön för en störning under beredskap, enligt veckoberedskapsavtalet.",
  inputSchema: {
    activeWorkStart: timeField("Starttid för aktivt arbete under störningen (HH:mm)."),
    activeWorkEnd: timeField("Sluttid för aktivt arbete under störningen (HH:mm)."),
    prevWorkDayStart: timeField("Start ordinarie schema dagen före störningen (HH:mm)."),
    prevWorkDayEnd: timeField("Slut ordinarie schema dagen före störningen (HH:mm)."),
    workDayStart: timeField("Start ordinarie schema dagen efter störningen (HH:mm)."),
    workDayEnd: timeField("Slut ordinarie schema dagen efter störningen (HH:mm)."),
    usedBeredskapsvila: z
      .number()
      .min(0)
      .max(8)
      .describe("Redan uttagen betald beredskapsvila denna beredskapsvecka, i timmar."),
    crossesMidnight: z.boolean().describe("Om störningens aktiva arbete passerar midnatt."),
    prevDayOff: z
      .boolean()
      .optional()
      .describe("Sant om användaren var ledig enligt ordinarie schema dagen före störningen."),
    nextDayOff: z
      .boolean()
      .optional()
      .describe("Sant om användaren är ledig enligt ordinarie schema dagen efter störningen."),
    dygnsbryt: timeField("Dygnsbryt (HH:mm), t.ex. 06:00.").optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (input) => {
    const result = calculateRest(input);
    return {
      content: [
        {
          type: "text",
          text:
            `Obligatorisk vila (måste vara ledig): ${result.mandatoryRestHours} h. ` +
            `Inskränkt dygnsvila: ${result.totalInskranktDygnsvila} h. ` +
            `Beredskapsvila med lön: ${result.beredskapsvila} h. ` +
            `Tidigast åter i arbete: ${result.earliestReturn}.`,
        },
      ],
      structuredContent: {
        obligatoriskVilaTimmar: result.mandatoryRestHours,
        inskranktDygnsvilaTimmar: result.totalInskranktDygnsvila,
        beredskapsvilaMedLonTimmar: result.beredskapsvila,
        aktivtArbeteTimmar: result.activeWorkHours,
        nattarbeteTimmar: result.nightWorkHours,
        langstaSammanhangandeVilaTimmar: result.longestContinuousRest,
        vilaForeStorningTimmar: result.restBeforeDisturbance,
        vilaEfterStorningTimmar: result.restAfterDisturbance,
        tidigastAterIArbete: result.earliestReturn,
        kvarvarandeBeredskapsvilaVeckaTimmar: result.remainingWeeklyBeredskapsvila,
        kraverAvstamningMedChef: result.requiresManagerConsultation,
        varningar: result.warnings,
      },
    };
  },
});
