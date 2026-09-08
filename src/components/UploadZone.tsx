import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { ACCEPTED_EXTENSIONS, MAX_FILE_SIZE } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function UploadZone({
  onFile, disabled,
}: { onFile: (file: File) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(file: File): string | null {
    const ext = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
    if (!ACCEPTED_EXTENSIONS.includes(ext as (typeof ACCEPTED_EXTENSIONS)[number])) {
      return `"${ext}" files are not supported. Allowed: PDF, DOCX, TXT.`;
    }
    if (file.size > MAX_FILE_SIZE) return "File exceeds the 25 MB limit.";
    return null;
  }

  function handle(file: File | undefined) {
    if (!file) return;
    const err = validate(file);
    if (err) { setError(err); return; }
    setError(null);
    onFile(file);
  }

  return (
    <div>
      <div
        role="button" tabIndex={0} aria-label="Upload source document"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false);
          handle(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragOver ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-gray-50 hover:border-blue-300",
          disabled && "pointer-events-none opacity-50",
        )}
      >
        <UploadCloud className="text-gray-400" size={24} aria-hidden />
        <p className="mt-2 text-sm font-medium text-gray-900">
          Drag and drop a source document, or browse
        </p>
        <p className="mt-1 text-xs text-gray-500">PDF, DOCX, or TXT · up to 25 MB</p>
        <input
          ref={inputRef} type="file" className="hidden"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ""; }}
        />
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
