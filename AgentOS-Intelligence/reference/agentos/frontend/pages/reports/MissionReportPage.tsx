import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  FileText,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { getMission } from "../../services/missionApi";
import type { MissionRecord } from "../../types";
import { Badge, Button, ProgressBar, StatCard } from "../../components/ui";

export function MissionReportPage() {
  const navigate = useNavigate();
  const { reportId } = useParams<{ reportId: string }>();
  const [mission, setMission] = useState<MissionRecord | null>(null);

  useEffect(() => {
    if (!reportId) {
      return;
    }
    const id = reportId;

    async function load() {
      const data = await getMission(id);
      setMission(data);
    }

    void load();
  }, [reportId]);

  if (!mission?.report) {
    return (
      <div className="activity-empty">
        <Bot size={24} />
        <strong>Report pending</strong>
        <p>The mission report will appear once execution completes.</p>
      </div>
    );
  }

  const report = mission.report;
  const confidence = Math.round(report.confidence * 100);

  return (
    <div className="mission-page">
      <button className="report-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={12} />
        Back to workflow
      </button>

      <div className="report-header">
        <div>
          <span className="section-label">MISSION REPORT</span>
          <h1>{mission.objective}</h1>
          <p>{mission.missionId} &bull; executed by the AgentOS orchestrator</p>
        </div>
        <div className="report-actions">
          <Badge tone={report.verification.status === "Verified" ? "success" : "warning"}>
            <ShieldCheck size={11} />
            {report.verification.status}
          </Badge>
        </div>
      </div>

      <div className="report-score-grid">
        <div className="report-score-card">
          <span>CONFIDENCE</span>
          <strong>{confidence}%</strong>
          <ProgressBar value={confidence} className="mt-2" />
          <small>Weighted by evidence quality</small>
        </div>
        <StatCard label="RECOVERY" value={report.recovery.length} hint="Fallback events handled" accent="emerald" />
        <StatCard label="RISKS" value={report.risks.length} hint="Open factors to monitor" accent="amber" />
        <StatCard label="STATUS" value={mission.status.replace(/_/g, " ")} hint="Execution state" accent="violet" />
      </div>

      <div className="recommendation-card">
        <div className="recommendation-icon">
          <Sparkles size={20} />
        </div>
        <div>
          <h2>Executive summary</h2>
          <p>{report.executiveSummary}</p>
          <div className="recommendation-tags">
            {report.recommendations.map((recommendation) => (
              <span key={recommendation}>{recommendation}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="report-layout">
        <div className="report-main">
          <section className="report-section">
            <div className="report-section-heading">
              <div className="report-section-icon"><Bot size={16} /></div>
              <h2>Agent contributions</h2>
            </div>
            <div className="finding-grid">
              {report.agentContributions.map((contribution) => (
                <div key={contribution.name} className="finding-card">
                  <div>
                    <Bot size={12} />
                    <strong>{contribution.name}</strong>
                  </div>
                  <p>{contribution.contribution}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="report-section">
            <div className="report-section-heading">
              <div className="report-section-icon"><CheckCircle2 size={16} /></div>
              <h2>Verification</h2>
            </div>
            <div className="verification-list">
              {report.verification.notes.map((note) => (
                <div key={note} className="verification-item">
                  <CheckCircle2 size={12} />
                  {note}
                </div>
              ))}
            </div>
          </section>

          <section className="report-section">
            <div className="report-section-heading">
              <div className="report-section-icon"><ShieldCheck size={16} /></div>
              <h2>Debate & evidence</h2>
            </div>
            <div className="debate-box">
              <div>
                <span>CONSENSUS</span>
                <strong>{report.debate.consensus}</strong>
              </div>
              <div className="debate-arrow">↔</div>
              <div>
                <span>CONTRADICTIONS</span>
                <strong>{report.debate.contradictions[0] ?? "No contradictions detected"}</strong>
              </div>
            </div>
          </section>

          <section className="report-section">
            <div className="report-section-heading">
              <div className="report-section-icon"><Zap size={16} /></div>
              <h2>Evidence quality</h2>
            </div>
            <div className="verification-list">
              {report.evidence.map((evidence, index) => (
                <div key={`${evidence}-${index}`} className="verification-item">
                  <FileText size={12} />
                  {evidence}
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="report-sidebar">
          <div className="report-side-card">
            <h2 className="report-side-title">
              <Clock size={12} />
              Execution timeline
            </h2>
            {report.executionTimeline.map((entry) => (
              <div key={entry} className="audit-item">
                <span>•</span>
                <p>{entry}</p>
              </div>
            ))}
          </div>

          <div className="report-side-card">
            <h2 className="report-side-title">
              <Coins size={12} />
              Cost & tokens
            </h2>
            <div className="health-row">
              <span>Total cost</span>
              <strong className="health-good">${mission.metrics.cost.toFixed(1)}</strong>
            </div>
            <div className="health-row">
              <span>Tokens consumed</span>
              <strong>{mission.metrics.tokens}</strong>
            </div>
            <div className="health-row">
              <span>Latency</span>
              <strong>{mission.metrics.latency}ms</strong>
            </div>
            <div className="health-row">
              <span>Exec time</span>
              <strong>{mission.metrics.executionTime}ms</strong>
            </div>
          </div>

          <div className="report-side-card">
            <h2 className="report-side-title">
              <Cpu size={12} />
              Recovery & failures
            </h2>
            {(report.recovery.length ? report.recovery : report.failures).map((entry) => (
              <div key={entry} className="risk-item">
                <span className="risk-medium">EVENT</span>
                <strong>{entry}</strong>
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" className="report-rerun" onClick={() => navigate(-1)}>
            <ArrowLeft size={12} />
            Back to workflow
          </Button>
        </aside>
      </div>
    </div>
  );
}
