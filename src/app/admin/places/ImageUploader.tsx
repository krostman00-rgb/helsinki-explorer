"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, X, Loader2, Link } from "lucide-react";

interface ImageUploaderProps {
  value: string;          // current image_url
  onChange: (url: string) => void;
}

export default function ImageUploader({ value, onChange }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput]         = useState("");
  const [dragOver, setDragOver]         = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const uploadFile = async (file: File) => {
    // Validate type and size
    if (!file.type.startsWith("image/")) {
      alert("Vain kuvatiedostot ovat sallittuja.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Tiedosto on liian suuri (max 5 Mt).");
      return;
    }

    setUploading(true);
    const ext      = file.name.split(".").pop() ?? "jpg";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { data, error } = await supabase.storage
      .from("place-images")
      .upload(filename, file, { contentType: file.type, upsert: false });

    if (error) {
      alert("Lataus epäonnistui: " + error.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("place-images")
      .getPublicUrl(data.path);

    onChange(publicUrl);
    setUploading(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = ""; // reset so same file can be re-selected
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleUrlConfirm = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setUrlInput("");
      setShowUrlInput(false);
    }
  };

  const handleClear = () => onChange("");

  return (
    <div className="flex flex-col gap-2">
      {/* Preview */}
      {value && (
        <div className="relative rounded-xl overflow-hidden border border-border bg-muted/30" style={{ height: 160 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="preview"
            className="w-full h-full object-cover"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <button
            type="button"
            onClick={handleClear}
            className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1 hover:bg-background transition-colors"
            title="Poista kuva"
          >
            <X className="size-4 text-foreground" />
          </button>
        </div>
      )}

      {/* Drop zone / upload area */}
      {!value && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !uploading && inputRef.current?.click()}
          className={[
            "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-colors",
            "h-32 text-sm text-muted-foreground",
            dragOver
              ? "border-ring bg-accent/30"
              : "border-border hover:border-ring/50 hover:bg-muted/30",
          ].join(" ")}
        >
          {uploading
            ? <><Loader2 className="size-5 animate-spin" /> Ladataan…</>
            : <><Upload className="size-5" /> Raahaa kuva tähän tai klikkaa<span className="text-xs">JPG, PNG, WebP · max 5 Mt</span></>
          }
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInput}
      />

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {value && !uploading && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" />
            Vaihda kuva
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowUrlInput(v => !v)}
          className="text-muted-foreground"
        >
          <Link className="size-4" />
          Käytä URL-osoitetta
        </Button>
      </div>

      {/* URL input (secondary option) */}
      {showUrlInput && (
        <div className="flex gap-2">
          <Input
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="https://..."
            className="h-9 flex-1"
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleUrlConfirm(); } }}
          />
          <Button type="button" size="sm" onClick={handleUrlConfirm} className="h-9 shrink-0">
            Käytä
          </Button>
        </div>
      )}
    </div>
  );
}
