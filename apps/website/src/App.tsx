import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import MarketingPage from './marketing/pages/MarketingPage';
import AppDashboard from './gateway/pages/AppDashboard';
import PrivacyPolicy from './marketing/pages/PrivacyPolicy';
import TermsOfService from './marketing/pages/TermsOfService';
import CookiePolicy from './marketing/pages/CookiePolicy';
import ContactPage from './marketing/pages/ContactPage';

function isAppHost(hostname: string) {
  if (!hostname) {
    return false;
  }
  return hostname === 'app.propai.live' || hostname.startsWith('app.') || hostname.includes('gateway');
}

export default function App() {
  const hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  const serveDashboardAtRoot = isAppHost(hostname);

  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={serveDashboardAtRoot ? <AppDashboard /> : <MarketingPage />} />
          <Route path="/app" element={<AppDashboard />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/cookies" element={<CookiePolicy />} />
          <Route path="/contact" element={<ContactPage />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}
