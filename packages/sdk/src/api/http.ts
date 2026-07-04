import { getAQ } from '../bridge';

export const http = {
  get: (url: string, options?: any) => getAQ().http.get(url, options),
  post: (url: string, body?: any, options?: any) => getAQ().http.post(url, body, options),
};