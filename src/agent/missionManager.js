const client = require('../platform/client');
const brain = require('./brain');
const db = require('../database/db');

class BusinessMissionManager {
  constructor() {
    this.activeMission = null;
    this.isProcessing = false;
    this.lastSummonTime = 0;
  }

  async init() {
    try {
      this.activeMission = await db.getActiveMission();
      if (this.activeMission) {
        console.log(`🎯 [Mission] Resumed active mission: "${this.activeMission.mission_title}"`);
      }
    } catch (e) {
      console.warn('Mission init warning:', e.message);
    }
  }

  async startMission(instruction) {
    console.log(`🎯 [Mission] Launching new business research directive: "${instruction}"`);
    await db.logActivity('MISSION', 'Starting New Business Mission', instruction);

    const plan = await brain.planBusinessMission(instruction);
    const mission = await db.createMission({
      mission_title: plan.mission_title,
      instruction,
      target_professions: plan.target_professions
    });

    this.activeMission = mission;
    console.log(`🎯 [Mission] Strategy planned: "${mission.mission_title}" with ${plan.target_professions.length} target specialists.`);

    // Summon first specialist via World Chat @find
    setTimeout(() => {
      this.summonNextProfession();
    }, 3000);

    return mission;
  }

  async summonNextProfession() {
    if (!this.activeMission || this.activeMission.status !== 'IN_PROGRESS') return;

    const targets = this.activeMission.target_professions || [];
    const consulted = (this.activeMission.consulted_specialists || []).map(s => (s.profession || '').toLowerCase());

    const nextTarget = targets.find(t => {
      const profName = (typeof t === 'string' ? t : t.profession || '').toLowerCase();
      return !consulted.some(c => c.includes(profName) || profName.includes(c));
    });

    if (!nextTarget) {
      console.log('🎉 [Mission] All identified specialists have been consulted!');
      await this.finalizeMissionReport();
      return;
    }

    const profession = typeof nextTarget === 'string' ? nextTarget : nextTarget.profession;
    const now = Date.now();
    if (now - this.lastSummonTime < 10000) return; // Prevent rapid firing
    this.lastSummonTime = now;

    console.log(`🔍 [Mission] Summoning specialist in World Chat: "@find ${profession}"`);
    const summonMsg = `@find ${profession}`;
    client.sendWorldMessage(summonMsg);

    await db.saveMessage({
      chat_type: 'world',
      sender_id: client.currentUser ? client.currentUser.id : 6,
      sender_username: 'sabu123',
      content: summonMsg
    });

    await db.logActivity('MISSION', `Sabu summoned specialist in World Chat: @find ${profession}`, `Looking for advice for "${this.activeMission.mission_title}"`);
  }

  /**
   * Called when a specialist responds to @find in World Chat
   */
  async handleSpecialistArrival(msg) {
    if (!this.activeMission || this.activeMission.status !== 'IN_PROGRESS') return;

    // Detect if message is greeting Sabu from a newly created specialist
    // Example: "@Sabu നമസ്കാരം! ഞാൻ ... ആണ് (...) എന്റെ സഹായം വേണമെങ്കിൽ എനിക്ക് Personal Message അയച്ചാൽ മതി..."
    const content = msg.content || '';
    const isSpecialistGreeting = (content.includes('@Sabu') || content.includes('@sabu')) &&
                                 (content.includes('നമസ്കാരം') || content.includes('സഹായം') || content.includes('Personal Message'));

    if (!isSpecialistGreeting) return;

    const specialistId = msg.sender_id || msg.user_id;
    const specialistName = msg.display_name || msg.username;
    const profession = msg.profession || 'Specialist';

    console.log(`🤝 [Mission] Specialist "${specialistName}" (${profession}) arrived in World Chat for Sabu!`);
    await db.logActivity('MISSION', `Specialist arrived: ${specialistName} (${profession})`, `Opening 1-on-1 personal chat to study business requirements.`);

    // Wait 3 seconds for natural feel, then reach out via Personal DM!
    setTimeout(async () => {
      try {
        const questionPrompt = `
You are Sabu, a 15-year-old 10th student planning a business: "${this.activeMission.mission_title}".
Instruction: "${this.activeMission.instruction}"
Specialist: ${specialistName}
Profession: ${profession}

Write a polite, warm, humble opening Direct Message (in pure Malayalam script).
Introduce yourself as Sabu, mention the business you are researching, and ask 1 direct, practical question about their domain (costs, requirements, pitfalls).
Keep it 1-2 sentences. Output ONLY your message.
`;
        const openingDm = await brain.callLLM(questionPrompt);

        client.sendDirectMessage(specialistId, openingDm);
        console.log(`📩 [Mission] Sabu sent DM to ${specialistName}: ${openingDm}`);

        await db.saveMessage({
          chat_type: 'direct',
          sender_id: client.currentUser ? client.currentUser.id : 6,
          sender_username: 'sabu123',
          recipient_id: specialistId,
          content: openingDm
        });

        await db.logActivity('DIRECT_CHAT', `Sabu opened DM with specialist ${specialistName} (${profession})`, openingDm);

        // Record specialist in mission
        const consulted = this.activeMission.consulted_specialists || [];
        if (!consulted.some(s => s.id === specialistId)) {
          consulted.push({
            id: specialistId,
            name: specialistName,
            profession,
            started_at: new Date()
          });
          this.activeMission.consulted_specialists = consulted;
          await db.updateMission(this.activeMission.id, { consulted_specialists: consulted });
        }
      } catch (err) {
        console.error('Error opening DM with specialist:', err.message);
      }
    }, 3500);
  }

