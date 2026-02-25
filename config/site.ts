export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "NotaAgent",
  description: "Remember and organize your notes.",
  navItems: [
    {
      label: "Home",
      href: "/",
    },
    {
      label: "Chat",
      href: "/chat",
    },
    {
      label: "Docs",
      href: "/docs",
    },
    {
      label: "About",
      href: "/about",
    },
  ],
  navMenuItems: [
    {
      label: "Home",
      href: "/",
    },
    {
      label: "Chat",
      href: "/chat",
    },
    {
      label: "Docs",
      href: "/docs",
    },
    {
      label: "About",
      href: "/about",
    },
  ],
  links: {
    github: "https://github.com/heroui-inc/heroui",
    twitter: "https://twitter.com/hero_ui",
    docs: "https://heroui.com",
    discord: "https://discord.gg/9b6yyZKmH4",
    sponsor: "https://patreon.com/jrgarciadev",
  },
};
