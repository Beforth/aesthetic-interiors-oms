import { apiClient } from './apiClient';
import { isDebug } from '../config/env';
import { defaultStageTemplate } from '../data/stageTemplate';

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
    if (isDebug()) {
      return [...getStoredTemplate()];
    }
    return apiClient.get('/projects/stage-template/');
  },

  async updateStageTemplate(template) {
    if (isDebug()) {
      saveTemplate(template);
      return [...template];
    }
    return apiClient.put('/projects/stage-template/', { template });
  },

  async resetDefaultTemplate() {
    if (isDebug()) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultStageTemplate));
      return [...defaultStageTemplate];
    }
    return apiClient.post('/projects/stage-template/reset/');
  },
};

export default stageService;
