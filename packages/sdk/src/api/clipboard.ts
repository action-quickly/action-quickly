import { getAQ } from '../bridge';

export const clipboard = {
  read: () => getAQ().clipboard.read(),
  write: (text: string) => getAQ().clipboard.write(text),
};