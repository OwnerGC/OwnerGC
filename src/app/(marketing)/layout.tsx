// Layout for the public pages (home, estimator, privacy). They use the
// ownergc.app landing page design rather than the app's Tailwind styles, so
// they get their own root layout and stylesheet.
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from "next/font/google";
import "./landing.css";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage", axes: ["opsz"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "OwnerGC: Free Cost-to-Build Estimator for Owner-Builders",
  description:
    "Building your own house? Get a free line-item cost to build, see what you save as your own general contractor, and get a build schedule.",
  openGraph: {
    title: "OwnerGC: What will your house cost to build?",
    description: "Free line-item budget, owner-builder savings and build schedule for your plan. Built by an owner-builder.",
  },
  icons: {
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%2313202c'/%3E%3Cpath d='M7 16 16 8l9 8v9H7z' fill='none' stroke='%23f0a43a' stroke-width='2.4' stroke-linejoin='round'/%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = { themeColor: "#13202c", viewportFit: "cover" };

export default function MarketingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
