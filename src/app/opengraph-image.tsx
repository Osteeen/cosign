import { ImageResponse } from "next/og";

// The link preview (WhatsApp, Slack, X, LinkedIn...): the headline beside a
// permission slip showing the three answers. Rendered once at build time.

export const alt = "Cosign - your agents spend, you co-sign. A company card for AI agents, built on PayPal.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#eef1f5";
const SHEET = "#fbfcfd";
const INK = "#16213a";
const INK_SOFT = "#4b5672";
const RULE = "#d3d9e3";
const BALLPOINT = "#2343c8";

const ROWS = [
  { stamp: "PAID", what: "Coffee beans", amount: "$24.00", ink: "#17704a", tint: "#e3f2ea" },
  { stamp: "ASK YOU", what: "Printer toner", amount: "$80.00", ink: "#8f5400", tint: "#fbf0dc" },
  { stamp: "BLOCKED", what: "50 gift cards", amount: "$1,250.00", ink: "#b3261e", tint: "#fbe6e4" },
];

// Brand fonts from Google Fonts (TTF, which the image renderer needs). If the
// fetch fails, the image still renders in the built-in font.
async function googleFont(query: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?${query}`, { signal: AbortSignal.timeout(8000) })).text();
    const url = css.match(/src: url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return res.ok ? await res.arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function OpenGraphImage() {
  const [heavy, regular, mono] = await Promise.all([
    googleFont("family=Archivo:wdth,wght@125,800"),
    googleFont("family=Archivo:wght@500"),
    googleFont("family=IBM+Plex+Mono:wght@500"),
  ]);
  const fonts = [
    heavy && { name: "Archivo Wide", data: heavy, weight: 800 as const, style: "normal" as const },
    regular && { name: "Archivo", data: regular, weight: 500 as const, style: "normal" as const },
    mono && { name: "Plex Mono", data: mono, weight: 500 as const, style: "normal" as const },
  ].filter((f) => !!f);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: PAPER, padding: "64px 72px", fontFamily: "Archivo" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 590 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: "Archivo Wide", fontSize: 40, color: INK, letterSpacing: -1 }}>Cosign</div>
            <svg width="150" height="12" viewBox="0 0 100 8" style={{ marginTop: 4 }}>
              <path d="M1 5.5 C 22 1.5, 48 7.5, 70 3.5 S 92 2.5, 99 4" fill="none" stroke={BALLPOINT} strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: "Archivo Wide", fontSize: 76, lineHeight: 1.02, color: INK, letterSpacing: -2 }}>Your agents spend. You co-sign.</div>
            <div style={{ marginTop: 26, fontSize: 27, lineHeight: 1.35, color: INK_SOFT }}>A company card for AI agents, built on PayPal.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", fontSize: 22, color: INK_SOFT }}>
            <div style={{ display: "flex", padding: "8px 16px", borderRadius: 6, background: BALLPOINT, color: "#ffffff", marginRight: 16 }}>Try the demo</div>
            No sign-up - PayPal sandbox
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginLeft: "auto",
            alignSelf: "center",
            width: 430,
            padding: "30px 30px 26px",
            background: SHEET,
            border: `1px solid ${RULE}`,
            borderRadius: 8,
            boxShadow: "0 18px 40px rgba(22, 33, 58, 0.14)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 14, borderBottom: `2px solid ${INK}` }}>
            <div style={{ fontFamily: "Archivo Wide", fontSize: 18, letterSpacing: 3, color: INK }}>PERMISSION SLIP</div>
            <div style={{ fontFamily: "Plex Mono", fontSize: 16, color: INK_SOFT }}>Office bot</div>
          </div>
          {ROWS.map((r) => (
            <div key={r.stamp} style={{ display: "flex", alignItems: "center", padding: "18px 0", borderBottom: `1px solid ${RULE}` }}>
              <div
                style={{
                  display: "flex",
                  width: 118,
                  justifyContent: "center",
                  padding: "5px 0",
                  border: `2px solid ${r.ink}`,
                  borderRadius: 4,
                  background: r.tint,
                  color: r.ink,
                  fontFamily: "Archivo Wide",
                  fontSize: 15,
                  letterSpacing: 2,
                }}
              >
                {r.stamp}
              </div>
              <div style={{ marginLeft: 16, fontSize: 21, color: INK }}>{r.what}</div>
              <div style={{ marginLeft: "auto", fontFamily: "Plex Mono", fontSize: 20, color: INK }}>{r.amount}</div>
            </div>
          ))}
          <div style={{ display: "flex", marginTop: 16, fontSize: 17, color: INK_SOFT }}>Checked against the slip. PayPal pays the store.</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
