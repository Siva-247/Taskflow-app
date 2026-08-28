import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import SignUp from './pages/SignUp.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import ManagerDashboard from './pages/ManagerDashboard.jsx';
import TeamLeadDashboard from './pages/TeamLeadDashboard.jsx';
import EmployeeDashboard from './pages/EmployeeDashboard.jsx';
import TaskList from './pages/TaskList.jsx';
import CreateTask from './pages/CreateTask.jsx';
import TaskDetails from './pages/TaskDetails.jsx';
import EditTask from './pages/EditTask.jsx';
import DailyUpdate from './pages/DailyUpdate.jsx';
import DailyUpdateHistory from './pages/DailyUpdateHistory.jsx';
import Drafts from './pages/Drafts.jsx';
import Profile from './pages/Profile.jsx';
import Employees from './pages/Employees.jsx';
import Teams from './pages/Teams.jsx';
import Departments from './pages/Departments.jsx';
import MyTeam from './pages/MyTeam.jsx';
import Settings from './pages/Settings.jsx';
import Reports from './pages/Reports.jsx';
import NotFound from './pages/NotFound.jsx';

function AppRoutes() {
  const { sessionRestoring } = useApp();

  // A previous session's token is still being validated against the server
  // — rendering the login screen here would flash it for a moment even when
  // the user is about to be signed back in automatically.
  if (sessionRestoring) {
    return (
      <div style={{ minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--page-bg)' }} />
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/manager" element={<ManagerDashboard />} />
          <Route path="/team-lead" element={<TeamLeadDashboard />} />
          <Route path="/employee" element={<EmployeeDashboard />} />
          <Route path="/tasks" element={<TaskList />} />
          <Route path="/tasks/new" element={<CreateTask />} />
          <Route path="/tasks/new/:draftId" element={<CreateTask />} />
          <Route path="/tasks/:taskId" element={<TaskDetails />} />
          <Route path="/tasks/:taskId/edit" element={<EditTask />} />
          <Route path="/daily-update" element={<DailyUpdate />} />
          <Route path="/daily-updates" element={<DailyUpdateHistory />} />
          <Route path="/drafts" element={<Drafts />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/teams" element={<Teams />} />
          <Route path="/departments" element={<Departments />} />
          <Route path="/my-team" element={<MyTeam />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  );
}
