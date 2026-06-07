import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Programmatic icon — overrides the static favicon.ico in the browser tab */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "#6366f1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Branch icon */}
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="4" r="2.2" fill="white" />
          <circle cx="4"  cy="16" r="2.2" fill="white" />
          <circle cx="16" cy="16" r="2.2" fill="white" />
          <line x1="10" y1="6.2"  x2="10" y2="11" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="10" y1="11"   x2="4"  y2="13.8" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          <line x1="10" y1="11"   x2="16" y2="13.8" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
