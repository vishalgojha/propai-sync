import { ArrowLeft, Mail, MessageSquare, Clock, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { WHATSAPP_JOIN_URL } from '../../lib/links';

export default function ContactPage() {
  const [companyName, setCompanyName] = useState('');
  const defaultWhatsappUrl = 'https://wa.me/9819471310';
  const baseWhatsappUrl = WHATSAPP_JOIN_URL || defaultWhatsappUrl;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const preset =
      params.get('company') ||
      params.get('brokerage') ||
      params.get('tenant') ||
      params.get('name');
    if (preset) {
      setCompanyName(preset);
    }
  }, []);

  const whatsappJoinUrl = useMemo(() => {
    const trimmed = companyName.trim();
    try {
      const url = new URL(baseWhatsappUrl);
      const existingText = url.searchParams.get('text') || 'JOIN';
      const nextText = trimmed ? `JOIN ${trimmed}` : existingText;
      url.searchParams.set('text', nextText);
      return url.toString();
    } catch {
      if (!trimmed) return baseWhatsappUrl;
      const joinText = encodeURIComponent(`JOIN ${trimmed}`);
      return baseWhatsappUrl.includes('?')
        ? `${baseWhatsappUrl}&text=${joinText}`
        : `${baseWhatsappUrl}?text=${joinText}`;
    }
  }, [baseWhatsappUrl, companyName]);

  const whatsappDisplay = useMemo(() => {
    try {
      const url = new URL(baseWhatsappUrl);
      const digits = url.pathname.replace(/\//g, '');
      return digits ? `+${digits}` : '+9819471310';
    } catch {
      return baseWhatsappUrl.replace(/^https?:\/\/wa\.me\//, '+');
    }
  }, [baseWhatsappUrl]);

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
          className="space-y-12"
        >
          <div>
            <h1 className="font-display text-3xl md:text-5xl font-bold tracking-tight mb-4">
              Contact <span className="text-primary">PropAi Sync</span>
            </h1>
            <p className="text-lg text-muted-foreground">We’re here to help you get set up and keep your team moving.</p>
          </div>

          <div className="grid gap-8">
            <section className="bg-card border border-border rounded-2xl p-8 shadow-sm">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" /> Best way to reach us
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <Mail className="w-5 h-5 text-muted-foreground mt-1" />
                  <div>
                    <p className="font-medium">Email</p>
                    <a href="mailto:support@propai.live" className="text-primary hover:underline">support@propai.live</a>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-5 h-5 flex items-center justify-center mt-1">
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-muted-foreground" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </div>
                  <div>
                    <p className="font-medium">WhatsApp</p>
                    <a href={whatsappJoinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{whatsappDisplay}</a>
                    {companyName ? (
                      <p className="text-xs text-muted-foreground mt-1">Prefilled join message for {companyName}</p>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <Clock className="w-5 h-5 text-muted-foreground mt-1" />
                  <div>
                    <p className="font-medium">Business hours</p>
                    <p className="text-muted-foreground">Mon–Sat, 10:00 AM–7:00 PM IST</p>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid md:grid-cols-2 gap-8">
              <section className="bg-card border border-border rounded-2xl p-8 shadow-sm">
                <h2 className="text-xl font-bold mb-4">Sales & Partnerships</h2>
                <div className="flex items-start gap-4">
                  <Mail className="w-5 h-5 text-muted-foreground mt-1" />
                  <div>
                    <p className="font-medium">Email</p>
                    <a href="mailto:hello@propai.live" className="text-primary hover:underline">hello@propai.live</a>
                  </div>
                </div>
              </section>

              <section className="bg-card border border-border rounded-2xl p-8 shadow-sm">
                <h2 className="text-xl font-bold mb-4">Owner</h2>
                <div className="flex items-start gap-4">
                  <User className="w-5 h-5 text-muted-foreground mt-1" />
                  <div>
                    <p className="font-medium">Vishal Ojha</p>
                  </div>
                </div>
              </section>
            </div>

            <section className="text-center p-8 bg-muted/30 rounded-2xl border border-dashed border-border">
              <h2 className="font-bold mb-2">Response time</h2>
              <p className="text-muted-foreground">Most requests are answered within 1 business day.</p>
            </section>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
