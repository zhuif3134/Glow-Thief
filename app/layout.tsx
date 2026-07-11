import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "夜光小贼 · Glow Thief",
  description: "一款午夜漫画风的短局制 2D 街机游戏：偷走光，冲碎影子，把连击叠到天上。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
