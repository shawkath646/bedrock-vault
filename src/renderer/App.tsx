import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/Home/page';
import NotFound from './pages/NotFound';
import FileSelectionPage from './pages/FileSelection/page';
import SetupWizardPage from './pages/SetupWizard/page';
import SafeRouting from './components/SafeRouting';
import EncryptionOptionsPage from './pages/EncryptionOptions/page';
import type { AppConfig } from '@shared/types/global';
import { AppConfigProvider } from './contexts/AppConfigContext';
import ConfirmEncryptionPage from './pages/ConfirmEncryption/page';
import EncryptionProgressPage from './pages/EncryptionProgress/page';
import AboutPage from './pages/About/page';
import { TooltipProvider } from './components/ui/tooltip';
import GlobalPopup from './components/GlobalPopup';


export default function App({ appConfig }: { appConfig: AppConfig }) {
  return (
    <AppConfigProvider initialConfig={appConfig}>
      <TooltipProvider>
        {/* GlobalPopup sits outside the Router so it's always reachable */}
        <GlobalPopup />
        <Router>
          <div className="h-screen bg-background font-sans text-foreground select-none">
            <Routes>
              <Route
                path="/"
                element={
                  <SafeRouting>
                    <HomePage />
                  </SafeRouting>
                }
              />
              <Route
                path="/file-selection"
                element={
                  <SafeRouting>
                    <FileSelectionPage />
                  </SafeRouting>
                }
              />
              <Route
                path="/encryption-options"
                element={
                  <SafeRouting>
                    <EncryptionOptionsPage />
                  </SafeRouting>
                }
              />

              <Route
                path="/confirm-encryption"
                element={
                  <SafeRouting>
                    <ConfirmEncryptionPage />
                  </SafeRouting>
                }
              />

              <Route
                path="/encryption-progress"
                element={
                  <SafeRouting>
                    <EncryptionProgressPage />
                  </SafeRouting>
                }
              />

              <Route
                path="/setup"
                element={
                  <SetupWizardPage />
                }
              />

              <Route
                path="/about"
                element={
                  <SafeRouting>
                    <AboutPage />
                  </SafeRouting>
                }
              />

              <Route
                path="*"
                element={<NotFound />}
              />
            </Routes>
          </div>
        </Router>
      </TooltipProvider>
    </AppConfigProvider>
  );
}