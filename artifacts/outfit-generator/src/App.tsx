import { QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Redirect, Router as WouterRouter } from 'wouter';
import { AppLayout } from './components/layout/AppLayout';
import WardrobePage from './pages/wardrobe';
import GeneratePage from './pages/generate';
import SavedPage from './pages/saved';
import FavoritesPage from './pages/favorites';
import BackupPage from './pages/backup';
import WelcomePage from './pages/welcome';
import HeroSplash from './pages/hero-splash';
import { LockedScreen } from './components/LockedScreen';
import { queryClient } from '@/lib/queryClient';
import { useState } from 'react';
import { initRevenueCat, syncEntitlementOnStartup, addCustomerInfoListener } from '@/lib/revenuecat';
import { setGlobalTier } from '@/hooks/useEntitlements';
import { useBiometricLock } from '@/hooks/useBiometricLock';
import { BiometricLockContext } from '@/contexts/BiometricLockContext';
import { AnimatePresence } from 'framer-motion';

// ── RevenueCat bootstrap ──────────────────────────────────────────────────────
//
// Order of operations:
//   1. configure() — await so SDK is ready before any API call
//   2. addCustomerInfoUpdateListener — catches async entitlement pushes
//      (subscription renewals, cross-device purchases, App Review purchases)
//   3. syncEntitlementOnStartup — one getCustomerInfo() call to restore the
//      correct tier if localStorage was cleared (reinstall / WebView reset)
//
initRevenueCat().then(() => {
  // Register a persistent listener.  RevenueCat calls this whenever
  // CustomerInfo changes — including right after a purchase completes on the
  // App Store side, which may arrive slightly after purchasePackage() returns.
  addCustomerInfoListener((hasEntitlement) => {
    if (hasEntitlement) setGlobalTier('unlock');
  });

  // Cold-launch sync: restores tier if localStorage was wiped.
  return syncEntitlementOnStartup();
}).then((active) => {
  if (active) setGlobalTier('unlock');
}).catch((e) => {
  console.error('[RevenueCat] Startup bootstrap failed:', e);
});

// ─────────────────────────────────────────────────────────────────────────────

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
      <h1 className="text-6xl font-display font-bold text-primary drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">404</h1>
      <p className="text-xl font-bold uppercase">As if! This page is totally lost.</p>
    </div>
  );
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={WardrobePage} />
        <Route path="/generate" component={GeneratePage} />
        <Route path="/saved" component={SavedPage} />
        <Route path="/favorites" component={FavoritesPage} />
        <Route path="/backup" component={BackupPage} />
        <Redirect to="/" />
      </Switch>
    </AppLayout>
  );
}

type SplashPhase = "hero" | "welcome" | "entered";

function AppShell() {
  const isPreview = new URLSearchParams(window.location.search).get('preview') === '1';
  const [splashPhase, setSplashPhase] = useState<SplashPhase>(() => isPreview ? "entered" : "hero");
  const { enabled, isLocked, authenticate, enableLock, disableLock } = useBiometricLock();

  return (
    <BiometricLockContext.Provider value={{ enabled, enableLock, disableLock }}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Router />
      </WouterRouter>

      {/* Splash sequence — hero image → animated welcome → app */}
      <AnimatePresence mode="wait">
        {splashPhase === "hero" && (
          <HeroSplash key="hero" onContinue={() => setSplashPhase("welcome")} />
        )}
        {splashPhase === "welcome" && (
          <WelcomePage key="welcome" onEnter={() => setSplashPhase("entered")} />
        )}
      </AnimatePresence>

      {/* Biometric lock gate — sits above everything including the welcome splash */}
      <AnimatePresence>
        {isLocked && (
          <LockedScreen key="locked" onAuthenticate={authenticate} />
        )}
      </AnimatePresence>
    </BiometricLockContext.Provider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}

export default App;
