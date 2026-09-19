import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const bricolageGrotesque = localFont({
  src: [
    {
      path: "../../public/fonts/bricolage-grotesque-latin.woff2",
      weight: "500 800",
      style: "normal",
    },
    {
      path: "../../public/fonts/bricolage-grotesque-latin-ext.woff2",
      weight: "500 800",
      style: "normal",
    },
  ],
  variable: "--font-display",
  display: "swap",
});

const spaceMono = localFont({
  src: [
    {
      path: "../../public/fonts/spacemono-700-latin.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/fonts/spacemono-700-latin-ext.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-label",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://drinkup.vercel.app"),
  title: "DrinkUp — A tiny water reminder that actually gets out of your way",
  description:
    "DrinkUp lives in your Windows tray, splashes a reminder onto your screen when it's time to sip, and dives back out. No accounts, no subscriptions, no nagging popups — just one tiny .exe.",
  keywords: [
    "water reminder",
    "hydration app",
    "windows desktop pet",
    "tauri app",
    "drink water reminder",
  ],
  authors: [{ name: "Aaditya Samani", url: "https://github.com/aadityasamani" }],
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  openGraph: {
    title: "DrinkUp — A tiny water reminder that actually gets out of your way",
    description:
      "Lives in your Windows tray, splashes a reminder onto your screen when it's time to sip, and dives back out. Free, open source, ~2 MB.",
    url: "https://github.com/aadityasamani/drinkup",
    siteName: "DrinkUp",
    images: [
      {
        url: "/images/reminder-light.png",
        width: 600,
        height: 400,
        alt: "DrinkUp reminder notification preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DrinkUp — A tiny water reminder that actually gets out of your way",
    description:
      "Lives in your Windows tray, splashes a reminder onto your screen when it's time to sip, and dives back out. Free, open source, ~2 MB.",
    images: ["/images/reminder-light.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${bricolageGrotesque.variable} ${spaceMono.variable}`}
      style={{ colorScheme: "light" }}
    >
      <head>
        <meta name="color-scheme" content="light" />
        <link rel="icon" href="/icon.png" type="image/png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
