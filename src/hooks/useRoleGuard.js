import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { roleHome } from '../utils.js';

// Keeps a route visible only to the role(s) it was built for — visiting it
// directly with another role bounces you back to your own home, so no one
// ever sees data scoped outside their responsibility. Accepts one role or a list.
export function useRoleGuard(expectedRole) {
  const { currentUser, showToast } = useApp();
  const navigate = useNavigate();
  const allowedRoles = Array.isArray(expectedRole) ? expectedRole : [expectedRole];

  useEffect(() => {
    if (currentUser && !allowedRoles.includes(currentUser.role)) {
      showToast("That page isn't part of your role");
      navigate(roleHome(currentUser.role), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, JSON.stringify(allowedRoles)]);

  return currentUser && allowedRoles.includes(currentUser.role);
}
