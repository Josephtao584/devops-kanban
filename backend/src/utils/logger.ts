type LogContext = Record<string, unknown>;

function formatMessage(level: string, component: string, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  const contextStr = context && Object.keys(context).length > 0
    ? ' ' + JSON.stringify(context)
    : '';
  return `${timestamp} [${level}] [${component}] ${message}${contextStr}`;
}

export const logger = {
  info(component: string, message: string, context?: LogContext) {
    console.log(formatMessage('INFO', component, message, context));
  },

  warn(component: string, message: string, context?: LogContext) {
    console.warn(formatMessage('WARN', component, message, context));
  },

  error(component: string, message: string, context?: LogContext) {
    console.error(formatMessage('ERROR', component, message, context));
  },
};
