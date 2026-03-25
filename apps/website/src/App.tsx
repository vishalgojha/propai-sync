import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import MarketingPage from './marketing/pages/MarketingPage';
import AppDashboard from './gateway/pages/AppDashboard';
import { APP_DASHBOARD_ROUTE_PATHS } from './gateway/tabRoutes';
import PrivacyPolicy from './marketing/pages/PrivacyPolicy';
import TermsOfService from './marketing/pages/TermsOfService';
import CookiePolicy from './marketing/pages/CookiePolicy';
import ContactPage from './marketing/pages/ContactPage';
import AIWhatsAppAutomationPage from './marketing/pages/AIWhatsAppAutomationPage';
import WhatsAppLeadQualificationPage from './marketing/pages/WhatsAppLeadQualificationPage';
import RealEstateAIAssistantIndiaPage from './marketing/pages/RealEstateAIAssistantIndiaPage';

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
          {APP_DASHBOARD_ROUTE_PATHS.map((path) => (
            <Route
              key={path}
              path={path}
              element={path === '/' && !serveDashboardAtRoot ? <MarketingPage /> : <AppDashboard />}
            />
          ))}
          <Route path="/ai-whatsapp-automation-real-estate" element={<AIWhatsAppAutomationPage />} />
          <Route path="/whatsapp-lead-qualification" element={<WhatsAppLeadQualificationPage />} />
          <Route path="/real-estate-ai-assistant-india" element={<RealEstateAIAssistantIndiaPage />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/cookies" element={<CookiePolicy />} />
          <Route path="/contact" element={<ContactPage />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

