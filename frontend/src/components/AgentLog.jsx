const ICONS = {
  'Patient Intake Agent':     '🏥',
  'Clinical Summary Agent':   '🧬',
  'Imaging Workflow Agent':   '🔬',
  'EHR Agent':                '📋',
  'Alert Agent':              '🚨',
  'Task Planner Agent':       '📌',
  'Analytics Agent':          '📊',
  'System Orchestrator':      '⚙️',
}

export default function AgentLog({ steps }) {
  if (!steps || steps.length === 0) {
    return (
      <div className="empty-state">
        <div className="icon">🤖</div>
        <p>No agent activity yet. Submit a patient to start the pipeline.</p>
      </div>
    )
  }

  return (
    <div className="pipeline">
      {steps.map((step, i) => (
        <div className="pipeline-step" key={i}>
          <div className="pipeline-connector">
            <div className={`pipeline-dot ${step.success ? 'success' : 'error'}`}>
              {step.success ? '✓' : '✗'}
            </div>
            {i < steps.length - 1 && <div className="pipeline-line" />}
          </div>
          <div className="pipeline-content">
            <div className="pipeline-agent">
              {ICONS[step.agent] || '🤖'} {step.agent}
            </div>
            <div className="pipeline-log">{step.log}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
