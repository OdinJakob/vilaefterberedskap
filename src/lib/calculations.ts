/**
 * Vila vid beredskap – beräkningslogik
 *
 * Regler enligt dokumentet "Vila vid beredskap – Kompensation enligt Veckoberedskapsavtalet":
 *
 * 1. OBLIGATORISK VILA (00–06-regeln):
 *    Kompensera för utebliven vila mellan 00:00–06:00.
 *    Vila läggs ut timme per timme motsvarande aktivt arbete mellan 00:00–06:00.
 *    Tiden ska läggas ut samma dag (arbetspasset som börjar efter tjänstgöringsnatten).
 *
 * 2. INSKRÄNKT DYGNSVILA:
 *    11 timmars sammanhängande dygnsvila krävs per 24-timmarsperiod.
 *    Räkna den längsta sammanhängande dygnsvilan utifrån störningar.
 *    Inskränkt dygnsvila = 11 - längsta sammanhängande vila.
 *    Den kompenserande vilan ska aldrig bli längre än störningens varaktighet.
 *    Samlas normalt i en "pott" och kompenseras vid beredskapsperiodens slut,
 *    men kan användas tidigare vid arbetsmiljöskäl.
 *
 * 3. VECKOBEREDSKAPSAVTALET (lokalt kollektivavtal):
 *    Max 8 timmars betald beredskapsvila per beredskapsvecka.
 *    Max 6 timmar per ledighetstillfälle.
 *    Används i första hand för att täcka vilobehov.
 */

export interface CalcInput {
  /** Starttid för aktivt arbete (HH:mm) */
  activeWorkStart: string;
  /** Sluttid för aktivt arbete (HH:mm) */
  activeWorkEnd: string;
  /** Start ordinarie arbetstid föregående arbetsdag (HH:mm) */
  prevWorkDayStart: string;
  /** Slut ordinarie arbetstid föregående arbetsdag (HH:mm) */
  prevWorkDayEnd: string;
  /** Start ordinarie arbetstid nästa dag (HH:mm) */
  workDayStart: string;
  /** Slut ordinarie arbetstid nästa dag (HH:mm) */
  workDayEnd: string;
  /** Redan uttagen beredskapsvila denna vecka (timmar, decimal) */
  usedBeredskapsvila: number;
  /** Om arbetspasset passerar midnatt */
  crossesMidnight: boolean;
  /** Ledig föregående arbetsdag (ingen ordinarie arbetstid dagen före) */
  prevDayOff?: boolean;
  /** Ledig nästkommande dag (ingen ordinarie arbetstid dagen efter) */
  nextDayOff?: boolean;
  /** Ledig det dygn (enligt dygnsbryt) störningen inträffar – ingen kompenserande vila tjänas in */
  disturbanceDayOff?: boolean;
  /** Dygnsbryt (HH:mm) – ankare för 24-timmarsperioden */
  dygnsbryt?: string;
}

export interface CalcResult {
  /** Timmar aktivt arbete */
  activeWorkHours: number;
  /** Timmar aktivt arbete mellan 00:00–06:00 */
  nightWorkHours: number;
  /** Obligatorisk ledighet (timmar) – 00–06-regeln – "ska vara ledig" */
  mandatoryRestHours: number;
  /** Längsta sammanhängande vila under viloperioden */
  longestContinuousRest: number;
  /** Total inskränkt dygnsvila (11 - längsta vila, max störningstid) */
  totalInskranktDygnsvila: number;
  /** Inskränkt dygnsvila oavsett rätt till betald vila (informativt) */
  rawInskranktDygnsvila: number;
  /** Ytterligare inskränkt dygnsvila utöver obligatorisk – "får vara ledig" */
  additionalInskranktHours: number;
  /** Total ledighet (obligatorisk + ytterligare inskränkt) */
  totalRestHours: number;
  /** Beredskapsvila som kan tas ut (timmar) */
  beredskapsvila: number;
  /** Resterande som klassas som inskränkt dygnsvila */
  inskanktDygnsvila: number;
  /** Tidigast åter i arbete (HH:mm) */
  earliestReturn: string;
  /** Kvarvarande beredskapsvila denna vecka (timmar) */
  remainingWeeklyBeredskapsvila: number;
  /** Vila före störning (timmar) */
  restBeforeDisturbance: number;
  /** Vila efter störning till arbetsstart (timmar) */
  restAfterDisturbance: number;
  /** Kräver avstämning med chef */
  requiresManagerConsultation: boolean;
  /** Varningsmeddelanden */
  warnings: string[];
}

