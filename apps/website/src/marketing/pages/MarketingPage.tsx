import { 
  MessageSquare, 
  Zap, 
  Users, 
  Clock, 
  CheckCircle2, 
  ArrowRight, 
  Menu, 
  X,
  Smartphone,
  Download
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Link } from 'react-router-dom';
import { ANDROID_APK_URL, APP_URL, WHATSAPP_JOIN_URL } from '../../lib/links';

export default function MarketingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    document.title = 'PropAi Sync';
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <ZapIcon className="text-primary-foreground w-5 h-5" />
              </div>
              <span className="font-display font-bold text-xl tracking-tight">PropAi Sync</span>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium hover:text-primary transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm font-medium hover:text-primary transition-colors">How It Works</a>
              <a href="#faq" className="text-sm font-medium hover:text-primary transition-colors">FAQ</a>
              <Link to="/contact" className="text-sm font-medium hover:text-primary transition-colors">Contact</Link>
              <ThemeToggle />
              <a 
                href={APP_URL}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Open PropAi Live
              </a>
            </div>

            <div className="md:hidden flex items-center gap-4">
              <ThemeToggle />
              <button onClick={() => setIsMenuOpen(!isMenuOpen)}>
                {isMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-background border-b border-border p-4 space-y-4">
            <a href="#features" className="block text-sm font-medium" onClick={() => setIsMenuOpen(false)}>Features</a>
            <a href="#how-it-works" className="block text-sm font-medium" onClick={() => setIsMenuOpen(false)}>How It Works</a>
            <a href="#faq" className="block text-sm font-medium" onClick={() => setIsMenuOpen(false)}>FAQ</a>
            <Link to="/contact" className="block text-sm font-medium" onClick={() => setIsMenuOpen(false)}>Contact</Link>
            <a 
              href={APP_URL}
              className="block w-full bg-primary text-primary-foreground px-4 py-2 rounded-md text-center text-sm font-semibold"
              onClick={() => setIsMenuOpen(false)}
            >
              Open PropAi Live
            </a>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              Close more deals with <span className="text-primary">AI-powered</span> WhatsApp follow-ups.
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              PropAi Sync automates your initial lead conversations, qualifies prospects, and books site visits while you focus on closing.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href={APP_URL}
                className="bg-primary text-primary-foreground px-8 py-4 rounded-xl text-lg font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                Open PropAi Live <ArrowRight className="w-5 h-5" />
              </a>
              {WHATSAPP_JOIN_URL ? (
                <a 
                  href={WHATSAPP_JOIN_URL}
                  className="bg-emerald-500 text-white px-8 py-4 rounded-xl text-lg font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2"
                >
                  Join on WhatsApp
                </a>
              ) : null}
              <a 
                href={ANDROID_APK_URL}
                className="bg-secondary text-secondary-foreground px-8 py-4 rounded-xl text-lg font-bold hover:bg-accent transition-all flex items-center justify-center gap-2"
              >
                Download Android App <Download className="w-5 h-5" />
              </a>
            </div>
            <p className="text-sm text-muted-foreground mt-5">
              Need access? <Link to="/contact" className="text-primary hover:underline">Request access</Link>
            </p>
          </motion.div>
        </div>
      </section>

      {/* AI Agent */}
      <section id="agent" className="py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest">
                AI Follow‑Up Agent
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-bold">
                Your WhatsApp‑first AI agent for Indian real estate teams.
              </h2>
              <p className="text-muted-foreground">
                PropAi Sync replies instantly, qualifies buyers, and schedules site visits so your team can focus on closing.
              </p>
              <ul className="space-y-3">
                {[
                  'Handles first replies in seconds',
                  'Captures budget, locality, and timeline',
                  'Books site visits and follow‑ups',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <a 
                  href={APP_URL}
                  className="bg-primary text-primary-foreground px-6 py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-all text-center"
                >
                  Open PropAi Live
                </a>
                <a 
                  href={ANDROID_APK_URL}
                  className="bg-secondary text-secondary-foreground px-6 py-3 rounded-xl text-sm font-bold hover:bg-accent transition-all text-center"
                >
                  Download Android App
                </a>
              </div>
            </div>
            <div className="bg-muted/30 rounded-3xl border border-border p-8">
              <div className="bg-background border border-border rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">AI Follow‑Up Agent</p>
                    <p className="text-xs text-muted-foreground">WhatsApp • India‑ready</p>
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="bg-muted p-3 rounded-2xl rounded-tl-none">
                    Hi! What’s your budget range and preferred area?
                  </div>
                  <div className="bg-primary/10 p-3 rounded-2xl rounded-tr-none ml-auto max-w-[85%]">
                    2–2.5 Cr, Bandra or Khar. Weekend site visit preferred.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-display text-2xl md:text-4xl font-bold mb-4">Everything you need to <span className="text-primary">scale</span></h2>
            <p className="text-sm md:text-base text-muted-foreground">Professional tools designed for the modern Indian real estate agent.</p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { title: "Smart Lead Routing", desc: "Automatically assign leads to the right team member based on locality or property type.", icon: Users },
              { title: "Conversation History", desc: "Full visibility into every AI-led conversation, so you can jump in whenever needed.", icon: MessageSquare },
              { title: "Site Visit Scheduler", desc: "Integrates with your calendar to book property viewings directly through WhatsApp.", icon: Clock },
              { title: "WhatsApp Gateway", desc: "Professional gateway to manage thousands of conversations without losing the personal touch.", icon: Smartphone },
              { title: "Daily Snapshots", icon: BarChart3Icon, desc: "Get a summary of your lead activity and response times delivered to your WhatsApp." },
              { title: "Team Management", icon: ShieldCheckIcon, desc: "Easily add or remove agents and manage their access levels from one dashboard." }
            ].map((feature, i) => (
              <div key={i} className="bg-background p-8 rounded-2xl border border-border hover:border-primary/50 transition-colors">
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
                  <feature.icon className="text-primary w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WhatsApp Highlight */}
      <section className="py-24 bg-primary text-primary-foreground overflow-hidden relative">
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="font-display text-3xl md:text-5xl font-bold mb-6"><span className="text-primary-foreground">WhatsApp-First</span> Automation</h2>
              <p className="text-lg md:text-xl opacity-90 mb-8">
                Your clients are on WhatsApp. That's where they want to talk. PropAi Sync gives you a professional gateway to manage thousands of conversations without losing the personal touch.
              </p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5" /> No app for clients to download
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5" /> 98% open rates compared to email
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5" /> Verified business profile support
                </li>
              </ul>
            </div>
            <div className="relative">
              <div className="bg-background text-foreground p-6 rounded-3xl shadow-2xl max-w-sm mx-auto transform rotate-3">
                <div className="flex items-center gap-3 mb-4 border-b pb-3">
                  <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                    <Users className="text-primary w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Lead: Anjali Sharma</p>
                    <p className="text-xs text-muted-foreground">Online</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="bg-muted p-3 rounded-2xl rounded-tl-none text-sm max-w-[80%]">
                    Hi, I'm interested in the 3BHK apartment in Bandra. Is it still available?
                  </div>
                  <div className="bg-primary/10 p-3 rounded-2xl rounded-tr-none text-sm max-w-[80%] ml-auto">
                    Hi Anjali! Yes, it is. Would you like to see the floor plan or schedule a site visit this weekend?
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mr-48 -mt-48"></div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground">4 steps to complete automation.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { step: "01", title: "Connect", desc: "Link your WhatsApp Business account in seconds." },
              { step: "02", title: "Configure", desc: "Set your preferences and property details." },
              { step: "03", title: "Automate", desc: "AI starts handling incoming leads instantly." },
              { step: "04", title: "Close", desc: "Jump in when the lead is ready to buy." }
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="text-6xl font-display font-black text-primary/10 mb-4">{item.step}</div>
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 bg-muted/30">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="font-display text-3xl md:text-4xl font-bold mb-12 text-center">FAQ</h2>
          <div className="space-y-6">
            {[
              { q: "Does this replace my agents?", a: "Not at all. It handles the repetitive initial contact and qualification, allowing your team to focus on high-value tasks like site visits and negotiations." },
              { q: "Is it difficult to set up?", a: "No. You can connect your WhatsApp account in under 2 minutes using our step-by-step guide." },
              { q: "Can I jump into a conversation?", a: "Yes, at any time. The dashboard gives you full control to take over any chat manually." },
              { q: "What happens if the AI doesn't know the answer?", a: "It will politely inform the lead that a human agent will get back to them shortly and alert your team immediately." },
              { q: "Is my data secure?", a: "We use industry-standard encryption and never share your lead data with third parties." }
            ].map((item, i) => (
              <div key={i} className="bg-background p-6 rounded-2xl border border-border">
                <h3 className="font-bold mb-2 flex items-center justify-between">
                  {item.q}
                </h3>
                <p className="text-sm text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto bg-primary rounded-[2rem] p-12 text-center text-primary-foreground">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">Ready to automate your growth?</h2>
          <p className="text-xl opacity-90 mb-10">Join hundreds of Indian real estate teams closing more deals with PropAi Sync.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href={APP_URL}
              className="inline-block bg-white text-primary-foreground px-10 py-5 rounded-2xl text-xl font-bold hover:bg-opacity-90 transition-all"
            >
              Open PropAi Live
            </a>
            <a 
              href={ANDROID_APK_URL}
              className="inline-block bg-primary/10 text-primary-foreground px-10 py-5 rounded-2xl text-xl font-bold hover:bg-primary/20 transition-all"
            >
              Download Android App
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <ZapIcon className="text-primary w-6 h-6" />
            <span className="font-display font-bold text-lg">PropAi Live</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 PropAi Live. Built by Chaos Craft Labs</p>
          <div className="flex gap-6">
            <Link to="/privacy" className="text-sm text-muted-foreground hover:text-primary">Privacy</Link>
            <Link to="/terms" className="text-sm text-muted-foreground hover:text-primary">Terms</Link>
            <Link to="/cookies" className="text-sm text-muted-foreground hover:text-primary">Cookies</Link>
            <Link to="/contact" className="text-sm text-muted-foreground hover:text-primary">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ZapIcon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className}
    >
      <path d="M14 2L4 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}

function BarChart3Icon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
  );
}

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
  );
}
