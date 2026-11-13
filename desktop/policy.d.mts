export function navigationKind(value: string, origin: string): "internal" | "external" | "deny";
export const USER_CONFIG_KEYS: RegExp;
export function parseUserConfig(text: string): Record<string, string>;
export const USER_CONFIG_TEMPLATE: string;
