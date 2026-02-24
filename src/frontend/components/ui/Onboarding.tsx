import { useCallback, useEffect, useState } from "react";
import faviconUrl from "../../../../favicon.svg";
import type { PluginSettingInfo } from "../../../shared/rpc-types.ts";
import { getRPC } from "../../rpc.ts";
import { PluginRow } from "../settings/PluginRow.tsx";
import "./Onboarding.css";

interface OnboardingProps {
  onComplete: () => void;
}

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [plugins, setPlugins] = useState<PluginSettingInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRPC()
      .request.getPluginSettings({} as Record<string, never>)
      .then((data) => {
        setPlugins(data.plugins);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleToggle = useCallback((pluginId: string, enabled: boolean) => {
    getRPC()
      .request.updatePluginSetting({ pluginId, enabled })
      .then((data) => setPlugins(data.plugins))
      .catch(() => {});
  }, []);

  const handleBrowse = useCallback((pluginId: string, currentDir: string) => {
    getRPC()
      .request.browseDirectory({ startingFolder: currentDir })
      .then((data) => {
        if (data.path) {
          return getRPC().request.updatePluginSetting({ pluginId, dataDir: data.path });
        }
        return null;
      })
      .then((data) => {
        if (data) setPlugins(data.plugins);
      })
      .catch(() => {});
  }, []);

  const handlePathChange = useCallback((pluginId: string, dataDir: string) => {
    getRPC()
      .request.updatePluginSetting({ pluginId, dataDir })
      .then((data) => setPlugins(data.plugins))
      .catch(() => {});
  }, []);

  const handleReset = useCallback((pluginId: string) => {
    getRPC()
      .request.updatePluginSetting({ pluginId, dataDir: null })
      .then((data) => setPlugins(data.plugins))
      .catch(() => {});
  }, []);

  return (
    <div className="onboarding" aria-labelledby="onboarding-heading">
      <div className="onboarding-content">
        <div className="onboarding-steps" aria-hidden="true">
          <div className={`onboarding-dot ${step === 1 ? "active" : ""}`} />
          <div className="onboarding-line" />
          <div className={`onboarding-dot ${step === 2 ? "active" : ""}`} />
        </div>

        {step === 1 && (
          <>
            <img src={faviconUrl} alt="" width="64" height="64" className="onboarding-logo" />
            <h1 id="onboarding-heading" className="onboarding-heading">
              Session Data Notice
            </h1>
            <p>
              Klovi reads AI coding session history from your local machine. Session data may
              contain sensitive information such as API keys, credentials, or private code snippets.
            </p>
            <p>
              Klovi is fully local — your data never leaves your machine. Klovi is open source, so
              you can verify this yourself.
            </p>
            <p className="onboarding-muted">
              Be mindful when screen sharing or using Klovi in public settings.
            </p>
            <button type="button" className="onboarding-button" onClick={() => setStep(2)}>
              Next
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="onboarding-heading">Plugins</h1>
            <p className="onboarding-subtitle">Choose which AI coding tools to monitor</p>
            {loading ? (
              <div>Loading...</div>
            ) : (
              <div className="onboarding-plugins">
                {plugins.map((plugin) => (
                  <PluginRow
                    key={plugin.id}
                    plugin={plugin}
                    onToggle={handleToggle}
                    onBrowse={handleBrowse}
                    onPathChange={handlePathChange}
                    onReset={handleReset}
                  />
                ))}
              </div>
            )}
            <button type="button" className="onboarding-button" onClick={onComplete}>
              Get Started
            </button>
            <button type="button" className="onboarding-back" onClick={() => setStep(1)}>
              Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
