const mysql = require('mysql2/promise');
const config = require('../config');

class DatabaseManager {
  constructor() {
    this.pool = null;
    this.isMysqlConnected = false;
    // In-memory fallback in case Remote MySQL is pending approval
    this.memoryStore = {
      usersMet: [],
      messages: [],
      businessLessons: [
        {
          id: 1,
          topic: 'Platform Launch & Community',
          learned_from: 'System',
          profession: 'Network Admin',
          lesson: 'Networking with domain experts is the fastest way to understand market gaps and build viable startups.',
          created_at: new Date()
        }
      ],
      activityLogs: [
        {
          id: 1,
          event_type: 'SYSTEM',
          action: 'Sabu Agent System Initialized',
          details: 'Ready to connect to ProChat platform and start learning.',
          created_at: new Date()
        }
      ]
    };
  }

  async init() {
    console.log(`[DB] Attempting connection to Hostinger MySQL at ${config.db.host}...`);
    try {
      this.pool = mysql.createPool({
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 7000
      });

      // Test connection
      const connection = await this.pool.getConnection();
      console.log('✅ [DB] Connected to Hostinger MySQL successfully!');
      this.isMysqlConnected = true;
      connection.release();

      await this.createTables();
    } catch (err) {
      console.warn('⚠️ [DB] Hostinger MySQL connection note:', err.message);
      console.warn('ℹ️ [DB] Running in resilient memory mode until Remote MySQL is accessible. Agent will continue seamlessly!');
      this.isMysqlConnected = false;
    }
  }

