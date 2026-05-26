"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Place, Json } from "@/types/database.types";
import LocationPicker from "./LocationPicker";
import ImageUploader from "./ImageUploader";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, Pencil, Trash2, Search, LogOut, ChevronUp, ChevronDown, Loader2, MapPin, X,
} from "lucide-react";

// ── Constants ────────────────────────────────────────────────
const CATEGORIES = [
  { value: "food",     label: "Ravintolat" },
  { value: "cafe",     label: "Kahvilat" },
  { value: "museums",  label: "Museot" },
  { value: "nature",   label: "Aktiviteetit" },
  { value: "sauna",    label: "Saunat" },
  { value: "arch",     label: "Saaristo" },
  { value: "design",   label: "Design" },
  { value: "shop",     label: "Kaupalliset" },
  { value: "night",    label: "Yöelämä" },
  { value: "history",  label: "Historia" },
  { value: "family",   label: "Perhe" },
  { value: "events",   label: "Tapahtumat" },
];

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.label])
);

// ── Form shape ───────────────────────────────────────────────
const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
type DayKey = typeof DAY_KEYS[number];
const DAY_LABEL_FI: Record<DayKey, string> = {
  mon: "Ma", tue: "Ti", wed: "Ke", thu: "To", fri: "Pe", sat: "La", sun: "Su",
};

type DayHoursInput = { open: string; close: string; closed: boolean };

type PricingRow = {
  label:     string;
  price_eur: string;   // empty = free
  is_free:   boolean;
};

type PlaceForm = {
  name: string;
  category: string;
  lat: string;
  lng: string;
  address: string;
  description: string;
  price_level: string;
  rating: string;           // 0–5, optional
  tags: string;             // comma-separated
  image_url: string;
  website: string;
  // Structured pricing (replaces old free-text pricing_info in UI)
  pricing_items: PricingRow[];
  phone: string;
  email: string;
  reservation_url: string;
  hours: Record<DayKey, DayHoursInput>;
};

const EMPTY_HOURS: Record<DayKey, DayHoursInput> = {
  mon: { open: "09:00", close: "18:00", closed: true },
  tue: { open: "09:00", close: "18:00", closed: true },
  wed: { open: "09:00", close: "18:00", closed: true },
  thu: { open: "09:00", close: "18:00", closed: true },
  fri: { open: "09:00", close: "18:00", closed: true },
  sat: { open: "09:00", close: "18:00", closed: true },
  sun: { open: "09:00", close: "18:00", closed: true },
};

const EMPTY_FORM: PlaceForm = {
  name: "", category: "food", lat: "", lng: "",
  address: "", description: "", price_level: "2", rating: "",
  tags: "", image_url: "", website: "",
  pricing_items: [],
  phone: "", email: "", reservation_url: "",
  hours: structuredClone(EMPTY_HOURS),
};

/** Parses opening_hours JSON (whatever shape it has) back into editor state. */
function parseHours(oh: unknown): Record<DayKey, DayHoursInput> {
  const result: Record<DayKey, DayHoursInput> = structuredClone(EMPTY_HOURS);
  if (!oh || typeof oh !== "object" || Array.isArray(oh)) return result;
  const map = oh as Record<string, unknown>;
  for (const k of DAY_KEYS) {
    const entry = map[k];
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const e = entry as Record<string, unknown>;
      if (typeof e.open === "string" && typeof e.close === "string") {
        result[k] = { open: e.open, close: e.close, closed: false };
      }
    }
  }
  return result;
}

/** Serializes editor state into the JSON shape stored in DB. Closed days omitted. */
function hoursToJson(hours: Record<DayKey, DayHoursInput>): Record<string, { open: string; close: string }> | null {
  const out: Record<string, { open: string; close: string }> = {};
  for (const k of DAY_KEYS) {
    const h = hours[k];
    if (!h.closed && h.open && h.close) out[k] = { open: h.open, close: h.close };
  }
  return Object.keys(out).length > 0 ? out : null;
}

