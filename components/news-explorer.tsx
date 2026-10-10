"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  Clock3,
  Eye,
  EyeOff,
  ExternalLink,
  Flame,
  Globe2,
  Layers3,
  List,
  LockKeyhole,
  LogIn,
  LogOut,
  MapPin,
  Radio,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import { GlobeCanvas } from "@/components/globe-canvas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { countryAtCoordinates } from "@/lib/country-location.mjs";
import { DEMO_EVENTS, type NewsEvent, type Sentiment, type ViewMode } from "@/lib/news-data";
import { COUNTRIES, countryFromInput } from "@/lib/news-search.mjs";
import { countTaxonomyMatches, NEWS_TAXONOMY } from "@/lib/news-taxonomy.mjs";

type DataMode = "loading" | "live" | "demo";
type SentimentFilter = "all" | Sentiment;
type SavedItem = { eventId: string; event: NewsEvent; createdAt: string };
type LocationVerification = { verifiedCount: number; unresolvedCount: number; lookupCount: number };
type AuthUser = { id: string; email: string };
type AuthMode = "login" | "signup";
type PanelMode = "globe" | "list";
type BrowserLocation = { status: "detecting" | "detected" | "saved" | "unavailable"; country: string };

const sentimentColors: Record<Sentiment, string> = {
  positive: "var(--positive)",
  neutral: "var(--neutral)",
  negative: "var(--negative)",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function dayLabel(day: number, reference: Date) {
  const date = new Date(reference);
  date.setUTCDate(date.getUTCDate() - day);
  return new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(date);
}

export function NewsExplorer() {
  const [events, setEvents] = useState<NewsEvent[]>(DEMO_EVENTS);
  const [selectedId, setSelectedId] = useState(DEMO_EVENTS[0].id);
  const [dataMode, setDataMode] = useState<DataMode>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [days, setDays] = useState("7");
  const [country, setCountry] = useState("Worldwide");
  const [countryError, setCountryError] = useState("");
  const [activeSearch, setActiveSearch] = useState({ query: "World news", days: 7, country: "Worldwide" });
  const [sentiment, setSentiment] = useState<SentimentFilter>("all");
  const [category, setCategory] = useState("all");
  const [subcategory, setSubcategory] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("events");
  const [panelMode, setPanelMode] = useState<PanelMode>("globe");
  const [timeline, setTimeline] = useState([0, 6]);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [savedOpen, setSavedOpen] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [pendingSave, setPendingSave] = useState<NewsEvent | null>(null);
  const [verification, setVerification] = useState<LocationVerification>({ verifiedCount: 0, unresolvedCount: 0, lookupCount: 0 });
  const [browserLocation, setBrowserLocation] = useState<BrowserLocation>({ status: "detecting", country: "" });

  const loadNews = useCallback(async (countryOverride?: string) => {
    const selectedCountry = countryFromInput(countryOverride ?? country);
    if (!selectedCountry) {
      setCountryError("Choose a country from the suggestions or enter its two-letter code.");
      return;
    }
    setCountryError("");
    setRefreshing(true);
    try {
      const searchQuery = query.trim() || (selectedCountry.code === "world" ? "world news" : `${selectedCountry.name} news`);
      const params = new URLSearchParams({ days, edition: selectedCountry.code, balanced: "1" });
      params.set("q", searchQuery);
      const response = await fetch(`/api/news?${params}`);
      const payload = (await response.json()) as {
        mode: "live" | "demo";
        events: NewsEvent[];
        locationVerification?: LocationVerification;
      };
      setEvents(payload.events);
      setDataMode(payload.mode);
      setVerification(payload.locationVerification ?? { verifiedCount: 0, unresolvedCount: 0, lookupCount: 0 });
      setSelectedId(payload.events[0]?.id ?? "");
      setActiveSearch({ query: searchQuery, days: Number(days), country: selectedCountry.name });
      setTimeline([0, Number(days) - 1]);
    } catch {
      setEvents(DEMO_EVENTS);
      setDataMode("demo");
    } finally {
      setRefreshing(false);
    }
  }, [query, days, country]);
  const loadNewsRef = useRef(loadNews);

  useEffect(() => {
    loadNewsRef.current = loadNews;
  }, [loadNews]);

  const detectBrowserLocation = useCallback((fallbackToWorld = false) => {
    setBrowserLocation({ status: "detecting", country: "" });
    if (!navigator.geolocation) {
      setBrowserLocation({ status: "unavailable", country: "" });
      if (fallbackToWorld) void loadNewsRef.current("Worldwide");
      return;
    }
    try { window.localStorage.setItem("pulse-atlas-location-asked", "1"); } catch { /* Optional preference only. */ }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const detected = countryAtCoordinates(coords.latitude, coords.longitude);
        if (!detected) {
          setBrowserLocation({ status: "unavailable", country: "" });
          if (fallbackToWorld) void loadNewsRef.current("Worldwide");
          return;
        }
        setBrowserLocation({ status: "detected", country: detected.name });
        setCountry(detected.name);
        try { window.localStorage.setItem("pulse-atlas-country", detected.name); } catch { /* Optional preference only. */ }
        void loadNewsRef.current(detected.name);
      },
      () => {
        setBrowserLocation({ status: "unavailable", country: "" });
        if (fallbackToWorld) void loadNewsRef.current("Worldwide");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 86_400_000 },
    );
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      let savedCountry = "";
      let locationAsked = false;
      try {
        savedCountry = window.localStorage.getItem("pulse-atlas-country") ?? "";
        locationAsked = window.localStorage.getItem("pulse-atlas-location-asked") === "1";
      } catch {
        // Storage can be unavailable in private browsing.
      }
      const savedEdition = countryFromInput(savedCountry);
      if (savedEdition) {
        setBrowserLocation({ status: "saved", country: savedEdition.name });
        setCountry(savedEdition.name);
        void loadNewsRef.current(savedEdition.name);
        return;
      }
      if (!navigator.geolocation || locationAsked) {
        setBrowserLocation({ status: "unavailable", country: "" });
        void loadNewsRef.current("Worldwide");
        return;
      }
      detectBrowserLocation(true);
    }, 0);
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then(async (payload: { user?: AuthUser | null }) => {
        if (!payload.user) return;
        setAuthUser(payload.user);
        const response = await fetch("/api/bookmarks");
        if (!response.ok) return;
        const bookmarks = await response.json() as { bookmarks?: SavedItem[] };
        setSaved(bookmarks.bookmarks ?? []);
      })
      .catch(() => setSaved([]));
    return () => window.clearTimeout(initialLoad);
  }, [detectBrowserLocation]);

  const referenceDate = useMemo(() => {
    const newest = Math.max(...events.map((event) => new Date(event.publishedAt).getTime()));
    return new Date(Number.isFinite(newest) ? newest : 0);
  }, [events]);

  const lensEvents = useMemo(() => events.filter((event) => {
    const age = Math.floor((referenceDate.getTime() - new Date(event.publishedAt).getTime()) / 86_400_000);
    return age >= timeline[0]
      && age <= timeline[1]
      && (sentiment === "all" || event.sentiment === sentiment);
  }), [events, referenceDate, timeline, sentiment]);

  const categories = useMemo(() => Object.keys(NEWS_TAXONOMY), []);

  const subcategories = useMemo(() => {
    if (category === "all") return Object.values(NEWS_TAXONOMY).flat();
    return NEWS_TAXONOMY[category as keyof typeof NEWS_TAXONOMY] ?? [];
  }, [category]);

  const taxonomyCounts = useMemo(
    () => countTaxonomyMatches(lensEvents, category),
    [lensEvents, category],
  );

  const filtered = useMemo(() => {
    return lensEvents.filter((event) => (category === "all" || event.category === category)
      && (subcategory === "all" || event.subcategory === subcategory));
  }, [lensEvents, category, subcategory]);

  const selected = filtered.find((event) => event.id === selectedId) ?? filtered[0];
  const savedIds = useMemo(() => new Set(saved.map((item) => item.eventId)), [saved]);
  const sourceCount = filtered.reduce((total, event) => total + event.sourceCount, 0);
  const reportCount = filtered.reduce((total, event) => total + (event.articleCount ?? event.sourceCount), 0);
  const advancedFilterCount = Number(category !== "all")
    + Number(subcategory !== "all")
    + Number(timeline[0] !== 0 || timeline[1] !== activeSearch.days - 1)
    + Number(viewMode !== "events");

  const persistEvent = useCallback(async (event: NewsEvent) => {
    try {
      const response = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
      if (response.status === 401) {
        setAuthUser(null);
        setPendingSave(event);
        setAuthOpen(true);
        return { saved: false, authRequired: true };
      }
      if (!response.ok) throw new Error("Save failed");
      const item = { eventId: event.id, event, createdAt: new Date().toISOString() };
      setSaved((items) => items.some((savedItem) => savedItem.eventId === event.id) ? items : [item, ...items]);
      setSaveNotice("Saved as a stable story snapshot");
      window.setTimeout(() => setSaveNotice(""), 2800);
      return { saved: true, eventId: event.id };
    } catch {
      setSaveNotice("Could not save this story. Please try again.");
      window.setTimeout(() => setSaveNotice(""), 2800);
      return { saved: false, eventId: event.id };
    }
  }, []);

  const saveEvent = useCallback(async (event: NewsEvent) => {
    if (!authUser) {
      setPendingSave(event);
      setAuthOpen(true);
      return { saved: false, authRequired: true };
    }
    return persistEvent(event);
  }, [authUser, persistEvent]);

  async function removeSaved(eventId: string) {
    try {
      const response = await fetch(`/api/bookmarks?eventId=${encodeURIComponent(eventId)}`, { method: "DELETE" });
      if (response.ok) setSaved((items) => items.filter((item) => item.eventId !== eventId));
    } catch {
      setSaveNotice("Could not remove this story. Please try again.");
    }
  }

  async function submitAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const response = await fetch(`/api/auth/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const payload = await response.json() as { user?: AuthUser; error?: string };
      if (!response.ok || !payload.user) {
        setAuthError(payload.error ?? "Could not sign in.");
        return;
      }
      setAuthUser(payload.user);
      setAuthPassword("");
      setShowPassword(false);
      setAuthOpen(false);
      const bookmarksResponse = await fetch("/api/bookmarks");
      if (bookmarksResponse.ok) {
        const bookmarks = await bookmarksResponse.json() as { bookmarks?: SavedItem[] };
        setSaved(bookmarks.bookmarks ?? []);
      }
      if (pendingSave) {
        const eventToSave = pendingSave;
        setPendingSave(null);
        await persistEvent(eventToSave);
      }
    } catch {
      setAuthError("Could not reach account storage. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setAuthUser(null);
    setSaved([]);
  }

  useEffect(() => {
    const context = (document as Document & {
      modelContext?: {
        registerTool: (tool: Record<string, unknown>, options?: { signal?: AbortSignal }) => void | Promise<void>;
      };
    }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "filter_news",
      title: "Filter the news globe",
      description: "Update the visible globe using a sentiment and topic filter.",
      inputSchema: {
        type: "object",
        properties: {
          sentiment: { type: "string", enum: ["all", "positive", "neutral", "negative"] },
          category: { type: "string" },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: async (input: unknown) => {
        const value = input as { sentiment?: SentimentFilter; category?: string };
        if (value.sentiment) setSentiment(value.sentiment);
        if (value.category) setCategory(value.category);
        return { sentiment: value.sentiment ?? "all", category: value.category ?? "all" };
      },
    }, { signal: lifecycle.signal }));
    void Promise.resolve(context.registerTool({
      name: "bookmark_news_event",
      title: "Bookmark a news event",
      description: "Save a stable snapshot of a news event from the current globe.",
      inputSchema: {
        type: "object",
        properties: { eventId: { type: "string" } },
        required: ["eventId"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: async (input: unknown) => {
        const eventId = (input as { eventId?: string }).eventId;
        const event = events.find((item) => item.id === eventId);
        if (!event) throw new Error("Event not found in the current seven-day window.");
        return saveEvent(event);
      },
    }, { signal: lifecycle.signal }));
    return () => lifecycle.abort();
  }, [events, saveEvent]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <Link href="/" className="brand-lockup" aria-label="Pulse Atlas home">
          <span className="brand-mark"><Globe2 aria-hidden="true" /></span>
          <div>
            <h1>Pulse Atlas</h1>
            <p>Global events, seen in place</p>
          </div>
        </Link>
        <div className="topbar-status" aria-live="polite">
          <span className={`data-status ${dataMode}`}>
            <Radio aria-hidden="true" />
            {dataMode === "loading" ? "Connecting" : dataMode === "live" ? "Live · News + Maps + NLP" : "Preview dataset"}
          </span>
          <span className="location-status" title="Browser location converted to a country locally. Precise coordinates are never sent to SerpApi.">
            <MapPin aria-hidden="true" />
            <span><small>Your location</small><strong>{browserLocation.status === "detecting" ? "Detecting…" : browserLocation.country ? `${browserLocation.country}${browserLocation.status === "saved" ? " · saved" : ""}` : "Unavailable"}</strong></span>
            {(browserLocation.status === "unavailable" || browserLocation.status === "saved") && <button type="button" onClick={() => detectBrowserLocation()}>{browserLocation.status === "saved" ? "Refresh" : "Retry"}</button>}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className={`profile-button ${authUser ? "authenticated" : "guest"}`} variant="outline" aria-label={authUser ? "Open account menu" : "Open guest menu"}>
                <span className="profile-avatar">
                  {authUser ? authUser.email.charAt(0).toUpperCase() : <UserRound aria-hidden="true" />}
                  <i aria-hidden="true" />
                </span>
                <span className="profile-summary"><small>{authUser ? "Account" : "Guest"}</small><strong>{authUser ? "Signed in" : "Not signed in"}</strong></span>
                <ChevronDown className="profile-chevron" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="profile-menu">
              <DropdownMenuLabel className="profile-menu-label">
                <strong>{authUser ? "Your account" : "Guest mode"}</strong>
                <span>{authUser?.email ?? "Browse freely. Sign in only to save."}</span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSavedOpen(true)}><Bookmark aria-hidden="true" />Saved stories <span className="profile-menu-count">{saved.length}</span></DropdownMenuItem>
              <DropdownMenuItem onSelect={() => authUser ? void signOut() : setAuthOpen(true)}>
                {authUser ? <><LogOut aria-hidden="true" />Sign out</> : <><LogIn aria-hidden="true" />Sign in or create account</>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Sheet open={savedOpen} onOpenChange={setSavedOpen}>
            <SheetContent className="saved-sheet">
              <SheetHeader>
                <SheetTitle>Saved stories</SheetTitle>
                <SheetDescription>{authUser ? `Signed in as ${authUser.email}. Snapshots remain after stories leave the globe.` : "Sign in only when you want to save and revisit story snapshots."}</SheetDescription>
              </SheetHeader>
              <div className="saved-list">
                {!authUser ? (
                  <div className="saved-empty"><LockKeyhole aria-hidden="true" /><p>Your globe and news search remain open. An account is required only for saved stories.</p><Button onClick={() => setAuthOpen(true)}>Sign in to save</Button></div>
                ) : saved.length === 0 ? (
                  <div className="saved-empty"><Bookmark aria-hidden="true" /><p>No saved stories yet.</p></div>
                ) : saved.map((item) => (
                  <article key={item.eventId} className="saved-card">
                    <div className="saved-card-meta"><span>{item.event.location}</span><time>{formatDate(item.createdAt)}</time></div>
                    <h3>{item.event.title}</h3>
                    <div className="saved-card-actions">
                      <button onClick={() => { setSelectedId(item.eventId); setEvents((current) => current.some((event) => event.id === item.eventId) ? current : [item.event, ...current]); }}>View on globe</button>
                      <button onClick={() => void removeSaved(item.eventId)}>Remove</button>
                    </div>
                  </article>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <section className="workspace">
        <aside className="filter-panel" aria-label="News filters">
          <div className="panel-heading">
            <div><span className="eyebrow">Explore</span><h2>Shape the signal</h2></div>
            <span className="result-count">{filtered.length}</span>
          </div>

          <form className="search-box" onSubmit={(event) => { event.preventDefault(); void loadNews(); }}>
            <Search aria-hidden="true" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Topic, person, event, place or site:" aria-label="What news do you want to find?" />
            <Button type="submit" size="icon-sm" variant="ghost" aria-label="Refresh search" disabled={refreshing}>
              <RefreshCw className={refreshing ? "spin" : ""} aria-hidden="true" />
            </Button>
          </form>

          <div className="search-controls">
            <div>
              <label>Time window</label>
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Past day</SelectItem>
                  <SelectItem value="7">Past 7 days</SelectItem>
                  <SelectItem value="30">Past 30 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="news-country">News edition</label>
              <Input
                id="news-country"
                list="news-countries"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void loadNews();
                  }
                }}
                placeholder="Type any country"
              />
              <datalist id="news-countries">
                <option value="Worldwide" />
                {COUNTRIES.map(({ code, name }) => <option key={code} value={`${name} (${code.toUpperCase()})`} />)}
              </datalist>
            </div>
          </div>
          <p className="search-context">{refreshing ? "Searching…" : `${activeSearch.query} · ${activeSearch.country} edition`}</p>
          {countryError && <p className="search-error" role="alert">{countryError}</p>}
          {verification.unresolvedCount > 0 && <p className="search-note" title="Omitted because their event location could not be verified.">{verification.unresolvedCount} reports not mapped</p>}

          <div className="filter-group impact-filter">
            <label>Event impact</label>
            <ToggleGroup type="single" value={sentiment} onValueChange={(value) => { if (value) { setSentiment(value as SentimentFilter); setSubcategory("all"); } }} variant="outline" className="sentiment-toggle">
              <ToggleGroupItem value="all">All</ToggleGroupItem>
              <ToggleGroupItem value="positive"><span className="sentiment-dot positive" />Positive</ToggleGroupItem>
              <ToggleGroupItem value="neutral"><span className="sentiment-dot neutral" />Neutral</ToggleGroupItem>
              <ToggleGroupItem value="negative"><span className="sentiment-dot negative" />Negative</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <details className="advanced-filters">
            <summary><span>More filters</span><small>{advancedFilterCount ? `${advancedFilterCount} active` : "Optional"}</small></summary>
            <div className="advanced-filter-body">
              <div className="split-fields">
                <div>
                  <label>Topic</label>
                  <Select value={category} onValueChange={(value) => { setCategory(value); setSubcategory("all"); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All topics</SelectItem>
                      {categories.map((item) => <SelectItem key={item} value={item} disabled={!taxonomyCounts.topics[item]}>{item} ({taxonomyCounts.topics[item]})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label>Subcategory</label>
                  <Select value={subcategory} onValueChange={setSubcategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All subcategories</SelectItem>
                      {subcategories.map((item) => <SelectItem key={item} value={item} disabled={!taxonomyCounts.subtopics[item]}>{item} ({taxonomyCounts.subtopics[item]})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="filter-group">
                <div className="label-row"><label>Timeline</label><span>{timeline[1] - timeline[0] + 1} days</span></div>
                <Slider min={0} max={activeSearch.days - 1} step={1} value={timeline} onValueChange={(value) => setTimeline([...value])} aria-label="Visible days in search window" />
                <div className="timeline-labels"><span>{dayLabel(timeline[1], referenceDate)}</span><span>{dayLabel(timeline[0], referenceDate)}</span></div>
              </div>

              <div className="filter-group">
                <label>Visualization</label>
                <ToggleGroup type="single" value={viewMode} onValueChange={(value) => value && setViewMode(value as ViewMode)} variant="outline" className="view-toggle">
                  <ToggleGroupItem value="events"><Layers3 aria-hidden="true" />Events</ToggleGroupItem>
                  <ToggleGroupItem value="heatmap"><Flame aria-hidden="true" />Attention heat</ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
          </details>

          <div className="sidebar-summary"><span>{filtered.length} events</span><span>{sourceCount} sources</span></div>
        </aside>

        <section className="globe-panel">
          <div className="globe-caption">
            <span>{panelMode === "list" ? "Filtered stories" : viewMode === "events" ? "Clustered events" : "Source attention"}</span>
            <strong>{filtered.length ? `${reportCount} reports → ${filtered.length} events · ${verification.verifiedCount} reports mapped · ${verification.unresolvedCount} unlocated` : "No signals match"}</strong>
          </div>
          <div className="panel-mode-switch" role="group" aria-label="Center panel view">
            <button type="button" aria-pressed={panelMode === "globe"} onClick={() => setPanelMode("globe")}><Globe2 aria-hidden="true" />Globe</button>
            <button type="button" aria-pressed={panelMode === "list"} onClick={() => setPanelMode("list")}><List aria-hidden="true" />List</button>
          </div>
          {panelMode === "globe" ? (
            <GlobeCanvas events={filtered} selectedId={selected?.id ?? ""} viewMode={viewMode} focusCountry={activeSearch.country} showZoomControls onSelect={(event) => setSelectedId(event.id)} />
          ) : (
            <ol className="event-list" aria-label="Filtered news events">
              {filtered.map((event) => (
                <li key={event.id}>
                  <button type="button" className={event.id === selected?.id ? "selected" : ""} aria-pressed={event.id === selected?.id} onClick={() => setSelectedId(event.id)}>
                    <span className="event-list-top"><em style={{ color: sentimentColors[event.sentiment] }}><i style={{ background: sentimentColors[event.sentiment] }} />{event.sentiment}</em><span><MapPin aria-hidden="true" />{event.location}</span></span>
                    <strong>{event.title}</strong>
                    <span className="event-list-bottom"><span>{event.category} · {event.subcategory}</span><time>{formatDate(event.publishedAt)}</time></span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          {filtered.length === 0 && (
            <div className="empty-globe"><Sparkles aria-hidden="true" /><h3>No events match this lens</h3><button onClick={() => { setSentiment("all"); setCategory("all"); setSubcategory("all"); setTimeline([0, 6]); }}>Reset filters</button></div>
          )}
        </section>

        <aside className="story-panel" aria-live="polite">
          {selected ? (
            <>
              <div className="story-kicker">
                <span className="impact-pill" style={{ color: sentimentColors[selected.sentiment] }}><i style={{ background: sentimentColors[selected.sentiment] }} />{selected.sentiment} impact</span>
                <span>{selected.category} · {selected.subcategory}</span>
              </div>
              <h2>{selected.title}</h2>
              <div className="story-location"><MapPin aria-hidden="true" /><span>{selected.location}</span><strong>{selected.locationSource === "google_maps" ? "Google Maps verified" : `${Math.round(selected.locationConfidence * 100)}% location confidence`}</strong></div>
              <p className="story-summary">{selected.summary}</p>
              <div className="story-meta">
                <div><Clock3 aria-hidden="true" /><span>{formatDate(selected.publishedAt)}</span></div>
                <div><Radio aria-hidden="true" /><span>{selected.articleCount ?? selected.sourceCount} reports → {selected.sourceCount} sources</span></div>
              </div>
              <div className="confidence-card">
                <div className="confidence-title"><span>NLP interpretation</span></div>
                <div className="confidence-row"><div><span>Event impact</span><em>{selected.sentiment}</em></div><div className="confidence-track"><i style={{ width: `${selected.impactConfidence * 100}%` }} /></div><strong>{Math.round(selected.impactConfidence * 100)}%</strong></div>
                <div className="confidence-row"><div><span>Article tone</span><em>{selected.tone}</em></div><div className="confidence-track"><i style={{ width: `${(selected.toneConfidence ?? 0.55) * 100}%` }} /></div><strong>{Math.round((selected.toneConfidence ?? 0.55) * 100)}%</strong></div>
              </div>
              <div className="coverage-block">
                <div className="label-row"><label>Coverage cluster</label><span>Duplicates merged by title, time & place</span></div>
                <div className="source-chips">
                  {selected.articles?.map((article) => <a key={article.source} href={article.url} target="_blank" rel="noreferrer">{article.source} <ExternalLink aria-hidden="true" /></a>)
                    ?? selected.relatedSources.map((source) => <span key={source}>{source}</span>)}
                </div>
              </div>
              <div className="story-actions">
                <Button onClick={() => void saveEvent(selected)} disabled={savedIds.has(selected.id)}>
                  {savedIds.has(selected.id) ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
                  {savedIds.has(selected.id) ? "Saved" : "Save snapshot"}
                </Button>
                <Button asChild variant="outline"><a href={selected.url} target="_blank" rel="noreferrer">Open source <ExternalLink aria-hidden="true" /></a></Button>
              </div>
              {saveNotice && <div className="save-notice">{saveNotice}</div>}
              <div className="provenance"><span>From source</span><b>Headline · publisher · time · link</b><span>Enriched</span><b>{selected.locationSource === "google_maps" ? "Google Maps coordinates" : "Inferred location"} · NLP topic, tone & impact · clustering</b></div>
            </>
          ) : (
            <div className="story-empty"><Globe2 aria-hidden="true" /><h2>Select an event</h2><p>Choose a pulse on the globe to inspect its sources and classification.</p></div>
          )}
        </aside>
      </section>

      <Dialog open={authOpen} onOpenChange={(open) => { setAuthOpen(open); if (!open) { setAuthError(""); setPendingSave(null); setShowPassword(false); } }}>
        <DialogContent className="auth-dialog">
          <DialogHeader>
            <div className="auth-icon"><LockKeyhole aria-hidden="true" /></div>
            <DialogTitle>Save stories across visits</DialogTitle>
            <DialogDescription>Your account is used only for saved snapshots. Reading, searching, and filtering do not require it.</DialogDescription>
          </DialogHeader>
          <div className="auth-mode" role="group" aria-label="Account action">
            <button type="button" aria-pressed={authMode === "login"} onClick={() => { setAuthMode("login"); setAuthError(""); }}>Sign in</button>
            <button type="button" aria-pressed={authMode === "signup"} onClick={() => { setAuthMode("signup"); setAuthError(""); }}>Create account</button>
          </div>
          <form className="auth-form" onSubmit={(event) => void submitAuth(event)}>
            <label htmlFor="account-email">Email</label>
            <Input id="account-email" type="email" autoComplete="email" required maxLength={254} value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} />
            <label htmlFor="account-password">Password</label>
            <div className="auth-password-field">
              <Input id="account-password" type={showPassword ? "text" : "password"} autoComplete={authMode === "signup" ? "new-password" : "current-password"} required minLength={authMode === "signup" ? 8 : undefined} maxLength={128} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} />
              <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>
                {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </div>
            {authMode === "signup" && <small>Use 8–128 characters.</small>}
            {authError && <p className="auth-error" role="alert">{authError}</p>}
            <Button type="submit" disabled={authLoading}>{authLoading ? "Please wait…" : authMode === "login" ? "Sign in and save" : "Create account and save"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
