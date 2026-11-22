import { Check, Clipboard, ExternalLink, Github, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  pollGitHubDeviceFlow,
  startGitHubDeviceFlow,
} from "../lib/tauri";
import type { GitHubAccount, GitHubDeviceStart } from "../lib/types";
import Modal from "./Modal";

interface GitHubAuthDialogProps {
  open: boolean;
  onClose: () => void;
  onConnected: (token: string, account: GitHubAccount) => void;
}

type Phase = "idle" | "starting" | "waiting" | "connected";

export default function GitHubAuthDialog({
  open,
  onClose,
  onConnected,
}: GitHubAuthDialogProps) {
  const [clientId, setClientId] = useState(
    () => localStorage.getItem("sentence.githubClientId") ?? "",
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [device, setDevice] = useState<GitHubDeviceStart | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const polling = useRef(false);

  useEffect(() => {
    if (!open) {
      setPhase("idle");
      setDevice(null);
      setMessage(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || phase !== "waiting" || !device) return;
    let cancelled = false;
    const interval = window.setInterval(async () => {
      if (polling.current || cancelled) return;
      polling.current = true;
      try {
        const result = await pollGitHubDeviceFlow(
          clientId.trim() || null,
          device.deviceCode,
        );
        if (result.status === "connected" && result.token && result.account) {
          setPhase("connected");
          setMessage(`Connected as ${result.account.login}.`);
          onConnected(result.token, result.account);
          window.setTimeout(onClose, 650);
        } else if (result.status === "error") {
          setPhase("idle");
          setMessage(result.message ?? "GitHub authorization failed.");
        }
      } catch (error) {
        setPhase("idle");
        setMessage(error instanceof Error ? error.message : String(error));
      } finally {
        polling.current = false;
      }
    }, Math.max(device.interval, 5) * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [clientId, device, onClose, onConnected, open, phase]);

  const begin = async () => {
    if (!clientId.trim()) {
      setMessage("Enter the OAuth Client ID for the Sentence GitHub app.");
      return;
    }
    localStorage.setItem("sentence.githubClientId", clientId.trim());
    setPhase("starting");
    setMessage(null);
    try {
      const started = await startGitHubDeviceFlow(clientId.trim());
      setDevice(started);
      setPhase("waiting");
    } catch (error) {
      setPhase("idle");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Modal
      open={open}
      title="Connect GitHub"
      description="Sentence opens GitHub in your browser. No password is entered inside the application."
      onClose={onClose}
      footer={
        <>
          <button className="secondary-button" type="button" onClick={onClose}>
            {phase === "waiting" ? "Cancel" : "Close"}
          </button>
          {phase === "idle" ? (
            <button className="primary-button" type="button" onClick={() => void begin()}>
              <Github size={15} />
              Continue in browser
            </button>
          ) : null}
        </>
      }
    >
      <div className="github-auth-stage">
        <span className={`github-auth-mark ${phase}`}>
          {phase === "starting" || phase === "waiting" ? <LoaderCircle className="spin" size={26} /> : phase === "connected" ? <Check size={26} /> : <Github size={26} />}
        </span>
        <div>
          <h3>{phase === "connected" ? "GitHub connected" : "Sentence for GitHub"}</h3>
          <p>
            {phase === "waiting"
              ? "Enter the code below in the GitHub page that just opened."
              : "Use a GitHub OAuth app client ID to authorize repository access."}
          </p>
        </div>
      </div>
      {phase === "waiting" && device ? (
        <div className="device-code-card">
          <span>One-time code</span>
          <strong>{device.userCode}</strong>
          <div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void navigator.clipboard.writeText(device.userCode);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check size={14} /> : <Clipboard size={14} />}
              {copied ? "Copied" : "Copy code"}
            </button>
            <a className="secondary-button" href={device.verificationUri} target="_blank" rel="noreferrer">
              <ExternalLink size={14} />
              Open GitHub
            </a>
          </div>
        </div>
      ) : (
        <label className="dialog-field">
          <span>OAuth Client ID</span>
          <input
            value={clientId}
            placeholder="Iv1.0123456789abcdef"
            onChange={(event) => setClientId(event.target.value)}
            disabled={phase === "starting" || phase === "connected"}
          />
        </label>
      )}
      {message ? <p className={`auth-message ${phase === "connected" ? "success" : ""}`}>{message}</p> : null}
    </Modal>
  );
}
