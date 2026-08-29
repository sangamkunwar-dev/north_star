import { InfoGrid, MarketingShell } from '@/components/marketing-shell'

export default function FormatsPage() {
  return <MarketingShell eyebrow="Every kind of post" title="Build a week from one good idea." intro="Shape your message for the format your audience is ready to watch, read, or save."><InfoGrid items={[{ title: 'Photo', text: 'Pair a strong image with a caption that gives the moment a reason to matter.' }, { title: 'Carousel', text: 'Break a lesson, launch, or story into a sequence people can swipe through.' }, { title: 'Short-form video', text: 'Plan hooks, talking points, and calls to action for energetic vertical video.' }, { title: 'Announcement', text: 'Make launches and updates feel clear, timely, and unmistakably yours.' }, { title: 'Educational', text: 'Turn your expertise into useful content your audience can return to.' }, { title: 'Community', text: 'Ask better questions and create room for genuine conversation.' }]} /></MarketingShell>
}
