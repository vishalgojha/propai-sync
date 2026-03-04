import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Share2, 
  Server, 
  History, 
  BarChart3, 
  Clock, 
  Users, 
  Zap, 
  Network, 
  Settings, 
  Bug, 
  FileText, 
  ChevronRight, 
  Search, 
  Bell, 
  User, 
  Menu, 
  X,
  Plus,
  Filter,
  Download,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Smartphone,
  Send,
  MoreVertical,
  Terminal,
  Code,
  Layers,
  Cpu,
  Moon,
  Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type ScreenId = 
  | 'chat' 
  | 'overview' 
  | 'channels' 
  | 'instances' 
  | 'sessions' 
  | 'usage' 
  | 'cron' 
  | 'agents' 
  | 'skills' 
  | 'nodes' 
  | 'config' 
  | 'debug' 
  | 'logs';

type ThemeMode = 'dark' | 'light';

interface NavItem {
  id: ScreenId;
  label: string;
  icon: React.ElementType;
}

// --- Constants ---
const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'agents', label: 'Agents', icon: Users },
  { id: 'skills', label: 'Skills', icon: Zap },
  { id: 'channels', label: 'Channels', icon: Share2 },
  { id: 'nodes', label: 'Nodes', icon: Network },
  { id: 'instances', label: 'Instances', icon: Server },
  { id: 'sessions', label: 'Sessions', icon: History },
  { id: 'usage', label: 'Usage', icon: BarChart3 },
  { id: 'cron', label: 'Cron', icon: Clock },
  { id: 'config', label: 'Config', icon: Settings },
  { id: 'debug', label: 'Debug', icon: Bug },
  { id: 'logs', label: 'Logs', icon: FileText },
];

// --- Mock Data ---
const USAGE_DATA = [
  { name: '00:00', tokens: 400, cost: 0.24 },
  { name: '04:00', tokens: 300, cost: 0.18 },
  { name: '08:00', tokens: 900, cost: 0.54 },
  { name: '12:00', tokens: 1200, cost: 0.72 },
  { name: '16:00', tokens: 1500, cost: 0.90 },
  { name: '20:00', tokens: 800, cost: 0.48 },
];

const THEME_STORAGE_KEY = 'propai-studio-theme';
const GATEWAY_URL_STORAGE_KEY = 'propai-studio-gateway-url';
const DEFAULT_GATEWAY_URL = 'https://gateway.propaiclaw.io/v1/api';
const CHART_PRIMARY = 'var(--chart-primary)';
const CHART_GRID = 'var(--chart-grid)';
const CHART_TICK = 'var(--chart-tick)';
const CHART_DOT_STROKE = 'var(--chart-dot-stroke)';
const CHART_TOOLTIP_BG = 'var(--surface-white)';

function getDefaultGatewayUrl() {
  const envGatewayUrl = (import.meta.env.VITE_PROPAICLAW_GATEWAY_URL as string | undefined)?.trim();
  return envGatewayUrl || DEFAULT_GATEWAY_URL;
}

function toGatewayHealthUrl(gatewayUrl: string) {
  const normalized = gatewayUrl.trim().replace(/\/+$/, '');
  if (normalized.endsWith('/v1/api')) {
    return `${normalized.slice(0, -('/v1/api'.length))}/health`;
  }
  return `${normalized}/health`;
}

// --- Components ---

