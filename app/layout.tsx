import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Inter: large x-height + open apertures hold up at 12–15px UI sizes better
// than tighter grotesques; JetBrains Mono gives tabular, scannable figures.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jbMono = JetBrains_Mono({
  variable: "--font-jbmono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://panda-leetcode.vercel.app"),
  title: {
    default: "Company LeetCode Lists — Targeted Interview Prep",
    template: "%s · Company LeetCode Lists",
  },
  description: "Filter 700+ companies by recency and frequency. Learn patterns with Blind 75 / NeetCode 150 first, then target the top 30 company-tagged LeetCode problems.",
  keywords: ["leetcode", "interview", "coding", "tech companies", "programming", "algorithms", "data structures", "blind 75", "neetcode 150", "grind 75"],
  authors: [{ name: "Company LeetCode Lists" }],
  openGraph: {
    title: "Company LeetCode Lists",
    description: "Filter 700+ companies by recency and frequency. Patterns first, then company targeting.",
    url: "https://panda-leetcode.vercel.app",
    siteName: "Company LeetCode Lists",
    images: [
      {
        url: "/panda.svg",
        width: 800,
        height: 800,
        alt: "Panda LeetCode - Interview Preparation Tool",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Company LeetCode Lists",
    description: "Filter 700+ companies by recency and frequency. Patterns first, then company targeting.",
    images: ["/panda.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/panda.svg",
    shortcut: "/panda.svg",
    apple: "/panda.svg",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="theme-color" content="#f5f5f4" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
        <meta name="apple-mobile-web-app-title" content="Company LeetCode" />
      </head>
      <body
        className={`${inter.variable} ${jbMono.variable} antialiased`}
        style={{
          backgroundColor: '#f5f5f4', // warm paper; panda theme overrides per-page
          minHeight: '100dvh', // Dynamic viewport height for mobile
        }}
      >
        <div 
          style={{
            minHeight: '100dvh',
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            paddingLeft: 'env(safe-area-inset-left)',
            paddingRight: 'env(safe-area-inset-right)',
          }}
        >
          {children}
        </div>
      </body>
    </html>
  );
}