function parsePricingRows(raw: unknown): PricingRow[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>)
    .filter(r => typeof r.label === "string" && r.label.trim() !== "")
    .map(r => ({
      label:     String(r.label),
      price_eur: r.price_eur != null ? String(r.price_eur) : "",
      is_free:   r.price_eur === null || r.price_eur === undefined,
    }));
}

function pricingRowsToJson(rows: PricingRow[]): Json {
  const out = rows
    .filter(r => r.label.trim())
    .map(r => ({
      label:     r.label.trim(),
      price_eur: r.is_free ? null : (parseFloat(r.price_eur) || null),
    })) as Json[];
  return out.length > 0 ? out : null;
}

function placeToForm(p: Place): PlaceForm {
  return {
    name:            p.name,
    category:        p.category,
    lat:             String(p.lat),
    lng:             String(p.lng),
    address:         p.address ?? "",
    description:     p.description ?? "",
    price_level:     String(p.price_level ?? 2),
    rating:          p.rating != null ? String(p.rating) : "",
    tags:            (p.tags as string[]).join(", "),
    image_url:       p.image_url ?? "",
    website:         p.website ?? "",
    pricing_items:   parsePricingRows(p.pricing_items),
    phone:           p.phone ?? "",
    email:           p.email ?? "",
    reservation_url: p.reservation_url ?? "",
    hours:           parseHours(p.opening_hours),
  };
}

// ── Validation ───────────────────────────────────────────────
type FormErrors = Partial<Record<keyof PlaceForm, string>>;

function validate(form: PlaceForm): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim())          errors.name = "Nimi on pakollinen";
  if (!form.category)             errors.category = "Kategoria on pakollinen";
  const lat = parseFloat(form.lat);
  const lng = parseFloat(form.lng);
  if (!form.lat || isNaN(lat) || lat < -90  || lat > 90)
    errors.lat = "Lat täytyy olla välillä -90 … 90";
  if (!form.lng || isNaN(lng) || lng < -180 || lng > 180)
    errors.lng = "Lng täytyy olla välillä -180 … 180";
  const pl = parseInt(form.price_level);
  if (isNaN(pl) || pl < 1 || pl > 4)
    errors.price_level = "Hintataso 1–4";
  if (form.rating !== "") {
    const r = parseFloat(form.rating);
    if (isNaN(r) || r < 0 || r > 5)
      errors.rating = "Arvosana 0–5 (esim. 4.6)";
  }
  return errors;
}

// ── Sort types ───────────────────────────────────────────────
type SortKey = "name" | "category" | "price_level";
type SortDir = "asc" | "desc";

