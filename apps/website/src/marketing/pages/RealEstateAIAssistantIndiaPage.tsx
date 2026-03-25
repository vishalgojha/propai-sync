import SeoLandingPage from '../components/SeoLandingPage';

export default function RealEstateAIAssistantIndiaPage() {
  return (
    <SeoLandingPage
      title="Real Estate AI Assistant in India | PropAi Sync"
      description="PropAi Sync is a real estate AI assistant built for India-first WhatsApp workflows, team follow-up, lead qualification, and site visit preparation."
      canonicalUrl="https://www.propai.live/real-estate-ai-assistant-india"
      schemaId="propai-real-estate-ai-assistant-india-page"
      eyebrow="India-Focused"
      intro="PropAi Sync is designed around the way Indian real estate teams actually work: WhatsApp conversations, quick lead response, internal coordination, and strong human handoff once a lead becomes serious."
      bullets={[
        'Built around WhatsApp as the primary lead communication channel.',
        'Helpful for brokers, channel partners, and growing real estate teams in India.',
        'Supports setup, assistant controls, usage visibility, and device workflows in one app.',
        'Lets teams move from inbound lead to qualified conversation with less friction.',
      ]}
      sections={[
        {
          title: 'Why India needs a different workflow emphasis',
          body: 'Real estate in India is highly conversational and mobile-first. Teams often coordinate over WhatsApp long before a lead reaches a formal pipeline. PropAi Sync fits that reality instead of forcing a form-first flow.',
        },
        {
          title: 'More than a chatbot',
          body: 'The value is not just answering messages. The product also brings together assistant behavior, setup, Android and device support, usage visibility, and team-friendly controls so the whole workflow is more manageable.',
        },
        {
          title: 'Useful for buyer and investor funnels',
          body: 'Whether the inquiry is for end use, investment, or a shortlist request, the same early-stage problems show up: slow replies, inconsistent qualification, and scattered follow-up. PropAi Sync helps structure those first interactions.',
        },
        {
          title: 'Designed for operational clarity',
          body: 'The public site, app, API, and licensing surfaces are intentionally separated. That keeps the system easier to understand, easier to scale, and safer to operate than a single overloaded entrypoint.',
        },
      ]}
      faq={[
        {
          q: 'Is PropAi Sync built only for Mumbai?',
          a: 'No. The positioning is India-wide, even though some examples will feel especially familiar to metro brokerage teams.',
        },
        {
          q: 'Can small teams use it too?',
          a: 'Yes. Smaller teams still benefit from faster response and better qualification.',
        },
        {
          q: 'What makes it AI-assistant friendly for operations?',
          a: 'It combines public discoverability, a dedicated app surface, and team-oriented control flows instead of treating the AI layer as only a chat demo.',
        },
      ]}
    />
  );
}
