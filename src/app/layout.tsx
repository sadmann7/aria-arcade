import "@/styles/globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: { default: "Aria Arcade", template: "%s · Aria Arcade" },
  description: "Fun, useless things built from accessible UI behaviors.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0c0b10",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
