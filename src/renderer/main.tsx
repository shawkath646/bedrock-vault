import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

async function bootstrap() {
  const appConfig = await window.appConfig.getAppConfig();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App appConfig={appConfig} />
    </StrictMode>
  );
}

bootstrap();
