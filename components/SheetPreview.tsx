"use client";
import { useEffect, useRef, useState } from "react";

/** Shows an A4 sheet scaled down to fit its column. */
export default function SheetPreview({ html, label }: { html: string; label?: React.ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 1, height: 0 });
  useEffect(() => {
    const fit = () => {
      const f = frame.current, s = inner.current;
      if (!f || !s) return;
      const w = s.firstElementChild ? (s.firstElementChild as HTMLElement).offsetWidth : 794;
      const scale = Math.min(1, (f.clientWidth - 28) / w);
      const h = s.firstElementChild ? (s.firstElementChild as HTMLElement).offsetHeight : 1123;
      setBox((b) => (b.scale === scale && b.height === h * scale ? b : { scale, height: h * scale }));
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (frame.current) ro.observe(frame.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [html]);
  return (
    <div>
      {label && <div className="sheet-label">{label}</div>}
      <div className="sheet-frame" ref={frame} style={{ height: box.height ? box.height + 28 : undefined }}>
        <div className="sheet-scale" ref={inner} style={{ transform: `scale(${box.scale})` }} dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
