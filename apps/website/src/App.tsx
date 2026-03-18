import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  Heart,
  Layout,
  MessageSquare,
  Minus,
  Monitor,
  Plus,
  ShieldCheck,
  Smartphone,
  Users,
  Zap,
} from 'lucide-react';

const DOWNLOAD_URL = 'https://docs.propai.live/install/installer';
const DOCS_URL = 'https://docs.propai.live/start/getting-started';
const FAQ_URL = 'https://docs.propai.live/help/faq';
const COMPANY_URL = 'https://www.chaoscraftlabs.com';

const FEATURES = [
  {
    icon: <MessageSquare className="w-6 h-6 text-emerald-400" />,
    title: 'One place for client conversations',
    description:
      'Keep important chats, lead context, and follow-up notes together so your team is not hunting through tabs all day.',
  },
  {
    icon: <Clock className="w-6 h-6 text-emerald-400" />,
    title: 'Follow-ups that stay on track',
    description:
      'PropAi Sync helps you remember what needs attention next, so warm leads do not get forgotten during a busy week.',
  },
  {
    icon: <Layout className="w-6 h-6 text-emerald-400" />,
    title: 'Clear daily summaries',
    description:
      'Start the day with a simple view of activity, pending work, and the conversations your team should care about first.',
  },
  {
    icon: <Zap className="w-6 h-6 text-emerald-400" />,
    title: 'Helpful auto-tasks',
    description:
      'Let the app handle repetitive admin work in the background while your team focuses on clients, site visits, and closings.',
  },
];

const BENEFITS = [
  {
    title: 'Stop losing leads in busy chat threads',
    description:
      'Give every conversation a home so the next action is easier to spot, assign, and follow through.',
  },
  {
    title: 'Built around WhatsApp-first teams',
    description:
      'PropAi Sync is designed for the channel your team already lives in, with Telegram available only if you need it.',
  },
  {
    title: 'Reduce manual admin work',
    description:
      'Less copying, less checking, less chasing. Your team spends more time replying well and moving leads forward.',
  },
  {
    title: 'Keep everyone aligned',
    description:
      'When the whole team can see the same activity, reminders, and summaries, handoffs become much smoother.',
  },
];

const STEPS = [
  {
    id: '01',
    title: 'Download the desktop app',
    description: 'Install PropAi Sync on Windows and open the app in a few minutes.',
  },
  {
    id: '02',
    title: 'Activate your trial',
    description: 'Enter your activation key and unlock your setup without dealing with technical settings.',
  },
  {
    id: '03',
    title: 'Connect WhatsApp',
    description: 'Bring your main communication channel into one cleaner desktop workspace.',
  },
  {
    id: '04',
    title: 'Start working from one place',
    description: 'Manage conversations, follow-ups, and team updates without bouncing between tools.',
  },
];

const FAQS = [
  {
    question: 'Who is PropAi Sync for?',
    answer:
      'PropAi Sync is built for realtors, sales coordinators, and real estate teams that manage a lot of client conversations every day.',
  },
  {
    question: 'Do I need technical knowledge?',
    answer:
      'No. The product is designed for busy professionals, not technical teams. If you can use desktop software and WhatsApp, you can use PropAi Sync.',
  },
  {
    question: 'Does it work with WhatsApp?',
    answer:
      'Yes. WhatsApp is the main focus and the best-fit channel for the PropAi Sync workflow.',
  },
  {
    question: 'Is Telegram supported?',
    answer:
      'Yes, Telegram is available as an optional add-on, but WhatsApp is the primary experience.',
  },
  {
    question: 'Is it a desktop app?',
    answer:
      'Yes. PropAi Sync is a Windows desktop app designed for stability, speed, and day-to-day team use.',
  },
];

