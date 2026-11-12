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
- If someone discusses learning business or asking for experts, encourage them: "വേൾഡ് ചാറ്റിൽ @find [profession] എന്ന് ടൈപ്പ് ചെയ്താൽ ആ എക്സ്പർട്ടിനെ കിട്ടും, പേഴ്സണൽ ചാറ്റിൽ നേരിട്ട് ചോദിച്ചു പഠിക്കാം!"
- Keep response short (1 or 2 lines maximum) like a real chat message.
- Output ONLY the chat message text to send. No quotes, no markdown, no role prefixes.
`;

    const response = await this.callLLM(prompt, persona.systemPrompt);
    return response.trim();
  }

  /**
   * Generates a response for a Direct Message (1-on-1 personal chat)
   */
  async generateDirectMessageResponse(sender, incomingMessage, conversationHistory = [], activeMission = null) {
    const historyText = conversationHistory.map(m => 
      `${m.sender_username || (m.sender_id === 1 || m.sender_id === 6 ? 'Sabu' : sender.display_name)}: ${m.content}`
    ).join('\n');

    const missionContext = activeMission ? `
Active Business Being Researched: "${activeMission.mission_title}"
User Directive: "${activeMission.instruction}"` : '';

    const prompt = `
[CONTEXT: Direct 1-on-1 Conversation with ${sender.display_name || sender.username}]
Professional Role: ${sender.profession || 'Specialist'}
Skills: ${sender.skills || 'Not specified'}
Bio: ${sender.bio || 'Not specified'}
${missionContext}

Conversation History so far:
${historyText || '(No previous messages)'}

Latest message from ${sender.display_name || sender.username}:
"${incomingMessage}"

CRITICAL INSTRUCTIONS FOR SABU:
1. Act like a real human student named Sabu talking on a phone.
2. DO NOT repeat greetings (do NOT say "ഹലോ ചേട്ടാ സുഖമാണോ?" if you already greeted them in the history).
3. If they asked you to ask details or asked what you need help with:
   - Ask ONE concrete, practical, essential question related to their profession (${sender.profession}) and the business being planned.
   - For Legal/Licensing: Ask about required government licenses (FSSAI, GST, Trade license), procedures, estimated fees, or timeline.
   - For Culinary/Bakery/Product: Ask about kitchen equipment, raw material sourcing, shelf life, or cost breakdown.
   - For Tech/Dev: Ask about the best tech stack, mobile app costs, or hosting architecture.
   - For Marketing: Ask about customer acquisition, advertising channels, or initial budget.
4. If they just answered your previous question:
   - Thank them briefly and ask the next logical follow-up question.
5. If they suggest or mention another expert (e.g. lawyer, branding designer, accountant, packaging supplier):
   - Enthusiastically thank them and mention: "വളരെ നന്ദി! നിങ്ങൾ പറഞ്ഞ ആ സ്പെഷ്യലിസ്റ്റിനെ ഞാൻ ഉടൻ തന്നെ വേൾഡ് ചാറ്റിൽ @find വഴി കണ്ടെത്തി കൂടുതൽ കാര്യങ്ങൾ ചോദിച്ചു പഠിക്കാം!"
