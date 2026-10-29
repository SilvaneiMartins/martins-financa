import { Download } from "./components/Download";
import { Faq } from "./components/Faq";
import { Gallery } from "./components/Gallery";
import { Features } from "./components/Features";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { Nav } from "./components/Nav";
import { Showcase } from "./components/Showcase";
import { useLatestRelease } from "./lib/releases";

export default function App() {
  const release = useLatestRelease();
  return (
    <>
      <Nav />
      <Hero release={release} />
      <Features />
      <Showcase />
      <Gallery />
      <Download release={release} />
      <Faq />
      <Footer />
    </>
  );
}
