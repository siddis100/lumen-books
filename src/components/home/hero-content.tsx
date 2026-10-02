"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export type HeroStat = {
  value: string;
  label: string;
};

export type HeroContentProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  stats: HeroStat[];
};

/**
 * Animated part of the home hero. Split from `hero.tsx` because `motion.*` is a
 * client component: calling it from a server component throws
 * "createMotionComponent() from the server" under `next dev`, even though the
 * production build silently tolerates it. The strings arrive as props so the
 * translations stay resolved on the server.
 */
export function HeroContent({
  eyebrow,
  title,
  subtitle,
  ctaPrimary,
  ctaSecondary,
  stats,
}: HeroContentProps) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-brand/10 text-brand ring-brand/20 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1"
      >
        <Sparkles className="size-3.5" aria-hidden="true" />
        {eyebrow}
      </motion.p>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.05 }}
        className="font-display mt-6 text-4xl leading-[1.08] font-semibold text-balance sm:text-5xl lg:text-6xl"
      >
        {title}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.1 }}
        className="text-muted-foreground mt-6 max-w-2xl text-base text-pretty sm:text-lg"
      >
        {subtitle}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.15 }}
        className="mt-9 flex w-full flex-col gap-3 sm:w-auto sm:flex-row"
      >
        <Button asChild size="lg" className="h-11 px-6 text-base">
          <Link href="/books">
            {ctaPrimary}
            <ArrowRight className="rtl:hidden size-4" aria-hidden="true" />
            <ArrowRight className="hidden size-4 rotate-180 rtl:block" aria-hidden="true" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-11 px-6 text-base">
          <Link href={{ pathname: "/books", query: { sort: "newest" } }}>{ctaSecondary}</Link>
        </Button>
      </motion.div>

      <motion.dl
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="border-border/70 mt-12 grid w-full max-w-2xl grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-4"
      >
        {stats.map((stat) => (
          <div key={stat.label} className="bg-background/70 px-3 py-4 backdrop-blur-sm">
            <dt className="text-muted-foreground text-[11px] tracking-wide uppercase">{stat.label}</dt>
            <dd className="font-display mt-1 text-2xl font-semibold tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </motion.dl>
    </div>
  );
}