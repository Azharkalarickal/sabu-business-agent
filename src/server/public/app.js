// Sabu Dashboard Frontend Logic
(function () {
  'use strict';

  let pollInterval = null;
  let isSubmitting = false;

  const elements = {
    agentStatusBadge: document.getElementById('agentStatusBadge'),
    agentStatusText: document.getElementById('agentStatusText'),
    dbStatusPill: document.getElementById('dbStatusPill'),
    dbStatusText: document.getElementById('dbStatusText'),
    statWorldMsgs: document.getElementById('statWorldMsgs'),
    statWorldMeta: document.getElementById('statWorldMeta'),
    statDirectMsgs: document.getElementById('statDirectMsgs'),
    statDirectMeta: document.getElementById('statDirectMeta'),
    statLessons: document.getElementById('statLessons'),
    statUsersMet: document.getElementById('statUsersMet'),
    statOnlineUsers: document.getElementById('statOnlineUsers'),
    activityFeed: document.getElementById('activityFeed'),
    lessonsContainer: document.getElementById('lessonsContainer'),
    usersContainer: document.getElementById('usersContainer'),
    agentUptime: document.getElementById('agentUptime'),
    sendWorldForm: document.getElementById('sendWorldForm'),
    worldInput: document.getElementById('worldInput'),
    triggerDiscoveryBtn: document.getElementById('triggerDiscoveryBtn'),
    toggleActiveBtn: document.getElementById('toggleActiveBtn'),
    refreshFeedBtn: document.getElementById('refreshFeedBtn'),
    
    // Mission Elements
    startMissionForm: document.getElementById('startMissionForm'),
    missionInstructionInput: document.getElementById('missionInstructionInput'),
    launchMissionBtn: document.getElementById('launchMissionBtn'),
    activeMissionBox: document.getElementById('activeMissionBox'),
    missionStatusBadge: document.getElementById('missionStatusBadge'),
    missionTitleText: document.getElementById('missionTitleText'),
    summonNextBtn: document.getElementById('summonNextBtn'),
    missionTargetsChips: document.getElementById('missionTargetsChips'),
    missionReportContent: document.getElementById('missionReportContent')
  };

  async function fetchStats() {
    try {
      const res = await fetch('/api/dashboard/stats');
      if (!res.ok) return;
      const data = await res.json();
      renderDashboard(data);
    } catch (e) {
      console.warn('Dashboard poll error:', e);
    }
  }

  function renderDashboard(data) {
    const { agent, database, activities, lessons, usersMet, activeMission } = data;

    // Agent Connection Status
    if (agent.platformConnected) {
      elements.agentStatusBadge.style.background = 'rgba(16, 185, 129, 0.1)';
      elements.agentStatusBadge.style.color = '#10b981';
      elements.agentStatusBadge.style.borderColor = 'rgba(16, 185, 129, 0.25)';
      elements.agentStatusText.textContent = agent.isActive ? 'Sabu Online & Active' : 'Sabu Paused';
    } else {
      elements.agentStatusBadge.style.background = 'rgba(239, 68, 68, 0.1)';
      elements.agentStatusBadge.style.color = '#f87171';
      elements.agentStatusBadge.style.borderColor = 'rgba(239, 68, 68, 0.25)';
      elements.agentStatusText.textContent = 'Platform Reconnecting...';
    }

    // DB Status
    if (database.connectedToMysql) {
      elements.dbStatusPill.style.color = '#10b981';
      elements.dbStatusText.textContent = 'Hostinger MySQL (Connected)';
    } else {
      elements.dbStatusPill.style.color = '#f59e0b';
      elements.dbStatusText.textContent = 'Memory Mode (Remote MySQL Pending)';
    }

    // Metrics
    elements.statWorldMsgs.textContent = agent.worldMessagesSent + agent.worldMessagesReceived;
    elements.statWorldMeta.textContent = `${agent.worldMessagesSent} sent · ${agent.worldMessagesReceived} received`;

    elements.statDirectMsgs.textContent = agent.directMessagesSent + agent.directMessagesReceived;
    elements.statDirectMeta.textContent = `${agent.directMessagesSent} sent · ${agent.directMessagesReceived} received`;

    elements.statLessons.textContent = lessons.length;
    elements.statUsersMet.textContent = usersMet.length;
    elements.statOnlineUsers.textContent = `${agent.onlineUsersCount || 0} Online currently`;

    // Uptime
    const mins = Math.floor((agent.uptimeSeconds || 0) / 60);
    elements.agentUptime.textContent = `Uptime: ${mins}m (${agent.uptimeSeconds || 0}s)`;

    // Toggle button text
    elements.toggleActiveBtn.textContent = agent.isActive ? '⏸️ Pause Sabu' : '▶️ Resume Sabu';

    // Render Active Mission
    renderActiveMission(activeMission);

    // Activities Feed
    renderActivities(activities);

    // Lessons Vault
    renderLessons(lessons);

    // Users Met
    renderUsers(usersMet);
  }

  function renderActiveMission(mission) {
    if (!mission) {
      elements.activeMissionBox.style.display = 'none';
      return;
    }

    elements.activeMissionBox.style.display = 'flex';
    elements.missionTitleText.textContent = mission.mission_title;
    elements.missionStatusBadge.textContent = mission.status;
    if (mission.status === 'COMPLETED') {
      elements.missionStatusBadge.className = 'badge badge-accent';
      elements.missionStatusBadge.style.background = 'rgba(16, 185, 129, 0.2)';
      elements.missionStatusBadge.style.color = '#34d399';
    } else {
      elements.missionStatusBadge.className = 'badge badge-accent';
      elements.missionStatusBadge.style.background = 'rgba(59, 130, 246, 0.2)';
      elements.missionStatusBadge.style.color = '#60a5fa';
    }

    // Render Target Chips
    const targets = mission.target_professions || [];
    const consulted = (mission.consulted_specialists || []).map(s => (s.profession || '').toLowerCase());

    if (targets.length === 0) {
      elements.missionTargetsChips.innerHTML = '<span class="text-muted" style="font-size: 12px;">Planning required specialists...</span>';
    } else {
      elements.missionTargetsChips.innerHTML = targets.map(t => {
        const profName = typeof t === 'string' ? t : t.profession;
        const isConsulted = consulted.some(c => c.includes(profName.toLowerCase()) || profName.toLowerCase().includes(c));
        const chipClass = isConsulted ? 'chip-consulted' : 'chip-queued';
        const icon = isConsulted ? '✅' : '⏳';
        return `
          <div class="target-chip ${chipClass}" title="${t.question || ''}">
            <span>${icon}</span>
            <span>${escapeHtml(profName)}</span>
          </div>
        `;
      }).join('');
    }

    // Render Feasibility Report
    if (mission.feasibility_report && mission.feasibility_report.trim()) {
      elements.missionReportContent.textContent = mission.feasibility_report;
    } else {
      elements.missionReportContent.innerHTML = '<em>സാബു പ്രൊഫഷണലുകളോട് സംസാരിച്ച് വിവരങ്ങൾ ശേഖരിച്ചുകൊണ്ടിരിക്കുന്നു. റിപ്പോർട്ട് ഉടൻ ഇവിടെ കാണാം...</em>';
    }
  }

  function renderActivities(activities) {
    if (!activities || activities.length === 0) {
      elements.activityFeed.innerHTML = '<div class="empty-state">No recent activities logged yet.</div>';
      return;
    }

    elements.activityFeed.innerHTML = activities.map(act => {
      const time = new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `
        <div class="activity-item">
          <div class="activity-meta">
            <span class="tag-badge tag-${act.event_type}">${act.event_type}</span>
            <span>${time}</span>
          </div>
          <div class="activity-action">${escapeHtml(act.action)}</div>
          ${act.details ? `<div class="activity-details">${escapeHtml(act.details)}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  function renderLessons(lessons) {
    if (!lessons || lessons.length === 0) {
      elements.lessonsContainer.innerHTML = '<div class="empty-state">No business lessons gathered yet.</div>';
      return;
    }

    elements.lessonsContainer.innerHTML = lessons.map(l => `
      <div class="lesson-card">
        <div class="lesson-topic">${escapeHtml(l.topic || 'Insight')}</div>
        <div class="lesson-text">${escapeHtml(l.lesson)}</div>
        <div class="lesson-from">Learned from: <strong>${escapeHtml(l.learned_from || 'Expert')}</strong> (${escapeHtml(l.profession || 'Specialist')})</div>
      </div>
    `).join('');
  }

  function renderUsers(users) {
    if (!users || users.length === 0) {
      elements.usersContainer.innerHTML = '<div class="empty-state">No external professionals encountered yet.</div>';
      return;
    }

    elements.usersContainer.innerHTML = users.map(u => `
      <div class="user-card">
        <div class="user-avatar-sm">${escapeHtml((u.display_name || u.username || 'U')[0].toUpperCase())}</div>
        <div class="user-details">
          <h4>${escapeHtml(u.display_name || u.username)}</h4>
          <p>${escapeHtml(u.profession || 'Specialist')} ${u.skills ? `· ${escapeHtml(u.skills)}` : ''}</p>
        </div>
      </div>
    `).join('');
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
  }

  // Event Listeners
  elements.startMissionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const instruction = elements.missionInstructionInput.value.trim();
    if (!instruction) return;

    elements.launchMissionBtn.disabled = true;
    elements.launchMissionBtn.innerHTML = '<span>⏳ Planning Mission...</span>';

    try {
      const res = await fetch('/api/mission/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction })
      });
      if (res.ok) {
        elements.missionInstructionInput.value = '';
        fetchStats();
      }
    } catch (err) {
      console.error('Start mission error:', err);
    } finally {
      elements.launchMissionBtn.disabled = false;
      elements.launchMissionBtn.innerHTML = '<span>🚀 Launch Business Study</span>';
    }
  });

  elements.summonNextBtn.addEventListener('click', async () => {
    elements.summonNextBtn.disabled = true;
    elements.summonNextBtn.textContent = 'Summoning...';
    try {
      await fetch('/api/mission/summon-next', { method: 'POST' });
      fetchStats();
    } finally {
      setTimeout(() => {
        elements.summonNextBtn.disabled = false;
        elements.summonNextBtn.textContent = '🔍 Summon Next Specialist (@find)';
      }, 4000);
    }
  });

  elements.sendWorldForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = elements.worldInput.value.trim();
    if (!content || isSubmitting) return;

    isSubmitting = true;
    try {
      const res = await fetch('/api/actions/send-world', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (res.ok) {
        elements.worldInput.value = '';
        fetchStats();
      }
    } catch (err) {
      console.error(err);
    } finally {
      isSubmitting = false;
    }
  });

  elements.triggerDiscoveryBtn.addEventListener('click', async () => {
    elements.triggerDiscoveryBtn.disabled = true;
    elements.triggerDiscoveryBtn.textContent = 'Searching...';
    try {
      await fetch('/api/actions/discover', { method: 'POST' });
      fetchStats();
    } finally {
      setTimeout(() => {
        elements.triggerDiscoveryBtn.disabled = false;
        elements.triggerDiscoveryBtn.textContent = '🔍 Find New Professionals';
      }, 3000);
    }
  });

  elements.toggleActiveBtn.addEventListener('click', async () => {
    await fetch('/api/actions/toggle-active', { method: 'POST' });
    fetchStats();
  });

  elements.refreshFeedBtn.addEventListener('click', () => {
    fetchStats();
  });

  // Start polling every 3 seconds
  fetchStats();
  pollInterval = setInterval(fetchStats, 3000);
})();
