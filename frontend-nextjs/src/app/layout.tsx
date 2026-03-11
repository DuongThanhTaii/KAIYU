import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "KAIYU - Học Tiếng Trung Online",
    template: "%s | KAIYU",
  },
  description:
    "Ứng dụng học tiếng Trung qua video với phụ đề tương tác, flashcard SRS và từ vựng HSK 1-6. Học tiếng Hoa hiệu quả với phương pháp học thông minh.",
  keywords: [
    "học tiếng Trung",
    "HSK",
    "tiếng Hoa",
    "flashcard",
    "SRS",
    "phụ đề tương tác",
    "học tiếng Trung online",
  ],
  authors: [{ name: "KAIYU Team" }],
  openGraph: {
    title: "KAIYU - Học Tiếng Trung Online",
    description:
      "Học tiếng Trung hiệu quả với video thực tế và phụ đề tương tác",
    url: "https://KAIYU.vn",
    siteName: "KAIYU",
    images: ["/og-image.png"],
    locale: "vi_VN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KAIYU - Học Tiếng Trung Online",
    description:
      "Học tiếng Trung hiệu quả với video thực tế và phụ đề tương tác",
    images: ["/twitter-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        <link rel="icon" href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/settings/favicon.ico`} sizes="any" />
        {/* Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&family=Noto+Sans:wght@400;500;700&family=LXGW+WenKai+TC:wght@400;700&display=swap"
          rel="stylesheet"
        />
        {/* Material Symbols Icons */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
