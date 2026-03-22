import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

export default function CookiePolicy() {
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
            Cookie Policy <span className="text-primary">(India)</span>
          </h1>
          <p className="text-sm text-muted-foreground mb-12">Last updated: {lastUpdated}</p>

          <div className="prose prose-slate dark:prose-invert max-w-none space-y-12">
            <section>
              <p className="text-lg leading-relaxed">
                PropAi Sync uses cookies and similar technologies to make the website and app work properly.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">1. What we use cookies for</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Keeping you signed in</li>
                <li>Security and fraud prevention</li>
                <li>Basic site functionality</li>
                <li>Performance and analytics (if enabled)</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">2. Types of cookies</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li><span className="font-bold text-foreground">Essential cookies:</span> required for the site to work</li>
                <li><span className="font-bold text-foreground">Analytics cookies:</span> help us improve usability</li>
                <li><span className="font-bold text-foreground">Marketing cookies:</span> only if we ever run ads and you opt in</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">3. Your choices</h2>
              <p className="text-muted-foreground">
                You can control cookies in your browser settings. Some features may not work if you block essential cookies.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight border-b pb-2">4. Contact</h2>
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
