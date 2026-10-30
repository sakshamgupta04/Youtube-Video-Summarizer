import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EchoNotes – AI Video Intelligence & Transcript Studio",
  description:
    "Zero-cloud-cost video intelligence platform. Transcribe, segment with Choi C99 depth scoring, extract MMR key takeaways, and search via 384-dim semantic embeddings.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-[#08090e] text-[#f0f2f8] selection:bg-indigo-500/30 selection:text-indigo-200">
        <div className="gradient-bg pointer-events-none" />
        {children}
      </body>
    </html>
  );
}
