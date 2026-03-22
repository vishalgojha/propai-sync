import { 
  MessageSquare, 
  LayoutDashboard, 
  Smartphone, 
  Phone, 
  BarChart3, 
  Zap, 
  Settings, 
  LifeBuoy, 
  ClipboardList, 
  FolderOpen, 
  FileText,
  Plus,
  Send,
  RefreshCw,
  ShieldCheck,
  Cpu,
  Package,
  Monitor,
  AlertCircle,
  Menu,
  X,
  Download
} from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

export default function AppDashboard() {
  const [activeTab, setActiveTab] = useState('Assistant');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const sidebarGroups = [
    {
      label: 'nav.Chat',
      items: [
        { id: 'Assistant', label: 'Assistant', icon: MessageSquare },
      ]
    },
    {
      label: 'nav.Control',
      items: [
        { id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'WhatsApp & Apps', label: 'WhatsApp & Apps', icon: Smartphone },
        { id: 'Connected Phones', label: 'Connected Phones', icon: Phone },
        { id: 'Conversations', label: 'Conversations', icon: MessageSquare },
        { id: 'Reports', label: 'Reports', icon: BarChart3 },
        { id: 'Auto Tasks', label: 'Auto Tasks', icon: Zap },
      ]
    },
    {
      label: 'nav.Agent',
      items: [
        { id: 'Assistants', label: 'Assistants', icon: Cpu },
        { id: 'Add-ons', label: 'Add-ons', icon: Package },
        { id: 'Devices', label: 'Devices', icon: Monitor },
        { id: 'Android Agent', label: 'Android Agent', icon: Download },
      ]
    },
    {
      label: 'nav.Settings',
      items: [
        { id: 'Settings', label: 'Settings', icon: Settings },
        { id: 'Support', label: 'Support', icon: LifeBuoy },
        { id: 'Activity Log', label: 'Activity Log', icon: ClipboardList },
        { id: 'Resources', label: 'Resources', icon: FolderOpen },
        { id: 'Docs', label: 'Docs', icon: FileText },
      ]
    }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'Assistant':
        return (
          <div className="space-y-8">
            <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col h-[600px]">
              <div className="p-6 border-b border-border bg-muted/30 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold">Assistant</h2>
                  <p className="text-sm text-muted-foreground">Chat with your AI assistant to see how it handles leads.</p>
                </div>
                <div className="bg-destructive/10 text-destructive px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border border-destructive/20">
                  <ShieldCheck className="w-3 h-3" /> License required
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                  <MessageSquare className="text-primary w-8 h-8" />
                </div>
                <h3 className="font-bold text-xl">Main Session</h3>
                <div className="w-px h-12 bg-border"></div>
                <div className="space-y-2 max-w-xs">
                  <p className="text-sm font-medium text-destructive flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4" /> License required to send messages.
                  </p>
                  <p className="text-xs text-muted-foreground">Connect to the gateway to start chatting with your AI assistant.</p>
                </div>
              </div>

              <div className="p-4 md:p-6 border-t border-border bg-card">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <button className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-xs font-bold hover:bg-accent transition-all flex items-center justify-center gap-2">
                    <Plus className="w-3 h-3" /> <span className="sm:inline">New session</span>
                  </button>
                  <div className="flex-1 relative">
                    <input 
                      type="text" 
                      disabled
                      placeholder="Connect to gateway…" 
                      className="w-full bg-accent/30 border border-border rounded-full px-4 py-2 text-sm outline-none cursor-not-allowed" 
                    />
                  </div>
                  <button disabled className="px-4 py-2 bg-primary/50 text-primary-foreground rounded-full text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed">
                    Send <Send className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </section>

            {/* Trial Access Section (Visible on Assistant page as per user flow) */}
            <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-border bg-muted/30">
                <h2 className="text-lg font-bold">Trial access</h2>
                <p className="text-sm text-muted-foreground">To start your trial, please provide your WhatsApp number and the property details you'd like the AI to handle.</p>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid lg:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">WhatsApp Number</label>
                    <input 
                      type="text" 
                      placeholder="+91 98765 43210" 
                      className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Property Details</label>
                    <textarea 
                      placeholder="e.g., 3BHK apartment in Bandra, ₹2.5 Cr, available for site visits on weekends" 
                      className="w-full bg-accent/50 border border-border rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary min-h-[100px]"
                    />
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                  <button className="bg-primary text-primary-foreground px-8 py-3 rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">
                    Start Trial
                  </button>
                  <a href="#" className="text-xs font-medium text-primary hover:underline text-center sm:text-right">Need help? Contact support</a>
                </div>
              </div>
            </section>
          </div>
        );
      case 'Android Agent':
        return (
          <div className="space-y-8">
            <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-border bg-muted/30">
                <h2 className="text-lg font-bold">Android Agent</h2>
                <p className="text-sm text-muted-foreground">Download and install the PropAi Sync Android Agent to connect your phone and automate your real estate workflow.</p>
              </div>
              <div className="p-8">
                <div className="grid md:grid-cols-2 gap-12 items-center">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold">Get the Android App</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        The Android Agent allows PropAi Sync to securely interact with your WhatsApp and other messaging apps directly from your device.
                      </p>
                    </div>

                    <ul className="space-y-3">
                      {[
                        'Automate lead responses on WhatsApp',
                        'Sync conversations in real-time',
                        'Handle calls and messages automatically',
                        'Secure end-to-end encryption'
                      ].map((feature, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm font-medium">
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Zap className="w-3 h-3 text-primary" />
                          </div>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <div className="pt-4 flex flex-col sm:flex-row gap-4">
                      <button className="bg-primary text-primary-foreground px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:opacity-90 transition-opacity">
                        <Download className="w-5 h-5" />
                        Download APK
                      </button>
                      <div className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg border border-border">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-[10px] font-bold uppercase tracking-wider">Latest Version: 1.2.4</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center space-y-6 p-8 bg-accent/30 rounded-3xl border border-border">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-border">
                      {/* Placeholder for QR Code */}
                      <div className="w-48 h-48 bg-slate-100 flex items-center justify-center relative overflow-hidden rounded-lg">
                        <div className="absolute inset-0 opacity-10">
                          <div className="grid grid-cols-8 grid-rows-8 h-full w-full">
                            {Array.from({ length: 64 }).map((_, i) => (
                              <div key={i} className={i % 3 === 0 ? 'bg-black' : ''}></div>
                            ))}
                          </div>
                        </div>
                        <Smartphone className="w-12 h-12 text-slate-400 relative z-10" />
                      </div>
                    </div>
                    <div className="text-center space-y-1">
                      <p className="font-bold">Scan to Download</p>
                      <p className="text-xs text-muted-foreground">Scan this QR code with your phone camera to download the agent directly.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-border bg-muted/30">
                <h2 className="text-lg font-bold">Installation Guide</h2>
              </div>
              <div className="p-8">
                <div className="grid sm:grid-cols-3 gap-8">
                  {[
                    { step: '01', title: 'Download', desc: 'Download the APK file to your Android device.' },
                    { step: '02', title: 'Allow Install', desc: 'Enable "Install from Unknown Sources" in your device settings.' },
                    { step: '03', title: 'Connect', desc: 'Open the app and scan the pairing code from your dashboard.' }
                  ].map((item) => (
                    <div key={item.step} className="space-y-3">
                      <div className="text-3xl font-display font-black text-primary/20">{item.step}</div>
                      <h4 className="font-bold">{item.title}</h4>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        );
      default:
        return (
          <div className="flex flex-col items-center justify-center h-[600px] text-center space-y-4">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <Settings className="text-muted-foreground w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold">{activeTab}</h2>
            <p className="text-muted-foreground max-w-sm">This section is currently under development. Please check back soon.</p>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans relative">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-[60] md:hidden backdrop-blur-sm"
            />
            <motion.aside 
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-72 bg-card border-r border-border flex flex-col z-[70] md:hidden overflow-y-auto"
            >
              <div className="p-6 flex items-center justify-between">
                <Link to="/" className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
                    <ZapIcon className="text-primary-foreground w-5 h-5" />
                  </div>
                  <span className="font-display font-bold text-xl tracking-tight">PropAi Sync</span>
                </Link>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 hover:bg-accent rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 px-4 space-y-6 pb-8">
                {sidebarGroups.map((group) => (
                  <div key={group.label} className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-2 flex items-center justify-between">
                      {group.label}
                      <span className="opacity-50">−</span>
                    </p>
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          setIsSidebarOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-medium",
                          activeTab === item.id 
                            ? "bg-primary/10 text-primary" 
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="w-56 lg:w-64 bg-card border-r border-border hidden md:flex flex-col z-50 overflow-y-auto">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shrink-0">
              <ZapIcon className="text-primary-foreground w-5 h-5" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">PropAi Sync</span>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-6 pb-8">
          {sidebarGroups.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-2 flex items-center justify-between">
                {group.label}
                <span className="opacity-50">−</span>
              </p>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-medium",
                    activeTab === item.id 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 md:h-20 border-b border-border bg-card flex items-center justify-between px-4 md:px-8 shrink-0">
          <div className="flex items-center gap-3 md:gap-8">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-accent rounded-lg transition-colors md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="space-y-0.5">
              <h1 className="text-xs md:text-sm font-bold leading-none text-primary">PropAi Sync</h1>
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                <span>PropAi</span>
                <span className="w-1 h-1 bg-muted-foreground/30 rounded-full"></span>
                <span>Sync</span>
              </div>
              <p className="hidden sm:block text-[10px] text-primary font-bold uppercase tracking-wider">Real Estate Assistant</p>
            </div>

            <div className="hidden md:block h-8 w-px bg-border mx-2"></div>

            <div className="hidden md:block space-y-0.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Version</p>
              <p className="text-xs font-medium">1.0.0</p>
            </div>

            <div className="hidden md:block h-8 w-px bg-border mx-2"></div>

            <div className="hidden sm:block space-y-0.5">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Health</p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-destructive rounded-full animate-pulse"></div>
                <p className="text-xs font-medium">Offline</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold border border-border">
              JD
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
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
