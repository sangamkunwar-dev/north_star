import { InfoGrid, MarketingShell } from '@/components/marketing-shell'

export default function AboutPage() {
  return <MarketingShell eyebrow="Why Sajilo" title="A calmer operating system for showing up online." intro="Sajilo is made for creators, founders, and small teams who want a reliable content practice without losing their voice."><InfoGrid items={[{ title: 'Less noise', text: 'A small, intentional workspace that keeps the important decisions in view.' }, { title: 'More consistency', text: 'Move from idea to published story with repeatable steps and useful context.' }, { title: 'Your voice first', text: 'AI helps with the blank page, while you stay in control of the final word.' }]} /><p className="mt-16 text-sm font-semibold text-muted-foreground">Created with care by Sangam Kunwar.</p></MarketingShell>
}