// Konstanter
const DAILY_REST_REQUIRED = 11; // timmar
const NIGHT_START = 0; // 00:00 i minuter
const NIGHT_END = 360; // 06:00 i minuter
const WEEKLY_BEREDSKAPSVILA_MAX = 8; // timmar per vecka
const SINGLE_BEREDSKAPSVILA_MAX = 6; // max per tillfälle

/**
 * Konverterar HH:mm till minuter från midnatt
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function windowOffset(clockMins: number, dygnsbrytMins: number): number {
  return (((clockMins - dygnsbrytMins) % 1440) + 1440) % 1440;
}

export function minutesUntilWorkStartOrDygnsbryt(
  disturbanceEndOffset: number,
  workStartClockMins: number | null,
  dygnsbrytMins: number,
  disturbanceStartOffset?: number,
): number {
  const nextDygnsbryt = 1440;
  if (workStartClockMins === null) {
    return Math.max(0, nextDygnsbryt - disturbanceEndOffset);
  }

  const workStartOffset = windowOffset(workStartClockMins, dygnsbrytMins);
  if (
    disturbanceStartOffset !== undefined &&
    workStartOffset > disturbanceStartOffset &&
    workStartOffset <= disturbanceEndOffset
  ) {
    return 0;
  }
  const nextWorkStart = workStartOffset <= disturbanceEndOffset
    ? workStartOffset + 1440
    : workStartOffset;
  return Math.max(0, Math.min(nextWorkStart, nextDygnsbryt) - disturbanceEndOffset);
}

/**
 * Vila från det sista arbetets slut (störning eller ordinarie pass) till
 * nästa arbetspass eller dygnsbryt, vilket som infaller först.
 * Start- och slutoffset kan ligga bortom dygnsfönstret (> 1440) om
 * störningen sträcker sig över dygnsbrytet.
 */
export function restAfterLastWork(
  workStartOffset: number,
  workEndOffset: number,
  nextWorkStartClockMins: number | null,
  dygnsbrytMins: number,
): number {
  const nextDygnsbryt = (Math.floor(workEndOffset / 1440) + 1) * 1440;
  if (nextWorkStartClockMins === null) {
    return Math.max(0, nextDygnsbryt - workEndOffset);
  }
  const ws0 = windowOffset(nextWorkStartClockMins, dygnsbrytMins);
  // Börjar nästa arbetspass inne i det aktuella arbetet finns ingen vila.
  if (ws0 > workStartOffset && ws0 <= workEndOffset) return 0;
  let ws = ws0;
  while (ws <= workEndOffset) ws += 1440;
  return Math.max(0, Math.min(ws, nextDygnsbryt) - workEndOffset);
}

/**
 * Formaterar minuter till HH:mm
 */
