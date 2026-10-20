import { describe, it, expect } from "vitest";
import { calculateRest, CalcInput } from "@/lib/calculations";

// Dygnsbryt 19:00, ordinarie schema 07–16 två dagar i rad,
// störning 16:00–03:00 mellan arbetspassen.
const base: CalcInput = {
  activeWorkStart: "16:00",
  activeWorkEnd: "03:00",
  prevWorkDayStart: "07:00",
  prevWorkDayEnd: "16:00",
  workDayStart: "07:00",
  workDayEnd: "16:00",
  usedBeredskapsvila: 0,
  crossesMidnight: true,
  dygnsbryt: "19:00",
};

describe("dygnsvila mäts från sista arbetets slut", () => {
  it("störning 16–03 med dygnsbryt 19 ger 7 h inskränkt dygnsvila", () => {
    const res = calculateRest(base);
    // Vilan 19:00–07:00 (12 h) före arbetspasset räknas inte; dygnsvilan är
    // 03:00–07:00 = 4 h, så inskränkningen är 11 - 4 = 7 h.
    expect(res.longestContinuousRest).toBe(4);
    expect(res.restAfterDisturbance).toBe(4);
    expect(res.totalInskranktDygnsvila).toBe(7);
    expect(res.mandatoryRestHours).toBe(3);
  });

  it("störning 20–23 med dygnsbryt 19 ger fortfarande 3 h inskränkt dygnsvila", () => {
    const res = calculateRest({ ...base, activeWorkStart: "20:00", activeWorkEnd: "23:00", crossesMidnight: false });
    expect(res.longestContinuousRest).toBe(8);
    expect(res.totalInskranktDygnsvila).toBe(3);
  });
});
