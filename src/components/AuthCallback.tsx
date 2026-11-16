import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { completeGoogleProof, getGoogleProofIntent } from '../authClient';
import { useLearnOS } from '../context/LearnOSContext';

export default function AuthCallback() {
  const { currentUser, authError, isGoogleSigningIn } = useLearnOS();
  const navigate = useNavigate();
  const [intent] = useState(getGoogleProofIntent);
  const [popupNonce] = useState(() => sessionStorage.getItem('ss_oauth_popup_nonce'));
  const [hasCode] = useState(() => new URLSearchParams(location.search).has('code'));

  useEffect(() => {
    if (intent) {
      let active = true;
      void completeGoogleProof(intent).then(path => {
        if (active) navigate(path, { replace: true });
      });
      return () => { active = false; };
    }
    if (!popupNonce) return;
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    sessionStorage.removeItem('ss_oauth_popup_nonce');
    history.replaceState(history.state, '', url.pathname);
    const message = { type: 'ss-oauth-code', code, nonce: popupNonce };
    window.opener?.postMessage(message, window.location.origin);
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('ss-oauth-' + popupNonce);
      channel.postMessage(message);
      channel.close();
    }
    window.close();
  }, [intent, popupNonce, navigate]);

  if (!intent && !popupNonce && currentUser && !isGoogleSigningIn) {
    const path = ['admin', 'platform_owner'].includes(currentUser.role) ? '/admin/dashboard'
      : currentUser.role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard';
    return <Navigate replace to={path} />;
  }

  return <main className="grid min-h-screen place-items-center p-6">
    {!intent && (authError || !hasCode) ? (
      <div className="space-y-4 text-center">
        <p role="alert">Google kirishi yakunlanmadi.</p>
        <Link className="ss-primary" to="/login">Kirish sahifasiga qaytish</Link>
      </div>
    ) : <p role="status">Google hisobingiz tekshirilmoqda…</p>}
  </main>;
}
