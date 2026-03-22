export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryCount: number;
}

type Environment = 'development' | 'production' | 'test';

const configs: Record<Environment, ApiConfig> = {
  development: {
    baseUrl: 'http://localhost:5001/api',
    timeout: 10000,
    retryCount: 3
  },
  production: {
    baseUrl: '',
    timeout: 15000,
    retryCount: 2
  },
  test: {
    baseUrl: 'http://localhost:5001/api',
    timeout: 10000,
    retryCount: 1
  }
};

const getCurrentEnvironment = (): Environment => {
  if (process.env.NODE_ENV === 'test') {
    return 'test';
  }
  if (process.env.TARO_ENV === 'production') {
    return 'production';
  }
  return 'development';
};

export const apiConfig: ApiConfig = configs[getCurrentEnvironment()];

export const API_BASE_URL = apiConfig.baseUrl;
export const API_TIMEOUT = apiConfig.timeout;
export const API_RETRY_COUNT = apiConfig.retryCount;
