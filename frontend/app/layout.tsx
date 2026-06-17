import type { Metadata } from "next";
import { Providers } from "./providers";
import { Nav } from "../components/Nav";

export const metadata: Metadata = {
  title: "0G Time Capsule",
  description: "Seal a message now. Prove it later.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "monospace", background: "#0a0a0a", color: "#e5e5e5", margin: 0 }}>
        <Providers>
          <Nav />
          {children}
        </Providers>
      </body>
    </html>
  );
}