// ── Label field ──────────────────────────────────────────────
function FieldLabel({ children, error }: { children: React.ReactNode; error?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {children}
      </span>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────
export default function PlacesAdmin({
  initialPlaces,
  adminEmail,
}: {
  initialPlaces: Place[];
  adminEmail: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [places, setPlaces]           = useState<Place[]>(initialPlaces);
  const [search, setSearch]           = useState("");
  const [catFilter, setCatFilter]     = useState("all");
  const [sortKey, setSortKey]         = useState<SortKey>("name");
  const [sortDir, setSortDir]         = useState<SortDir>("asc");

  // Dialog state
  const [dialogOpen, setDialogOpen]   = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [form, setForm]               = useState<PlaceForm>(EMPTY_FORM);
  const [errors, setErrors]           = useState<FormErrors>({});
  const [saving, setSaving]           = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Place | null>(null);
  const [deleteOpen, setDeleteOpen]     = useState(false);
  const [deleting, setDeleting]         = useState(false);

  // ── Helpers ──
  const setField = (k: keyof PlaceForm, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  };

  const openAdd = () => {
    setEditingPlace(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (p: Place) => {
    setEditingPlace(p);
    setForm(placeToForm(p));
    setErrors({});
    setDialogOpen(true);
  };

  const openDelete = (p: Place) => {
    setDeleteTarget(p);
    setDeleteOpen(true);
  };

  // ── Sort helper ──
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k ? null :
    sortDir === "asc"
      ? <ChevronUp className="size-3 inline ml-0.5" />
      : <ChevronDown className="size-3 inline ml-0.5" />;

  // ── Filtered + sorted places ──
  const visible = useMemo(() => {
    const q = search.toLowerCase();
    return places
      .filter(p =>
        (catFilter === "all" || p.category === catFilter) &&
        (p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
      )
      .sort((a, b) => {
        let av: string | number = a[sortKey] ?? "";
        let bv: string | number = b[sortKey] ?? "";
        if (typeof av === "string") av = av.toLowerCase();
        if (typeof bv === "string") bv = bv.toLowerCase();
        if (av < bv) return sortDir === "asc" ? -1 : 1;
        if (av > bv) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
  }, [places, search, catFilter, sortKey, sortDir]);

  // ── Save (insert or update) ──
  const handleSave = async () => {
    const errs = validate(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    setSaving(true);
    const payload = {
      name:            form.name.trim(),
      category:        form.category,
      lat:             parseFloat(form.lat),
      lng:             parseFloat(form.lng),
      address:         form.address.trim() || null,
      description:     form.description.trim() || null,
      price_level:     parseInt(form.price_level),
      rating:          form.rating !== "" ? parseFloat(form.rating) : null,
      tags:            form.tags.split(",").map(t => t.trim()).filter(Boolean),
      image_url:       form.image_url.trim() || null,
      website:         form.website.trim() || null,
      pricing_items:   pricingRowsToJson(form.pricing_items),
      phone:           form.phone.trim() || null,
      email:           form.email.trim() || null,
      reservation_url: form.reservation_url.trim() || null,
      opening_hours:   hoursToJson(form.hours),
    };

    if (editingPlace) {
      const { data, error } = await supabase
        .from("places")
        .update(payload)
        .eq("id", editingPlace.id)
        .select()
        .single();
      if (error) {
        toast.error("Tallennus epäonnistui: " + error.message);
      } else {
        setPlaces(ps => ps.map(p => p.id === editingPlace.id ? data : p));
        toast.success(`"${data.name}" päivitetty`);
        setDialogOpen(false);
      }
    } else {
      const { data, error } = await supabase
        .from("places")
        .insert(payload)
        .select()
        .single();
      if (error) {
        toast.error("Lisäys epäonnistui: " + error.message);
      } else {
        setPlaces(ps => [...ps, data].sort((a, b) => a.name.localeCompare(b.name)));
        toast.success(`"${data.name}" lisätty`);
        setDialogOpen(false);
      }
    }
    setSaving(false);
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from("places").delete().eq("id", deleteTarget.id);
    if (error) {
      toast.error("Poisto epäonnistui: " + error.message);
    } else {
      setPlaces(ps => ps.filter(p => p.id !== deleteTarget.id));
      toast.success(`"${deleteTarget.name}" poistettu`);
      setDeleteOpen(false);
    }
    setDeleting(false);
  };

  // ── Sign out ──
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
  };

  // ── Price label ──
  const priceLabel = (n: number | null) => "€".repeat(n ?? 1);

  // ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh bg-linen-100">
      {/* Top bar */}
      <header className="sticky top-0 z-10 bg-background border-b border-border px-6 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg width="13" height="13" viewBox="0 0 14 14">
              <circle cx="7" cy="7" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.25"/>
              <circle cx="7" cy="7" r="2" fill="currentColor"/>
            </svg>
            <span className="text-xs font-semibold tracking-widest uppercase">hello·hel</span>
          </div>
          <span className="text-muted-foreground text-xs">/</span>
          <span className="text-xs font-medium">Paikkojen hallinta</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:block">{adminEmail}</span>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Kirjaudu ulos</span>
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"/>
            <Input
              placeholder="Hae nimellä tai kategorialla…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>

          {/* Category filter */}
          <select
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 cursor-pointer"
          >
            <option value="all">Kaikki kategoriat</option>
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>

          <Button onClick={openAdd} className="ml-auto shrink-0">
            <Plus className="size-4" />
            Lisää paikka
          </Button>
        </div>

        {/* Stats row */}
        <p className="text-xs text-muted-foreground mb-3">
          {visible.length} paikkaa näkyvillä / {places.length} yhteensä
        </p>

        {/* Table */}
        <div className="rounded-xl border border-border bg-background overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none whitespace-nowrap"
                  onClick={() => toggleSort("name")}
                >
                  Nimi <SortIcon k="name"/>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => toggleSort("category")}
                >
                  Kategoria <SortIcon k="category"/>
                </TableHead>
                <TableHead className="hidden md:table-cell">Osoite</TableHead>
                <TableHead
                  className="cursor-pointer select-none text-center hidden sm:table-cell"
                  onClick={() => toggleSort("price_level")}
                >
                  Hinta <SortIcon k="price_level"/>
                </TableHead>
                <TableHead className="hidden md:table-cell text-center">Arvosana</TableHead>
                <TableHead className="hidden lg:table-cell">Tagit</TableHead>
                <TableHead className="w-24 text-right">Toiminnot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    Ei paikkoja haulla &ldquo;{search}&rdquo;
                  </TableCell>
                </TableRow>
              )}
              {visible.map(place => (
                <TableRow key={place.id}>
                  <TableCell className="font-medium max-w-[180px] truncate">
                    {place.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {CATEGORY_LABEL[place.category] ?? place.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-xs max-w-[180px] truncate">
                    {place.address ?? "–"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-center text-muted-foreground text-sm">
                    {priceLabel(place.price_level)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-center text-muted-foreground text-sm">
                    {place.rating != null ? `★ ${place.rating}` : "–"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(place.tags as string[]).slice(0, 3).map(t => (
                        <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                      ))}
                      {(place.tags as string[]).length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{(place.tags as string[]).length - 3}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(place)}
                        title="Muokkaa"
                      >
                        <Pencil className="size-4"/>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openDelete(place)}
                        title="Poista"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-4"/>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>

      {/* ── Add / Edit dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPlace ? `Muokkaa: ${editingPlace.name}` : "Lisää uusi paikka"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            {/* Name */}
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <FieldLabel error={errors.name}>Nimi *</FieldLabel>
              <Input
                value={form.name}
                onChange={e => setField("name", e.target.value)}
                placeholder="Löyly"
                className="h-10"
                aria-invalid={!!errors.name}
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <FieldLabel error={errors.category}>Kategoria *</FieldLabel>
              <select
                value={form.category}
                onChange={e => setField("category", e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-invalid={!!errors.category}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Price level */}
            <div className="flex flex-col gap-1.5">
              <FieldLabel error={errors.price_level}>Hintataso (1–4) *</FieldLabel>
              <select
                value={form.price_level}
                onChange={e => setField("price_level", e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="1">€ — Edullinen</option>
                <option value="2">€€ — Kohtuullinen</option>
                <option value="3">€€€ — Kallis</option>
                <option value="4">€€€€ — Luksus</option>
              </select>
            </div>

            {/* Rating */}
            <div className="flex flex-col gap-1.5">
              <FieldLabel error={errors.rating}>Arvosana (0–5)</FieldLabel>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={form.rating}
                onChange={e => setField("rating", e.target.value)}
                placeholder="4.6"
                className="h-10"
                aria-invalid={!!errors.rating}
              />
            </div>

            {/* Location picker map */}
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Sijainti *
              </span>
              <LocationPicker
                initialLat={form.lat ? parseFloat(form.lat) : undefined}
                initialLng={form.lng ? parseFloat(form.lng) : undefined}
                onPick={({ lat, lng, address }) => {
                  setField("lat", String(lat));
                  setField("lng", String(lng));
                  if (address) setField("address", address);
                }}
              />
            </div>

            {/* Lat */}
            <div className="flex flex-col gap-1.5">
              <FieldLabel error={errors.lat}>Latitude *</FieldLabel>
              <Input
                type="number"
                step="any"
                value={form.lat}
                onChange={e => setField("lat", e.target.value)}
                placeholder="60.1699"
                className="h-10"
                aria-invalid={!!errors.lat}
              />
            </div>

            {/* Lng */}
            <div className="flex flex-col gap-1.5">
              <FieldLabel error={errors.lng}>Longitude *</FieldLabel>
              <Input
                type="number"
                step="any"
                value={form.lng}
                onChange={e => setField("lng", e.target.value)}
                placeholder="24.9384"
                className="h-10"
                aria-invalid={!!errors.lng}
              />
            </div>

            {/* Address */}
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <FieldLabel>Osoite</FieldLabel>
              <Input
                value={form.address}
                onChange={e => setField("address", e.target.value)}
                placeholder="Hernesaarenranta 4, Helsinki"
                className="h-10"
              />
            </div>

            {/* Description */}
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <FieldLabel>Kuvaus</FieldLabel>
              <Textarea
                value={form.description}
                onChange={e => setField("description", e.target.value)}
                placeholder="Lyhyt kuvaus paikasta…"
                className="resize-none"
                rows={3}
              />
            </div>

            {/* Tags */}
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <FieldLabel>Tagit (pilkulla eroteltu)</FieldLabel>
              <Input
                value={form.tags}
                onChange={e => setField("tags", e.target.value)}
                placeholder="sauna, merellinen, design"
                className="h-10"
              />
            </div>

            {/* Image upload */}
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <FieldLabel>Kuva</FieldLabel>
              <ImageUploader
                value={form.image_url}
                onChange={url => setField("image_url", url)}
              />
            </div>

            {/* Website */}
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <FieldLabel>Verkkosivusto</FieldLabel>
              <Input
                value={form.website}
                onChange={e => setField("website", e.target.value)}
                placeholder="https://loyly.fi"
                className="h-10"
              />
            </div>

            {/* ── Optional contextual fields ── */}
            <div className="sm:col-span-2 mt-3 pt-4 border-t border-border">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Lisätiedot (vapaaehtoiset)
              </h3>
            </div>

            {/* Structured pricing rows */}
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <FieldLabel>Hinnasto</FieldLabel>
                <button
                  type="button"
                  onClick={() => setForm(f => ({
                    ...f,
                    pricing_items: [...f.pricing_items, { label: "", price_eur: "", is_free: false }],
                  }))}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="size-3.5"/>
                  Lisää rivi
                </button>
              </div>

              {form.pricing_items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-input p-3 text-center text-xs text-muted-foreground">
                  Ei hintatietoja. Paina &ldquo;Lisää rivi&rdquo; aloittaaksesi.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 rounded-lg border border-input bg-muted/20 p-2">
                  {/* Header row */}
                  <div className="flex items-center gap-2 px-1 pb-0.5">
                    <span className="flex-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Lipputyyppi / kuvaus</span>
                    <span className="w-20 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-right">Hinta €</span>
                    <span className="w-16 text-[10px] font-medium text-muted-foreground uppercase tracking-wider text-center">Ilmainen</span>
                    <span className="w-7"/>
                  </div>

                  {form.pricing_items.map((row, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={row.label}
                        onChange={e => setForm(f => {
                          const items = [...f.pricing_items];
                          items[idx] = { ...items[idx]!, label: e.target.value };
                          return { ...f, pricing_items: items };
                        })}
                        placeholder="Aikuinen / Opiskelija / Lapsi…"
                        className="flex-1 h-8 text-sm"
                      />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={row.is_free ? "" : row.price_eur}
                        disabled={row.is_free}
                        onChange={e => setForm(f => {
                          const items = [...f.pricing_items];
                          items[idx] = { ...items[idx]!, price_eur: e.target.value };
                          return { ...f, pricing_items: items };
                        })}
                        placeholder="0.00"
                        className="w-20 h-8 text-sm text-right"
                      />
                      <div className="w-16 flex justify-center">
                        <input
                          type="checkbox"
                          checked={row.is_free}
                          onChange={e => setForm(f => {
                            const items = [...f.pricing_items];
                            items[idx] = { ...items[idx]!, is_free: e.target.checked, price_eur: "" };
                            return { ...f, pricing_items: items };
                          })}
                          className="size-4 cursor-pointer"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({
                          ...f,
                          pricing_items: f.pricing_items.filter((_, i) => i !== idx),
                        }))}
                        className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <X className="size-3.5"/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Phone */}
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Puhelin</FieldLabel>
              <Input
                value={form.phone}
                onChange={e => setField("phone", e.target.value)}
                placeholder="+358 9 1234 5678"
                className="h-10"
                type="tel"
              />
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Sähköposti</FieldLabel>
              <Input
                value={form.email}
                onChange={e => setField("email", e.target.value)}
                placeholder="info@loyly.fi"
                className="h-10"
                type="email"
              />
            </div>

            {/* Reservation URL */}
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <FieldLabel>Varaus- tai lippulinkki</FieldLabel>
              <Input
                value={form.reservation_url}
                onChange={e => setField("reservation_url", e.target.value)}
                placeholder="https://loyly.fi/varaa"
                className="h-10"
              />
            </div>

            {/* Opening hours editor */}
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <FieldLabel>Aukioloajat</FieldLabel>
              <div className="flex flex-col gap-1.5 rounded-lg border border-input p-3 bg-muted/30">
                {DAY_KEYS.map(day => {
                  const h = form.hours[day];
                  return (
                    <div key={day} className="flex items-center gap-2.5 text-sm">
                      <span className="w-8 font-mono text-xs text-muted-foreground uppercase">
                        {DAY_LABEL_FI[day]}
                      </span>
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground select-none cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!h.closed}
                          onChange={e => setForm(f => ({
                            ...f,
                            hours: { ...f.hours, [day]: { ...f.hours[day], closed: !e.target.checked } },
                          }))}
                          className="size-3.5 cursor-pointer"
                        />
                        Auki
                      </label>
                      <Input
                        type="time"
                        value={h.open}
                        disabled={h.closed}
                        onChange={e => setForm(f => ({
                          ...f,
                          hours: { ...f.hours, [day]: { ...f.hours[day], open: e.target.value } },
                        }))}
                        className="h-8 w-28 text-xs"
                      />
                      <span className="text-muted-foreground text-xs">–</span>
                      <Input
                        type="time"
                        value={h.close}
                        disabled={h.closed}
                        onChange={e => setForm(f => ({
                          ...f,
                          hours: { ...f.hours, [day]: { ...f.hours[day], close: e.target.value } },
                        }))}
                        className="h-8 w-28 text-xs"
                      />
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Päivät joita ei merkitä auki, näkyvät julkisella sivulla suljettuina.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Peruuta
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="size-4 animate-spin" /> Tallennetaan…</> : editingPlace ? "Tallenna muutokset" : "Lisää paikka"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation dialog ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Poista paikka</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground">
              Haluatko varmasti poistaa paikan{" "}
              <span className="font-medium text-foreground">
                &ldquo;{deleteTarget?.name}&rdquo;
              </span>
              ? Toimintoa ei voi peruuttaa.
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              <MapPin className="size-3.5 shrink-0"/>
              <span>{deleteTarget?.address ?? deleteTarget?.category}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Peruuta
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? <><Loader2 className="size-4 animate-spin" /> Poistetaan…</> : "Poista"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