6. NEVER repeat a question or statement that you already sent in the conversation history!
7. Keep your reply concise (1 to 2 sentences max) in pure, natural Malayalam script.
8. Output ONLY your exact Malayalam reply.
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
   * Plans an A-to-Z business research mission covering all 6 essential pillars
   */
  async planBusinessMission(instruction) {
    try {
      const prompt = `
You are an expert startup advisor assisting Sabu in conducting an A-to-Z business feasibility study.
Business Directive from User:
"${instruction}"

Your Task:
1. Provide a short, catchy Title for this business venture.
2. Structure the research into the 5-6 core specialist roles needed for a complete A to Z study:
   - Pillar 1: Domain/Product Specialist (Feasibility & Setup)
   - Pillar 2: Legal Consultant / Lawyer (Licensing, FSSAI, GST, Permits)
   - Pillar 3: Accountant / Financial Planner (Initial Capital, Operational Costs, Margins, Break-even)
   - Pillar 4: Supply Chain / Vendor Specialist (Raw materials, storage, sourcing)
   - Pillar 5: Marketing & Branding Specialist (First 100 customers, ads, branding)
   - Pillar 6: Startup Mentor (Common mistakes & risk avoidance)
3. For each role, provide the single most important practical question Sabu should ask them in Malayalam.

Respond in strict JSON format:
{
  "mission_title": "...",
  "target_professions": [
    { "profession": "...", "pillar": "Product & Setup", "question": "..." },
    { "profession": "Legal Consultant", "pillar": "Legal & Licensing", "question": "..." },
    { "profession": "Accountant", "pillar": "Finance & Margins", "question": "..." },
    { "profession": "Supply Chain Specialist", "pillar": "Raw Materials & Logistics", "question": "..." },
    { "profession": "Marketing Expert", "pillar": "Marketing & Customers", "question": "..." },
    { "profession": "Startup Mentor", "pillar": "Risks & Pitfalls", "question": "..." }
  ]
}
`;
      const result = await this.callLLM(prompt, 'You are a professional business research planner. Output strict JSON only.');
      const cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.mission_title && Array.isArray(parsed.target_professions)) {
        return parsed;
      }
    } catch (e) {
      console.warn('planBusinessMission error:', e.message);
    }
    return {
      mission_title: instruction.slice(0, 50),
      target_professions: [
        { profession: 'Business Consultant', pillar: 'Product & Setup', question: 'ഈ ബിസിനസ്സ് ആരംഭിക്കാൻ എന്തൊക്കെ പ്രധാന സജ്ജീകരണങ്ങളും മെഷിനറികളുമാണ് വേണ്ടത്?' },
        { profession: 'Legal Consultant', pillar: 'Legal & Licensing', question: 'കേരളത്തിൽ തുടങ്ങാൻ വേണ്ട പ്രധാന ലൈസൻസുകൾ (FSSAI, GST, ട്രേഡ് പെർമിറ്റ്) എന്തൊക്കെയാണ്, എത്ര ചിലവ് വരും?' },
        { profession: 'Accountant', pillar: 'Finance & Margins', question: 'തുടക്കത്തിൽ വേണ്ട മിനിമം ക്യാപിറ്റലും മാസാമാസ ചിലവുകളും ലാഭവിഹിതവും (Profit Margin) എത്രയാണ്?' },
        { profession: 'Supply Chain Specialist', pillar: 'Raw Materials & Logistics', question: 'ക്വാളിറ്റിയുള്ള റോ മെറ്റീരിയൽസ് ഏറ്റവും കുറഞ്ഞ ചിലവിൽ എവിടെ നിന്ന് ഹോൾസെയിലായി കണ്ടെത്താം?' },
        { profession: 'Marketing Expert', pillar: 'Marketing & Customers', question: 'ആദ്യത്തെ 100 കസ്റ്റമേഴ്സിനെ ആകർഷിക്കാൻ ഏറ്റവും അനുയോജ്യമായ മാർക്കറ്റിംഗ് സ്ട്രാറ്റജി എന്താണ്?' },
        { profession: 'Startup Mentor', pillar: 'Risks & Pitfalls', question: 'തുടക്കക്കാർക്ക് പറ്റുന്ന പ്രധാന അബദ്ധങ്ങൾ എന്തൊക്കെയാണ്, നഷ്ടം വരാതിരിക്കാൻ എന്ത് ശ്രദ്ധിക്കണം?' }
      ]
    };
  }

  /**
   * Analyzes specialist conversation to see if they recommended another professional or domain
   */
  async identifyNextSpecialist(conversationText) {
    try {
      const prompt = `
Analyze this conversation with a professional:
"${conversationText}"

Did this professional suggest consulting or connecting with another specific type of professional, expert, or partner (e.g. "you must speak to a lawyer for license", "consult a packaging supplier", "hire a devops engineer")?
If YES, output JSON: {"should_summon": true, "profession": "Exact Profession Name", "reason": "why they are needed"}
If NO, output JSON: {"should_summon": false}
`;
      const result = await this.callLLM(prompt, 'Output strict JSON only.');
      const cleanJson = result.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.should_summon && parsed.profession) {
        return parsed;
      }
    } catch (e) {
      // Ignored
    }
    return null;
  }

  /**
   * Low-level caller to Groq LLM API with automatic multi-model fallback
   */
  async callLLM(userPrompt, systemPrompt = '') {
    const candidateModels = [
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
      'qwen/qwen3.8-27b'
    ];

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userPrompt });

    for (const model of candidateModels) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.6,
            max_tokens: 600
          })
        });

        const data = await res.json();
        if (res.ok && data.choices?.[0]?.message) {
          let content = data.choices[0].message.content || '';
          if (!content && data.choices[0].message.reasoning) {
            content = data.choices[0].message.reasoning;
          }
          content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
          if (content) return content;
        } else {
          console.warn(`[Brain] Model ${model} unavailable or rate-limited:`, data.error?.message || 'Empty response');
        }
      } catch (err) {
        console.warn(`[Brain] Model ${model} fetch error:`, err.message);
      }
    }

    return 'തീർച്ചയായും ചേട്ടാ, നിങ്ങളുടെ നിർദ്ദേശങ്ങൾ ശ്രദ്ധയോടെ കേൾക്കാൻ ഞാൻ തയ്യാറാണ്!';
  }
}

module.exports = new SabuBrain();

