import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

export default function TermsOfService() {
  const lastUpdated = "March 21, 2026";

  return (
    <div className="min-h-screen bg-background text-foreground font-sans py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary mb-12 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Terms of Service <span className="text-primary">(India)</span>
          </h1>
          <p className="text-sm text-muted-foreground mb-12">Last updated: {lastUpdated}</p>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-12">
            <section>
              <p className="text-lg leading-relaxed">
                These Terms of Service (“Terms”) govern your use of PropAi Sync and related services (“Service”). By creating an account or using the Service, you agree to these Terms.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">1. Who can use PropAi Sync</h2>
              <p className="text-muted-foreground">
                You must be a business or an authorized employee/contractor using PropAi Sync on behalf of a business. You must follow all laws and platform rules (including WhatsApp policies).
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">2. What PropAi Sync does</h2>
              <p className="text-muted-foreground">
                PropAi Sync connects your business messaging (WhatsApp and other channels you enable) and helps you manage conversations, follow‑ups, and team activity in one place.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">3. Trials and subscriptions</h2>
              <p className="text-muted-foreground">
                If you are approved for a trial, it lasts for the period shown in the app. After the trial ends, a paid plan is required to continue using the Service. Plans, billing cycles, and features may change with notice.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">4. Accounts and access</h2>
              <p className="text-muted-foreground">
                You are responsible for:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Keeping your login credentials secure</li>
                <li>Making sure your team only accesses what they are allowed to</li>
                <li>All activity that happens under your account</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">5. Acceptable use</h2>
              <p className="text-muted-foreground">
                You agree not to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Spam, scrape, or send prohibited content</li>
                <li>Violate WhatsApp or platform rules</li>
                <li>Use the Service for illegal activity</li>
              </ul>
              <p className="text-muted-foreground">We may suspend access for violations.</p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">6. Third‑party services</h2>
              <p className="text-muted-foreground">
                PropAi Sync may connect to third‑party services (e.g., WhatsApp Cloud API, model providers). Those services have their own terms and policies, and you are responsible for complying with them.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">7. AI outputs</h2>
              <p className="text-muted-foreground">
                AI suggestions are provided to help your team work faster. You are responsible for reviewing and approving messages before sending, when required.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">8. Uptime and changes</h2>
              <p className="text-muted-foreground">
                We aim to keep the Service available but do not guarantee uninterrupted service. We may update features or change how the Service works over time.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">9. Termination</h2>
              <p className="text-muted-foreground">
                You may cancel at any time. We may suspend or end access if these Terms are violated.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">10. Limitation of liability</h2>
              <p className="text-muted-foreground">
                To the maximum extent allowed by law, PropAi Sync is not liable for indirect or consequential damages.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">11. Governing law</h2>
              <p className="text-muted-foreground">
                These Terms are governed by the laws of India, and courts in <span className="font-bold text-foreground">Mumbai, Maharashtra</span> shall have exclusive jurisdiction.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">Contact</h2>
              <p className="text-muted-foreground">
                Questions? Email <a href="mailto:support@propai.live" className="text-primary hover:underline">support@propai.live</a>.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
