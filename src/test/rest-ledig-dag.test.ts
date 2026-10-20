import { describe, it, expect } from "vitest";
import { calculateRest, CalcInput } from "@/lib/calculations";

// Nattstörning 20:00–03:00 (som natten lördag–söndag), ledig hela dygnet
const base: CalcInput = {
  activeWorkStart: "20:00",
  activeWorkEnd: "03:00",
  prevWorkDayStart: "07:00",
  prevWorkDayEnd: "15:30",
  workDayStart: "07:00",
  workDayEnd: "15:30",
  usedBeredskapsvila: 0,
  crossesMidnight: true,
  dygnsbryt: "06:00",
};

describe("ledig det dygn störningen inträffar", () => {
  it("ger ingen kompenserande vila på ett ledigt dygn", () => {
    const res = calculateRest({ ...base, disturbanceDayOff: true, prevDayOff: true, nextDayOff: true });
    expect(res.mandatoryRestHours).toBe(0);
    expect(res.totalInskranktDygnsvila).toBe(0);
    expect(res.additionalInskranktHours).toBe(0);
    expect(res.beredskapsvila).toBe(0);
  });

  it("visar fortfarande den inskränkta dygnsvilan informativt", () => {
    const res = calculateRest({ ...base, disturbanceDayOff: true, prevDayOff: true, nextDayOff: true });
    expect(res.rawInskranktDygnsvila).toBeGreaterThan(0);
    expect(res.activeWorkHours).toBeGreaterThan(0);
  });

  it("ger kompenserande vila på ett arbetsdygn (t.ex. natten till lördag)", () => {
    const res = calculateRest({ ...base, disturbanceDayOff: false });
    expect(res.mandatoryRestHours).toBeGreaterThan(0);
    expect(res.totalInskranktDygnsvila).toBeGreaterThan(0);
  });
});
