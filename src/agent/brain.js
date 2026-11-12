const config = require('../config');
const persona = require('./sabuPersona');
const db = require('../database/db');

class SabuBrain {
  constructor() {
    this.apiKey = config.ai.groqApiKey;
    this.model = config.ai.groqModel;
  }

  /**
   * Generates a response for a World Chat message
   */
  async generateWorldChatResponse(incomingMessage, recentChatHistory = []) {
    const formattedHistory = recentChatHistory.map(m => 
      `${m.sender_username || m.username}: ${m.content}`
    ).join('\n');

    const prompt = `
[CONTEXT: ProChat World Chat Room (Live Public Room)]
Recent Chat Messages:
${formattedHistory}

Latest Message from "${incomingMessage.username}" (Profession: ${incomingMessage.profession || 'Unknown'}):
"${incomingMessage.content}"

Your Task:
Respond naturally as Sabu (15-year-old student, eager to learn business).
- ALWAYS reply in pure, natural Malayalam script (മലയാളം ലിപിയിൽ മാത്രം).
- Even if they type in Manglish or English, reply in natural Malayalam.
- Keep response short (1 or 2 lines maximum) like a real chat message.
- Output ONLY the chat message text to send. No quotes, no markdown, no role prefixes.
`;

    const response = await this.callLLM(prompt, persona.systemPrompt);
    return response.trim();
  }

  /**
   * Generates a response for a Direct Message (1-on-1 personal chat)
   */
  async generateDirectMessageResponse(sender, incomingMessage, conversationHistory = []) {
    const historyText = conversationHistory.map(m => 
      `${m.sender_username || (m.sender_id === 1 ? 'Sabu' : sender.display_name)}: ${m.content}`
    ).join('\n');

    const prompt = `
[CONTEXT: Direct 1-on-1 Chat with ${sender.display_name || sender.username}]
User Profession: ${sender.profession || 'Professional'}
User Skills: ${sender.skills || 'Not specified'}
User Bio: ${sender.bio || 'Not specified'}

Conversation so far:
${historyText || '(No previous messages)'}

New message from ${sender.display_name || sender.username}:
"${incomingMessage}"

Your Task:
Respond naturally as Sabu (15-year-old student learning business).
- ALWAYS reply in pure, friendly, natural Malayalam script (മലയാളം ലിപിയിൽ മാത്രം സംസാരിക്കുക).
- Even if the user types in Manglish (like "online undo", "sugamano", "njan paranjal"), ALWAYS reply in clean Malayalam script.
- NEVER write broken Manglish or mix Tamil/Telugu words.
- Keep the response warm, respectful ("ചേട്ടാ"), and short (1-2 sentences).
- Output ONLY your exact chat reply.
`;

    const response = await this.callLLM(prompt, persona.systemPrompt);
    return response.trim();
  }

  /**
   * Generates a proactive initial greeting to a newly discovered professional
   */
  async generateProactiveGreeting(targetUser) {
    const prompt = `
[TASK: Proactively say hello to a newly discovered professional on the platform]
Target User: ${targetUser.display_name || targetUser.username}
Profession: ${targetUser.profession || 'Specialist'}
Skills: ${targetUser.skills || 'Not specified'}

Write a polite, warm direct message (1-2 sentences) introducing yourself as Sabu (a 10th student interested in learning about their field and business), and asking if you can ask a question when they have free time.
Keep it humble and friendly.
Output ONLY the message text.
`;

    const response = await this.callLLM(prompt, persona.systemPrompt);
    return response.trim();
  }

  /**
   * Extracts any business wisdom or lessons from a message to store in memory
   */
  async extractBusinessLesson(speaker, message) {
    try {
      const prompt = `
Analyze this statement from a professional named ${speaker.username} (${speaker.profession || 'Professional'}):
"${message}"

Did they share any practical business lesson, career advice, technology insight, or industry knowledge?
If YES, summarize the key lesson in 1 concise sentence and specify a topic.
Respond in JSON format: {"has_lesson": true, "topic": "...", "lesson": "..."}
If NO business or professional lesson was shared, respond: {"has_lesson": false}
`;
      const result = await this.callLLM(prompt, 'You are an analytical knowledge extractor. Output strict JSON only.');
      const cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.has_lesson && parsed.lesson) {
        return parsed;
      }
    } catch (e) {
      // Ignored if extraction fails
    }
    return null;
  }

  /**
   * Low-level caller to Groq LLM API
   */
  async callLLM(userPrompt, systemPrompt = '') {
    try {
      const messages = [];
      if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: userPrompt });

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.7,
          max_tokens: 300
        })
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('Groq API Error Response:', data);
        return 'ഹലോ ചേട്ടാ, സുഖമാണോ? നിങ്ങളുടെ മേഖലയെക്കുറിച്ച് കൂടുതൽ അറിയാൻ താല്പര്യമുണ്ട്!';
      }

      let content = data.choices?.[0]?.message?.content || '';
      // Strip any reasoning tags if present
      content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      return content || 'ഹലോ, സുഖമാണോ?';
    } catch (err) {
      console.error('Groq LLM call error:', err.message);
      return 'ഹലോ, സുഖമാണോ? നിങ്ങളുടെ വർക്കിനെക്കുറിച്ച് കൂടുതൽ അറിയാൻ താല്പര്യമുണ്ട്!';
    }
  }
}

module.exports = new SabuBrain();

