import { useState } from "react";
import { Bot, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createMission } from "../../services/missionApi";

export function NewMissionPage() {
  const navigate = useNavigate();
  const [objective, setObjective] = useState("Build a resilient market intelligence workflow for an AI product launch.");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const mission = await createMission(objective);
      navigate(`/app/workflows/${mission.missionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create mission.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mission-page">
      <div className="dashboard-heading">
        <div>
          <span className="section-label">NEW MISSION</span>
          <h1>Launch a production-grade workflow</h1>
          <p>AgentOS turns your objective into a live DAG with planner, analysis, verification, and recovery agents.</p>
        </div>
      </div>

      <div className="mission-builder">
        <div className="builder-heading">
          <Bot size={20} />
          <div>
            <h2>Mission objective</h2>
            <p>Describe the outcome and AgentOS will orchestrate the rest.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label>
            Objective
            <textarea
              rows={6}
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              placeholder="Describe the mission you want AgentOS to execute."
            />
          </label>

          <div className="form-grid">
            <label>
              Priority
              <select defaultValue="high">
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label>
              Execution mode
              <select defaultValue="adaptive">
                <option value="adaptive">Adaptive DAG</option>
                <option value="parallel">Parallel</option>
                <option value="safety">Safety-first</option>
              </select>
            </label>
          </div>

          {error ? <p className="activity-empty">{error}</p> : null}

          <button type="submit" className="primary-button execute-button" disabled={loading}>
            <Sparkles size={16} />
            {loading ? "Launching..." : "Launch mission"}
          </button>
        </form>
      </div>
    </div>
  );
}
