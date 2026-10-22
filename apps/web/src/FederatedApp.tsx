import React, { useEffect, useRef, useState } from "react";
import { App } from "@office/ui";
import { appReturnPath, automaticSignInURL } from "./automaticSignIn";
import { createSessionMonitor } from "./sessionMonitor";
import "./auth.css";

type User = { sub: string; user_id: string; username: string };
export function FederatedApp() {
  const [user, setUser] = useState<User | null>(null);
  const [local, setLocal] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [autoSignIn, setAutoSignIn] = useState(false);
  const automaticAttempted = useRef(false);
  const userRef = useRef<User | null>(null);
  const federatedRef = useRef(false);
  const monitorRef = useRef<ReturnType<typeof createSessionMonitor<User>> | null>(null);
  useEffect(() => {
    let cancelled = false, initialized = false;
    void fetch("/auth/gravitas/config", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Unable to check sign-in");
      const config = await response.json() as { enabled: boolean; autoSignIn?: boolean };
      if (cancelled) return;
      if (!config.enabled) { sessionStorage.setItem("office-auth-mode", "local"); setLocal(true); return; }
      federatedRef.current = true;
      sessionStorage.removeItem("office-auth-mode");
      const session = await fetch("/auth/gravitas/session", { credentials: "same-origin", cache: "no-store" });
      if (cancelled) return;
      if (session.ok) { const value = (await session.json() as { user: User }).user; if (cancelled) return; userRef.current = value; setUser(value); setAutoSignIn(config.autoSignIn === true); }
      else if (session.status === 401) setAutoSignIn(config.autoSignIn === true);
      else throw new Error("Sign-in is temporarily unavailable");
    }).catch(() => {
      if (cancelled) return;
      if (["127.0.0.1", "localhost", "[::1]"].includes(location.hostname) && sessionStorage.getItem("office-auth-mode") === "local") setLocal(true);
      else setError("Connect to the server to sign in with Gravitas.");
    }).finally(() => { if (!cancelled) { initialized = true; setChecking(false); } });
    const monitor = createSessionMonitor<User>({
      sessionURL: "/auth/gravitas/session", configURL: "/auth/gravitas/config", logoutURL: "/auth/gravitas/logout", csrfHeader: "X-Gravitas-CSRF",
      isAuthenticated: () => userRef.current !== null,
      onSession: value => { userRef.current = value; setUser(value); },
      onRevoked: () => { userRef.current = null; setUser(null); },
      onAutoHint: setAutoSignIn,
      onUnavailable: value => setError(value ? "Sign-in is temporarily unavailable. Your local edits are kept on this device." : ""),
    });
    monitorRef.current = monitor;
    const expired = () => { void monitor.unauthorized(); };
    const resume = () => { if (initialized && federatedRef.current) void monitor.check(); };
    const visibility = () => { if (document.visibilityState === "visible") resume(); };
    const interval = setInterval(resume, 15_000);
    window.addEventListener("office:unauthorized", expired);
    window.addEventListener("focus", resume);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", visibility);
    return () => { cancelled = true; monitor.dispose(); clearInterval(interval); window.removeEventListener("office:unauthorized", expired); window.removeEventListener("focus", resume); window.removeEventListener("pageshow", resume); document.removeEventListener("visibilitychange", visibility); };
  }, []);
  const automaticURL = automaticSignInURL({ enabled: autoSignIn && !local, hasSession: !!user, attempted: automaticAttempted.current, location });
  useEffect(() => {
    if (checking || !automaticURL || automaticAttempted.current) return;
    automaticAttempted.current = true;
    window.location.replace(automaticURL);
  }, [checking, automaticURL]);
  if (local) return <App />;
  if (checking || automaticURL) return <main className="office-auth"><p>Connecting to Gravitas…</p></main>;
  if (!user) {
    const next = appReturnPath(location);
    const query = new URLSearchParams({ next }).toString();
    return <main className="office-auth"><section className="office-auth-card">
      <span className="office-auth-kicker">GRAVITAS · OFFICE</span><h1>A place to work together.</h1>
      <p>Sign in with your Gravitas account to open the shared workspace.</p>
      {error && <p role="alert">{error}</p>}
      <a className="office-auth-primary" href={"/auth/gravitas/start?" + query}>Sign in with Gravitas</a>
      <a href={"/auth/gravitas/register?" + query}>Register at gravitas.cool</a>
    </section></main>;
  }
  const logout = async () => {
    try {
      const response = await fetch("/auth/gravitas/logout", { method: "POST", headers: { "X-Gravitas-CSRF": "1" }, credentials: "same-origin" });
      if (!response.ok) throw new Error("Unable to sign out");
      history.replaceState(null, "", "/login?auto=off");
      monitorRef.current?.localSignedOut();
      userRef.current = null; setUser(null);
    } catch { setError("Sign-out failed. Please try again."); }
  };
  return <div className="office-signed-in"><div className="office-session-bar"><span>{user.user_id}</span><span>{error}</span><button type="button" onClick={() => void logout()}>Sign out of Office</button></div><div className="office-workspace"><App key={user.sub} /></div></div>;
}
