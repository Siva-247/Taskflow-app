import React from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { roleHome } from '../utils.js';

// Single post-auth landing route: every login/signup navigates here, and
// this immediately routes on to the correct existing dashboard for the
// authenticated user's actual role — nothing per-person, nothing hardcoded.
// (Layout already redirects to "/" for anyone without a session before this
// ever renders, so currentUser is guaranteed to exist here.)
export default function Dashboard() {
  const { currentUser } = useApp();
  return <Navigate to={roleHome(currentUser.role)} replace />;
}
