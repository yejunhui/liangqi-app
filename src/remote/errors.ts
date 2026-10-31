/**
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export class RemoteError extends Error {
    readonly status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.name = "RemoteError";
        this.status = status;
    }
}

export class RemoteConflictError extends RemoteError {
    constructor(message = "远程文件已被修改，请先同步") {
        super(message, 409);
        this.name = "RemoteConflictError";
    }
}
