import React from "react";

const L_CODE = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G_CODE = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R_CODE = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const PARITIES = [
  "LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
  "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"
];

export function ean13CheckDigit(body12) {
  const sum = body12.split("").reduce((acc, d, i) => acc + parseInt(d, 10) * (i % 2 === 1 ? 3 : 1), 0);
  return String((10 - (sum % 10)) % 10);
}

export function encodeEan13(code) {
  const digits = String(code || "").replace(/\D/g, "");
  if (digits.length !== 12 && digits.length !== 13) return null;
  const full13 = digits.length === 12 ? digits + ean13CheckDigit(digits) : digits;
  
  const first = parseInt(full13[0], 10);
  const parity = PARITIES[first];
  if (!parity) return null;
  let binary = "101"; // start guard
  
  // Left 6 digits
  for (let i = 1; i <= 6; i++) {
    const digit = parseInt(full13[i], 10);
    const mode = parity[i - 1];
    binary += mode === "L" ? L_CODE[digit] : G_CODE[digit];
  }
  
  binary += "01010"; // center guard
  
  // Right 6 digits
  for (let i = 7; i <= 12; i++) {
    const digit = parseInt(full13[i], 10);
    binary += R_CODE[digit];
  }
  
  binary += "101"; // end guard
  return { binary, full13 };
}

export function getBarcodeSvgHtml(code, height = 50) {
  const encoded = encodeEan13(code);
  if (!encoded) {
    return `
      <div style="padding: 6px 12px; font-family: monospace; font-size: 12px; font-weight: bold; text-align: center; border: 1px dashed #94a3b8; border-radius: 6px; margin: 4px auto; display: inline-block;">
        ${code || "SANS CODE"}
      </div>
    `;
  }

  const { binary, full13 } = encoded;
  const barWidth = 2;
  const svgWidth = binary.length * barWidth + 30;
  const svgHeight = height + 24;

  let rects = "";
  for (let idx = 0; idx < binary.length; idx++) {
    if (binary[idx] === "1") {
      const isGuard = idx < 3 || (idx >= 45 && idx < 50) || idx >= 92;
      const barH = isGuard ? height + 6 : height;
      const x = idx * barWidth;
      rects += `<rect x="${x}" y="0" width="${barWidth}" height="${barH}" fill="#000000" />`;
    }
  }

  return `
    <svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}" style="display:block;margin:0 auto;max-width:100%;height:auto;shape-rendering:crispEdges;" xmlns="http://www.w3.org/2000/svg">
      <g transform="translate(15, 4)">
        ${rects}
      </g>
      <text x="${svgWidth / 2}" y="${svgHeight - 2}" text-anchor="middle" font-size="12" font-family="monospace" font-weight="bold" fill="#000000" letter-spacing="2">
        ${full13}
      </text>
    </svg>
  `;
}

export default function BarcodeSvg({ code, className = "", height = 50 }) {
  const encoded = encodeEan13(code);
  if (!encoded) {
    return (
      <div className={`flex flex-col items-center justify-center p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-xs ${className}`}>
        <span className="font-bold tracking-widest text-slate-800">{code || "—"}</span>
        <span className="text-[10px] text-slate-400 mt-0.5">Code non-EAN13</span>
      </div>
    );
  }

  const { binary, full13 } = encoded;
  const barWidth = 2;
  const svgWidth = binary.length * barWidth + 30;
  const svgHeight = height + 24;

  return (
    <div className={`inline-flex flex-col items-center bg-white p-2 rounded ${className}`}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="max-w-full h-auto"
        style={{ minWidth: 170, maxHeight: height + 28 }}
      >
        <g transform="translate(15, 4)">
          {binary.split("").map((bit, idx) => {
            if (bit !== "1") return null;
            const isGuard = idx < 3 || (idx >= 45 && idx < 50) || idx >= 92;
            const barH = isGuard ? height + 6 : height;
            return (
              <rect
                key={idx}
                x={idx * barWidth}
                y={0}
                width={barWidth}
                height={barH}
                fill="#000000"
              />
            );
          })}
        </g>
        <text
          x={svgWidth / 2}
          y={svgHeight - 2}
          textAnchor="middle"
          fontSize="12"
          fontFamily="monospace"
          fontWeight="bold"
          fill="#000000"
          letterSpacing="2"
        >
          {full13}
        </text>
      </svg>
    </div>
  );
}

