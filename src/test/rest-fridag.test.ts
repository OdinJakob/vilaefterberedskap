import { describe, it, expect } from "vitest";
import { calculateRest, CalcInput } from "@/lib/calculations";

const base: CalcInput = {
  activeWorkStart: "20:00",
  activeWorkEnd: "03:00",
  prevWorkDayStart: "07:00",
  prevWorkDayEnd: "15:30",
  workDayStart: "07:00",
  workDayEnd: "15:30",
  usedBeredskapsvila: 0,
  crossesMidnight: true,
};

describe("ledig dagen efter (fridag)", () => {
  it("ger inskränkt dygnsvila även när nästa dag är ledig – timmarna sparas i potten", () => {
    const res = calculateRest({ ...base, nextDayOff: true });
    expect(res.totalInskranktDygnsvila).toBeGreaterThan(0);
    expect(res.totalInskranktDygnsvila).toBe(res.rawInskranktDygnsvila);
    expect(res.mandatoryRestHours).toBe(res.nightWorkHours);
  });

  it("beräknar samma inskränkt dygnsvila oavsett om nästa dag är ledig eller inte", () => {
    const withWork = calculateRest({ ...base, nextDayOff: false });
    const off = calculateRest({ ...base, nextDayOff: true });
    expect(off.totalInskranktDygnsvila).toBe(withWork.rawInskranktDygnsvila);
  });
});
