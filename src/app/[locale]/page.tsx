import { Hero } from "@/components/home/hero";
import {
  Bestsellers,
  CategoryGrid,
  Features,
  HomeCta,
  NewReleases,
  Testimonials,
} from "@/components/home/sections";
import { Newsletter } from "@/components/marketing/newsletter";

/**
 * Home page. Every section is a server component reading from the database, so
 * the whole page can be statically generated and revalidated on write.
 */
export default function HomePage() {
  return (
    <>
      <Hero />
      <Bestsellers />
      <CategoryGrid />
      <NewReleases />
      <Features />
      <Testimonials />
      <Newsletter source="home" />
      <HomeCta />
    </>
  );
}
