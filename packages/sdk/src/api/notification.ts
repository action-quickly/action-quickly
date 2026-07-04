import { getAQ } from '../bridge';

export const notification = {
  show: (options: any) => getAQ().notification.show(options),
};