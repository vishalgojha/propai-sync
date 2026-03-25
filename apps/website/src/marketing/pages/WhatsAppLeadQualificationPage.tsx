import SeoLandingPage from '../components/SeoLandingPage';

export default function WhatsAppLeadQualificationPage() {
  return (
    <SeoLandingPage
      title="WhatsApp Lead Qualification for Brokers | PropAi Sync"
      description="PropAi Sync helps brokers qualify WhatsApp leads faster by collecting budget, locality, requirements, and intent before manual follow-up."
      canonicalUrl="https://www.propai.live/whatsapp-lead-qualification"
      schemaId="propai-whatsapp-lead-qualification-page"
      eyebrow="Broker Workflow"
      intro="If your team is drowning in half-qualified WhatsApp leads, PropAi Sync helps standardize the early conversation so brokers know who to call, what to pitch, and which leads deserve immediate attention."
      bullets={[
        'Capture budget, locality, property type, and buying timeline early in the conversation.',
        'Reduce lead leakage caused by inconsistent manual qualification.',
        'Make it easier to prioritize high-intent prospects across a team.',
        'Keep qualification inside WhatsApp instead of forcing buyers into extra forms.',
      ]}
      sections={[
        {
          title: 'Why lead qualification breaks on WhatsApp',
          body: 'WhatsApp is fast and convenient, but teams often improvise their qualification process. One agent asks the right questions, another forgets, and managers get incomplete context. PropAi Sync creates a consistent conversation flow without making the process feel robotic to the buyer.',
        },
        {
          title: 'What a broker actually needs to know',
          body: 'A useful qualification flow is not about collecting everything. It is about surfacing the few signals that affect follow-up quality: area, budget, property need, urgency, and next step. PropAi Sync is designed to move toward those signals naturally in chat.',
        },
        {
          title: 'Why this improves response quality',
          body: 'When brokers already know the core requirement before they step in, they can recommend better inventory, avoid repetitive questioning, and sound more prepared. That translates into better trust and faster movement toward site visits.',
        },
        {
          title: 'Better visibility for managers',
          body: 'A shared control panel also helps managers see what the AI asked, what the buyer shared, and whether the team has enough information to take over. That is much better than relying on memory or manually forwarded screenshots.',
        },
      ]}
      faq={[
        {
          q: 'Does PropAi Sync replace my CRM?',
          a: 'Not necessarily. It improves the lead conversation layer first, which makes whatever CRM or handoff system you use much more useful.',
        },
        {
          q: 'Can it qualify buyers before a broker calls them?',
          a: 'Yes. That is exactly the point of this workflow.',
        },
        {
          q: 'Is the qualification flow fixed?',
          a: 'No. Teams can adapt setup and assistant behavior, but the product helps keep the basics consistent.',
        },
      ]}
    />
  );
}
