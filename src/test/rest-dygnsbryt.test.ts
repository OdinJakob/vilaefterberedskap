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

  it("räknar vilan före störningen när dygnsbrytet är på morgonen", () => {
    const res = calculateRest({
      ...base,
      activeWorkStart: "03:00",
      activeWorkEnd: "05:00",
      crossesMidnight: false,
      dygnsbryt: "07:00",
    });
    // Schema 07–16: vila 16:00–03:00 = 11 h, vila efter störningen
    // 05:00–07:00 = 2 h. Längsta vila blir 11 h och dygnsvilan är uppfylld.
    expect(res.usesRestBeforeInLongest).toBe(true);
    expect(res.restBeforeDisturbance).toBe(11);
    expect(res.restAfterDisturbance).toBe(2);
    expect(res.longestContinuousRest).toBe(11);
    expect(res.totalInskranktDygnsvila).toBe(0);
  });

  it("räknar alltid längsta vilan inom dygnet – störning 05–07 med dygnsbryt 19 ger 10 h", () => {
    const res = calculateRest({
      ...base,
      activeWorkStart: "05:00",
      activeWorkEnd: "07:00",
      crossesMidnight: false,
      dygnsbryt: "19:00",
    });
    // Vilan 19:00–05:00 (10 h) ligger inom dygnet och räknas.
    expect(res.longestContinuousRest).toBe(10);
    expect(res.totalInskranktDygnsvila).toBe(1);
  });

  it("räknar vilan före störningen även vid dygnsbryt på kvällen", () => {
    const res = calculateRest({
      ...base,
      activeWorkStart: "06:00",
      activeWorkEnd: "06:30",
      crossesMidnight: false,
      dygnsbryt: "19:00",
      prevDayOff: true,
    });
    expect(res.usesRestBeforeInLongest).toBe(true);
    expect(res.restBeforeDisturbance).toBe(11);
    expect(res.restAfterDisturbance).toBe(0.5);
    // Längsta vila inom dygnet är 19:00–06:00 = 11 h, så dygnsvilan är uppfylld.
    expect(res.longestContinuousRest).toBe(11);
    expect(res.totalInskranktDygnsvila).toBe(0);
  });
});
