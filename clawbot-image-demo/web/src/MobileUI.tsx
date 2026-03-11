import React, { useState, useEffect, useMemo } from "react";
import { createWS, type EventMsg } from "./api/ws";
import {
  applyEvent,
  equipCosmetic,
  loadMeta,
  saveMeta,
  setCustomCosmeticAsset,
  type AgentEventType,
  type AgentMeta,
  type AvatarState,
  type CosmeticSlot,
} from "./agentMeta";

// ── Types ────────────────────────────────────────────────

export type AIIdentity = {
  name: string;
  persona: string;
  platform: string;
  platformTarget: string;
  createdAt: number;
};

// ── Shared constants ─────────────────────────────────────

const PERSONA_OPTIONS: Record<string, { label: string; desc: string }> = {
  professional: { label: "专业顾问", desc: "正式、结构化、直接给出建议" },
  friendly_coach: { label: "贴心教练", desc: "友好、鼓励、用大白话沟通" },
  no_bs: { label: "直言不讳", desc: "简洁、直接、不说废话" },
  playful_nerd: { label: "极客玩家", desc: "有趣、用比喻，但信息准确" },
};

function resolvePersona(tone: "casual" | "formal", mode: "confirm" | "immediate"): string {
  if (tone === "casual" && mode === "confirm") return "friendly_coach";
  if (tone === "casual" && mode === "immediate") return "playful_nerd";
  if (tone === "formal" && mode === "confirm") return "professional";
  if (tone === "formal" && mode === "immediate") return "no_bs";
  return "professional";
}

const PLATFORMS = [
  { id: "wechat", label: "微信", icon: "💬" },
  { id: "imessage", label: "iMessage", icon: "📱" },
  { id: "sms", label: "短信", icon: "✉️" },
  { id: "wecom", label: "企业微信", icon: "🏢" },
  { id: "dingtalk", label: "钉钉", icon: "📌" },
  { id: "feishu", label: "飞书", icon: "🐦" },
];

// ── Storage helpers ──────────────────────────────────────

function saveIdentity(id: AIIdentity) {
  localStorage.setItem("ai_identity", JSON.stringify(id));
}

function getSessionId() {
  let id = localStorage.getItem("demo_session");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("demo_session", id);
  }
  return id;
}

function getDefaultConnectorId(identity: AIIdentity) {
  return `${identity.name.toLowerCase().replace(/\s+/g, "-")}-mac`;
}

