"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bookmark,
  BrainCircuit,
  ChevronDown,
  Globe2,
  Layers3,
  MapPin,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { GlobeCanvas } from "@/components/globe-canvas";
import { countryAtCoordinates } from "@/lib/country-location.mjs";
import { DEMO_EVENTS, type NewsEvent } from "@/lib/news-data";
import { onePerImpact } from "@/lib/landing-signals.mjs";
import { countryFromInput } from "@/lib/news-search.mjs";

const features = [
  {
    icon: Search,
    number: "01",
    title: "Ask about anything",
    copy: "Search any topic, person, event, or place across a country edition or the worldwide feed.",
  },
  {
    icon: MapPin,
    number: "02",
    title: "See where it happened",
    copy: "Event locations are inferred from each report, checked with Google Maps, and plotted in context.",
  },
  {
    icon: BrainCircuit,
    number: "03",
    title: "Understand the impact",
    copy: "Event impact is scored separately from article tone, so a positive outcome can still be reported in serious language.",
  },
];

const essentials = [
  {
    icon: Radio,
    number: "04",
    title: "Live sources stay visible",
    copy: "Headlines, publishers, times, and links come from Google News through SerpApi. Open any source to read the full report.",
  },
  {
    icon: Layers3,
    number: "05",
    title: "Context is added clearly",
    copy: "Pulse Atlas groups related reports into events, estimates their location and topic, and shows confidence for its impact and tone analysis.",
  },
  {
    icon: ShieldCheck,
    number: "06",
    title: "Private by design",
    copy: "Your location becomes a country inside your browser; precise coordinates are not sent to SerpApi. An account is needed only to save snapshots.",
  },
];

