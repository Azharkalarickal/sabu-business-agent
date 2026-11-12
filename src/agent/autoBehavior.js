const client = require('../platform/client');
const brain = require('./brain');
const db = require('../database/db');

class AutoBehaviorManager {
  constructor() {
    this.isActive = true;
    this.worldChatCooldown = 0;
    this.worldChatCooldownMs = 12000; // 12s cooldown between public world chat replies
    this.searchInterval = null;
    this.stats = {
      worldMessagesReceived: 0,
      worldMessagesSent: 0,
      directMessagesReceived: 0,
      directMessagesSent: 0,
      lessonsLearned: 0,
      startedAt: new Date()
    };
  }

  init() {
    console.log('[Agent] Initializing Sabu Autonomous Behaviors...');

    // 1. Listen for World Chat messages
    client.onWorldMessage(async (msg) => {
      await this.handleWorldMessage(msg);
    });

    // 2. Listen for Direct Messages
    client.onDirectMessage(async (msg) => {
      await this.handleDirectMessage(msg);
    });

    // 3. Setup periodic proactive discovery (every 10 minutes)
    this.searchInterval = setInterval(() => {
      if (this.isActive) {
        this.discoverProfessionals().catch(err => {
          console.warn('Proactive discovery error:', err.message);
        });
      }
    }, 10 * 60 * 1000);

    // Initial discovery check after 20 seconds
    setTimeout(() => {
      if (this.isActive) {
        this.discoverProfessionals().catch(() => {});
      }
    }, 20000);
  }

  async handleWorldMessage(msg) {
    if (!this.isActive || !msg) return;
    const myId = client.currentUser ? client.currentUser.id : 1;
    const senderId = msg.sender_id || msg.user_id;

    // Bulletproof ignore own messages and other bots
    if (senderId === myId || msg.username === client.username || msg.username === 'sabu123' || msg.username === 'probot') {
      return;
    }

    this.stats.worldMessagesReceived++;
    console.log(`[World Chat] ${msg.username} (${msg.profession || 'User'}): ${msg.content}`);

    // Save message and user in database
    await db.saveMessage({
      chat_type: 'world',
      sender_id: msg.user_id,
      sender_username: msg.username,
      content: msg.content
    });

    await db.saveUserMet({
      id: msg.user_id,
      username: msg.username,
      display_name: msg.display_name,
      profession: msg.profession,
      skills: msg.skills,
      bio: msg.bio
    });

    // Try extracting any business lesson
    this.checkAndSaveLesson(msg, msg.content);

    // Check if Sabu should reply
    const text = (msg.content || '').toLowerCase();
    const isMentioned = text.includes('sabu') || text.includes('സാബു') || text.includes('123') || text.includes('@sabu');
    
    // Check if message has questions, greetings or business/general talk
    const isGreeting = text.includes('hi') || text.includes('hello') || text.includes('hey') || 
                       text.includes('ഹലോ') || text.includes('ഹായ്') || text.includes('ivide') || 
                       text.includes('aarum') || text.includes('undo') || text.includes('sugham');
                       
    const isTopicOfInterest = text.includes('business') || text.includes('start') || text.includes('job') ||
                              text.includes('career') || text.includes('work') || text.includes('tech') ||
                              text.includes('ai') || text.includes('money') || text.includes('company') ||
                              text.includes('?') || isGreeting;

    const now = Date.now();
    const canReply = isMentioned || (isTopicOfInterest && (now - this.worldChatCooldown > this.worldChatCooldownMs));

    if (canReply) {
      this.worldChatCooldown = now;
      await db.logActivity('WORLD_CHAT', `Sabu decided to respond to ${msg.username} in World Chat`, msg.content);

      // Simulate human typing delay (2-4 seconds)
      const typingDelay = 2000 + Math.floor(Math.random() * 2000);
      await this.sleep(typingDelay);

      try {
        const recentHistory = await db.getRecentMessages('world', 6);
        const reply = await brain.generateWorldChatResponse(msg, recentHistory);

        if (reply) {
          client.sendWorldMessage(reply);
          this.stats.worldMessagesSent++;
          console.log(`[World Chat] Sabu: ${reply}`);

          await db.saveMessage({
            chat_type: 'world',
            sender_id: myId,
            sender_username: 'sabu123',
            content: reply
          });
          await db.logActivity('WORLD_CHAT', `Sabu sent message in World Chat`, reply);
        }
      } catch (err) {
        console.error('Error generating world chat reply:', err.message);
      }
    }
  }

