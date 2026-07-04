import { getAQ } from '../bridge';

export const storage = {
  get: (key: string) => getAQ().storage.get(key),
  set: (key: string, value: any) => getAQ().storage.set(key, value),
  delete: (key: string) => getAQ().storage.delete(key),
};