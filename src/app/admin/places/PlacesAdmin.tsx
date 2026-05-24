"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Place } from "@/types/database.types";
import LocationPicker from "./LocationPicker";

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
  Plus, Pencil, Trash2, Search, LogOut, ChevronUp, ChevronDown, Loader2, MapPin,
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
type PlaceForm = {
  name: string;
  category: string;
  lat: string;
  lng: string;
  address: string;
  description: string;
  price_level: string;
  tags: string;        // comma-separated
  image_url: string;
  website: string;
};

const EMPTY_FORM: PlaceForm = {
  name: "", category: "food", lat: "", lng: "",
  address: "", description: "", price_level: "2",
  tags: "", image_url: "", website: "",
};

function placeToForm(p: Place): PlaceForm {
  return {
    name:        p.name,
    category:    p.category,
    lat:         String(p.lat),
    lng:         String(p.lng),
    address:     p.address ?? "",
    description: p.description ?? "",
    price_level: String(p.price_level ?? 2),
    tags:        (p.tags as string[]).join(", "),
    image_url:   p.image_url ?? "",
    website:     p.website ?? "",
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
      name:        form.name.trim(),
      category:    form.category,
      lat:         parseFloat(form.lat),
      lng:         parseFloat(form.lng),
      address:     form.address.trim() || null,
      description: form.description.trim() || null,
      price_level: parseInt(form.price_level),
      tags:        form.tags.split(",").map(t => t.trim()).filter(Boolean),
      image_url:   form.image_url.trim() || null,
      website:     form.website.trim() || null,
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
                <TableHead className="hidden lg:table-cell">Tagit</TableHead>
                <TableHead className="w-24 text-right">Toiminnot</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
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

            {/* Image URL */}
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <FieldLabel>Kuvan URL</FieldLabel>
              <Input
                value={form.image_url}
                onChange={e => setField("image_url", e.target.value)}
                placeholder="https://..."
                className="h-10"
              />
              {form.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.image_url}
                  alt="preview"
                  className="mt-1 h-28 w-full rounded-lg object-cover border border-border"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
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
