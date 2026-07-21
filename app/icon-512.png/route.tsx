import { ImageResponse } from "next/og";

export const runtime = "edge";
export const contentType = "image/png";
export const size = {
  width: 512,
  height: 512,
};

export default function Icon512() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#245b35",
          color: "#ffffff",
          fontSize: 240,
          fontWeight: 700,
          borderRadius: 96,
          fontFamily: "Arial, sans-serif",
        }}
      >
        N
      </div>
    ),
    size,
  );
}
