# Vila vid beredskap

Beredskapsvila är ett beräkningsverktyg som stödjer hanteringen av dygnsvila efter arbete under beredskap. Genom att registrera när en störning inträffat och hur länge arbetet pågått beräknar verktyget hur mycket kompensationsvila som ska tas ut. Verktyget är avsett att användas av medarbetare, beredskapsledare och chefer för att säkerställa en enhetlig och korrekt tillämpning av gällande regler och lokala tillämpningar för beredskap och vila.

Verktyget hjälper medarbetare och chefer att räkna ut:
- obligatorisk ledighet enligt 00–06-regeln
- inskränkt dygnsvila (11-timmarsregeln)
- hur mycket beredskapsvila som kan tas ut ur veckopotten (max 8 h/vecka, max 6 h/tillfälle)

Applikationen är en ren frontend utan backend eller externa API-anrop. Alla beräkningar sker lokalt i webbläsaren.

Byggd av Montell Partners och överlämnad till kund juni 2026. Nuvarande version: **1.6**.

---

## Innehåll

- [Kom igång](#kom-igång)
- [Tillgängliga kommandon](#tillgängliga-kommandon)
- [Kodstruktur](#kodstruktur)
- [Tester](#tester)
- [Deployment](#deployment)
- [Förvaltning och vidareutveckling](#förvaltning-och-vidareutveckling)
- [Kontakt](#kontakt)

---

## Kom igång

### Förutsättningar

- [Node.js](https://nodejs.org/) version 18 eller senare
- npm (följer med Node.js)

Kontrollera din version:

```sh
node --version   # ska vara 18+
npm --version
```

### Installation

```sh
# Klona repot
git clone <GIT_URL>
cd vilaefterberedskap

# Installera beroenden
npm install

# Starta lokal utvecklingsserver
npm run dev
```

Öppna [http://localhost:5173](http://localhost:5173) i webbläsaren.

> Inga miljövariabler eller konfigurationsfiler behövs — applikationen har inga externa beroenden.

---

## Tillgängliga kommandon

| Kommando | Beskrivning |
|---|---|
| `npm run dev` | Startar lokal utvecklingsserver med hot reload |
| `npm run build` | Bygger produktionsversion till mappen `dist/` |
| `npm run preview` | Förhandsgranskar produktionsbygget lokalt |
| `npm run lint` | Kör ESLint |
| `npm run test` | Kör enhetstester (Vitest) |
| `npm run test:watch` | Kör tester i watch-läge |

---

## Kodstruktur

```
src/
├── components/         # UI-komponenter
│   ├── ui/             # Generiska shadcn/ui-komponenter (redigeras normalt ej)
│   ├── RestForm.tsx    # Inmatningsformulär för störningen
│   ├── ResultDisplay.tsx     # Visar beräkningsresultat
│   ├── DetailedBreakdown.tsx # Detaljerad uträkning (expanderbar)
│   ├── WeekView.tsx    # Veckovyn (flera dagar)
│   ├── InfoBox.tsx     # Regelinformation
│   └── ...
├── lib/
│   ├── calculations.ts # All beräkningslogik (kärnfil)
│   └── utils.ts        # Hjälpfunktioner
├── pages/
│   ├── Index.tsx       # Huvudsida
│   └── NotFound.tsx    # 404-sida
└── main.tsx            # Applikationens startpunkt
```

Den viktigaste filen är `src/lib/calculations.ts` — all affärslogik för vila- och beredskapsvila­beräkningarna finns här, med utförliga kommentarer om vilka regler som tillämpas.

---

## Tester

Projektet har testats genom E2E-tester med nyckelpersoner för att validera beräkningslogiken.

---

## Deployment

Applikationen är en statisk webbapp och kan hostas på valfri statisk hostingtjänst.

### Bygg produktionsversion

```sh
npm run build
```

Utdata hamnar i mappen `dist/`. Dessa filer kan laddas upp till valfri webbserver eller CDN.

### Rekommenderade hostingalternativ

---

## Förvaltning och vidareutveckling

### Uppdatera beräkningsregler

All regellogik finns i `src/lib/calculations.ts`. Filen är kommenterad med hänvisningar till vilka avtalsparagrafer som styr respektive beräkning. Vid regeländringar i avtalet — börja där.

### Lägga till exempelscenarier

Exempelscenarion definieras i `EXAMPLE_SCENARIOS`-arrayen längst ner i `src/lib/calculations.ts`.

### Uppdatera beroenden

```sh
# Se vilka paket som är inaktuella
npm outdated

# Uppdatera ett specifikt paket
npm update <paketnamn>
```

Viktigt: `shadcn/ui`-komponenterna i `src/components/ui/` uppdateras via `shadcn`-CLI:n, inte via npm. Se [shadcn/ui-dokumentationen](https://ui.shadcn.com/docs/installation) vid behov.

### Tech stack

| Teknik       | Version | Syfte                      |
|---           |---      |---                         |
| React        | 18      | UI-ramverk                 |
| TypeScript   | 5       | Typsäkerhet                |
| Vite         | 5       | Byggverktyg och dev-server |
| Tailwind CSS | 3       | Styling                    |
| shadcn/ui    | —       | UI-komponentbibliotek      |
| React Router | 6       | Routing                    |
| Vitest       | 3       | Enhetstester               |
| Playwright   | 1.57    | E2E-tester                 |

---

## Kontakt

Applikationen är byggd av **Montell Partners**.

Vid frågor om kodbas, arkitektur eller vidareutveckling:

- E-post: info@montellpartners.se
- Webb: [montellpartners.se](https://montellpartners.se)
