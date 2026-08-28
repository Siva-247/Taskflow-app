import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { Card, Button } from '../components/ui.jsx';
import { roleHome } from '../utils.js';

export default function NotFound() {
  const { currentUser } = useApp();
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <Card style={{ maxWidth: 420, textAlign: 'center', padding: '40px 36px' }}>
        <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 700, fontSize: 40, color: 'var(--accent)', letterSpacing: '-0.02em' }}>404</div>
        <div style={{ fontFamily: "'Poppins',system-ui,sans-serif", fontWeight: 600, fontSize: 18, color: 'var(--heading)', marginTop: 10 }}>Page not found</div>
        <div style={{ fontFamily: "'Manrope',system-ui,sans-serif", fontWeight: 500, fontSize: 13.5, color: 'var(--text-secondary)', marginTop: 8, lineHeight: 1.6 }}>
          That page doesn't exist, or the link is out of date.
        </div>
        <Button variant="primary" style={{ marginTop: 22, justifyContent: 'center', width: '100%' }} onClick={() => navigate(roleHome(currentUser?.role))}>
          Go to Dashboard
        </Button>
      </Card>
    </div>
  );
}
