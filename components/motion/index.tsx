"use client"

import * as React from "react"
import { motion, type Variants, type Transition } from "motion/react"

/**
 * Sdílené stavební kameny pro animace napříč aplikací (Framer Motion).
 * Cíl: odvážné, ale uhlazené pohyby. Respektuje `prefers-reduced-motion`
 * skrze `<MotionConfig reducedMotion="user">` v `app-shell.tsx`.
 */

// Presety přechodů.
export const transitions = {
  /** Plynulý spring pro layout / klouzající indikátor. */
  spring: { type: "spring", stiffness: 420, damping: 34 },
  /** Svižný spring pro mikro-interakce (tap / hover na tlačítkách). */
  springSnappy: { type: "spring", stiffness: 600, damping: 26, mass: 0.5 },
  /** Měkký doběh (ease-out) pro nabíhání obsahu. */
  easeOut: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
} satisfies Record<string, Transition>

// Varianty.
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: transitions.easeOut },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: transitions.easeOut },
}

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.055, delayChildren: 0.04 },
  },
}

/** Jednoduché nabíhání odspoda nahoru (mount-only). */
export function FadeIn({
  children,
  className,
  delay = 0,
  ...props
}: React.ComponentProps<typeof motion.div> & { delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...transitions.easeOut, delay }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

/** Kontejner pro kaskádové (staggered) nabíhání potomků typu StaggerItem. */
export function Stagger({
  children,
  className,
  ...props
}: React.ComponentProps<typeof motion.div>) {
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      {...props}
    >
      {children}
    </motion.div>
  )
}

/** Jednotlivá položka uvnitř <Stagger>. Podporuje i whileHover apod. */
export function StaggerItem({
  children,
  className,
  ...props
}: React.ComponentProps<typeof motion.div>) {
  return (
    <motion.div className={className} variants={fadeInUp} {...props}>
      {children}
    </motion.div>
  )
}

/** Přechod celé stránky při navigaci (mountuje se z `app/template.tsx`). */
export function PageTransition({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitions.easeOut}
    >
      {children}
    </motion.div>
  )
}
