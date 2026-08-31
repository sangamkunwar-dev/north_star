'use client'

import Link from 'next/link'
import Image from 'next/image'

export function MarketingShell({
  children,
  eyebrow,
  title,
  intro,
}: {
  children: React.ReactNode
  eyebrow: string
  title: string
  intro: string
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        {/* Sajilo Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="relative flex size-10 items-center justify-center overflow-hidden rounded-xl">
            <Image
              src="/sajilo-logo.png"
              alt="Sajilo"
              fill
              priority
              className="object-contain"
            />
          </div>

          <span className="text-lg font-semibold tracking-tight">
            Sajilo
          </span>
        </Link>

        {/* Navigation */}
        <nav className="hidden items-center gap-6 text-sm font-semibold text-muted-foreground md:flex">
          <Link href="/features" className="hover:text-foreground">
            Features
          </Link>

          <Link href="/formats" className="hover:text-foreground">
            Formats
          </Link>

          <Link href="/about" className="hover:text-foreground">
            About
          </Link>
        </nav>

        {/* Sign In */}
        <Link
          href="/"
          className="rounded-lg border border-border px-4 py-2 text-sm font-bold hover:bg-muted"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-16 sm:pb-24 sm:pt-24">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">
          {eyebrow}
        </p>

        <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.05em] text-balance sm:text-7xl">
          {title}
        </h1>

        <p className="mt-7 max-w-2xl text-lg leading-8 text-muted-foreground">
          {intro}
        </p>

        {children}
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>Made by Sangam Kunwar</span>

          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>

            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}

export function InfoGrid({
  items,
}: {
  items: { title: string; text: string }[]
}) {
  return (
    <div className="mt-14 grid gap-4 md:grid-cols-3">
      {items.map((item) => (
        <article
          key={item.title}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <h2 className="text-lg font-semibold">{item.title}</h2>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {item.text}
          </p>
        </article>
      ))}
    </div>
  )
}

export function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string
  updated: string
  sections: { heading: string; body: string }[]
}) {
  return (
    <MarketingShell
      eyebrow="Sajilo"
      title={title}
      intro={`Last updated ${updated}. This page explains how Sajilo operates and what you can expect when using the workspace.`}
    >
      <div className="mt-14 max-w-3xl space-y-10">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-xl font-semibold">
              {section.heading}
            </h2>

            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {section.body}
            </p>
          </section>
        ))}
      </div>
    </MarketingShell>
  )
}
