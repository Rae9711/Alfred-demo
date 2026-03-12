import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { MobileSetupScreen, MobileMainScreen, loadIdentity, isMobilePlatform, type AIIdentity } from "./MobileUI";

function MobileApp() {
  const [identity, setIdentity] = useState<AIIdentity | null>(() => loadIdentity());

  const handleReset = () => {
    localStorage.removeItem("ai_identity");
    setIdentity(null);
  };

  if (!identity) {
    return <MobileSetupScreen onComplete={setIdentity} />;
  }

  return (
    <MobileMainScreen
      identity={identity}
      onReset={handleReset}
    />
  );
}

function Root() {
  const isMobile = isMobilePlatform();
  
  if (isMobile) {
    return <MobileApp />;
  }
  
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
