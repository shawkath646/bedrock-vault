import { useEffect, lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import logger from './lib/logger';
import HomePage from './pages/Home/page';
import SafeRouting from './components/SafeRouting';
import type { AppConfig } from '@shared/types/global';
import { AppConfigProvider } from './contexts/AppConfigContext';
import { TooltipProvider } from './components/ui/tooltip';
import GlobalPopup from './components/GlobalPopup';
import useTheme from './lib/theme';

const NotFound = lazy(() => import('./pages/NotFound'));
const FileSelectionPage = lazy(() => import('./pages/FileSelection/page'));
const SetupWizardPage = lazy(() => import('./pages/SetupWizard/page'));
const EncryptionOptionsPage = lazy(() => import('./pages/EncryptionOptions/page'));
const ConfirmEncryptionPage = lazy(() => import('./pages/ConfirmEncryption/page'));
const EncryptionProgressPage = lazy(() => import('./pages/EncryptionProgress/page'));
const AboutPage = lazy(() => import('./pages/About/page'));
const UpdatePage = lazy(() => import('./pages/Update/page'));
const SettingsPage = lazy(() => import('./pages/Settings/page'));
const LogPage = lazy(() => import('./pages/LogPage/page'));


function RouteTracker() {
  const location = useLocation();

  useEffect(() => {
    void logger.info("Navigation", `Navigated to ${location.pathname}${location.search}${location.hash}`);
  }, [location]);

  return null;
}

function AppContent() {
  useTheme();

  return (
    <TooltipProvider>
      <GlobalPopup />
      <Router>
        <RouteTracker />
        <div className="h-screen bg-background font-sans text-foreground select-none">
            <Suspense fallback={<div className="h-screen w-screen bg-background" />}>
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
                  path="/update"
                  element={
                    <SafeRouting>
                      <UpdatePage />
                    </SafeRouting>
                  }
                />

                <Route
                  path="/settings"
                  element={
                    <SafeRouting>
                      <SettingsPage />
                    </SafeRouting>
                  }
                />
                <Route
                  path="/logs"
                  element={
                    <SafeRouting>
                      <LogPage />
                    </SafeRouting>
                  }
                />

                <Route
                  path="*"
                  element={<NotFound />}
                />
              </Routes>
            </Suspense>
          </div>
        </Router>
      </TooltipProvider>
  );
}

export default function App({ appConfig }: { appConfig: AppConfig }) {
  return (
    <AppConfigProvider initialConfig={appConfig}>
      <AppContent />
    </AppConfigProvider>
  );
}