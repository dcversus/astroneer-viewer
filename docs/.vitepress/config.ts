import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Astroneer Viewer",
  description: "Explore an Astroneer save in 3D, entirely in your browser.",
  base: "/astroneer-viewer/docs/",
  themeConfig: {
    nav: [
      { text: "Open the viewer", link: "https://dcversus.github.io/astroneer-viewer/" },
      { text: "GitHub", link: "https://github.com/dcversus/astroneer-viewer" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Overview", link: "/" },
          { text: "Save format", link: "/save-format" },
          { text: "Contributing", link: "/contributing" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/dcversus/astroneer-viewer" }],
  },
});
