# Helsinki Explorer

PWA-sovellus Helsingin matkailijoille — ohjatut matkat, interaktiivinen kartta ja paikalliset vinkit.

## Teknologiapino

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS v4** + shadcn/ui
- **Supabase** — autentikointi ja tietokanta
- **MapLibre GL JS** — kartat
- **Dexie.js** — offline-välimuisti (IndexedDB)
- **next-pwa** — PWA / service worker

---

## Paikalliset kehitysasetukset

### 1. Vaatimukset

- Node.js 18 tai uudempi
- npm 9 tai uudempi

### 2. Asenna riippuvuudet

```bash
cd helsinki-explorer
npm install
```

### 3. Ympäristömuuttujat

Luo tiedosto `.env.local` projektin juureen:

```env
NEXT_PUBLIC_SUPABASE_URL=https://dzralcgwnchvjxaesaea.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-tähän>
```

> `.env.local` on jo lisätty `.gitignore`en — sitä ei koskaan commitoida GitHubiin.

### 4. Käynnistä kehityspalvelin

```bash
npm run dev
```

Avaa selaimessa: [http://localhost:3000](http://localhost:3000)

---

## Kansiorakenne

```
src/
├── app/                  # Next.js App Router -sivut
│   ├── page.tsx          # / – Tervetulosivu
│   ├── onboarding/       # /onboarding – Matkan luontilomake
│   ├── trips/            # /trips – Matkalista
│   │   └── [id]/         # /trips/[id] – Yksittäinen matka
│   ├── map/              # /map – Karttanäkymä
│   ├── profile/          # /profile – Käyttäjäprofiili
│   └── offline/          # /offline – Offline-fallback
├── components/
│   ├── BottomNav.tsx     # Mobiilinavigaatio
│   ├── MapView.tsx       # MapLibre GL -karttakomponentti
│   └── ui/               # shadcn/ui-komponentit
├── lib/
│   ├── supabase/
│   │   ├── client.ts     # Supabase client (selain)
│   │   └── server.ts     # Supabase client (server)
│   └── db/
│       └── offline.ts    # Dexie offline-tietokanta
├── providers/
│   └── AuthProvider.tsx  # Anonyymi autentikointi + React Context
└── types/
    └── database.types.ts # TypeScript-tyypit Supabase-tauluille
```

---

## Reitit

| Reitti | Kuvaus |
|---|---|
| `/` | Tervetulosivu |
| `/onboarding` | Matkan luontilomake (kesto, budjetti, kiinnostukset) |
| `/trips` | Lista käyttäjän matkoista |
| `/trips/[id]` | Yksittäisen matkan päiväohjelma |
| `/map` | Helsinki-karttanäkymä |
| `/profile` | Käyttäjäprofiili ja pisteet |
| `/offline` | Näytetään kun ei ole internet-yhteyttä |

---

## Muuta

- PWA on käytössä vain **production-buildissa** (`npm run build && npm start`)
- Kehityspalvelimella service worker on pois käytöstä tarkoituksella
