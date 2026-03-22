import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import MarketingPage from './marketing/pages/MarketingPage';
import AppDashboard from './gateway/pages/AppDashboard';
import PrivacyPolicy from './marketing/pages/PrivacyPolicy';
import TermsOfService from './marketing/pages/TermsOfService';
import CookiePolicy from './marketing/pages/CookiePolicy';
import ContactPage from './marketing/pages/ContactPage';

export default function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<MarketingPage />} />
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
