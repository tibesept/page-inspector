import { ApiService } from "#api/ApiService.js";

export class MonitorService {
    constructor(private readonly apiService: ApiService) {}

    public async getMonitors(userId: number) {
        return this.apiService.getMonitors(userId);
    }

    public async createMonitor(userId: number, data: any) {
        return this.apiService.createMonitor(userId, data);
    }

    public async toggleMonitor(userId: number, id: number, active: boolean) {
        return this.apiService.toggleMonitor(userId, id, active);
    }

    public async deleteMonitor(userId: number, id: number) {
        return this.apiService.deleteMonitor(userId, id);
    }
}
