import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { APP_URL } from '../../lib/links';
import { applyMarketingSeo } from '../seo';

type SeoLandingPageProps = {
  title: string;
  description: string;
  canonicalUrl: string;
  eyebrow: string;
  intro: string;
  bullets: string[];
  sections: Array<{
    title: string;
    body: string;
  }>;
  faq: Array<{
    q: string;
    a: string;
  }>;
  schemaId: string;
};

export default function SeoLandingPage({
  title,
  description,
  canonicalUrl,
  eyebrow,
  intro,
  bullets,
  sections,
  faq,
  schemaId,
}: SeoLandingPageProps) {
  useEffect(() => {
    applyMarketingSeo({
      title,
      description,
      canonicalUrl,
      schemaId,
      schema: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: title,
        url: canonicalUrl,
        description,
        about: [
          'AI WhatsApp automation',
          'Real estate lead qualification',
          'Broker workflow automation',
        ],
        isPartOf: {
          '@type': 'WebSite',
          name: 'PropAi Sync',
          url: 'https://www.propai.live/',
        },
      },
    });
  }, [canonicalUrl, description, schemaId, title]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans py-20 px-4">
      <div className="max-w-5xl mx-auto space-y-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to PropAi Sync
        </Link>

        <section className="space-y-6">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary">{eyebrow}</p>
          <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight">{title}</h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl">{intro}</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href={APP_URL}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:opacity-90"
            >
              Open PropAi Live <ArrowRight className="w-4 h-4" />
            </a>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center rounded-xl border border-border px-6 py-3 text-sm font-semibold hover:bg-accent"
            >
              Talk to us
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {bullets.map((bullet) => (
            <div key={bullet} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                <p className="text-sm font-medium leading-6">{bullet}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          {sections.map((section) => (
            <article key={section.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h2 className="mb-3 text-xl font-bold">{section.title}</h2>
              <p className="text-sm leading-7 text-muted-foreground">{section.body}</p>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-border bg-muted/30 p-8">
          <h2 className="mb-6 text-2xl font-bold">Frequently asked questions</h2>
          <div className="space-y-4">
            {faq.map((item) => (
              <div key={item.q} className="rounded-2xl border border-border bg-background p-5">
                <h3 className="mb-2 text-base font-semibold">{item.q}</h3>
                <p className="text-sm leading-7 text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