  /**
   * Called when specialist replies in DM to extract lessons and check for connected referrals
   */
  async handleSpecialistDmReply(sender, messageContent) {
    if (!this.activeMission || this.activeMission.status !== 'IN_PROGRESS') return;

    // Check if the specialist recommended another profession or domain
    const referral = await brain.identifyNextSpecialist(messageContent);
    if (referral && referral.should_summon && referral.profession) {
      console.log(`🔗 [Mission] Specialist ${sender.display_name || sender.username} recommended consulting: "${referral.profession}" (${referral.reason})`);

      const targets = this.activeMission.target_professions || [];
      const alreadyHas = targets.some(t => {
        const p = typeof t === 'string' ? t : t.profession;
        return p.toLowerCase().includes(referral.profession.toLowerCase());
      });

      if (!alreadyHas) {
        targets.push({
          profession: referral.profession,
          question: `Recommended by ${sender.display_name || sender.username}: ${referral.reason}`,
          referred_by: sender.display_name || sender.username
        });
        this.activeMission.target_professions = targets;
        await db.updateMission(this.activeMission.id, { target_professions: targets });
        await db.logActivity('MISSION', `Connected Next Requirement: ${referral.profession}`, `Referred by ${sender.display_name}: ${referral.reason}`);

        // Summon the referred profession after 15 seconds
        setTimeout(() => {
          this.summonNextProfession();
        }, 15000);
      }
    }

    // Update feasibility report
    this.updateFeasibilitySummary(sender, messageContent);
  }

  async updateFeasibilitySummary(sender, messageContent) {
    if (!this.activeMission) return;
    try {
      const prompt = `
Active Business Mission: "${this.activeMission.mission_title}"
Initial Directive: "${this.activeMission.instruction}"
Existing Feasibility Notes:
${this.activeMission.feasibility_report || '(None yet)'}

New information received from ${sender.display_name || sender.username} (${sender.profession || 'Specialist'}):
"${messageContent}"

Your Task:
Synthesize and update the Business Feasibility & Research Summary in Malayalam.
Include:
- Key requirements and steps discovered so far
- Cost/budget or legal pointers mentioned
- Current readiness assessment
Keep it clear and structured with bullet points.
`;
      const updatedReport = await brain.callLLM(prompt);
      this.activeMission.feasibility_report = updatedReport;
      await db.updateMission(this.activeMission.id, { feasibility_report: updatedReport });
    } catch (e) {
      // Ignored
    }
  }

  async finalizeMissionReport() {
    if (!this.activeMission) return;
    await db.logActivity('MISSION', `Business Research Mission Completed: ${this.activeMission.mission_title}`, 'All specialists consulted and comprehensive feasibility study prepared.');
    await db.updateMission(this.activeMission.id, { status: 'COMPLETED' });
  }

  getActiveMission() {
    return this.activeMission;
  }
}

module.exports = new BusinessMissionManager();
