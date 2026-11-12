-- Schema for Sabu Business Agent (Hostinger MySQL)

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sabu_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  chat_type VARCHAR(20) NOT NULL, -- 'world' or 'direct'
  sender_id INT NOT NULL,
  sender_username VARCHAR(100) NOT NULL,
  recipient_id INT NULL,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sabu_business_lessons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  topic VARCHAR(255) NOT NULL,
  learned_from VARCHAR(100),
  profession VARCHAR(100),
  lesson TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sabu_activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL, -- 'WORLD_CHAT', 'DIRECT_CHAT', 'INSIGHT', 'DISCOVERY', 'SYSTEM'
  action TEXT NOT NULL,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

