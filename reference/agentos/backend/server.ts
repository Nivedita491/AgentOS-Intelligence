import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MissionEngine } from "./engine";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;
const engine = new MissionEngine();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    name: "AgentOS API",
    status: "ONLINE",
    version: "1.0.0",
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "healthy",
    orchestrator: "ready",
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/missions", (req, res) => {
  const { objective } = req.body;

  if (!objective) {
    return res.status(400).json({
      error: "Mission objective is required",
    });
  }

  const mission = engine.createMission(objective);

  console.log("\n=================================");
  console.log("🚀 NEW MISSION RECEIVED");
  console.log(`Mission ID: ${mission.missionId}`);
  console.log(`Objective: ${objective}`);
  console.log("Status: CREATED");
  console.log("=================================\n");

  return res.status(201).json({
    missionId: mission.missionId,
    objective: mission.objective,
    status: mission.status,
    message: "Mission accepted by AgentOS.",
  });
});

app.get("/api/missions", (_req, res) => {
  return res.json(engine.listMissions());
});

app.get("/api/agents", (_req, res) => {
  return res.json(engine.getAgents());
});

app.get("/api/dashboard", (_req, res) => {
  return res.json(engine.getDashboard());
});

app.get("/api/missions/:missionId", (req, res) => {
  const { missionId } = req.params;
  const mission = engine.getMission(missionId);

  if (!mission) {
    return res.status(404).json({
      error: "Mission not found",
    });
  }

  return res.json(mission);
});

app.post("/api/missions/:missionId/start", (req, res) => {
  const { missionId } = req.params;
  const mission = engine.startMission(missionId);

  if (!mission) {
    return res.status(404).json({
      error: "Mission not found",
    });
  }

  console.log(`▶ MISSION STARTED: ${missionId}`);

  return res.json({
    ...mission,
    message: "Mission execution started.",
  });
});

app.post("/api/missions/:missionId/inject", (req, res) => {
  const { missionId } = req.params;
  const { requirement } = req.body;

  if (!requirement) {
    return res.status(400).json({ error: "Requirement is required" });
  }

  const mission = engine.injectRequirement(missionId, requirement);
  if (!mission) {
    return res.status(404).json({ error: "Mission not found" });
  }

  return res.json(mission);
});

app.post("/api/missions/:missionId/complete", (req, res) => {
  const { missionId } = req.params;
  const mission = engine.getMission(missionId);

  if (!mission) {
    return res.status(404).json({
      error: "Mission not found",
    });
  }

  mission.status = "completed";
  mission.completedAt = new Date().toISOString();
  mission.updatedAt = new Date().toISOString();

  console.log(`✓ MISSION COMPLETED: ${missionId}`);

  return res.json({
    ...mission,
    message: "Mission completed.",
  });
});

app.listen(PORT, () => {
  console.log("");
  console.log("=================================");
  console.log("        AGENTOS BACKEND");
  console.log("=================================");
  console.log("✓ API ONLINE");
  console.log(`✓ http://localhost:${PORT}`);
  console.log("✓ Orchestrator READY");
  console.log("=================================");
  console.log("");
});