function getWebSocketURL(token?: string): string {
  let base: string;
  // @ts-ignore - Vite env
  const envUrl = import.meta.env?.VITE_WS_URL;
  if (envUrl) {
    base = envUrl;
  } else if (window.location.protocol === 'https:') {
    const wsProtocol = 'wss:';
    const hostname = window.location.hostname;
    base = `${wsProtocol}//${hostname}`;
  } else {
    base = "ws://localhost:8080";
  }
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

// ── Mobile Setup Screen ──────────────────────────────────

export function MobileSetupScreen({ onComplete }: { onComplete: (id: AIIdentity) => void }) {
  const [name, setName] = useState("");
  const [tone, setTone] = useState<"casual" | "formal">("casual");
  const [mode, setMode] = useState<"confirm" | "immediate">("confirm");
  const [platform, setPlatform] = useState("imessage");
  const [step, setStep] = useState(1); // Multi-step wizard for mobile

  const persona = resolvePersona(tone, mode);

  const submit = () => {
    if (!name.trim()) return;
    const plat = PLATFORMS.find((p) => p.id === platform) ?? PLATFORMS[1];
    const identity: AIIdentity = {
      name: name.trim(),
      persona,
      platform: plat.id,
      platformTarget: `#${plat.id}`,
      createdAt: Date.now(),
    };
    saveIdentity(identity);
    onComplete(identity);
  };

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    display: "flex",
    flexDirection: "column",
    padding: "env(safe-area-inset-top, 20px) 20px env(safe-area-inset-bottom, 20px)",
  };

  const cardStyle: React.CSSProperties = {
    background: "white",
    borderRadius: 24,
    padding: 24,
    margin: "auto",
    width: "100%",
    maxWidth: 380,
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: step >= s ? "#4F46E5" : "#E5E7EB",
                transition: "all 0.3s",
              }}
            />
          ))}
        </div>

        {step === 1 && (
          <>
            <h1 style={{ margin: 0, fontSize: 22, textAlign: "center", fontWeight: 700 }}>
              创建你的 AI 助手
            </h1>
            <p style={{ textAlign: "center", color: "#6B7280", fontSize: 14, marginTop: 8, marginBottom: 28 }}>
              给你的助手起个名字
            </p>

            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：小福、阿智..."
              style={{
                width: "100%",
                padding: 16,
                borderRadius: 12,
                border: "2px solid #E5E7EB",
                fontSize: 18,
                textAlign: "center",
                outline: "none",
                boxSizing: "border-box",
              }}
              autoFocus
            />

            <button
              onClick={() => name.trim() && setStep(2)}
              disabled={!name.trim()}
              style={{
                width: "100%",
                padding: 16,
                borderRadius: 12,
                border: "none",
                background: name.trim() ? "#4F46E5" : "#E5E7EB",
                color: "white",
                fontWeight: 700,
                fontSize: 16,
                marginTop: 20,
                cursor: name.trim() ? "pointer" : "not-allowed",
              }}
            >
              下一步
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={{ margin: 0, fontSize: 20, textAlign: "center", fontWeight: 700 }}>
              {name} 的性格
            </h2>
            <p style={{ textAlign: "center", color: "#6B7280", fontSize: 14, marginTop: 8, marginBottom: 24 }}>
              选择 TA 的风格
            </p>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 10 }}>语气风格</div>
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { value: "casual", label: "轻松随意", emoji: "😊" },
                  { value: "formal", label: "正式专业", emoji: "💼" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setTone(opt.value as any)}
                    style={{
                      flex: 1,
                      padding: "14px 12px",
                      borderRadius: 12,
                      border: tone === opt.value ? "2px solid #4F46E5" : "1px solid #E5E7EB",
                      background: tone === opt.value ? "#EEF2FF" : "white",
                      fontSize: 14,
                      fontWeight: tone === opt.value ? 600 : 400,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{opt.emoji}</div>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 10 }}>执行模式</div>
              <div style={{ display: "flex", gap: 10 }}>
                {[
                  { value: "confirm", label: "先确认再执行", emoji: "🔒" },
                  { value: "immediate", label: "立即执行", emoji: "⚡" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setMode(opt.value as any)}
                    style={{
                      flex: 1,
                      padding: "14px 12px",
                      borderRadius: 12,
                      border: mode === opt.value ? "2px solid #4F46E5" : "1px solid #E5E7EB",
                      background: mode === opt.value ? "#EEF2FF" : "white",
                      fontSize: 14,
                      fontWeight: mode === opt.value ? 600 : 400,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{opt.emoji}</div>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 12,
                  border: "1px solid #E5E7EB",
                  background: "white",
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                返回
              </button>
              <button
                onClick={() => setStep(3)}
                style={{
                  flex: 2,
                  padding: 14,
                  borderRadius: 12,
                  border: "none",
                  background: "#4F46E5",
                  color: "white",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                下一步
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 style={{ margin: 0, fontSize: 20, textAlign: "center", fontWeight: 700 }}>
              选择通讯平台
            </h2>
            <p style={{ textAlign: "center", color: "#6B7280", fontSize: 14, marginTop: 8, marginBottom: 24 }}>
              {name} 帮你发消息用哪个?
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 24 }}>
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPlatform(p.id)}
                  style={{
                    padding: "16px 8px",
                    borderRadius: 12,
                    border: platform === p.id ? "2px solid #4F46E5" : "1px solid #E5E7EB",
                    background: platform === p.id ? "#EEF2FF" : "white",
                    fontSize: 13,
                    fontWeight: platform === p.id ? 600 : 400,
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 4 }}>{p.icon}</div>
                  {p.label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setStep(2)}
                style={{
                  flex: 1,
                  padding: 14,
                  borderRadius: 12,
                  border: "1px solid #E5E7EB",
                  background: "white",
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                返回
              </button>
              <button
                onClick={submit}
                style={{
                  flex: 2,
                  padding: 14,
                  borderRadius: 12,
                  border: "none",
                  background: "#059669",
                  color: "white",
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                开始使用 🚀
              </button>
            </div>
          </>
        )}
      </div>

      {/* Persona preview */}
      {step > 1 && (
        <div style={{ textAlign: "center", marginTop: 16, color: "rgba(255,255,255,0.8)", fontSize: 13 }}>
          性格: {PERSONA_OPTIONS[persona]?.label}
        </div>
      )}
    </div>
  );
}

// ── Mobile Main Screen ───────────────────────────────────

type Phase = "idle" | "planning" | "planned" | "executing" | "done" | "clarifying";

export function MobileMainScreen({
  identity,
  accessToken,
  onReset,
  onLogout,
}: {
  identity: AIIdentity;
  accessToken?: string;
  onReset: () => void;
  onLogout?: () => void;
}) {
  const sessionId = useMemo(() => getSessionId(), []);
  const metaStorageKey = useMemo(
    () => `agent_meta_${sessionId}_${identity.createdAt}`,
    [sessionId, identity.createdAt],
  );
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<any>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [finalMsg, setFinalMsg] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [wsClient, setWsClient] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "status" | "settings">("chat");
  const connectorStorageKey = useMemo(() => `connector_id_${sessionId}`, [sessionId]);
  const [connectorId, setConnectorId] = useState<string>(() => {
    const stored = localStorage.getItem(`connector_id_${getSessionId()}`);
    return stored || getDefaultConnectorId(identity);
  });
  const [connectorOnline, setConnectorOnline] = useState(false);
  const [actionMode, setActionMode] = useState<"confirm" | "immediate">(() => {
    return (localStorage.getItem("action_mode") as any) || "confirm";
  });
  const [tone, setTone] = useState<"casual" | "formal">(() => {
    return (localStorage.getItem("tone_pref") as any) || (
      identity.persona === "friendly_coach" || identity.persona === "playful_nerd" ? "casual" : "formal"
    );
  });

  const platLabel = PLATFORMS.find((p) => p.id === identity.platform)?.label ?? identity.platform;
  const personaInfo = PERSONA_OPTIONS[identity.persona];

  // WebSocket setup
  useEffect(() => {
    const wsUrl = getWebSocketURL(accessToken);
    const client = createWS(wsUrl, (m: EventMsg) => {
      if (m.type === "event") {
        const ev = m.event ?? "";
        const data = m.data;

        if (ev === "gateway.ready") setConnected(true);
        if (ev === "agent.plan.proposed") {
          setPlan(data);
          setPhase("planned");
        }
        if (ev === "agent.plan.error") setPhase("idle");
        if (ev.startsWith("agent.exec") || ev.startsWith("tool.")) {
          setLogs((prev) => [...prev, { ts: Date.now(), ev, data }]);
        }
        if (ev === "agent.exec.started") setPhase("executing");
        if (ev === "agent.rendered") {
          setFinalMsg(data.message);
          setPhase("done");
        }
      } else {
        if (m.result?.planId) setPlanId(m.result.planId);
        if (m.result?.runId) setRunId(m.result.runId);
        if (m.result?.connectorId) setConnectorOnline(!!m.result.connected);
      }
    });
    setWsClient(client);
  }, [accessToken]);

  // Sync settings
  useEffect(() => {
    if (!wsClient) return;
    wsClient.call("session.setPersona", { sessionId, persona: identity.persona });
  }, [wsClient, sessionId, identity.persona]);

  useEffect(() => {
    localStorage.setItem(connectorStorageKey, connectorId);
    if (wsClient && connectorId.trim()) {
      wsClient.call("session.bindConnector", { sessionId, connectorId: connectorId.trim() });
    }
  }, [wsClient, connectorStorageKey, connectorId, sessionId]);

  // Actions
  const askPlan = () => {
    if (!wsClient || !prompt.trim()) return;
    setLogs([]);
    setFinalMsg("");
    setPlan(null);
    setPhase("planning");
    wsClient.call("agent.plan", {
      sessionId,
      intent: "process_text",
      prompt: prompt.trim(),
      platform: identity.platform,
    });
  };

  const approve = () => {
    if (!wsClient || !planId) return;
    wsClient.call("agent.execute", { sessionId, planId, approved: true });
  };

  return (
    <div style={{ 
      minHeight: "100vh", 
      background: "#F5F5F7",
      display: "flex",
      flexDirection: "column",
      paddingTop: "env(safe-area-inset-top, 0)",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
        padding: "16px 20px",
        color: "white",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              fontWeight: 700,
            }}>
              {identity.name[0]}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{identity.name}</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>{personaInfo?.label} · {platLabel}</div>
            </div>
          </div>
          <div style={{
            padding: "6px 12px",
            borderRadius: 20,
            background: connected ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)",
            fontSize: 12,
            fontWeight: 500,
          }}>
            {connected ? "已连接" : "未连接"}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 16, overflowY: "auto", paddingBottom: 100 }}>
        {activeTab === "chat" && (
          <>
            {/* Input Card */}
            <div style={{
              background: "white",
              borderRadius: 16,
              padding: 16,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              marginBottom: 16,
            }}>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={`告诉 ${identity.name} 你想做什么...\n例如：给小明发消息说明天见`}
                rows={4}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #E5E7EB",
                  fontSize: 16,
                  resize: "none",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <button
                onClick={askPlan}
                disabled={!prompt.trim() || phase === "planning"}
                style={{
                  width: "100%",
                  padding: 14,
                  borderRadius: 12,
                  border: "none",
                  background: prompt.trim() && phase !== "planning" ? "#4F46E5" : "#E5E7EB",
                  color: "white",
                  fontWeight: 700,
                  fontSize: 16,
                  marginTop: 12,
                  cursor: prompt.trim() && phase !== "planning" ? "pointer" : "not-allowed",
                }}
              >
                {phase === "planning" ? "思考中..." : "发送指令"}
              </button>
            </div>

            {/* Plan Preview */}
            {phase === "planned" && plan && (
              <div style={{
                background: "white",
                borderRadius: 16,
                padding: 16,
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                marginBottom: 16,
              }}>
                <div style={{ fontWeight: 700, marginBottom: 12, color: "#4F46E5" }}>
                  📋 执行计划
                </div>
                <div style={{ fontSize: 14, color: "#374151", marginBottom: 16 }}>
                  {plan.steps?.map((step: any, i: number) => (
                    <div key={i} style={{ 
                      padding: "10px 0", 
                      borderBottom: i < plan.steps.length - 1 ? "1px solid #F3F4F6" : "none" 
                    }}>
                      <span style={{ fontWeight: 500 }}>{i + 1}. {step.tool}</span>
                      {step.description && (
                        <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
                          {step.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={approve}
                  style={{
                    width: "100%",
                    padding: 14,
                    borderRadius: 12,
                    border: "none",
                    background: "#059669",
                    color: "white",
                    fontWeight: 700,
                    fontSize: 16,
                    cursor: "pointer",
                  }}
                >
                  确认执行 ✓
                </button>
              </div>
            )}

            {/* Execution Status */}
            {phase === "executing" && (
              <div style={{
                background: "#FEF3C7",
                borderRadius: 16,
                padding: 16,
                textAlign: "center",
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
                <div style={{ fontWeight: 600, color: "#92400E" }}>执行中...</div>
              </div>
            )}

            {/* Result */}
            {phase === "done" && finalMsg && (
              <div style={{
                background: "#ECFDF5",
                borderRadius: 16,
                padding: 16,
              }}>
                <div style={{ fontWeight: 700, marginBottom: 8, color: "#059669" }}>
                  ✅ 完成
                </div>
                <div style={{ fontSize: 14, color: "#065F46", whiteSpace: "pre-wrap" }}>
                  {finalMsg}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "status" && (
          <div style={{
            background: "white",
            borderRadius: 16,
            padding: 16,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 16 }}>执行日志</div>
            {logs.length === 0 ? (
              <div style={{ color: "#9CA3AF", textAlign: "center", padding: 20 }}>
                暂无日志
              </div>
            ) : (
              logs.slice(-10).map((log, i) => (
                <div key={i} style={{ 
                  fontSize: 13, 
                  padding: "8px 0", 
                  borderBottom: "1px solid #F3F4F6" 
                }}>
                  <span style={{ color: "#6B7280" }}>{log.ev}</span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div style={{
            background: "white",
            borderRadius: 16,
            padding: 16,
          }}>
            <div style={{ fontWeight: 700, marginBottom: 16 }}>设置</div>
            
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 8 }}>Connector ID</div>
              <input
                value={connectorId}
                onChange={(e) => setConnectorId(e.target.value)}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid #E5E7EB",
                  fontSize: 15,
                  boxSizing: "border-box",
                }}
              />
              <div style={{ 
                marginTop: 6, 
                fontSize: 12, 
                color: connectorOnline ? "#059669" : "#9CA3AF" 
              }}>
                {connectorOnline ? "Connector 在线" : "Connector 未连接"}
              </div>
            </div>

            <button
              onClick={onReset}
              style={{
                width: "100%",
                padding: 14,
                borderRadius: 12,
                border: "1px solid #E5E7EB",
                background: "white",
                fontSize: 15,
                cursor: "pointer",
                marginBottom: 10,
              }}
            >
              重新设置
            </button>

            {onLogout && (
              <button
                onClick={onLogout}
                style={{
                  width: "100%",
                  padding: 14,
                  borderRadius: 12,
                  border: "1px solid #FCA5A5",
                  background: "#FEF2F2",
                  color: "#DC2626",
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                登出
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "white",
        borderTop: "1px solid #E5E7EB",
        display: "flex",
        paddingBottom: "env(safe-area-inset-bottom, 0)",
      }}>
        {[
          { id: "chat", label: "对话", icon: "💬" },
          { id: "status", label: "状态", icon: "📊" },
          { id: "settings", label: "设置", icon: "⚙️" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              flex: 1,
              padding: "12px 0",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: activeTab === tab.id ? "#4F46E5" : "#9CA3AF",
            }}
          >
            <div style={{ fontSize: 20 }}>{tab.icon}</div>
            <div style={{ fontSize: 11, fontWeight: activeTab === tab.id ? 600 : 400 }}>{tab.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
