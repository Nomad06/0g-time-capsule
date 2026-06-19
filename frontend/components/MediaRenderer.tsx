"use client";

export function isDataUri(s: string): boolean {
  return s.startsWith("data:");
}

export function getMediaType(s: string): "image" | "audio" | "video" | "pdf" | "text" {
  if (!isDataUri(s)) return "text";
  const semi = s.indexOf(";");
  const mime = semi !== -1 ? s.slice(5, semi) : "";
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  return "text";
}

export function getFileSizeLabel(dataUri: string): string {
  const b64 = dataUri.slice(dataUri.indexOf(",") + 1);
  const bytes = Math.round((b64.length * 3) / 4);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaRenderer({ content, className = "" }: { content: string; className?: string }) {
  const type = getMediaType(content);

  if (type === "image") {
    return (
      <div className={className}>
        <img src={content} alt="Capsule content" className="max-w-full rounded-lg border border-border" />
        <p className="mt-1.5 text-xs text-muted-foreground/50">{getFileSizeLabel(content)} · stored on 0G Storage</p>
      </div>
    );
  }

  if (type === "audio") {
    return (
      <div className={className}>
        <audio controls src={content} className="w-full" />
        <p className="mt-1.5 text-xs text-muted-foreground/50">{getFileSizeLabel(content)} · stored on 0G Storage</p>
      </div>
    );
  }

  if (type === "video") {
    return (
      <div className={className}>
        <video controls src={content} className="max-w-full rounded-lg border border-border" />
        <p className="mt-1.5 text-xs text-muted-foreground/50">{getFileSizeLabel(content)} · stored on 0G Storage</p>
      </div>
    );
  }

  if (type === "pdf") {
    return (
      <div className={className}>
        <iframe src={content} className="h-96 w-full rounded-lg border border-border" title="PDF content" />
        <p className="mt-1.5 text-xs text-muted-foreground/50">{getFileSizeLabel(content)} · stored on 0G Storage</p>
      </div>
    );
  }

  // plain text (including data:text/plain;base64,... or raw string)
  let text = content;
  if (isDataUri(content) && content.includes("base64,")) {
    try { text = atob(content.slice(content.indexOf(",") + 1)); } catch { /* fallback */ }
  }
  return (
    <p className={`whitespace-pre-wrap text-base leading-[1.8] text-[#e5e5e5] ${className}`}>
      {text}
    </p>
  );
}
