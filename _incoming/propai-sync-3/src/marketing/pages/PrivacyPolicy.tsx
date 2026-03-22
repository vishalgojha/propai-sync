import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

export default function PrivacyPolicy() {
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
            Privacy Policy <span className="text-primary">(India)</span>
          </h1>
          <p className="text-sm text-muted-foreground mb-12">Last updated: {lastUpdated}</p>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-12">
            <section>
              <p className="text-lg leading-relaxed">
                PropAi Sync respects your privacy. This policy explains what we collect and how we use it, in line with applicable Indian laws and regulations.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">1. Information we collect</h2>
              <p>We may collect:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Account info (name, email, company)</li>
                <li>Team members you add</li>
                <li>Conversation metadata (time, channel, tags)</li>
                <li>Message content you send or receive through connected channels</li>
                <li>Usage data (features used, errors, performance)</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">2. How we use your data</h2>
              <p>We use data to:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Provide and improve the Service</li>
                <li>Support your account and troubleshoot</li>
                <li>Secure and monitor the system</li>
                <li>Send service updates</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">3. Message content</h2>
              <p className="text-muted-foreground">
                Messages are processed to deliver the Service. We do not sell your content. Access is limited to authorized staff for support and security purposes only.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">4. Third‑party services</h2>
              <p className="text-muted-foreground">
                We use third‑party providers (e.g., hosting, WhatsApp API, AI providers). They only receive the minimum data required to provide the Service.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">5. Data retention</h2>
              <p className="text-muted-foreground">
                We retain data while your account is active and as needed for legal, security, or operational purposes. You may request deletion where legally possible.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">6. Your rights</h2>
              <p className="text-muted-foreground">
                You can request access, correction, or deletion by contacting us at <a href="mailto:support@propai.live" className="text-primary hover:underline">support@propai.live</a>.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">7. Security</h2>
              <p className="text-muted-foreground">
                We use reasonable safeguards to protect your data but no system is 100% secure.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">8. Updates</h2>
              <p className="text-muted-foreground">
                We may update this policy and will notify you if changes are significant.
              </p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
