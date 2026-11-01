/**
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { create } from "zustand";

const AI_KEY = "liangqi-ai-v1";

export interface AiConfig {
    endpoint: string;
    model: string;
    apiKey: string;
}

interface StoredAiConfig extends AiConfig {
    version: 1;
}

interface AiState extends AiConfig {
    setConfig: (config: AiConfig) => void;
    clear: () => void;
}

function readConfig(): AiConfig {
    if (typeof window === "undefined") {
        return { endpoint: "", model: "", apiKey: "" };
    }
    try {
        const raw = window.localStorage.getItem(AI_KEY);
        if (!raw) {
            return { endpoint: "", model: "", apiKey: "" };
        }
        const value = JSON.parse(raw) as Partial<StoredAiConfig>;
        return {
            endpoint: typeof value.endpoint === "string" ? value.endpoint : "",
            model: typeof value.model === "string" ? value.model : "",
            apiKey: typeof value.apiKey === "string" ? value.apiKey : "",
        };
    } catch {
        return { endpoint: "", model: "", apiKey: "" };
    }
}

function writeConfig(config: AiConfig): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.localStorage.setItem(
            AI_KEY,
            JSON.stringify({ version: 1, ...config } satisfies StoredAiConfig),
        );
    } catch {
        // Keep the config in memory for this session.
    }
}

const initial = readConfig();

export const useAiStore = create<AiState>()((set) => ({
    ...initial,
    setConfig(config) {
        writeConfig(config);
        set(config);
    },
    clear() {
        writeConfig({ endpoint: "", model: "", apiKey: "" });
        set({ endpoint: "", model: "", apiKey: "" });
    },
}));

export function isAiConfigured(config: Pick<AiConfig, "endpoint" | "model" | "apiKey">): boolean {
    return Boolean(config.endpoint.trim() && config.model.trim() && config.apiKey.trim());
}
