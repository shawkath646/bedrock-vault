import { useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, useLocation, useNavigationType } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import appMetadata from "@shared/constant/metadata.json";
import AnimatedPage from './components/AnimatedPage';
import HomePage from './pages/Home/page';
import NotFound from './pages/NotFound';
import FileSelectionPage from './pages/FileSelection/page';
import SetupWizardPage from './pages/SetupWizard/page';
import SafeRouting from './components/SafeRouting';
import { applyAppTheme, getAppTheme } from '@/lib/theme';

type InitState = {
  loading: boolean;
  initialized: boolean;
};

function LocationRoutes() {
  const location = useLocation();
  const navType = useNavigationType();
  const direction = navType === "POP" ? -1 : 1;

  const [state, setState] = useState<InitState>({
    loading: true,
    initialized: false,
  });

  useEffect(() => {
    let isMounted = true;

    (async () => {
      const initialized = await window.api.isInitialized();
      if (isMounted) {
        setState({ loading: false, initialized });
      }
    })();

    return () => { isMounted = false; };
  }, []);

  if (state.loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>

        <Route
          path="/"
          element={
            <SafeRouting initialized={state.initialized} direction={direction}>
              <HomePage />
            </SafeRouting>
          }
        />

        <Route
          path="/file-selection"
          element={
            <SafeRouting initialized={state.initialized} direction={direction}>
              <FileSelectionPage />
            </SafeRouting>
          }
        />

        <Route
          path="/setup"
          element={
            <AnimatedPage direction={direction}>
              <SetupWizardPage
                onComplete={() =>
                  setState({ loading: false, initialized: true })
                }
              />
            </AnimatedPage>
          }
        />

        <Route
          path="*"
          element={
            <AnimatedPage direction={direction}>
              <NotFound />
            </AnimatedPage>
          }
        />

      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  useEffect(() => {
    document.title = appMetadata.name;

    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const syncTheme = () => {
      applyAppTheme(getAppTheme());
    };

    syncTheme();
    darkModeQuery.addEventListener('change', syncTheme);
    window.addEventListener('app-theme-change', syncTheme as EventListener);

    return () => {
      darkModeQuery.removeEventListener('change', syncTheme);
      window.removeEventListener('app-theme-change', syncTheme as EventListener);
    };
  }, []);

  return (
    <Router>
      <div className="h-screen bg-background font-sans text-foreground select-none">
        <LocationRoutes />
      </div>
    </Router>
  );
}