  async handleDirectMessage(msg) {
    if (!this.isActive || !msg) return;
    const myId = client.currentUser ? client.currentUser.id : 1;
    const senderId = msg.sender_id || msg.user_id;

    // Ignore own messages
    if (senderId === myId || msg.sender_username === 'sabu123' || msg.username === 'sabu123') return;

    this.stats.directMessagesReceived++;
    console.log(`[DM] From ${msg.sender_username || msg.sender_id}: ${msg.content}`);

    // Mark as read
    client.markRead(msg.sender_id);

    // Save message and sender info
    await db.saveMessage({
      chat_type: 'direct',
      sender_id: msg.sender_id,
      sender_username: msg.sender_username || `user_${msg.sender_id}`,
      recipient_id: myId,
      content: msg.content
    });

    await db.saveUserMet({
      id: msg.sender_id,
      username: msg.sender_username,
      display_name: msg.sender_display_name,
      profession: msg.sender_profession,
      skills: msg.sender_skills,
      bio: msg.sender_bio
    });

    // Check for business lesson
    this.checkAndSaveLesson(
      { username: msg.sender_username, profession: msg.sender_profession },
      msg.content
    );

    await db.logActivity('DIRECT_CHAT', `Received DM from ${msg.sender_username || msg.sender_id}`, msg.content);

    // Simulate natural thinking and typing delay (1.5 - 3.5 seconds)
    const typingDelay = 1500 + Math.floor(Math.random() * 2000);
    await this.sleep(typingDelay);

    try {
      // Fetch conversation history
      const history = await client.getDirectMessages(msg.sender_id);
      const reply = await brain.generateDirectMessageResponse(
        {
          id: msg.sender_id,
          username: msg.sender_username,
          display_name: msg.sender_display_name,
          profession: msg.sender_profession,
          skills: msg.sender_skills,
          bio: msg.sender_bio
        },
        msg.content,
        history.slice(-8)
      );

      if (reply) {
        client.sendDirectMessage(msg.sender_id, reply);
        this.stats.directMessagesSent++;
        console.log(`[DM Reply] Sabu -> ${msg.sender_username || msg.sender_id}: ${reply}`);

        await db.saveMessage({
          chat_type: 'direct',
          sender_id: myId,
          sender_username: 'sabu123',
          recipient_id: msg.sender_id,
          content: reply
        });

        await db.logActivity('DIRECT_CHAT', `Sabu replied to ${msg.sender_username || msg.sender_id}`, reply);
      }
    } catch (err) {
      console.error('Error generating direct message reply:', err.message);
    }
  }

  async discoverProfessionals() {
    console.log('[Discovery] Searching for professionals on the platform...');
    try {
      const myId = client.currentUser ? client.currentUser.id : 1;
      const queries = ['', 'Doctor', 'Developer', 'Engineer', 'Business', 'Manager', 'Designer'];
      const randomQuery = queries[Math.floor(Math.random() * queries.length)];

      const users = await client.searchUsers(randomQuery);
      if (!users || users.length === 0) {
        console.log(`[Discovery] No new professionals found for query: "${randomQuery}"`);
        return;
      }

      for (const user of users) {
        if (user.id === myId) continue;

        // Save user to database
        await db.saveUserMet(user);

        // Check if we already chatted with them
        const history = await client.getDirectMessages(user.id);
        if (!history || history.length === 0) {
          // New professional! Proactively reach out
          console.log(`[Discovery] Reaching out to new professional: ${user.display_name} (${user.profession || 'Specialist'})`);
          await db.logActivity('DISCOVERY', `Found new professional: ${user.display_name}`, `Role: ${user.profession || 'Specialist'}`);

          const greeting = await brain.generateProactiveGreeting(user);
          if (greeting) {
            await this.sleep(3000);
            client.sendDirectMessage(user.id, greeting);
            this.stats.directMessagesSent++;

            await db.saveMessage({
              chat_type: 'direct',
              sender_id: myId,
              sender_username: 'sabu123',
              recipient_id: user.id,
              content: greeting
            });

            await db.logActivity('DIRECT_CHAT', `Proactive intro sent to ${user.display_name}`, greeting);
            break; // Reach out to one at a time per discovery cycle
          }
        }
      }
    } catch (err) {
      console.error('Error in discoverProfessionals:', err.message);
    }
  }

  async checkAndSaveLesson(speaker, content) {
    if (!content || content.length < 15) return;
    try {
      const extracted = await brain.extractBusinessLesson(speaker, content);
      if (extracted && extracted.has_lesson && extracted.lesson) {
        await db.saveBusinessLesson({
          topic: extracted.topic || 'Business Insights',
          learned_from: speaker.username || 'Professional',
          profession: speaker.profession || 'Professional',
          lesson: extracted.lesson
        });
        this.stats.lessonsLearned++;
        await db.logActivity('INSIGHT', `Learned new business lesson from ${speaker.username}`, extracted.lesson);
        console.log(`💡 [Insight Learned] ${extracted.topic}: ${extracted.lesson}`);
      }
    } catch (e) {
      // Ignored
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    return {
      ...this.stats,
      isActive: this.isActive,
      uptimeSeconds: Math.floor((Date.now() - new Date(this.stats.startedAt).getTime()) / 1000)
    };
  }

  toggleActive(status = null) {
    this.isActive = status !== null ? status : !this.isActive;
    return this.isActive;
  }
}

module.exports = new AutoBehaviorManager();
