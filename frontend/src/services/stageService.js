import { defaultStageTemplate } from '../data/stageTemplate';
import { apiClient } from './apiClient';

const STORAGE_KEY = 'osm_stage_template_v2';

function getStoredTemplate() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read stage template from localStorage', e);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultStageTemplate));
  return defaultStageTemplate;
}

function saveTemplate(template) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(template));
  } catch (e) {
    console.error('Failed to save stage template to localStorage', e);
  }
}

export const stageService = {
  async getStageTemplate() {
    return apiClient.execute(async () => {
      return [...getStoredTemplate()];
    }, 'Stage template fetched successfully');
  },

  async updateStageTemplate(template) {
    return apiClient.execute(async () => {
      saveTemplate(template);
      return [...template];
    }, 'Stage template updated successfully');
  },

  async resetDefaultTemplate() {
    return apiClient.execute(async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultStageTemplate));
      return [...defaultStageTemplate];
    }, 'Stage template reset to defaults');
  },
};

export default stageService;
