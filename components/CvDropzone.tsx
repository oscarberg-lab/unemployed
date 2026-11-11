"use client";

import { FileText, Upload } from "lucide-react";
import { useRef, useState } from "react";

/** A large drop area around the ordinary file input, so it works by click, keyboard and drag-and-drop. */
export function CvDropzone({ hasCv }: { hasCv: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);

  return (
    <label
      className="dropzone"
      data-over={over}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = e.dataTransfer.files;
        if (files.length && input.current) {
          input.current.files = files;
          setFilename(files[0].name);
        }
      }}
    >
      {filename ? <FileText size={32} strokeWidth={1.5} aria-hidden="true" /> : <Upload size={32} strokeWidth={1.5} aria-hidden="true" />}
      {filename ? (
        <>
          <span className="dropzone-title">Ready when you are</span>
          <span className="dropzone-file">{filename}</span>
          <span className="small muted">Click to choose a different file</span>
        </>
      ) : (
        <>
          <span className="dropzone-title">{hasCv ? "Drop a newer CV here" : "Drop your CV here"}</span>
          <span className="muted">or click to choose a file from your computer</span>
          <span className="small muted">PDF or plain text, up to 10 MB</span>
        </>
      )}
      <input
        ref={input}
        className="sr-only"
        type="file"
        name="cv"
        accept=".pdf,.txt,.md,application/pdf,text/plain"
        required
        onChange={(e) => setFilename(e.target.files?.[0]?.name ?? null)}
      />
    </label>
  );
}