const Card = ({ children, className, title, subtitle, action, onClick }: { children: React.ReactNode, className?: string, title?: string, subtitle?: string, action?: React.ReactNode, onClick?: () => void }) => (
  <div 
    className={cn("bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm", className)}
    onClick={onClick}
  >
    {(title || subtitle || action) && (
      <div className="px-6 py-4 border-bottom border-slate-100 flex items-center justify-between">
        <div>
          {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

const Badge = ({ children, variant = 'default' }: { children: React.ReactNode, variant?: 'default' | 'success' | 'warning' | 'error' | 'info' }) => {
  const variants = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-100',
    warning: 'bg-amber-50 text-amber-700 border border-amber-100',
    error: 'bg-rose-50 text-rose-700 border border-rose-100',
    info: 'bg-brand-50 text-brand-700 border border-brand-100',
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider", variants[variant])}>
      {children}
    </span>
  );
};

const Button = ({ children, variant = 'primary', size = 'md', className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger', size?: 'sm' | 'md' | 'lg' }) => {
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  return (
    <button className={cn("inline-flex items-center justify-center font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed", variants[variant], sizes[size], className)} {...props}>
      {children}
    </button>
  );
};

const Modal = ({ isOpen, onClose, title, children, footer }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode, footer?: React.ReactNode }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }} 
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" 
        />
        <motion.div 
          initial={{ scale: 0.95, opacity: 0, y: 20 }} 
          animate={{ scale: 1, opacity: 1, y: 0 }} 
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
          <div className="p-6">{children}</div>
          {footer && <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">{footer}</div>}
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

// --- Screen Components ---

const OverviewScreen = () => (
  <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { label: 'Active Agents', value: '12', icon: Users, color: 'text-brand-600', bg: 'bg-brand-50' },
        { label: 'Total Sessions', value: '1,284', icon: History, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Active Nodes', value: '4', icon: Network, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'Daily Cost', value: '$12.42', icon: BarChart3, color: 'text-rose-600', bg: 'bg-rose-50' },
      ].map((stat, i) => (
        <Card key={i} className="flex items-center gap-4 p-5">
          <div className={cn("p-3 rounded-xl", stat.bg)}>
            <stat.icon className={cn("w-6 h-6", stat.color)} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{stat.value}</p>
          </div>
        </Card>
      ))}
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2" title="Token Usage History" subtitle="Last 24 hours of activity">
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={USAGE_DATA}>
              <defs>
                <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_PRIMARY} stopOpacity={0.1}/>
                  <stop offset="95%" stopColor={CHART_PRIMARY} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: CHART_TICK }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: CHART_TICK }} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: CHART_TOOLTIP_BG }}
              />
              <Area type="monotone" dataKey="tokens" stroke={CHART_PRIMARY} strokeWidth={2} fillOpacity={1} fill="url(#colorTokens)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Recent Activity" subtitle="Latest system events">
        <div className="space-y-4 mt-4">
          {[
            { user: 'Agent Alpha', action: 'completed task', time: '2m ago', type: 'success' },
            { user: 'System', action: 'node heartbeat lost', time: '15m ago', type: 'error' },
            { user: 'User Admin', action: 'updated config', time: '1h ago', type: 'info' },
            { user: 'Cron Job', action: 'started backup', time: '3h ago', type: 'default' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={cn("w-2 h-2 rounded-full mt-1.5", 
                item.type === 'success' ? 'bg-emerald-500' : 
                item.type === 'error' ? 'bg-rose-500' : 
                item.type === 'info' ? 'bg-brand-500' : 'bg-slate-300'
              )} />
              <div>
                <p className="text-sm font-medium text-slate-900">{item.user} {item.action}</p>
                <p className="text-xs text-slate-500">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  </div>
);

const ChatScreen = () => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am PropAI Studio. How can I assist you today?' }
  ]);
  const [input, setInput] = useState('');
  const [showToolSidebar, setShowToolSidebar] = useState(false);

  return (
    <div className="flex h-full gap-4">
      <div className="flex-1 flex flex-col glass-panel rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white">
              <MessageSquare size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Active Session</h2>
              <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wider">Connected</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowToolSidebar(!showToolSidebar)}>
              <Layers size={16} className="mr-2" />
              Tools
            </Button>
            <Button variant="ghost" size="sm">
              <MoreVertical size={16} />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex", msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                msg.role === 'user' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-800'
              )}>
                <Markdown>{msg.content}</Markdown>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 bg-white border-t border-slate-100">
          <form className="flex gap-2" onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim()) return;
            setMessages([...messages, { role: 'user', content: input }]);
            setInput('');
          }}>
            <input 
              type="text" 
              placeholder="Type your message..." 
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <Button type="submit">
              <Send size={18} />
            </Button>
          </form>
        </div>
      </div>

      <AnimatePresence>
        {showToolSidebar && (
          <motion.div 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="glass-panel rounded-2xl overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-slate-100 bg-white flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Tool Outputs</h3>
              <button onClick={() => setShowToolSidebar(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <Card className="p-3 bg-slate-50 border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Terminal size={14} className="text-brand-600" />
                  <span className="text-xs font-mono font-bold text-slate-700">get_weather</span>
                </div>
                <pre className="text-[10px] font-mono text-slate-600 overflow-x-auto">
                  {JSON.stringify({ location: 'San Francisco', temp: 68, condition: 'Sunny' }, null, 2)}
                </pre>
              </Card>
              <Card className="p-3 bg-slate-50 border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Code size={14} className="text-emerald-600" />
                  <span className="text-xs font-mono font-bold text-slate-700">execute_script</span>
                </div>
                <pre className="text-[10px] font-mono text-slate-600 overflow-x-auto">
                  {`Success: Process exited with code 0\nOutput: "Hello from PropAI Studio"`}
                </pre>
              </Card>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AgentsScreen = () => {
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const agents = [
    { name: 'Customer Support', status: 'online', tasks: 124, type: 'Support' },
    { name: 'Data Analyst', status: 'busy', tasks: 42, type: 'Analytics' },
    { name: 'Sales Bot', status: 'offline', tasks: 0, type: 'Sales' },
    { name: 'DevOps Assistant', status: 'online', tasks: 89, type: 'Infrastructure' },
  ];

  if (selectedAgent) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedAgent(null)}>
            <ChevronRight size={18} className="rotate-180 mr-1" />
            Back to List
          </Button>
          <div className="h-8 w-[1px] bg-slate-200" />
          <h2 className="text-xl font-bold text-slate-900">{selectedAgent.name}</h2>
          <Badge variant={selectedAgent.status === 'online' ? 'success' : 'default'}>{selectedAgent.status}</Badge>
        </div>

        <div className="flex border-b border-slate-200 gap-6">
          {['overview', 'files', 'tools', 'skills', 'channels', 'cron'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "pb-3 text-sm font-medium capitalize transition-colors relative",
                activeTab === tab ? "text-brand-600" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {tab}
              {activeTab === tab && (
                <motion.div layoutId="agent-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-600" />
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {activeTab === 'overview' && (
              <Card title="Agent Performance" subtitle="Activity metrics for the last 7 days">
                <div className="h-[200px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={USAGE_DATA}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                      <XAxis dataKey="name" hide />
                      <Tooltip />
                      <Area type="monotone" dataKey="tokens" stroke={CHART_PRIMARY} fill={CHART_PRIMARY} fillOpacity={0.1} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
            {activeTab !== 'overview' && (
              <Card title={activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} subtitle={`Manage ${activeTab} for ${selectedAgent.name}`}>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                    <Layers size={20} />
                  </div>
                  <p className="text-sm text-slate-500">No {activeTab} configured for this agent.</p>
                  <Button variant="secondary" size="sm" className="mt-4">
                    Add {activeTab.slice(0, -1)}
                  </Button>
                </div>
              </Card>
            )}
          </div>
          <div className="space-y-6">
            <Card title="Agent Identity">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold">
                    {selectedAgent.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{selectedAgent.name}</p>
                    <p className="text-xs text-slate-500">ID: agent_92384</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Created</span>
                    <span className="text-slate-900">Oct 24, 2025</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Type</span>
                    <span className="text-slate-900">{selectedAgent.type}</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Agents</h2>
          <p className="text-sm text-slate-500">Manage and deploy your autonomous workers</p>
        </div>
        <Button>
          <Plus size={18} className="mr-2" />
          New Agent
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent, i) => (
          <Card 
            key={i} 
            className="hover:border-brand-300 transition-colors cursor-pointer group"
            onClick={() => setSelectedAgent(agent)}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                <User size={24} />
              </div>
              <Badge variant={agent.status === 'online' ? 'success' : agent.status === 'busy' ? 'warning' : 'default'}>
                {agent.status}
              </Badge>
            </div>
            <h3 className="text-base font-bold text-slate-900">{agent.name}</h3>
            <p className="text-xs text-slate-500 mt-1">{agent.type} Agent • {agent.tasks} tasks completed</p>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex -space-x-2">
                {[1, 2, 3].map(j => (
                  <div key={j} className="w-6 h-6 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-500">
                    {j}
                  </div>
                ))}
              </div>
              <Button variant="ghost" size="sm">
                View Details
                <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

const ChannelsScreen = () => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Channels</h2>
        <p className="text-sm text-slate-500">Connect PropAI Studio to your favorite platforms</p>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        { name: 'WhatsApp', icon: Smartphone, status: 'Connected', color: 'bg-emerald-500' },
        { name: 'Telegram', icon: Send, status: 'Not Configured', color: 'bg-sky-500' },
        { name: 'Slack', icon: MessageSquare, status: 'Connected', color: 'bg-purple-500' },
        { name: 'Discord', icon: MessageSquare, status: 'Not Configured', color: 'bg-indigo-500' },
        { name: 'Google Chat', icon: MessageSquare, status: 'Connected', color: 'bg-blue-500' },
        { name: 'iMessage', icon: MessageSquare, status: 'Not Configured', color: 'bg-blue-400' },
        { name: 'Nostr', icon: Zap, status: 'Connected', color: 'bg-amber-500' },
        { name: 'Signal', icon: MessageSquare, status: 'Not Configured', color: 'bg-blue-600' },
      ].map((channel, i) => (
        <Card key={i} className="p-5 hover:shadow-md transition-shadow cursor-pointer">
          <div className="flex items-center gap-4">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-white", channel.color)}>
              <channel.icon size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">{channel.name}</h3>
              <p className={cn("text-[10px] font-medium uppercase tracking-wider", channel.status === 'Connected' ? 'text-emerald-600' : 'text-slate-400')}>
                {channel.status}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>

    <Card title="Nostr Profile Configuration" subtitle="Manage your decentralized identity">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Display Name</label>
            <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="PropAI Studio Bot" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">About</label>
            <textarea className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm h-24" placeholder="Autonomous agent powered by PropAI Studio..." />
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Public Key (npub)</label>
            <div className="flex gap-2">
              <input type="text" readOnly className="flex-1 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" value="npub1...xyz789" />
              <Button variant="secondary" size="sm">Copy</Button>
            </div>
          </div>
          <div className="pt-4">
            <Button className="w-full">Save Profile</Button>
          </div>
        </div>
      </div>
    </Card>
  </div>
);

const NodesScreen = () => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Nodes</h2>
        <p className="text-sm text-slate-500">Manage execution environments and devices</p>
      </div>
      <Button>
        <Plus size={18} className="mr-2" />
        Register Node
      </Button>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <Card title="Connected Devices" subtitle="Physical and virtual execution nodes">
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Node Name</th>
                  <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Uptime</th>
                  <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Load</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[
                  { name: 'MacBook Pro - Local', status: 'online', uptime: '4d 12h', load: '12%' },
                  { name: 'AWS-EC2-US-EAST', status: 'online', uptime: '124d 2h', load: '45%' },
                  { name: 'Raspberry Pi 4', status: 'offline', uptime: '0m', load: '0%' },
                ].map((node, i) => (
                  <tr key={i} className="group">
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                          <Cpu size={16} />
                        </div>
                        <span className="text-sm font-medium text-slate-900">{node.name}</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <Badge variant={node.status === 'online' ? 'success' : 'default'}>{node.status}</Badge>
                    </td>
                    <td className="py-4 text-sm text-slate-500">{node.uptime}</td>
                    <td className="py-4">
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500" style={{ width: node.load }} />
                      </div>
                    </td>
                    <td className="py-4 text-right">
                      <Button variant="ghost" size="sm">Configure</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Execution Approvals" subtitle="Pending requests requiring manual intervention">
          <div className="space-y-4 mt-4">
            {[
              { agent: 'Sales Bot', action: 'Delete Customer Record', id: 'REQ-102', time: '5m ago' },
              { agent: 'DevOps Assistant', action: 'Restart Production Server', id: 'REQ-105', time: '12m ago' },
            ].map((req, i) => (
              <div key={i} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{req.action}</h4>
                    <p className="text-xs text-slate-500">Requested by {req.agent} • {req.time}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm">Deny</Button>
                  <Button size="sm">Approve</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card title="Node Bindings" subtitle="Agent-to-Node assignments">
          <div className="space-y-3 mt-4">
            {[
              { agent: 'Customer Support', node: 'AWS-EC2-US-EAST' },
              { agent: 'Data Analyst', node: 'MacBook Pro - Local' },
              { agent: 'Sales Bot', node: 'AWS-EC2-US-EAST' },
            ].map((binding, i) => (
              <div key={i} className="p-3 bg-white border border-slate-100 rounded-lg flex items-center justify-between shadow-sm">
                <div className="text-xs font-medium text-slate-900">{binding.agent}</div>
                <ChevronRight size={12} className="text-slate-300" />
                <div className="text-xs font-mono text-brand-600">{binding.node}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  </div>
);

const UsageScreen = () => (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Usage & Billing</h2>
        <p className="text-sm text-slate-500">Monitor your consumption and costs</p>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary">
          <Filter size={18} className="mr-2" />
          Filter
        </Button>
        <Button variant="secondary">
          <Download size={18} className="mr-2" />
          Export
        </Button>
      </div>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2" title="Cost Over Time" subtitle="Daily expenditure in USD">
        <div className="h-[300px] w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={USAGE_DATA}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: CHART_TICK }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: CHART_TICK }} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', backgroundColor: CHART_TOOLTIP_BG }}
              />
              <Line type="monotone" dataKey="cost" stroke={CHART_PRIMARY} strokeWidth={3} dot={{ r: 4, fill: CHART_PRIMARY, strokeWidth: 2, stroke: CHART_DOT_STROKE }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="space-y-4">
        <Card title="Current Plan" className="bg-brand-900 text-white border-none">
          <div className="mb-4">
            <Badge variant="info">Pro Plan</Badge>
          </div>
          <p className="text-3xl font-bold">$49.00<span className="text-sm font-normal text-brand-300">/mo</span></p>
          <p className="text-xs text-brand-200 mt-2">Next billing date: April 1, 2026</p>
          <Button variant="secondary" className="w-full mt-6 bg-white/10 border-white/20 text-white hover:bg-white/20">
            Manage Subscription
          </Button>
        </Card>
        <Card title="Usage Limits">
          <div className="space-y-4">
            {[
              { label: 'Tokens', used: '4.2M', limit: '10M', percent: 42 },
              { label: 'Agents', used: '12', limit: '20', percent: 60 },
              { label: 'Storage', used: '1.2GB', limit: '5GB', percent: 24 },
            ].map((limit, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs font-medium mb-1.5">
                  <span className="text-slate-500">{limit.label}</span>
                  <span className="text-slate-900">{limit.used} / {limit.limit}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500" style={{ width: `${limit.percent}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  </div>
);

// --- Main App Shell ---

export default function App() {
  const [activeScreen, setActiveScreen] = useState<ScreenId>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showGatewayModal, setShowGatewayModal] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'dark';
  });
  const [gatewayUrl, setGatewayUrl] = useState<string>(() => {
    if (typeof window === 'undefined') return getDefaultGatewayUrl();
    const saved = window.localStorage.getItem(GATEWAY_URL_STORAGE_KEY)?.trim();
    return saved || getDefaultGatewayUrl();
  });
  const [gatewayStatus, setGatewayStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [gatewayStatusMessage, setGatewayStatusMessage] = useState<string>('');

  // Auto-close mobile menu on screen change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [activeScreen]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    const normalized = gatewayUrl.trim();
    if (!normalized) return;
    window.localStorage.setItem(GATEWAY_URL_STORAGE_KEY, normalized);
  }, [gatewayUrl]);

  const renderScreen = () => {
    switch (activeScreen) {
      case 'overview': return <OverviewScreen />;
      case 'chat': return <ChatScreen />;
      case 'agents': return <AgentsScreen />;
      case 'channels': return <ChannelsScreen />;
      case 'nodes': return <NodesScreen />;
      case 'usage': return <UsageScreen />;
      default: return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
            <Zap size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 capitalize">{activeScreen}</h2>
          <p className="text-slate-500 mt-2">This screen is currently under development.</p>
          <Button variant="secondary" className="mt-6" onClick={() => setActiveScreen('overview')}>
            Back to Overview
          </Button>
        </div>
      );
    }
  };

  const nextTheme = themeMode === 'dark' ? 'light' : 'dark';

  const handleGatewayConnectionTest = async () => {
    const normalized = gatewayUrl.trim();
    if (!normalized) {
      setGatewayStatus('error');
      setGatewayStatusMessage('Gateway URL cannot be empty.');
      return;
    }

    setGatewayStatus('checking');
    setGatewayStatusMessage('Checking gateway reachability...');

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(toGatewayHealthUrl(normalized), {
        method: 'GET',
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      setGatewayStatus('ok');
      setGatewayStatusMessage('Gateway reachable.');
    } catch (error) {
      const err = error as Error;
      setGatewayStatus('error');
      setGatewayStatusMessage(`Connection check failed (${err.message}).`);
    } finally {
      window.clearTimeout(timeout);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* Desktop Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 260 : 80 }}
        className="hidden lg:flex flex-col bg-white border-r border-slate-200 z-30"
      >
        <div className="h-16 flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
              <Zap size={18} fill="currentColor" />
            </div>
            {isSidebarOpen && <span className="font-bold text-slate-900 tracking-tight text-lg">PropAI Studio</span>}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveScreen(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group",
                activeScreen === item.id 
                  ? "bg-brand-50 text-brand-700 shadow-sm" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <item.icon size={20} className={cn(activeScreen === item.id ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600")} />
              {isSidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
              {isSidebarOpen && activeScreen === item.id && (
                <motion.div layoutId="active-nav" className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-600" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:bg-slate-50 transition-colors"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            {isSidebarOpen && <span className="text-sm font-medium">Collapse Sidebar</span>}
          </button>
        </div>
      </motion.aside>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="fixed inset-y-0 left-0 w-72 bg-white z-50 lg:hidden flex flex-col"
            >
              <div className="h-16 flex items-center px-6 border-b border-slate-100 justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white">
                    <Zap size={18} fill="currentColor" />
                  </div>
                  <span className="font-bold text-slate-900 text-lg">PropAI Studio</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400">
                  <X size={20} />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                {NAV_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveScreen(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all",
                      activeScreen === item.id ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    <item.icon size={20} />
                    <span className="text-sm font-medium">{item.label}</span>
                  </button>
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-8 z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-50 rounded-lg"
            >
              <Menu size={20} />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500">
              <span className="hover:text-slate-900 cursor-pointer">PropAI Studio</span>
              <ChevronRight size={14} className="text-slate-300" />
              <span className="text-slate-900 font-medium capitalize">{activeScreen}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            <div className="hidden md:flex items-center bg-slate-100 rounded-full px-3 py-1.5 border border-slate-200">
              <Search size={16} className="text-slate-400 mr-2" />
              <input type="text" placeholder="Search..." className="bg-transparent border-none text-xs focus:outline-none w-32 lg:w-48" />
            </div>
            <button
              type="button"
              onClick={() => setThemeMode(nextTheme)}
              className="flex items-center gap-2 p-2 text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
              aria-label={`Switch to ${nextTheme} theme`}
              title={`Switch to ${nextTheme} theme`}
            >
              {themeMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="p-2 text-slate-500 hover:bg-slate-50 rounded-full relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
            </button>
            <div className="h-8 w-[1px] bg-slate-200 mx-1 hidden sm:block" />
            <button className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-slate-50 transition-colors">
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs">
                JD
              </div>
              <span className="text-sm font-medium text-slate-700 hidden lg:block">John Doe</span>
            </button>
          </div>
        </header>

        {/* Content Viewport */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeScreen}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto h-full"
            >
              {renderScreen()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Modals & Overlays */}
      <Modal 
        isOpen={showApprovalModal} 
        onClose={() => setShowApprovalModal(false)} 
        title="Execution Approval Required"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowApprovalModal(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => setShowApprovalModal(false)}>Approve Action</Button>
          </>
        }
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
            <AlertCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Agent <span className="font-bold text-slate-900">DevOps Assistant</span> is requesting permission to execute a high-risk command:
            </p>
            <div className="mt-3 p-3 bg-slate-900 rounded-lg font-mono text-xs text-emerald-400">
              rm -rf /var/log/temp/* && systemctl restart nginx
            </div>
            <p className="mt-3 text-xs text-slate-500 italic">
              This action cannot be undone. Please verify the command before approving.
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showGatewayModal}
        onClose={() => setShowGatewayModal(false)}
        title="Gateway URL Confirmation"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowGatewayModal(false)}>Close</Button>
            <Button
              onClick={() => {
                const normalized = gatewayUrl.trim();
                if (normalized) {
                  setGatewayUrl(normalized);
                  setGatewayStatus('idle');
                  setGatewayStatusMessage('Gateway URL saved.');
                  setShowGatewayModal(false);
                }
              }}
            >
              Save Gateway URL
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Please confirm the Gateway URL for your PropAI Studio instance. This URL will be used for all external communications.
          </p>
          <div className="relative">
            <input 
              type="text" 
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm font-mono" 
              value={gatewayUrl}
              onChange={(event) => {
                setGatewayUrl(event.target.value);
                setGatewayStatus('idle');
                setGatewayStatusMessage('');
              }}
            />
            {gatewayStatus === 'ok' && (
              <div className="absolute right-3 top-3 text-emerald-600">
                <CheckCircle2 size={18} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs font-medium">
            <button
              type="button"
              onClick={handleGatewayConnectionTest}
              className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-700"
            >
              <ExternalLink size={14} />
              Test connection to gateway
            </button>
            <span className="text-slate-400">|</span>
            <a
              href={toGatewayHealthUrl(gatewayUrl)}
              target="_blank"
              rel="noreferrer"
              className="text-slate-500 hover:text-slate-700 hover:underline"
            >
              Open health endpoint
            </a>
          </div>
          {gatewayStatusMessage && (
            <p
              className={cn(
                'text-xs',
                gatewayStatus === 'error'
                  ? 'text-rose-600'
                  : gatewayStatus === 'ok'
                    ? 'text-emerald-600'
                    : 'text-slate-500',
              )}
            >
              {gatewayStatusMessage}
            </p>
          )}
          <div className="text-[11px] text-slate-500">
            Env override: <span className="font-mono">VITE_PROPAICLAW_GATEWAY_URL</span>
          </div>
        </div>
      </Modal>

      {/* Floating Action for Demo */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-40">
        <button 
          onClick={() => setShowApprovalModal(true)}
          className="w-12 h-12 rounded-full bg-rose-600 text-white shadow-lg hover:bg-rose-700 flex items-center justify-center transition-transform hover:scale-110"
          title="Demo Approval Modal"
        >
          <AlertCircle size={20} />
        </button>
        <button 
          onClick={() => setShowGatewayModal(true)}
          className="w-12 h-12 rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 flex items-center justify-center transition-transform hover:scale-110"
          title="Demo Gateway Modal"
        >
          <Network size={20} />
        </button>
      </div>
    </div>
  );
}
