import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://glow-thief-midnight.zhui-f.chatgpt.site"),
  title: "夜光小贼 · Glow Thief",
  description: "一款午夜漫画风的短局制 2D 街机游戏：偷走光，冲碎影子，把连击叠到天上。",
  openGraph: {
    title: "夜光小贼 · Glow Thief",
    description: "偷走光，冲碎影子，把连击叠到天上。",
    images: [{ url: "/og.png", width: 1733, height: 908, alt: "夜光小贼午夜漫画风游戏海报" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "夜光小贼 · Glow Thief",
    description: "偷走光，冲碎影子，把连击叠到天上。",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
