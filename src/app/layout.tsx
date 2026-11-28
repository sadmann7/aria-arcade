import "@/styles/globals.css";
import type { Metadata, Viewport } from "next";

import {
  Archivo,
  Archivo_Black,
  Inter,
  Silkscreen,
  VT323,
} from "next/font/google";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
});

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-archivo-black",
});

const silkscreen = Silkscreen({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-silkscreen",
});

const vt323 = VT323({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-vt323",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const fontVariables = [archivo, archivoBlack, silkscreen, vt323, inter]
  .map((font) => font.variable)
  .join(" ");

export const metadata: Metadata = {
  title: { default: "Aria Arcade", template: "%s · Aria Arcade" },
  description: "Fun, useless things built from accessible UI behaviors.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0b0a0d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
