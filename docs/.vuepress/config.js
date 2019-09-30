module.exports = {
  title: "Harker Bell Schedule Docs",
  description: "hello world",
  base: "/docs/",
  head: [],
  themeConfig: {
    lastUpdated: "Last updated",
    repo: "BowenYin/harker-bell",
    nav: [
      {text: "Back to Bell Schedule", link: "https://bell.harker.org"}
    ],
    sidebar: [
      "/",
      {
        title: "General",
        collapsable: false,
        children: ["/api", "/install", "/assistant", "/shortcuts", "/features"]
      },
      {
        title: "Internal",
        children: ["/internal/admin", "/internal/lunchmenu", "internal/schemas"]
      }
    ],
    sidebarDepth: 2,
    searchPlaceholder: "Search...",
  },
  plugins: ["@vuepress/back-to-top"],
};