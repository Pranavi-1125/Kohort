export default function SetupScreen() {
  return (
    <div className="center-screen">
      <div className="card stack" style={{ maxWidth: 560 }}>
        <h1>Almost there</h1>
        <p className="muted">Kohort needs your Firebase project settings before it can start. Copy <code>client/.env.example</code> to <code>client/.env</code>, fill in the values from the Firebase console, and restart the dev server.</p>
        <pre style={{ background: '#f6f1e4', padding: 14, borderRadius: 10, overflow: 'auto', fontSize: 13 }}>{`VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_DATABASE_URL=`}</pre>
        <p className="small muted">Full instructions are in the README.</p>
      </div>
    </div>
  );
}