export function LandingPage() {
  const [events, setEvents] = useState<NewsEvent[]>(DEMO_EVENTS);
  const [selectedId, setSelectedId] = useState(DEMO_EVENTS[0].id);
  const [edition, setEdition] = useState("Worldwide");
  const [editionCode, setEditionCode] = useState("WORLD");
  const [locationSource, setLocationSource] = useState<"detecting" | "browser" | "saved" | "fallback">("detecting");
  const [signalMode, setSignalMode] = useState<"loading" | "live" | "preview">("loading");
  const signals = useMemo(() => onePerImpact(events) as NewsEvent[], [events]);
  const selected = useMemo(
    () => events.find((event) => event.id === selectedId) ?? signals[0] ?? DEMO_EVENTS[0],
    [events, selectedId, signals],
  );

  useEffect(() => {
    let cancelled = false;

    async function load(countryName: string, source: "browser" | "saved" | "fallback") {
      const country = countryFromInput(countryName) ?? countryFromInput("Worldwide")!;
      const params = new URLSearchParams({ days: "7", edition: country.code, balanced: "1" });
      if (country.code !== "world") params.set("q", `${country.name} news`);
      try {
        const response = await fetch(`/api/news?${params}`);
        const payload = await response.json() as { mode: "live" | "demo"; events: NewsEvent[] };
        if (cancelled || !payload.events.length) return;
        const nextSignals = onePerImpact(payload.events) as NewsEvent[];
        setEvents(payload.events);
        setSelectedId((nextSignals[0] ?? payload.events[0]).id);
        setEdition(country.name);
        setEditionCode(country.code.toUpperCase());
        setLocationSource(source);
        setSignalMode(payload.mode === "live" ? "live" : "preview");
      } catch {
        if (!cancelled) setSignalMode("preview");
      }
    }

    let savedCountry = "";
    let locationAsked = false;
    try {
      savedCountry = window.localStorage.getItem("pulse-atlas-country") ?? "";
      locationAsked = window.localStorage.getItem("pulse-atlas-location-asked") === "1";
    } catch {
      // Browser storage is optional.
    }
    if (countryFromInput(savedCountry)) {
      void load(savedCountry, "saved");
    } else if (!navigator.geolocation || locationAsked) {
      void load("Worldwide", "fallback");
    } else {
      try { window.localStorage.setItem("pulse-atlas-location-asked", "1"); } catch { /* Optional preference only. */ }
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const detected = countryAtCoordinates(coords.latitude, coords.longitude);
          if (detected) {
            try { window.localStorage.setItem("pulse-atlas-country", detected.name); } catch { /* Optional preference only. */ }
            void load(detected.name, "browser");
          } else {
            void load("Worldwide", "fallback");
          }
        },
        () => void load("Worldwide", "fallback"),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 86_400_000 },
      );
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (signals.length < 2) return;
    const timer = window.setInterval(() => {
      setSelectedId((current) => {
        const index = signals.findIndex((event) => event.id === current);
        return signals[(index + 1) % signals.length].id;
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [signals]);

  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Main navigation">
        <Link href="/" className="landing-brand" aria-label="Pulse Atlas home">
          <span className="landing-brand-mark"><Globe2 aria-hidden="true" /></span>
          <span><strong>Pulse Atlas</strong><small>Global events, seen in place</small></span>
        </Link>
        <div className="landing-nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#capabilities">Capabilities</a>
          <a href="#what-to-know">What to know</a>
        </div>
        <Link href="/explore" className="landing-nav-cta">
          Open atlas <ArrowRight aria-hidden="true" />
        </Link>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-live-pill"><Radio aria-hidden="true" /> Live world intelligence</span>
          <h1>See the world.<br /><em>Understand the signal.</em></h1>
          <p>
            Turn live news into a geographic story. Explore events by place, time,
            topic, and impact on one interactive globe.
          </p>
          <div className="landing-actions">
            <Link href="/explore" className="landing-primary-cta">
              Explore the live globe <ArrowRight aria-hidden="true" />
            </Link>
            <a href="#how-it-works" className="landing-secondary-cta">
              See how it works <ChevronDown aria-hidden="true" />
            </a>
          </div>
          <div className="landing-proof" aria-label="Powered by">
            <span>Google News</span><i />
            <span>Google Maps</span><i />
            <span>Explainable NLP</span>
          </div>
        </div>

        <div className="landing-visual" aria-label="Interactive preview of Pulse Atlas">
          <div className="landing-visual-halo" />
          <div className="landing-console">
            <div className="landing-console-bar">
              <span><i /> {signalMode === "loading" ? "Locating signal" : signalMode === "live" ? `${edition} signal` : "Preview signal"}</span>
              <span>Rolling 7 days</span>
            </div>
            <div className="landing-globe">
              <GlobeCanvas
                events={events}
                selectedId={selectedId}
                viewMode="events"
                onSelect={(event) => setSelectedId(event.id)}
              />
            </div>
            <div
              className="landing-location-badge"
              title="Only this country edition is sent to SerpApi. Your precise coordinates stay in this browser."
            >
              <MapPin aria-hidden="true" />
              <span>
                <small>News edition sent to SerpApi</small>
                <strong>{locationSource === "detecting" ? "Detecting location…" : `${edition} · ${editionCode}`}</strong>
                <em>{locationSource === "browser" ? "Browser-detected country" : locationSource === "saved" ? "Saved country preference" : locationSource === "fallback" ? "Location unavailable · worldwide fallback" : "Waiting for browser location"}</em>
              </span>
            </div>
            <div className="landing-map-legend">
              <span><i className="positive" /> Positive</span>
              <span><i className="neutral" /> Neutral</span>
              <span><i className="negative" /> Negative</span>
            </div>
          </div>
          <article className="landing-story-card" aria-live="polite">
            <div className="landing-story-top"><span className={`landing-impact ${selected.sentiment}`}><i />{selected.sentiment} impact</span><small>{selected.category}</small></div>
            <h2>{selected.title}</h2>
            <p><MapPin aria-hidden="true" /> {selected.location}</p>
            <div className="landing-story-cycle">
              <span>{edition} edition</span>
              <div aria-label="Rotating impact stories">
                {signals.map((event) => (
                  <button
                    key={event.id}
                    className={`${event.sentiment} ${event.id === selected.id ? "active" : ""}`}
                    onClick={() => setSelectedId(event.id)}
                    aria-label={`Show ${event.sentiment} story`}
                  />
                ))}
              </div>
            </div>
          </article>
          <span className="landing-orbit-label label-one">LOCATE</span>
          <span className="landing-orbit-label label-two">INTERPRET</span>
        </div>
      </section>

      <section className="landing-signal-strip" aria-label="Pulse Atlas capabilities">
        <div><Radio aria-hidden="true" /><span><strong>Live search</strong>Fresh results from Google News</span></div>
        <div><Globe2 aria-hidden="true" /><span><strong>Global context</strong>Any country or worldwide edition</span></div>
        <div><Layers3 aria-hidden="true" /><span><strong>Less noise</strong>Related coverage grouped as events</span></div>
        <div><Bookmark aria-hidden="true" /><span><strong>Keep the signal</strong>Save stable story snapshots</span></div>
      </section>

      <section id="how-it-works" className="landing-section landing-how">
        <div className="landing-section-heading">
          <span className="landing-kicker">From headline to place</span>
          <h2>News becomes clearer<br />when you can see it.</h2>
          <p>Pulse Atlas turns a stream of headlines into explorable, accountable geographic context.</p>
        </div>
        <div className="landing-feature-grid">
          {features.map(({ icon: Icon, number, title, copy }) => (
            <article key={number} className="landing-feature-card">
              <div><span>{number}</span><Icon aria-hidden="true" /></div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="capabilities" className="landing-section landing-lenses">
        <div className="landing-lens-copy">
          <span className="landing-kicker">Your question. Your lens.</span>
          <h2>Move from global pulse<br />to the story you need.</h2>
          <p>
            Start with the news around you or search worldwide. Narrow the globe by
            time, topic, event impact, and subcategory—then switch to an attention heatmap.
          </p>
          <Link href="/explore" className="landing-text-link">Start exploring <ArrowRight aria-hidden="true" /></Link>
        </div>
        <div className="landing-query-demo">
          <div className="landing-query-bar"><Search aria-hidden="true" /><span>renewable energy breakthroughs</span><kbd>↵</kbd></div>
          <div className="landing-filter-pills"><span>Worldwide</span><span>Past 7 days</span><span className="active"><Sparkles aria-hidden="true" /> Positive</span></div>
          <div className="landing-results-demo">
            <div><i className="positive" /><span><strong>Jakarta, Indonesia</strong>Coastal restoration project opens new wetlands</span><small>Climate</small></div>
            <div><i className="positive" /><span><strong>Osaka, Japan</strong>Advance reported in recyclable battery chemistry</span><small>Science</small></div>
            <div><i className="neutral" /><span><strong>São Paulo, Brazil</strong>Clinics expand prevention program</span><small>Health</small></div>
          </div>
        </div>
      </section>

      <section id="what-to-know" className="landing-section">
        <div className="landing-section-heading">
          <span className="landing-kicker">What to know</span>
          <h2>Clear sources.<br />Clear context.</h2>
          <p>See what came from the news result, what Pulse Atlas added, and how your location and saved stories are handled.</p>
        </div>
        <div className="landing-feature-grid">
          {essentials.map(({ icon: Icon, number, title, copy }) => (
            <article key={number} className="landing-feature-card">
              <div><span>{number}</span><Icon aria-hidden="true" /></div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-final-cta">
        <div className="landing-final-glow" />
        <span className="landing-kicker">The world is already moving</span>
        <h2>See what is happening—and where.</h2>
        <p>Open Pulse Atlas and shape the signal around the questions that matter to you.</p>
        <Link href="/explore" className="landing-primary-cta">Launch Pulse Atlas <ArrowRight aria-hidden="true" /></Link>
      </section>

      <footer className="landing-footer">
        <Link href="/" className="landing-brand"><span className="landing-brand-mark"><Globe2 aria-hidden="true" /></span><span><strong>Pulse Atlas</strong></span></Link>
        <p>Live news data enriched with place and context.</p>
        <span>Built with SerpApi</span>
      </footer>
    </main>
  );
}
