/**
 * API Settings Panel
 * 
 * Allows users to configure API keys for various services directly in the app.
 * Settings are stored in localStorage and synced to the backend.
 */
import React, { useState, useEffect } from "react";

export type APIConfig = {
  llmProvider: "claude" | "qwen" | "gemini" | "ollama";
  anthropicKey: string;
  qwenKey: string;
  geminiKey: string;
  braveSearchKey: string;
  kiwiKey: string;
  ollamaUrl: string;
  // Google OAuth (more complex, simplified for now)
  googleClientId: string;
  googleClientSecret: string;
};

const DEFAULT_CONFIG: APIConfig = {
  llmProvider: "ollama", // Default to local Ollama
  anthropicKey: "",
  qwenKey: "",
  geminiKey: "",
  braveSearchKey: "",
  kiwiKey: "",
  ollamaUrl: "http://127.0.0.1:11434",
  googleClientId: "",
  googleClientSecret: "",
};

const STORAGE_KEY = "api_settings";

export function loadAPIConfig(): APIConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    }
  } catch {}
  return DEFAULT_CONFIG;
}

export function saveAPIConfig(config: APIConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: APIConfig) => void;
};

export default function APISettings({ isOpen, onClose, onSave }: Props) {
  const [config, setConfig] = useState<APIConfig>(loadAPIConfig);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConfig(loadAPIConfig());
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setSaving(true);
    setTestResult(null);
    
    try {
      // Save to localStorage
      saveAPIConfig(config);
      
      // Sync to backend
      const wsUrl = getAPIBaseUrl();
      const res = await fetch(`${wsUrl}/api/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      
      if (res.ok) {
        setTestResult("✅ 设置已保存");
        onSave(config);
        setTimeout(onClose, 1000);
      } else {
        setTestResult("⚠️ 保存到服务器失败，设置已保存到本地");
      }
    } catch (e) {
      setTestResult("⚠️ 无法连接服务器，设置已保存到本地");
    }
    
    setSaving(false);
  };

  const testConnection = async () => {
    setTestResult("测试中...");
    
    try {
      const wsUrl = getAPIBaseUrl();
      const res = await fetch(`${wsUrl}/api/settings/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      
      const data = await res.json();
      if (data.ok) {
        setTestResult(`✅ ${data.provider} 连接成功`);
      } else {
        setTestResult(`❌ ${data.error || "连接失败"}`);
      }
    } catch (e) {
      setTestResult("❌ 无法连接服务器");
    }
  };

  const update = (key: keyof APIConfig, value: string) => {
    setConfig((c) => ({ ...c, [key]: value }));
    setTestResult(null);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "white",
          borderRadius: 16,
          width: "90%",
          maxWidth: 500,
          maxHeight: "85vh",
          overflow: "auto",
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 600 }}>
          API 配置
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6B7280" }}>
          配置 AI 和服务 API 密钥。所有密钥存储在本地，不会上传到云端。
        </p>

        {/* LLM Provider Selection */}
        <Section title="AI 提供商">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {[
              { id: "gemini", label: "Gemini", desc: "免费，支持网络搜索" },
              { id: "claude", label: "Claude", desc: "最强，按量付费" },
              { id: "qwen", label: "通义千问", desc: "中文优化" },
              { id: "ollama", label: "Ollama", desc: "本地运行，免费" },
            ].map((p) => (
              <ProviderButton
                key={p.id}
                selected={config.llmProvider === p.id}
                onClick={() => update("llmProvider", p.id as APIConfig["llmProvider"])}
                label={p.label}
                desc={p.desc}
              />
            ))}
          </div>
        </Section>

        {/* Provider-specific settings */}
        {config.llmProvider === "gemini" && (
          <Section title="Google Gemini (免费)">
            <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
              获取密钥：
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noopener"
                style={{ color: "#3B82F6", marginLeft: 4 }}
              >
                Google AI Studio →
              </a>
            </p>
            <PasswordInput
              value={config.geminiKey}
              onChange={(v) => update("geminiKey", v)}
              placeholder="AIza..."
            />
            <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
              ✨ 免费版每分钟 15 次请求，支持 Google Search 实时搜索
            </p>
          </Section>
        )}

        {config.llmProvider === "claude" && (
          <Section title="Anthropic Claude">
            <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
              获取密钥：
              <a 
                href="https://console.anthropic.com/settings/keys" 
                target="_blank" 
                rel="noopener"
                style={{ color: "#3B82F6", marginLeft: 4 }}
              >
                Anthropic Console →
              </a>
            </p>
            <PasswordInput
              value={config.anthropicKey}
              onChange={(v) => update("anthropicKey", v)}
              placeholder="sk-ant-..."
            />
          </Section>
        )}

        {config.llmProvider === "qwen" && (
          <Section title="阿里云通义千问">
            <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
              获取密钥：
              <a 
                href="https://dashscope.console.aliyun.com/apiKey" 
                target="_blank" 
                rel="noopener"
                style={{ color: "#3B82F6", marginLeft: 4 }}
              >
                阿里云控制台 →
              </a>
            </p>
            <PasswordInput
              value={config.qwenKey}
              onChange={(v) => update("qwenKey", v)}
              placeholder="sk-..."
            />
          </Section>
        )}

        {config.llmProvider === "ollama" && (
          <Section title="Ollama (本地)">
            <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
              安装：<code style={{ background: "#F3F4F6", padding: "2px 4px", borderRadius: 4 }}>brew install ollama</code>
            </p>
            <input
              type="text"
              value={config.ollamaUrl}
              onChange={(e) => update("ollamaUrl", e.target.value)}
              placeholder="http://127.0.0.1:11434"
              style={inputStyle}
            />
          </Section>
        )}

        {/* Web Search */}
        <Section title="网络搜索 (可选)">
          {config.llmProvider === "gemini" ? (
            <p style={{ fontSize: 12, color: "#10B981" }}>
              ✅ Gemini 已内置 Google Search，无需额外配置
            </p>
          ) : (
            <>
              <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
                Brave Search API：
                <a 
                  href="https://brave.com/search/api/" 
                  target="_blank" 
                  rel="noopener"
                  style={{ color: "#3B82F6", marginLeft: 4 }}
                >
                  获取免费密钥 →
                </a>
              </p>
              <PasswordInput
                value={config.braveSearchKey}
                onChange={(v) => update("braveSearchKey", v)}
                placeholder="BSA..."
              />
              <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                免费版每月 2,000 次查询
              </p>
            </>
          )}
        </Section>

        {/* Flight Search */}
        <Section title="航班搜索 (可选)">
          <p style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
            Kiwi.com Tequila API：
            <a 
              href="https://tequila.kiwi.com/portal/login" 
              target="_blank" 
              rel="noopener"
              style={{ color: "#3B82F6", marginLeft: 4 }}
            >
              注册获取 →
            </a>
          </p>
          <PasswordInput
            value={config.kiwiKey}
            onChange={(v) => update("kiwiKey", v)}
            placeholder=""
          />
        </Section>

        {/* Test result */}
        {testResult && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              background: testResult.startsWith("✅") ? "#D1FAE5" : testResult.startsWith("❌") ? "#FEE2E2" : "#FEF3C7",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {testResult}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
          <button
            onClick={testConnection}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 8,
              border: "1px solid #E5E7EB",
              background: "white",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            测试连接
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1,
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              background: "#3B82F6",
              color: "white",
              fontSize: 14,
              fontWeight: 500,
              cursor: saving ? "wait" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "保存中..." : "保存设置"}
          </button>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 32,
            height: 32,
            borderRadius: "50%",
            border: "none",
            background: "#F3F4F6",
            fontSize: 18,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ── Helper Components ──

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#374151" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function ProviderButton({
  selected,
  onClick,
  label,
  desc,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  desc: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 12px",
        borderRadius: 8,
        border: selected ? "2px solid #3B82F6" : "1px solid #E5E7EB",
        background: selected ? "#EFF6FF" : "white",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 11, color: "#6B7280" }}>{desc}</div>
    </button>
  );
}

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);
  
  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        style={{
          position: "absolute",
          right: 8,
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          fontSize: 12,
          color: "#6B7280",
          cursor: "pointer",
        }}
      >
        {show ? "隐藏" : "显示"}
      </button>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  paddingRight: 50,
  borderRadius: 8,
  border: "1px solid #E5E7EB",
  fontSize: 14,
  outline: "none",
  fontFamily: "monospace",
};

function getAPIBaseUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl) return envUrl;
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8080`;
  }
  return "http://localhost:8080";
}
