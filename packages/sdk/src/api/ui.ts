import { getAQ } from '../bridge';

export const ui = {
  showToast: (message: string, type?: 'info' | 'success' | 'error') => 
    getAQ().ui.showToast(message, type),
  showModal: (options: any) => getAQ().ui.showModal(options),
};