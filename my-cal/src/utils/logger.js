// 日志级别定义
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// 当前日志级别，生产环境默认为 INFO
const CURRENT_LEVEL = process.env.NODE_ENV === 'production' 
  ? LOG_LEVELS.INFO 
  : (parseInt(process.env.REACT_APP_LOG_LEVEL) || LOG_LEVELS.DEBUG);

// 日志分类配置
const LOG_CATEGORIES = {
  // 关键动作 - 生产环境也显示
  ACTION: { level: LOG_LEVELS.INFO, enabled: true },
  
  // 调试信息 - 仅在开发环境显示
  DEBUG: { level: LOG_LEVELS.DEBUG, enabled: CURRENT_LEVEL >= LOG_LEVELS.DEBUG },
  
  // 错误信息 - 始终显示
  ERROR: { level: LOG_LEVELS.ERROR, enabled: true },
  
  // 警告信息 - 始终显示
  WARN: { level: LOG_LEVELS.WARN, enabled: true }
};

/**
 * 统一日志输出函数
 * @param {string} category - 日志分类
 * @param {string} message - 日志消息
 * @param {...any} args - 额外参数
 */
export const log = (category, message, ...args) => {
  const config = LOG_CATEGORIES[category];
  if (!config || !config.enabled) return;
  
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${category}]`;
  
  switch (config.level) {
    case LOG_LEVELS.ERROR:
      console.error(prefix, message, ...args);
      break;
    case LOG_LEVELS.WARN:
      console.warn(prefix, message, ...args);
      break;
    case LOG_LEVELS.INFO:
      console.info(prefix, message, ...args);
      break;
    default:
      console.debug(prefix, message, ...args);
      break;
  }
};

// 快捷函数
export const logAction = (message, ...args) => log('ACTION', message, ...args);
export const logDebug = (message, ...args) => log('DEBUG', message, ...args);
export const logError = (message, ...args) => log('ERROR', message, ...args);
export const logWarn = (message, ...args) => log('WARN', message, ...args);

// 向后兼容的 debugLog 函数
export const debugLog = (category, message, ...args) => {
  logDebug(`[${category}] ${message}`, ...args);
};

export default log;