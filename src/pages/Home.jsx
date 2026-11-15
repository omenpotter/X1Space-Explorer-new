import React from 'react';
import { Navigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// The dashboard is the landing page. This route only exists so old /home links keep working.
export default function Home() {
  return <Navigate to={createPageUrl('Dashboard')} replace />;
}
