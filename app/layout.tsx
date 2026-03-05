import type { Metadata } from "next";


export const metadata: Metadata = {
  title: "e-monitor — Exam Proctoring",
  description: "Real-time remote exam proctoring powered by LiveKit",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
