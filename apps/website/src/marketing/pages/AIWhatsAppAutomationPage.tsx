import SeoLandingPage from '../components/SeoLandingPage';

export default function AIWhatsAppAutomationPage() {
  return (
    <SeoLandingPage
      title="AI WhatsApp Automation for Real Estate Teams | PropAi Sync"
      description="Discover how PropAi Sync helps real estate teams automate WhatsApp lead replies, qualification, and follow-ups without losing human control."
      canonicalUrl="https://www.propai.live/ai-whatsapp-automation-real-estate"
      schemaId="propai-ai-whatsapp-automation-page"
      eyebrow="Use Case"
      intro="PropAi Sync gives Indian real estate teams a WhatsApp-first automation layer for faster replies, cleaner qualification, and smoother handoff from AI to broker."
      bullets={[
        'Reply to inbound WhatsApp leads in seconds instead of waiting for manual follow-up.',
        'Capture core buying intent like budget, location, property type, and urgency.',
        'Keep human control for site visits, negotiation, and closing steps.',
        'Support both structured setup and lightweight team workflows under one app.',
      ]}
      sections={[
        {
          title: 'Why WhatsApp automation matters in real estate',
          body: 'Most buyer conversations already begin on WhatsApp. Teams lose leads when the first reply is slow or inconsistent. PropAi Sync helps agencies respond immediately, keep the conversation moving, and collect the information brokers need before taking over.',
        },
        {
          title: 'Built for teams, not just solo agents',
          body: 'The platform is designed for teams that need shared setup, device management, webhooks, and assistant controls. That makes it easier for brokers, coordinators, and managers to work from the same system instead of juggling scattered chats and ad-hoc notes.',
        },
        {
          title: 'AI where it helps, humans where it matters',
          body: 'PropAi Sync is not trying to replace brokers. It handles repetitive first contact, qualification, and follow-up structure so your team can spend time on high-intent buyers, property fit, and closing conversations.',
        },
        {
          title: 'Works well for Indian real estate workflows',
          body: 'The product messaging, control setup, and WhatsApp-first structure are especially aligned to Indian brokerage teams where speed, trust, and conversational handoff make a measurable difference.',
        },
      ]}
      faq={[
        {
          q: 'Can PropAi Sync automate first replies on WhatsApp?',
          a: 'Yes. That is one of the core use cases. The platform is built around faster first response and more structured qualification.',
        },
        {
          q: 'Is this only for enterprise teams?',
          a: 'No. It works for smaller broker teams too, but the structure is especially helpful once multiple people are handling inbound leads.',
        },
        {
          q: 'Can brokers still take over manually?',
          a: 'Yes. The intent is to speed up the early part of the funnel, not remove broker control.',
        },
      ]}
    />
  );
}
