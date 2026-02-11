import "@/styles/globals.css";
import { Metadata, Viewport } from "next";
import { Link } from "@heroui/link";
import clsx from "clsx";

import { Providers } from "./providers";

import { siteConfig } from "@/config/site";
import { fontSans } from "@/config/fonts";
import { Navbar } from "@/components/navbar";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: siteConfig.description,
  icons: {
    icon: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning lang="en">
      <head />
      <body
        className={clsx(
          "h-screen w-screen overflow-hidden text-foreground bg-background font-sans antialiased",
          fontSans.variable,
        )}
      >
        <Providers themeProps={{ attribute: "class", defaultTheme: "dark" }}>
          <div className="relative flex flex-col h-full">
            <Navbar />
            <main className="container mx-auto max-w-7xl lg:px-6 flex-grow overflow-hidden flex flex-col min-h-0">
              {children}
            </main>
            <footer className="w-full flex items-center justify-center py-3 flex-shrink-0">
              <Link
                isExternal
                className="flex items-center gap-1 text-current"
                href="https://www.oboard.fun/"
                title="oboard homepage"
              >
                {/* <span className="text-default-600">Powered by</span> */}
                <p className="text-primary">@oboard</p>
              </Link>
            </footer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