const FAQItem: React.FC<{ question: string; answer: string }> = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-white/5 py-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group flex w-full items-center justify-between text-left"
      >
        <span className="text-lg font-medium text-white/80 transition-colors group-hover:text-white">
          {question}
        </span>
        {isOpen ? <Minus className="w-5 h-5 text-emerald-400" /> : <Plus className="w-5 h-5 text-white/40" />}
      </button>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="overflow-hidden"
        >
          <p className="pt-4 pb-2 leading-relaxed text-white/50">{answer}</p>
        </motion.div>
      )}
    </div>
  );
};

const SectionHeading: React.FC<{ eyebrow?: string; title: string; description: string }> = ({
  eyebrow,
  title,
  description,
}) => (
  <div className="mx-auto mb-20 max-w-3xl text-center">
    {eyebrow ? (
      <div className="mb-5 text-[11px] font-semibold uppercase tracking-[0.35em] text-white/35">{eyebrow}</div>
    ) : null}
    <h2 className="mb-6 text-4xl font-bold tracking-tight md:text-5xl">{title}</h2>
    <p className="text-xl leading-relaxed text-white/50">{description}</p>
  </div>
);

export default function App() {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-white/20">
      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-black/70 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-white/[0.03]">
              <Zap className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="font-mono text-lg font-bold uppercase tracking-widest text-white/88">PropAi Sync</span>
          </div>
          <div className="hidden items-center gap-8 text-sm font-medium text-white/60 md:flex">
            <a href="#features" className="transition-colors hover:text-white">
              Features
            </a>
            <a href="#how-it-works" className="transition-colors hover:text-white">
              How It Works
            </a>
            <a href="#faq" className="transition-colors hover:text-white">
              FAQ
            </a>
            <a
              href={DOWNLOAD_URL}
              className="rounded-full border border-white/10 bg-white px-6 py-2.5 font-bold text-black transition-all hover:bg-white/90"
            >
              Download for Windows
            </a>
          </div>
        </div>
      </nav>

      <section className="px-6 pb-20 pt-40">
        <div className="mx-auto max-w-5xl text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-bold uppercase tracking-widest text-white/65">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Built for real estate teams
            </div>
            <h1 className="mb-8 text-6xl font-bold tracking-tight md:text-8xl leading-[0.9]">
              Real estate work,<br />
              <span className="text-white/45">finally in one place.</span>
            </h1>
            <p className="mx-auto mb-12 max-w-3xl text-xl leading-relaxed text-white/55 md:text-2xl">
              PropAi Sync is the desktop assistant for busy realtors and sales teams who want cleaner conversations,
              better follow-ups, and more control over daily work.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href={DOWNLOAD_URL}
                className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-10 py-5 text-lg font-bold text-black transition-all hover:bg-emerald-400 sm:w-auto"
              >
                <Download className="w-6 h-6" />
                Download for Windows
                <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </a>
              <a
                href="#how-it-works"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-10 py-5 text-lg font-bold text-white transition-all hover:bg-white/[0.06] sm:w-auto"
              >
                See how it works
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative mt-20"
          >
            <div className="glass-panel border-white/10 p-2 md:p-4">
              <div className="relative aspect-video overflow-hidden rounded-xl border border-white/5 bg-[#0a0a0a]">
                <div className="absolute inset-0 flex">
                  <div className="w-1/4 border-r border-white/5 bg-black/40 p-4 flex flex-col gap-4">
                    <div className="h-4 w-3/4 rounded bg-white/10" />
                    <div className="mt-4 space-y-3">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-white/5" />
                          <div className="flex-1 space-y-1">
                            <div className="h-2 w-full rounded bg-white/10" />
                            <div className="h-2 w-1/2 rounded bg-white/5" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 p-8 flex flex-col">
                    <div className="mb-12 flex items-center justify-between">
                      <div className="h-8 w-48 rounded-lg bg-white/10" />
                      <div className="flex gap-2">
                        <div className="h-8 w-8 rounded-full bg-emerald-500/15" />
                        <div className="h-8 w-8 rounded-full bg-white/5" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.03] p-6">
                        <div className="h-4 w-1/2 rounded bg-emerald-500/20" />
                        <div className="space-y-2">
                          <div className="h-2 w-full rounded bg-white/10" />
                          <div className="h-2 w-full rounded bg-white/10" />
                          <div className="h-2 w-3/4 rounded bg-white/10" />
                        </div>
                      </div>
                      <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.03] p-6">
                        <div className="h-4 w-1/2 rounded bg-white/10" />
                        <div className="space-y-2">
                          <div className="h-2 w-full rounded bg-white/10" />
                          <div className="h-2 w-full rounded bg-white/10" />
                          <div className="h-2 w-3/4 rounded bg-white/10" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="features" className="bg-[#050505] py-24 px-6">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="What it does"
            title="Built for the way real estate teams actually work"
            description="PropAi Sync helps your team stay on top of conversations, lead movement, follow-ups, and daily admin without making the work feel heavier."
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <motion.div key={feature.title} whileHover={{ y: -8 }} className="glass-panel p-8 transition-all hover:border-white/10">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10">
                  {feature.icon}
                </div>
                <h3 className="mb-4 text-xl font-bold">{feature.title}</h3>
                <p className="leading-relaxed text-white/45">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-20 lg:flex-row">
          <div className="lg:w-1/2">
            <SectionHeading
              eyebrow="Why teams use it"
              title="Less mess, fewer missed follow-ups, better daily control"
              description="The biggest win is not more software. It is a calmer workflow for the people already handling too much at once."
            />
            <div className="space-y-8">
              {BENEFITS.map((benefit) => (
                <div key={benefit.title} className="flex gap-6">
                  <div className="mt-1">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="mb-2 text-xl font-bold">{benefit.title}</h3>
                    <p className="leading-relaxed text-white/50">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="w-full lg:w-1/2">
            <div className="rounded-3xl border border-white/8 bg-[#070707] p-8 md:p-12">
              <div className="mb-10 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
                <Users className="w-8 h-8 text-emerald-400" />
              </div>
              <div className="mb-3 text-5xl font-bold">One calmer workspace</div>
              <div className="font-mono text-sm uppercase tracking-[0.3em] text-white/35">For real conversations, reminders, and team flow</div>
              <div className="mt-10 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-5 text-left">
                  <div className="mb-2 text-sm font-semibold text-white/80">WhatsApp-first</div>
                  <p className="text-sm leading-relaxed text-white/45">Work where your team already talks to leads every day.</p>
                </div>
                <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-5 text-left">
                  <div className="mb-2 text-sm font-semibold text-white/80">Desktop-focused</div>
                  <p className="text-sm leading-relaxed text-white/45">Stable, fast, and easier to manage during a full workday.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-[#050505] py-24 px-6">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="How it works"
            title="Simple to start, easy to keep using"
            description="The setup is meant for busy teams, not technical teams. You download it, activate it, connect WhatsApp, and start working."
          />
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, idx) => (
              <div key={step.id} className="relative">
                <div className="pointer-events-none absolute -top-10 -left-4 select-none text-8xl font-bold text-white/5">{step.id}</div>
                <div className="relative z-10">
                  <h3 className="mb-4 text-xl font-bold">{step.title}</h3>
                  <p className="leading-relaxed text-white/40">{step.description}</p>
                </div>
                {idx < STEPS.length - 1 ? (
                  <div className="absolute top-1/2 -right-6 hidden -translate-y-1/2 lg:block">
                    <ArrowRight className="w-6 h-6 text-white/10" />
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="glass-panel relative overflow-hidden border-white/10 p-12 md:p-20">
            <div className="relative z-10 max-w-2xl">
              <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
                <MessageSquare className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="mb-8 text-4xl font-bold leading-tight md:text-6xl">Built for WhatsApp-first teams</h2>
              <p className="mb-10 text-xl leading-relaxed text-white/60">
                If your business lives in WhatsApp, PropAi Sync is built around that reality. Telegram is supported when needed, but WhatsApp is the main path.
              </p>
              <div className="flex items-center gap-4 font-mono text-sm uppercase tracking-widest text-white/55">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                Telegram support available when needed
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 py-24 px-6">
        <div className="mx-auto max-w-7xl text-center">
          <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
            <div className="space-y-4">
              <ShieldCheck className="mx-auto w-10 h-10 text-emerald-400" />
              <h3 className="text-xl font-bold">Built for real businesses</h3>
              <p className="text-white/40">Desktop software that feels dependable and easy to return to every day.</p>
            </div>
            <div className="space-y-4">
              <Layout className="mx-auto w-10 h-10 text-emerald-400" />
              <h3 className="text-xl font-bold">Easy to understand</h3>
              <p className="text-white/40">Made for working professionals who already have enough friction to deal with.</p>
            </div>
            <div className="space-y-4">
              <Monitor className="mx-auto w-10 h-10 text-emerald-400" />
              <h3 className="text-xl font-bold">Desktop-first stability</h3>
              <p className="text-white/40">Fast, focused, and better suited to full-day team use on Windows.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="bg-[#050505] py-24 px-6">
        <div className="mx-auto max-w-3xl">
          <SectionHeading
            eyebrow="FAQ"
            title="Common questions"
            description="A quick answer to the questions most teams ask before getting started."
          />
          <div className="space-y-2">
            {FAQS.map((faq) => (
              <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </section>

      <section id="download" className="relative overflow-hidden px-6 py-32">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-8 text-5xl font-bold md:text-7xl">Ready to get started?</h2>
          <p className="mx-auto mb-12 max-w-2xl text-xl leading-relaxed text-white/50">
            Download PropAi Sync for Windows and set up a cleaner way for your team to manage conversations, follow-ups, and daily work.
          </p>
          <div className="space-y-6">
            <a
              href={DOWNLOAD_URL}
              className="inline-flex items-center gap-3 rounded-2xl bg-emerald-500 px-12 py-6 text-xl font-bold text-black transition-all hover:bg-emerald-400"
            >
              <Download className="w-7 h-7" />
              Download for Windows
            </a>
            <p className="font-mono text-sm uppercase tracking-widest text-white/30">Windows 10/11 supported · Installer guide opens in docs</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-20 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-20 flex flex-col items-start justify-between gap-12 md:flex-row md:items-center">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-white/[0.03]">
                  <Zap className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="font-mono text-lg font-bold uppercase tracking-widest text-white/88">PropAi Sync</span>
              </div>
              <p className="max-w-xs leading-relaxed text-white/40">The desktop assistant built for modern real estate teams.</p>
            </div>
            <div className="grid grid-cols-2 gap-12 md:gap-24">
              <div className="space-y-4">
                <h4 className="font-mono text-xs uppercase tracking-widest text-white/20">Product</h4>
                <ul className="space-y-2 text-sm text-white/50">
                  <li><a href="#features" className="transition-colors hover:text-white">Features</a></li>
                  <li><a href="#how-it-works" className="transition-colors hover:text-white">How It Works</a></li>
                  <li><a href={FAQ_URL} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">FAQ</a></li>
                </ul>
              </div>
              <div className="space-y-4">
                <h4 className="font-mono text-xs uppercase tracking-widest text-white/20">Company</h4>
                <ul className="space-y-2 text-sm text-white/50">
                  <li>
                    <a href={COMPANY_URL} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">
                      Chaos Craft Labs
                    </a>
                  </li>
                  <li><a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">Download</a></li>
                  <li><a href={FAQ_URL} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white">Support</a></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-8 border-t border-white/5 pt-12 md:flex-row">
            <div className="flex items-center gap-6 font-mono text-[10px] uppercase tracking-widest text-white/50">
              <div className="flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5" /> Windows desktop app
              </div>
              <div className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" /> Mobile pairing next
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 font-mono text-[10px] uppercase tracking-[0.2em] md:flex-row md:gap-8">
              <a
                href={COMPANY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-white/70 transition-colors hover:text-white"
              >
                Built by Chaos Craft Labs
              </a>
              <div className="flex items-center gap-2 font-medium text-white/70">
                Made in Mumbai <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