  async createTables() {
    if (!this.isMysqlConnected) return;
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS sabu_users_met (
          id INT AUTO_INCREMENT PRIMARY KEY,
          platform_user_id INT UNIQUE,
          username VARCHAR(100) NOT NULL,
          display_name VARCHAR(100),
          profession VARCHAR(255),
          skills TEXT,
          bio TEXT,
          first_met_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          conversation_count INT DEFAULT 1,
          notes TEXT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS sabu_messages (
          id INT AUTO_INCREMENT PRIMARY KEY,
          chat_type VARCHAR(20) NOT NULL,
          sender_id INT NOT NULL,
          sender_username VARCHAR(100) NOT NULL,
          recipient_id INT NULL,
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS sabu_business_lessons (
          id INT AUTO_INCREMENT PRIMARY KEY,
          topic VARCHAR(255) NOT NULL,
          learned_from VARCHAR(100),
          profession VARCHAR(100),
          lesson TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS sabu_activity_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          event_type VARCHAR(50) NOT NULL,
          action TEXT NOT NULL,
          details TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS sabu_business_missions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          mission_title VARCHAR(255) NOT NULL,
          instruction TEXT NOT NULL,
          status VARCHAR(50) DEFAULT 'IN_PROGRESS',
          target_professions TEXT,
          consulted_specialists TEXT,
          feasibility_report TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log('✅ [DB] Sabu tables verified & ready.');
    } catch (e) {
      console.error('❌ [DB] Error creating tables:', e.message);
    }
  }

  async saveUserMet(user) {
    if (!user || !user.id) return;
    const { id, username, display_name, profession, skills, bio } = user;

    if (this.isMysqlConnected) {
      try {
        const query = `
          INSERT INTO sabu_users_met (platform_user_id, username, display_name, profession, skills, bio)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE 
            display_name = VALUES(display_name),
            profession = VALUES(profession),
            skills = VALUES(skills),
            bio = VALUES(bio),
            conversation_count = conversation_count + 1,
            last_seen_at = CURRENT_TIMESTAMP;
        `;
        await this.pool.query(query, [id, username, display_name || username, profession || '', skills || '', bio || '']);
        return;
      } catch (e) {
        console.warn('DB saveUserMet MySQL error:', e.message);
      }
    }

    // Memory fallback
    const existing = this.memoryStore.usersMet.find(u => u.platform_user_id === id);
    if (existing) {
      existing.display_name = display_name || username;
      existing.profession = profession;
      existing.skills = skills;
      existing.bio = bio;
      existing.conversation_count = (existing.conversation_count || 1) + 1;
      existing.last_seen_at = new Date();
    } else {
      this.memoryStore.usersMet.push({
        id: this.memoryStore.usersMet.length + 1,
        platform_user_id: id,
        username,
        display_name: display_name || username,
        profession,
        skills,
        bio,
        conversation_count: 1,
        first_met_at: new Date(),
        last_seen_at: new Date()
      });
    }
  }

  async saveMessage({ chat_type, sender_id, sender_username, recipient_id = null, content }) {
    if (this.isMysqlConnected) {
      try {
        await this.pool.query(`
          INSERT INTO sabu_messages (chat_type, sender_id, sender_username, recipient_id, content)
          VALUES (?, ?, ?, ?, ?)
        `, [chat_type, sender_id, sender_username, recipient_id, content]);
        return;
      } catch (e) {
        console.warn('DB saveMessage MySQL error:', e.message);
      }
    }

    this.memoryStore.messages.unshift({
      id: this.memoryStore.messages.length + 1,
      chat_type,
      sender_id,
      sender_username,
      recipient_id,
      content,
      created_at: new Date()
    });
    if (this.memoryStore.messages.length > 200) this.memoryStore.messages.pop();
  }

  async saveBusinessLesson({ topic, learned_from, profession, lesson }) {
    if (this.isMysqlConnected) {
      try {
        await this.pool.query(`
          INSERT INTO sabu_business_lessons (topic, learned_from, profession, lesson)
          VALUES (?, ?, ?, ?)
        `, [topic, learned_from, profession || 'Professional', lesson]);
        return;
      } catch (e) {
        console.warn('DB saveBusinessLesson MySQL error:', e.message);
      }
    }

    this.memoryStore.businessLessons.unshift({
      id: this.memoryStore.businessLessons.length + 1,
      topic,
      learned_from,
      profession: profession || 'Professional',
      lesson,
      created_at: new Date()
    });
  }

  async logActivity(event_type, action, details = '') {
    const timestamp = new Date();
    if (this.isMysqlConnected) {
      try {
        await this.pool.query(`
          INSERT INTO sabu_activity_logs (event_type, action, details)
          VALUES (?, ?, ?)
        `, [event_type, action, details]);
        return;
      } catch (e) {
        console.warn('DB logActivity MySQL error:', e.message);
      }
    }

    this.memoryStore.activityLogs.unshift({
      id: this.memoryStore.activityLogs.length + 1,
      event_type,
      action,
      details,
      created_at: timestamp
    });
    if (this.memoryStore.activityLogs.length > 300) this.memoryStore.activityLogs.pop();
  }

  async getRecentActivities(limit = 25) {
    if (this.isMysqlConnected) {
      try {
        const [rows] = await this.pool.query(
          'SELECT * FROM sabu_activity_logs ORDER BY id DESC LIMIT ?',
          [limit]
        );
        return rows;
      } catch (e) {
        console.warn('DB getRecentActivities MySQL error:', e.message);
      }
    }
    return this.memoryStore.activityLogs.slice(0, limit);
  }

  async getBusinessLessons(limit = 20) {
    if (this.isMysqlConnected) {
      try {
        const [rows] = await this.pool.query(
          'SELECT * FROM sabu_business_lessons ORDER BY id DESC LIMIT ?',
          [limit]
        );
        return rows;
      } catch (e) {
        console.warn('DB getBusinessLessons MySQL error:', e.message);
      }
    }
    return this.memoryStore.businessLessons.slice(0, limit);
  }

  async getUsersMet(limit = 20) {
    if (this.isMysqlConnected) {
      try {
        const [rows] = await this.pool.query(
          'SELECT * FROM sabu_users_met ORDER BY last_seen_at DESC LIMIT ?',
          [limit]
        );
        return rows;
      } catch (e) {
        console.warn('DB getUsersMet MySQL error:', e.message);
      }
    }
    return this.memoryStore.usersMet.slice(0, limit);
  }

  async getRecentMessages(chat_type = null, limit = 20) {
    if (this.isMysqlConnected) {
      try {
        let query = 'SELECT * FROM sabu_messages';
        const params = [];
        if (chat_type) {
          query += ' WHERE chat_type = ?';
          params.push(chat_type);
        }
        query += ' ORDER BY id DESC LIMIT ?';
        params.push(limit);

        const [rows] = await this.pool.query(query, params);
        return rows;
      } catch (e) {
        console.warn('DB getRecentMessages MySQL error:', e.message);
      }
    }
    let list = this.memoryStore.messages;
    if (chat_type) list = list.filter(m => m.chat_type === chat_type);
    return list.slice(0, limit);
  }

  async createMission({ mission_title, instruction, target_professions = [] }) {
    const targetJson = JSON.stringify(target_professions);
    if (this.isMysqlConnected) {
      try {
        const [result] = await this.pool.query(`
          INSERT INTO sabu_business_missions (mission_title, instruction, status, target_professions, consulted_specialists, feasibility_report)
          VALUES (?, ?, 'IN_PROGRESS', ?, '[]', '')
        `, [mission_title, instruction, targetJson]);
        return { id: result.insertId, mission_title, instruction, status: 'IN_PROGRESS', target_professions, consulted_specialists: [], feasibility_report: '' };
      } catch (e) {
        console.warn('DB createMission MySQL error:', e.message);
      }
    }
    const mission = {
      id: Date.now(),
      mission_title,
      instruction,
      status: 'IN_PROGRESS',
      target_professions,
      consulted_specialists: [],
      feasibility_report: '',
      created_at: new Date()
    };
    this.memoryStore.activeMission = mission;
    return mission;
  }

  async getActiveMission() {
    if (this.isMysqlConnected) {
      try {
        const [rows] = await this.pool.query(
          "SELECT * FROM sabu_business_missions WHERE status = 'IN_PROGRESS' ORDER BY id DESC LIMIT 1"
        );
        if (rows.length > 0) {
          const row = rows[0];
          return {
            ...row,
            target_professions: typeof row.target_professions === 'string' ? JSON.parse(row.target_professions || '[]') : row.target_professions,
            consulted_specialists: typeof row.consulted_specialists === 'string' ? JSON.parse(row.consulted_specialists || '[]') : row.consulted_specialists
          };
        }
        return null;
      } catch (e) {
        console.warn('DB getActiveMission MySQL error:', e.message);
      }
    }
    return this.memoryStore.activeMission || null;
  }

  async updateMission(id, { status, target_professions, consulted_specialists, feasibility_report }) {
    if (this.isMysqlConnected) {
      try {
        const fields = [];
        const params = [];
        if (status) { fields.push('status = ?'); params.push(status); }
        if (target_professions) { fields.push('target_professions = ?'); params.push(JSON.stringify(target_professions)); }
        if (consulted_specialists) { fields.push('consulted_specialists = ?'); params.push(JSON.stringify(consulted_specialists)); }
        if (feasibility_report !== undefined) { fields.push('feasibility_report = ?'); params.push(feasibility_report); }
        
        if (fields.length > 0) {
          params.push(id);
          await this.pool.query(`UPDATE sabu_business_missions SET ${fields.join(', ')} WHERE id = ?`, params);
        }
        return;
      } catch (e) {
        console.warn('DB updateMission MySQL error:', e.message);
      }
    }
    if (this.memoryStore.activeMission) {
      if (status) this.memoryStore.activeMission.status = status;
      if (target_professions) this.memoryStore.activeMission.target_professions = target_professions;
      if (consulted_specialists) this.memoryStore.activeMission.consulted_specialists = consulted_specialists;
      if (feasibility_report !== undefined) this.memoryStore.activeMission.feasibility_report = feasibility_report;
    }
  }

  getStatus() {
    return {
      connectedToMysql: this.isMysqlConnected,
      host: config.db.host,
      database: config.db.database,
      totalUsersMet: this.memoryStore.usersMet.length,
      totalLessons: this.memoryStore.businessLessons.length
    };
  }
}

module.exports = new DatabaseManager();

