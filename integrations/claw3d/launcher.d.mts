// Tipos do launcher (JavaScript puro, usado pelo Electron e pela linha de comando).
import type { Server } from "node:http";

export declare const CLAW3D_DEFAULTS: { port: number; adapterPort: number };
export declare const SELLORA_FRAME_ANCESTORS: string[];
export declare function frameHeaders(headers: Record<string, string | string[] | undefined>, ancestors?: string[]): Record<string, string | string[] | undefined>;
export declare function startFrameProxy(options: { port: number; targetPort: number; ancestors?: string[]; log?: (line: string) => void; onOfficeEntry?: () => void }): Server;
export declare function writeStudioSettings(stateDir: string, options: { adapterPort: number; token: string }): void;
export declare function startClaw3d(options: {
  appDir: string; stateDir: string; bridgeUrl: string; port?: number; adapterPort?: number; nodePath?: string;
  env?: Record<string, string>; log?: (line: string) => void;
}): { url: string; stop: () => void; done: Promise<number | null>; pids: (number | undefined)[] };