function minutesToTime(minutes: number): string {
  const totalMins = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Formaterar timmar till "X timmar Y minuter"
 */
export function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h} timmar`;
  if (h === 0) return `${m} minuter`;
  return `${h} timmar ${m} minuter`;
}

/**
 * Formaterar timmar till kort form "X,X h"
 */
export function formatHoursShort(hours: number): string {
  if (hours === Math.floor(hours)) return `${hours} h`;
  return `${hours.toFixed(1).replace(".", ",")} h`;
}

/**
 * Beräknar hur många minuter av ett arbetspass som ligger mellan 00:00–06:00
 */
function nightWorkMinutes(activeStartMins: number, activeEndMins: number, crossesMidnight: boolean): number {
  if (!crossesMidnight && activeEndMins > activeStartMins) {
    // Inget midnattspassage, t.ex. 01:00–04:00
    const overlapStart = Math.max(activeStartMins, NIGHT_START);
    const overlapEnd = Math.min(activeEndMins, NIGHT_END);
    return Math.max(0, overlapEnd - overlapStart);
  } else {
    // Passerar midnatt, t.ex. 20:00–03:00
    // Del 1: [activeStart, 24:00] – overlap med [00:00, 06:00]
    // Bara relevant om activeStart < 06:00 (t.ex. start 02:00)
    const part1 = activeStartMins < NIGHT_END
      ? Math.max(0, NIGHT_END - activeStartMins)
      : 0;

    // Del 2: [00:00, activeEnd] – overlap med [00:00, 06:00]
    const part2 = Math.min(activeEndMins, NIGHT_END);

    // Undvik dubbelräkning om start < 06:00 och slut < 06:00
    // I normalfallet (t.ex. 20:00–03:00) är part1 = 0, part2 = 180 (3h)
    // Om t.ex. 02:00–05:00 (ej midnattspassage) hanteras ovan
    return part1 + part2;
  }
}

/**
 * Huvudberäkning
 *
 * Beräkningsperiod: från föregående dags arbetsslut till nästa dags arbetsstart.
 */
export function calculateRest(input: CalcInput): CalcResult {
  const warnings: string[] = [];

  // Parsa tider
  const activeStartMins = timeToMinutes(input.activeWorkStart);
  const activeEndMins = timeToMinutes(input.activeWorkEnd);
  const workStartMins = timeToMinutes(input.workDayStart || "07:00");
  const workEndMins = timeToMinutes(input.workDayEnd || "15:30");
  const prevWorkStartMins = timeToMinutes(input.prevWorkDayStart || input.workDayStart || "07:00");
  const prevWorkEndMins = timeToMinutes(input.prevWorkDayEnd || input.workDayEnd || "15:30");
  const dygnsbrytMins = timeToMinutes(input.dygnsbryt || "06:00");

  // Beräkna varaktighet för aktivt arbete
  let activeWorkMinutes: number;
  const crossesMidnight = activeEndMins <= activeStartMins;
  if (crossesMidnight) {
    activeWorkMinutes = (1440 - activeStartMins) + activeEndMins;
  } else {
    activeWorkMinutes = activeEndMins - activeStartMins;
  }

  // Vilofönstret är 24 timmar med dygnsbryt som ankare.
  // Inom fönstret placeras föregående och nästa ordinarie schema samt störningen.
  // Längsta sammanhängande vila = största lucka mellan dessa event inom fönstret.
  const anchor = dygnsbrytMins;
  const fwd = (t: number) => windowOffset(t, anchor);

  type Interval = { s: number; e: number; kind: "prev" | "next" | "dist" };
  const intervals: Interval[] = [];

  const addIntervalAt = (
    absS: number,
    durMins: number,
    kind: Interval["kind"],
  ) => {
    if (durMins <= 0) return;
    const absE = absS + durMins;
    const cs = Math.max(0, absS);
    const ce = Math.min(1440, absE);
    if (ce > cs) intervals.push({ s: cs, e: ce, kind });
  };

  const disturbanceStartOffset = fwd(activeStartMins);
  const disturbanceEndOffset = disturbanceStartOffset + activeWorkMinutes;

  if (!input.prevDayOff) {
    const dur = prevWorkEndMins >= prevWorkStartMins
      ? prevWorkEndMins - prevWorkStartMins
      : 1440 - prevWorkStartMins + prevWorkEndMins;
    let prevStartOffset = fwd(prevWorkStartMins);
    // Passet tillhör föregående dygn om det annars skulle börja efter störningen i fönstret
    if (prevStartOffset >= disturbanceStartOffset) prevStartOffset -= 1440;
    // Om passet överlappar störningens start klipps det vid störningens start
    const clippedDur = Math.min(dur, disturbanceStartOffset - prevStartOffset);
    addIntervalAt(prevStartOffset, clippedDur, "prev");
  }
  if (!input.nextDayOff) {
    const dur = workEndMins >= workStartMins
      ? workEndMins - workStartMins
      : 1440 - workStartMins + workEndMins;
    const nextStartOffset = fwd(workStartMins);
    addIntervalAt(nextStartOffset <= disturbanceStartOffset ? nextStartOffset + 1440 : nextStartOffset, dur, "next");
  }
  addIntervalAt(disturbanceStartOffset, activeWorkMinutes, "dist");

  // Aktivt arbete: störningens varaktighet exkl. överlapp med ordinarie schema.
  // Beräknas på störningens absoluta klocktider, oberoende av dygnsbrytet.
  // Om störningen börjar under ett ordinarie pass räknas den först från passets slut,
  // och om den slutar under ett ordinarie pass räknas den bara fram till passets start.
  const workAbs: { s: number; e: number }[] = [];
  if (!input.prevDayOff) {
    const prevDur = prevWorkEndMins >= prevWorkStartMins
      ? prevWorkEndMins - prevWorkStartMins
      : 1440 - prevWorkStartMins + prevWorkEndMins;
    // Normalfallet: passet slutar före (eller vid) störningens start.
    const gap = ((activeStartMins - prevWorkEndMins) % 1440 + 1440) % 1440;
    let e = -gap;
    // Om passet överlappar störningens start (slutar efter den) räknas det som samma dygn,
    // så att störningen bara räknas från ordinarie schemats slut.
    const eFwd = ((prevWorkEndMins - activeStartMins) % 1440 + 1440) % 1440;
    if (eFwd > 0 && eFwd <= prevDur) e = eFwd;
    workAbs.push({ s: e - prevDur, e });
  }
  if (!input.nextDayOff) {
    const nextDur = workEndMins >= workStartMins
      ? workEndMins - workStartMins
      : 1440 - workStartMins + workEndMins;
    // Nästa pass placeras så att det startar efter (eller vid) störningens slut.
    const gap = ((workStartMins - activeEndMins) % 1440 + 1440) % 1440;
    const s = activeWorkMinutes + gap;
    workAbs.push({ s, e: s + nextDur });
  }
  let distPieces: { s: number; e: number }[] = [{ s: 0, e: activeWorkMinutes }];
  for (const w of workAbs) {
    const next: { s: number; e: number }[] = [];
    for (const p of distPieces) {
      const os = Math.max(p.s, w.s);
      const oe = Math.min(p.e, w.e);
      if (oe <= os) { next.push(p); continue; }
      if (p.s < os) next.push({ s: p.s, e: os });
      if (oe < p.e) next.push({ s: oe, e: p.e });
    }
    distPieces = next;
  }
  const activeWorkHours =
    distPieces.reduce((s, i) => s + (i.e - i.s), 0) / 60;

  // Natt-overlap för störningen – baseras på absoluta klocktider.
  const nightMins = distPieces.reduce((sum, p) => {
    const sClock = ((activeStartMins + p.s) % 1440 + 1440) % 1440;
    const eClock = ((activeStartMins + p.e) % 1440 + 1440) % 1440;
    const dur = p.e - p.s;
    const crosses = dur > 0 && eClock <= sClock;
    return sum + nightWorkMinutes(sClock, eClock, crosses);
  }, 0);
  const nightWorkHrs = nightMins / 60;
  // Är man ledig det dygn (enligt dygnsbryt) störningen inträffar tjänas ingen
  // kompenserande vila in – varken obligatorisk vila eller inskränkt dygnsvila.
  const dayOffBlocked = !!input.disturbanceDayOff;
  // Obligatorisk vila (arbete 00–06) gäller även om störningsdygnet var ledigt.
  const mandatoryRestHours = nightWorkHrs;

  // Vila före störning: från föregående pass slut (eller dygnsbryt) till störningens
  // effektiva start. Överlappar störningens start ordinarie schema räknas störningen
  // från schemats slut och vilan före störningen blir 0.
  const prevInt = intervals.find((i) => i.kind === "prev");
  const prevEndOffset = prevInt ? prevInt.e : 0;
  const effectiveDistStart = Math.max(disturbanceStartOffset, prevEndOffset);
  const restBeforeMin = Math.max(0, effectiveDistStart - prevEndOffset);

  // Dygnsvilan mäts från det sista arbetets slut (störningens slut, eller
  // dagens ordinarie pass om det slutar senare) till nästa arbetspass eller
  // dygnsbryt – vila före arbetspasset räknas inte.
  const restAfterMin = restAfterLastWork(
    disturbanceStartOffset,
    Math.max(disturbanceEndOffset, prevEndOffset),
    input.nextDayOff ? null : workStartMins,
    dygnsbrytMins,
  );
  const longestMin = restAfterMin;

  const restBeforeHours = restBeforeMin / 60;
  const restAfterHours = restAfterMin / 60;
  const longestContinuousRest = longestMin / 60;

  // Inskränkt = 11 - längsta sammanhängande vila, men aldrig längre än störningens varaktighet.
  // Är man ledig dagen efter störningen sparas timmarna i potten och kan tas ut
  // i samband med dygnsvila vid beredskapsperiodens slut.
  const rawInskrankt = Math.max(0, DAILY_REST_REQUIRED - longestContinuousRest);
  const rawInskranktDygnsvila = Math.min(rawInskrankt, activeWorkHours);
  const totalInskranktDygnsvila = dayOffBlocked ? 0 : rawInskranktDygnsvila;

  // 3. Ytterligare inskränkt dygnsvila utöver obligatorisk vila
  // (det som "får" tas ut utöver det som "ska" tas ut)
  const additionalInskranktHours = Math.max(0, totalInskranktDygnsvila - mandatoryRestHours);

  // 4. Total ledighet = obligatorisk + ytterligare inskränkt
  const totalRestHours = mandatoryRestHours + additionalInskranktHours;

  // 5. Beredskapsvila (veckoberedskapsavtalet)
  const remainingWeekly = Math.max(0, WEEKLY_BEREDSKAPSVILA_MAX - input.usedBeredskapsvila);
  const beredskapsvila = Math.min(totalRestHours, remainingWeekly, SINGLE_BEREDSKAPSVILA_MAX, activeWorkHours);
  const inskanktDygnsvila = Math.max(0, totalRestHours - beredskapsvila);

  // 6. Tidigast åter i arbete
  const earliestReturnMins = workStartMins + Math.round(mandatoryRestHours * 60);
  const earliestReturn = minutesToTime(earliestReturnMins);

  // 7. Kvarvarande beredskapsvila
  const remainingAfter = Math.max(0, remainingWeekly - beredskapsvila);

  // 8. Varningar

  if (remainingWeekly < totalRestHours) {
    warnings.push(
      `Obs: Kvarvarande beredskapsvila denna vecka (${formatHoursShort(remainingWeekly)}) ` +
      `räcker inte för hela vilobehovet.`
    );
  }

  const requiresManagerConsultation = additionalInskranktHours > 0;

  return {
    activeWorkHours,
    nightWorkHours: nightWorkHrs,
    mandatoryRestHours,
    longestContinuousRest,
    totalInskranktDygnsvila,
    rawInskranktDygnsvila,
    additionalInskranktHours,
    totalRestHours,
    beredskapsvila,
    inskanktDygnsvila,
    earliestReturn,
    remainingWeeklyBeredskapsvila: remainingAfter,
    restBeforeDisturbance: restBeforeHours,
    restAfterDisturbance: restAfterHours,
    requiresManagerConsultation,
    warnings,
  };
}

/** Fördefinierade exempelscenarier */
export interface ExampleScenario {
  title: string;
  description: string;
  input: CalcInput;
}

export const EXAMPLE_SCENARIOS: ExampleScenario[] = [
  {
    title: "Exempel 1 – Nattlig störning",
    description: "Aktivt arbete 00:00–03:00, ordinarie arbetstid 07:00–15:30",
    input: {
      activeWorkStart: "00:00",
      activeWorkEnd: "03:00",
      prevWorkDayStart: "07:00",
      prevWorkDayEnd: "15:30",
      workDayStart: "07:00",
      workDayEnd: "15:30",
      usedBeredskapsvila: 0,
      crossesMidnight: false,
    },
  },
  {
    title: "Exempel 2 – Kvälls- och nattstörning",
    description: "Aktivt arbete 20:00–03:00, ordinarie arbetstid 07:00–15:30",
    input: {
      activeWorkStart: "20:00",
      activeWorkEnd: "03:00",
      prevWorkDayStart: "07:00",
      prevWorkDayEnd: "15:30",
      workDayStart: "07:00",
      workDayEnd: "15:30",
      usedBeredskapsvila: 0,
      crossesMidnight: true,
    },
  },
  {
    title: "Exempel 3 – Redan använd beredskapsvila",
    description: "Aktivt arbete 01:00–04:00, redan använt 5 timmar denna vecka",
    input: {
      activeWorkStart: "01:00",
      activeWorkEnd: "04:00",
      prevWorkDayStart: "07:00",
      prevWorkDayEnd: "15:30",
      workDayStart: "07:00",
      workDayEnd: "15:30",
      usedBeredskapsvila: 5,
      crossesMidnight: false,
    },
  },
];
