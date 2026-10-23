import { apiClient } from './apiClient';

export const stageService = {
  async getStageTemplate() {
    return apiClient.get('/projects/stage-template/');
  },

  async updateStageTemplate(template) {
    return apiClient.put('/projects/stage-template/', { template });
  },

  async resetDefaultTemplate() {
    return apiClient.post('/projects/stage-template/reset/');
  },
};

export default stageService;
