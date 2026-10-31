/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { create } from "zustand";
import type { RemoteUser } from "@/types";
import { getConnectionById, useLibraryStore } from "@/store/library";
import { newId } from "@/utils/id";

const USER_KEY = "liangqi-local-user-v1";

function readLocalUser(): RemoteUser {
    if (typeof window === "undefined") {
        return { id: newId("user"), name: "我", color: "#0f766e" };
    }
    try {
        const raw = window.localStorage.getItem(USER_KEY);
        if (raw) {
            const value: unknown = JSON.parse(raw);
            if (
                typeof value === "object" &&
                value !== null &&
                typeof (value as RemoteUser).id === "string" &&
                typeof (value as RemoteUser).name === "string"
            ) {
                return value as RemoteUser;
            }
        }
    } catch {
        // Fall through to a fresh local identity.
    }
    const user: RemoteUser = {
        id: newId("user"),
        name: "我",
        color: "#0f766e",
    };
    try {
        window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
        // The identity still works for this session.
    }
    return user;
}

interface LocalUserState {
    user: RemoteUser;
    setName: (name: string) => void;
}

export const useLocalUserStore = create<LocalUserState>()((set) => ({
    user: readLocalUser(),
    setName(name) {
        const next = {
            ...useLocalUserStore.getState().user,
            name: name.trim() || "我",
        };
        try {
            window.localStorage.setItem(USER_KEY, JSON.stringify(next));
        } catch {
            // Keep the name for this session.
        }
        set({ user: next });
    },
}));

export function getCurrentActor(): RemoteUser {
    const library = useLibraryStore.getState();
    const book = library.books.find((item) => item.id === library.activeBookId);
    if (book?.remote) {
        const connection = getConnectionById(library, book.remote.connectionId);
        if (connection?.user) {
            return connection.user;
        }
    }
    return useLocalUserStore.getState().user;
}

export function useCurrentActor(): RemoteUser {
    const remoteUser = useLibraryStore((state) => {
        const book = state.books.find((item) => item.id === state.activeBookId);
        if (!book?.remote) {
            return undefined;
        }
        return getConnectionById(state, book.remote.connectionId)?.user;
    });
    const localUser = useLocalUserStore((state) => state.user);
    return remoteUser ?? localUser;
}
