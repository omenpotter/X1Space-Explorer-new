import { Toaster } from "@/components/ui/toaster"
import { Suspense, lazy } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import VisualEditAgent from '@/lib/VisualEditAgent'
import NavigationTracker from '@/lib/NavigationTracker'
import Layout from './Layout.jsx'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { Analytics } from "@vercel/analytics/react";

// Routes come from the files in ./pages, each loaded as its own chunk on first visit.
// (pages.config.js is not imported here because it imports every page eagerly.)
const MAIN_PAGE = 'Dashboard';
const loaders = import.meta.glob('./pages/*.jsx');
const Pages = Object.fromEntries(
  Object.entries(loaders).map(([file, load]) => [file.replace('./pages/', '').replace('.jsx', ''), lazy(load)]),
);
const mainPageKey = MAIN_PAGE in Pages ? MAIN_PAGE : Object.keys(Pages)[0];
const MainPage = Pages[mainPageKey];

function PageFallback() {
  return (
    <div role="status" aria-label="Loading page" className="flex min-h-[40vh] items-center justify-center">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-line-strong border-t-brand" />
    </div>
  );
}

// Layout wrapper for all pages
/** @param {{ children?: any, currentPageName?: any, [key: string]: any }} props */
const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

// Authenticated routes component
const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-canvas" role="status" aria-label="Loading X1 Space">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line-strong border-t-brand"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <Suspense fallback={<PageFallback />}><MainPage /></Suspense>
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Suspense fallback={<PageFallback />}><Page /></Suspense>
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

// Main App
function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <VisualEditAgent />
        {/* Vercel Analytics */}
        <Analytics />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App;
