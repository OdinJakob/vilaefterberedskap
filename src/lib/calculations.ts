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
  const workStartMins = timeToMinutes(input.workDayStart);
  const workEndMins = timeToMinutes(input.workDayEnd);

  // Beräkna varaktighet för aktivt arbete
  let activeWorkMinutes: number;
  const crossesMidnight = input.crossesMidnight || activeEndMins <= activeStartMins;
  if (crossesMidnight) {
    activeWorkMinutes = (1440 - activeStartMins) + activeEndMins;
  } else {
    activeWorkMinutes = activeEndMins - activeStartMins;
  }
  const activeWorkHours = activeWorkMinutes / 60;

  // 1. OBLIGATORISK VILA (00–06-regeln)
  // Timmar aktivt arbete mellan 00:00–06:00
  const nightMins = nightWorkMinutes(activeStartMins, activeEndMins, crossesMidnight);
  const nightWorkHrs = nightMins / 60;
  const mandatoryRestHours = nightWorkHrs;

  // Beräkna vila före störning (föregående arbetsslut → störningens start)
  let restBeforeMinutes: number;
  if (activeStartMins >= workEndMins) {
    restBeforeMinutes = activeStartMins - workEndMins;
  } else {
    restBeforeMinutes = (1440 - workEndMins) + activeStartMins;
  }
  const restBeforeHours = restBeforeMinutes / 60;

  // Vila efter störning (störningens slut → ordinarie arbetsstart)
  let restAfterMinutes: number;
  if (crossesMidnight) {
    // Störningen slutar efter midnatt
    restAfterMinutes = workStartMins - activeEndMins;
  } else {
    if (activeEndMins <= workStartMins) {
      restAfterMinutes = workStartMins - activeEndMins;
    } else {
      restAfterMinutes = (1440 - activeEndMins) + workStartMins;
    }
  }
  const restAfterHours = restAfterMinutes / 60;

  // 2. INSKRÄNKT DYGNSVILA
  // Längsta sammanhängande dygnsvila = max(vila före störning, vila efter störning)
  const longestContinuousRest = Math.max(restBeforeHours, restAfterHours);

  // Inskränkt = 11 - längsta vila, men aldrig mer än störningens varaktighet
  const rawInskrankt = Math.max(0, DAILY_REST_REQUIRED - longestContinuousRest);
  const totalInskranktDygnsvila = Math.min(rawInskrankt, activeWorkHours);

  // 3. Ytterligare inskränkt dygnsvila utöver obligatorisk vila
  // (det som "får" tas ut utöver det som "ska" tas ut)
  const additionalInskranktHours = Math.max(0, totalInskranktDygnsvila - mandatoryRestHours);

  // 4. Total ledighet = obligatorisk + ytterligare inskränkt
  const totalRestHours = mandatoryRestHours + additionalInskranktHours;

  // 5. Beredskapsvila (veckoberedskapsavtalet)
  const remainingWeekly = Math.max(0, WEEKLY_BEREDSKAPSVILA_MAX - input.usedBeredskapsvila);
  const beredskapsvila = Math.min(totalRestHours, remainingWeekly, SINGLE_BEREDSKAPSVILA_MAX);
  const inskanktDygnsvila = Math.max(0, totalRestHours - beredskapsvila);

  // 6. Tidigast åter i arbete
  const earliestReturnMins = workStartMins + Math.round(totalRestHours * 60);
  const earliestReturn = minutesToTime(earliestReturnMins);

  // 7. Kvarvarande beredskapsvila
  const remainingAfter = Math.max(0, remainingWeekly - beredskapsvila);

  // 8. Varningar
  if (beredskapsvila < totalRestHours && beredskapsvila >= SINGLE_BEREDSKAPSVILA_MAX) {
    warnings.push(
      `Max ${SINGLE_BEREDSKAPSVILA_MAX} timmars beredskapsvila kan tas ut vid ett tillfälle. ` +
      `Resterande ${formatHoursShort(inskanktDygnsvila)} klassas som inskränkt dygnsvila.`
    );
  }

  if (remainingWeekly < totalRestHours) {
    warnings.push(
      `Obs: Kvarvarande beredskapsvila denna vecka (${formatHoursShort(remainingWeekly)}) ` +
      `räcker inte för hela vilobehovet.`
    );
  }

  const requiresManagerConsultation = additionalInskranktHours > 0;

  if (requiresManagerConsultation) {
    warnings.push(
      "Inskränkt dygnsvila kräver avstämning med chef om den ska tas ut direkt eller sparas tills beredskapsveckan är slut."
    );
  }

  return {
    activeWorkHours,
    nightWorkHours: nightWorkHrs,
    mandatoryRestHours,
    longestContinuousRest,
    totalInskranktDygnsvila,
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
      workDayStart: "07:00",
      workDayEnd: "15:30",
      usedBeredskapsvila: 5,
      crossesMidnight: false,
    },
  },
];
