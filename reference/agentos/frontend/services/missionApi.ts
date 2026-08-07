import type {
  AgentDefinition,
  DashboardData,
  MissionRecord,
} from "../types";

export interface CreateMissionResponse {
  missionId: string;
  objective: string;
  status: string;
  message: string;
}

const API_URL = "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error((data as { error?: string } | null)?.error || "AgentOS request failed.");
  }

  return response.json() as Promise<T>;
}

export async function createMission(objective: string): Promise<CreateMissionResponse> {
  return request<CreateMissionResponse>("/api/missions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ objective }),
  });
}

export async function getMission(missionId: string): Promise<MissionRecord> {
  return request<MissionRecord>(`/api/missions/${missionId}`);
}

export async function startMission(missionId: string): Promise<MissionRecord> {
  return request<MissionRecord>(`/api/missions/${missionId}/start`, {
    method: "POST",
  });
}

export async function injectRequirement(
  missionId: string,
  requirement: string,
): Promise<MissionRecord> {
  return request<MissionRecord>(`/api/missions/${missionId}/inject`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requirement }),
  });
}

export async function completeMission(missionId: string): Promise<MissionRecord> {
  return request<MissionRecord>(`/api/missions/${missionId}/complete`, {
    method: "POST",
  });
}

export async function getDashboard(): Promise<DashboardData> {
  return request<DashboardData>("/api/dashboard");
}

export async function getAgents(): Promise<AgentDefinition[]> {
  return request<AgentDefinition[]>("/api/agents");
}
