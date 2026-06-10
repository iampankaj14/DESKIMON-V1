import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import BRANDING from "@/lib/branding";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata = {
  title: BRANDING.seo.title,
  description: BRANDING.seo.description,
  keywords: BRANDING.seo.keywords,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

