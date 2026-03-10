/**
 * Vila vid beredskap – beräkningslogik
 *
 * Regler:
 * - 11 timmars dygnsvila krävs per 24-timmarsperiod
 * - 36 timmars veckovila krävs
 * - Vid störning under beredskap gäller minst 7 timmars sammanhängande vila
 *   efter att störningen upphört innan arbetet återupptas
 * - 8 timmars betald beredskapsvila per beredskapsvecka (lokalt kollektivavtal)
 * - Max 6 timmars beredskapsvila vid ett tillfälle
 */

export interface CalcInput {
  /** Starttid för aktivt arbete (HH:mm) */
  activeWorkStart: string;
  /** Sluttid för aktivt arbete (HH:mm) */
  activeWorkEnd: string;
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
  /** Obligatorisk ledighet (timmar) – "ska vara ledig" */
  mandatoryRestHours: number;
  /** Inskränkt dygnsvila (timmar) – "får vara ledig" */
  restrictedDailyRestHours: number;
  /** Total ledighet */
  totalRestHours: number;
  /** Beredskapsvila som kan tas ut (timmar) */
  beredskapsvila: number;
  /** Inskränkt dygnsvila som klassas separat */
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
const MIN_REST_AFTER_DISTURBANCE = 7; // timmar – minsta sammanhängande vila
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
  const totalMins = ((minutes % 1440) + 1440) % 1440; // hantera negativa & > 24h
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
 * Huvudberäkning
 *
 * Antar att föregående arbetsdag hade samma schema som nästa arbetsdag.
 * Beräkningsperiod: från föregående dags arbetsslut till nästa dags arbetsstart.
 */
export function calculateRest(input: CalcInput): CalcResult {
  const warnings: string[] = [];

  // Parsa tider
  const activeStartMins = timeToMinutes(input.activeWorkStart);
  let activeEndMins = timeToMinutes(input.activeWorkEnd);
  const workStartMins = timeToMinutes(input.workDayStart);
  const workEndMins = timeToMinutes(input.workDayEnd);

  // Hantera midnattspassering
  if (input.crossesMidnight || activeEndMins <= activeStartMins) {
    // Aktivt arbete börjar före midnatt, slutar efter
    // Normalisera: activeStart är på dag 0, activeEnd är på dag 1
  }

  // Beräkna varaktighet för aktivt arbete
  let activeWorkMinutes: number;
  if (activeEndMins <= activeStartMins) {
    // Passerar midnatt
    activeWorkMinutes = (1440 - activeStartMins) + activeEndMins;
  } else {
    activeWorkMinutes = activeEndMins - activeStartMins;
  }
  const activeWorkHours = activeWorkMinutes / 60;

  // Beräkna vila före störning
  // Antar föregående arbetsdag slutade vid workEndMins (samma schema)
  // Vila = tid från föregående arbetsslut till störningens start
  let restBeforeMinutes: number;
  if (activeStartMins >= workEndMins) {
    // Störningen börjar samma dag som arbetet slutade (t.ex. arbete slutar 15:30, störning 20:00)
    restBeforeMinutes = activeStartMins - workEndMins;
  } else {
    // Störningen börjar efter midnatt (t.ex. arbete slutar 15:30, störning 00:00 nästa dag)
    restBeforeMinutes = (1440 - workEndMins) + activeStartMins;
  }
  const restBeforeHours = restBeforeMinutes / 60;

  // Vila efter störning till arbetsstart (utan förskjutning)
  let restAfterMinutes: number;
  if (activeEndMins <= activeStartMins) {
    // Störningen slutar efter midnatt, dag 1
    restAfterMinutes = workStartMins - activeEndMins;
  } else {
    // Störningen slutar samma dag som den börjar
    // Vila = från störningsslut (dag 0 eller 1) till arbetsstart (dag 1)
    if (activeEndMins <= workStartMins) {
      // Slutar efter midnatt men före arbetsstart
      restAfterMinutes = workStartMins - activeEndMins;
    } else {
      // Slutar efter arbetsstart – det borde inte hända normalt
      restAfterMinutes = (1440 - activeEndMins) + workStartMins;
    }
  }
  const restAfterHours = restAfterMinutes / 60;

  // 1. Obligatorisk ledighet ("ska vara ledig")
  // Minst MIN_REST_AFTER_DISTURBANCE timmars sammanhängande vila efter störning
  const mandatoryRestHours = Math.max(0, MIN_REST_AFTER_DISTURBANCE - restAfterHours);

  // 2. Inskränkt dygnsvila ("får vara ledig")
  // Total vila utan förskjutning = restBefore + restAfter
  // Med obligatorisk förskjutning: total = restBefore + mandatoryRest
  // Om detta < 11h → deficit = inskränkt dygnsvila
  const totalRestWithMandatory = restBeforeHours + MIN_REST_AFTER_DISTURBANCE;
  const restrictedDailyRestHours = Math.max(
    0,
    DAILY_REST_REQUIRED - totalRestWithMandatory
  );
  // Avrunda till närmaste 0.5
  const restrictedRounded =
    Math.round(restrictedDailyRestHours * 2) / 2;

  const totalRestHours = mandatoryRestHours + restrictedRounded;

  // 3. Beredskapsvila (lokalt kollektivavtal)
  const remainingWeekly = Math.max(
    0,
    WEEKLY_BEREDSKAPSVILA_MAX - input.usedBeredskapsvila
  );

  // Beredskapsvila = min(totalRestHours, remainingWeekly, SINGLE_MAX)
  const beredskapsvila = Math.min(
    totalRestHours,
    remainingWeekly,
    SINGLE_BEREDSKAPSVILA_MAX
  );
  const inskanktDygnsvila = Math.max(0, totalRestHours - beredskapsvila);

  // 4. Tidigast åter i arbete
  const earliestReturnMins = workStartMins + Math.round(totalRestHours * 60);
  const earliestReturn = minutesToTime(earliestReturnMins);

  // 5. Kvarvarande beredskapsvila
  const remainingAfter = Math.max(0, remainingWeekly - beredskapsvila);

  // 6. Varningar
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

  const requiresManagerConsultation = restrictedRounded > 0;

  if (requiresManagerConsultation) {
    warnings.push(
      "Inskränkt dygnsvila kräver avstämning med chef om den ska tas ut direkt eller senare under beredskapsveckan."
    );
  }

  return {
    activeWorkHours,
    mandatoryRestHours,
    restrictedDailyRestHours: restrictedRounded,
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
