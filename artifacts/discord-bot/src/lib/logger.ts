type LogData = Record<string, unknown>;

function format(level: string, msgOrData: string | LogData, msg?: string): string {
  const time = new Date().toISOString();
  if (typeof msgOrData === "string") {
    return `[${time}] ${level.toUpperCase()} ${msgOrData}`;
  }
  const { err, ...rest } = msgOrData;
  const errStr = err instanceof Error ? ` error="${err.message}"` : "";
  const dataStr = Object.keys(rest).length
    ? " " + Object.entries(rest).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(" ")
    : "";
  return `[${time}] ${level.toUpperCase()}${dataStr}${errStr} ${msg ?? ""}`;
}

export const logger = {
  info(msgOrData: string | LogData, msg?: string): void {
    console.log(format("info", msgOrData, msg));
  },
  warn(msgOrData: string | LogData, msg?: string): void {
    console.warn(format("warn", msgOrData, msg));
  },
  error(msgOrData: string | LogData, msg?: string): void {
    console.error(format("error", msgOrData, msg));
  },
  debug(msgOrData: string | LogData, msg?: string): void {
    if (process.env["LOG_LEVEL"] === "debug") {
      console.log(format("debug", msgOrData, msg));
    }
  },
};
