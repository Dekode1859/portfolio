import NavBar from "@/components/NavBar";
import SectionHeadline from "@/components/SectionHeadline";
import HeroSection from "@/components/HeroSection";
import ProjectsSection from "@/components/ProjectsSection";
import SkillsSection from "@/components/SkillsSection";
import BackgroundNetworkLoader from "@/components/BackgroundNetworkLoader";

export default function Home() {
  return (
    <>
      {/* 3D canvas — fixed, behind everything (z-0), pointer-events-none.
          Loaded client-side only via BackgroundNetworkLoader ('use client' wrapper
          that owns the ssr:false dynamic import). */}
      <BackgroundNetworkLoader />

      {/* Sticky nav — always pointer-events-auto */}
      <NavBar />

      {/* Fixed section headline — swaps between Projects / Skills via viewMode state.
          Hidden during the Hero section. Lives outside <main> so it persists
          across both scroll sections without being clipped by the Projects container. */}
      <SectionHeadline />

      {/* UI overlay — pointer-events-none on the container;
          interactive elements (links, buttons) override with pointer-events-auto */}
      <main className="pointer-events-none relative z-10">
        <HeroSection />
        <ProjectsSection />
        <SkillsSection />
      </main>
    </>
  );
}
