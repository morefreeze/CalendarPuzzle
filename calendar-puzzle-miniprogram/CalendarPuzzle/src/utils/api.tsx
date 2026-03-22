import { API_BASE_URL, API_TIMEOUT, API_RETRY_COUNT } from '../../config/api';
import { logError, logDebug } from './logger';
import { GameIdRequest, GameIdResponse, SolutionRequest, Solution, SolutionErrorResponse } from '../types/game';

interface ApiError {
  status: number;
  data: any;
  message: string;
}

interface RequestOptions {
  url: string;
  method: 'GET' | 'POST';
  data?: any;
  timeout?: number;
  retry?: number;
}

const request = <T extends unknown>(options: RequestOptions): Promise<T> => {
  const { url, method, data, timeout = API_TIMEOUT, retry = 0 } = options;

  return new Promise((resolve, reject) => {
    const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
    const startTime = Date.now();

    wx.request({
      url: fullUrl,
      method,
      data,
      header: {
        'Content-Type': 'application/json'
      },
      timeout,
      success: (res) => {
        const elapsedTime = (Date.now() - startTime) / 1000;
        logDebug(`API request completed in ${elapsedTime}s: ${method} ${url}`);

        if (res.statusCode === 200) {
          resolve(res.data as T);
        } else if (res.statusCode === 404) {
          reject({ status: 404, data: res.data, message: 'Resource not found' });
        } else {
          reject({ status: res.statusCode, data: res.data, message: `HTTP ${res.statusCode}` });
        }
      },
      fail: (err) => {
        logError(`API request failed: ${method} ${url}`, err);

        if (retry > 0) {
          logDebug(`Retrying request (${retry} retries left): ${method} ${url}`);
          request<T>({ url, method, data, timeout, retry: retry - 1 })
            .then(resolve)
            .catch(reject);
        } else {
          reject({ status: 0, data: null, message: err.errMsg || 'Network error' });
        }
      }
    });
  });
};

const unwrapResponse = <T extends unknown>(response: T & { success?: boolean; error?: string }): T => {
  if ('success' in response && !response.success) {
    const error = response as any;
    throw {
      status: 400,
      data: error,
      message: error.error || 'Request failed'
    };
  }
  return response;
};

export const api = {
  async fetchGameId(payload: GameIdRequest): Promise<GameIdResponse> {
    logDebug('Fetching game ID:', payload);

    const response = await request<GameIdResponse & { success: boolean; error?: string }>({
      url: '/game-id',
      method: 'POST',
      data: payload
    });

    return unwrapResponse(response);
  },

  async fetchSolution(payload: SolutionRequest): Promise<Solution> {
    logDebug('Fetching solution:', payload);

    const response = await request<Solution & { success: boolean; status?: number; error?: string }>({
      url: '/solution',
      method: 'POST',
      data: payload,
      retry: API_RETRY_COUNT
    });

    if (response.status === 404) {
      const errorData = response as any;
      throw {
        status: 404,
        data: errorData,
        message: errorData.error || 'No solution found for current configuration'
      };
    }

    return unwrapResponse(response);
  },

  async checkHealth(): Promise<{ status: string; timestamp: number }> {
    return request({
      url: '/health',
      method: 'GET'
    });
  }
};
