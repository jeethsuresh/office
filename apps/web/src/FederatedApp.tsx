import React, { useEffect, useState } from "react";
import { App } from "@office/ui";
import "./auth.css";

type User = { user_id: string; username: string };
export function FederatedApp() {
  const [user, setUser] = useState<User | null>(null);
  const [local, setLocal] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch("/auth/gravitas/config", { cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("Unable to check sign-in");
      const config = await response.json() as { enabled: boolean };
      if (!config.enabled) { sessionStorage.setItem("office-auth-mode", "local"); setLocal(true); return; }
      sessionStorage.removeItem("office-auth-mode");
      const session = await fetch("/auth/gravitas/session", { credentials: "same-origin", cache: "no-store" });
      if (session.ok) setUser((await session.json() as { user: User }).user);
      else if (session.status !== 401) throw new Error("Sign-in is temporarily unavailable");
    }).catch(() => {
      if (["127.0.0.1", "localhost", "[::1]"].includes(location.hostname) && sessionStorage.getItem("office-auth-mode") === "local") setLocal(true);
      else setError("Connect to the server to sign in with Gravitas.");
    }).finally(() => setChecking(false));
    const expired = () => setUser(null);
    window.addEventListener("office:unauthorized", expired);
    return () => window.removeEventListener("office:unauthorized", expired);
  }, []);
  if (local) return <App />;
  if (checking) return <main className="office-auth"><p>Checking your session…</p></main>;
  if (!user) {
    const requested = new URLSearchParams(location.search).get("next");
    const next = requested || (location.pathname === "/login" ? "/" : location.pathname + location.search + location.hash);
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
      setUser(null);
      history.replaceState(null, "", "/login");
    } catch { setError("Sign-out failed. Please try again."); }
  };
  return <div className="office-signed-in"><div className="office-session-bar"><span>{user.user_id}</span><span>{error}</span><button type="button" onClick={() => void logout()}>Sign out of Office</button></div><div className="office-workspace"><App /></div></div>;
}
