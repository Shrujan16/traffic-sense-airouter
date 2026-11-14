import { useEffect, useRef, useState, type DragEvent } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export function PhotoDropzone({
  file,
  onChange,
  error,
  onError,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
  error?: string | undefined;
  onError: (msg: string | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function accept(f: File | undefined) {
    if (!f) return;
    if (!ACCEPTED.includes(f.type) && !f.type.startsWith("image/")) {
      onError("Please choose an image file (JPG, PNG or WebP).");
      return;
    }
    if (f.size > MAX_PHOTO_BYTES) {
      onError(`That photo is ${(f.size / 1024 / 1024).toFixed(1)} MB — the limit is 5 MB.`);
      return;
    }
    onError(undefined);
    onChange(f);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    accept(e.dataTransfer.files?.[0]);
  }

  if (file && preview) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-border">
        <img src={preview} alt="Selected incident photo preview" className="h-52 w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-navy/80 px-3 py-2 text-xs text-navy-foreground">
          <span className="truncate">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</span>
          <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-navy-foreground/10" aria-label="Remove photo">
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        aria-describedby="photo-help"
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
          dragging ? "border-teal bg-teal/10" : "border-border hover:border-teal/60 hover:bg-muted/50",
          error && "border-destructive",
        )}
      >
        <span className="grid h-11 w-11 place-items-center rounded-full bg-teal/12 text-teal"><ImagePlus className="h-5 w-5" /></span>
        <span className="text-sm font-medium">Drag a photo here or click to upload</span>
        <span id="photo-help" className="text-xs text-muted-foreground">JPG, PNG or WebP · max 5 MB · helps the AI verify the cause</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-label="Upload incident photo"
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
