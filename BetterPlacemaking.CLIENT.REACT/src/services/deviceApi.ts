import { api } from "../auth/apiClient";
import type { Config, DeviceDto } from "../lib/deviceTypes";

export interface DeviceInput {
  Id?: string;
  ProjectId?: string;
  Name?: string;
  Config?: Config;
}

export function getDevicesByProject(projectId: string): Promise<DeviceDto[]> {
  return api.get<DeviceDto[]>(`/api/device/project/${projectId}`);
}

export function getDevice(projectId: string, id: string): Promise<DeviceDto> {
  return api.get<DeviceDto>(`/api/device/project/${projectId}/${id}`);
}

export function addDevice(device: DeviceInput): Promise<DeviceDto> {
  if (!device.ProjectId) throw new Error("device.ProjectId is required");
  return api.post<DeviceDto>(`/api/device/project/${device.ProjectId}`, device);
}

export function updateDevice(id: string, device: DeviceInput): Promise<DeviceDto> {
  if (!device.ProjectId) throw new Error("device.ProjectId is required");
  return api.put<DeviceDto>(`/api/device/project/${device.ProjectId}/${id}`, device);
}

export function deleteDevice(projectId: string, id: string): Promise<void> {
  return api.delete<void>(`/api/device/project/${projectId}/${id}`);
}

export async function getApiKey(projectId: string, id: string): Promise<string> {
  const response = await api.post<{ ApiKey?: string }>(`/api/device/project/${projectId}/${id}/apikey`);
  return response.ApiKey ?? "";
}
