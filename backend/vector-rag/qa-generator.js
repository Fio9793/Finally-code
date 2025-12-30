// backend/vector-rag/qa-generator.js
const axios = require('axios');
require('dotenv').config();

class QAGenerator {
    constructor() {
        this.apiKey = process.env.DEEPSEEK_API_KEY;
        this.apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
        this.useMockLLM = !this.apiKey; // 如果没有API Key，使用模拟回答
        
        if (this.apiKey) {
            console.log('✅ DeepSeek API 已配置');
        } else {
            console.warn('⚠️ 未配置DeepSeek API Key，使用模拟回答');
        }
    }

    /**
     * 生成答案
     */
    async generateAnswer(query, contextResults, conversationHistory = []) {
        try {
            console.log(`🤖 为查询生成答案: "${query}"`);
            
            if (contextResults.length === 0) {
                return {
                    answer: '抱歉，没有找到相关的新闻信息来回答您的问题。请尝试使用不同的关键词或扩大搜索范围。',
                    sources: [],
                    suggestions: [
                        '尝试使用更具体的关键词',
                        '检查拼写是否正确',
                        '扩大时间范围'
                    ]
                };
            }

            // 构建提示词
            const prompt = this.buildPrompt(query, contextResults, conversationHistory);
            
            // 调用LLM服务
            const answer = await this.callLLMService(prompt);
            
            return {
                answer: answer,
                sources: contextResults.map(r => ({
                    id: r.payload.news_id,
                    title: r.payload.title,
                    score: r.score,
                    publish_time: r.payload.publish_time,
                    source_url: r.payload.source_url,
                    theme: r.payload.theme
                })),
                search_time: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ 答案生成失败:', error);
            return this.fallbackAnswer(query, contextResults);
        }
    }

    /**
     * 构建提示词 - 优化版本
     */
    buildPrompt(query, contextResults, conversationHistory) {
        const contextText = contextResults.map((result, index) => 
            `[新闻${index + 1}] 
标题: ${result.payload.title}
主题: ${result.payload.theme}
执行方: ${result.payload.executor || '未知'}
位置: ${result.payload.locations?.join(', ') || '未知'}
时间: ${result.payload.publish_time || '未知'}
主要内容: ${result.payload.content}
关键词: ${result.payload.keywords?.join(', ') || '无'}
措施: ${result.payload.measure || '无'}
效果数据: ${result.payload.effect_data || '无'}`
        ).join('\n\n');

        const historyText = conversationHistory.length > 0 ? 
            `\n\n对话历史:\n${conversationHistory.slice(-3).map(msg => `${msg.role}: ${msg.content}`).join('\n')}` : '';

        return `你是一个专业的海洋新闻分析助手，专门分析海洋环境保护、航运、污染治理等相关新闻。

用户问题: "${query}"
${historyText}

相关新闻内容:
${contextText}

请根据以上新闻内容回答用户问题，要求:
1. 基于提供的新闻内容给出准确、专业的回答
2. 引用具体的新闻来源，但不要直接说"根据新闻1"
3. 如果新闻内容不足以完全回答问题，请说明并给出基于现有信息的最佳回答
4. 保持回答简洁明了，重点突出，不超过300字
5. 用自然流畅的中文回答，避免机械的列举

请开始回答:`;
    }

    /**
     * 调用DeepSeek API
     */
    async callLLMService(prompt) {
        // 如果没有API Key，使用模拟回答
        if (this.useMockLLM) {
            return this.mockLLMResponse(prompt);
        }

        try {
            const response = await axios.post(this.apiUrl, {
                model: "deepseek-chat",
                messages: [
                    {
                        role: "system",
                        content: "你是一个专业的海洋新闻分析助手，专门分析海洋环境保护、航运、污染治理等相关新闻。请根据用户提供的新闻内容回答问题，保持回答准确、专业、简洁。"
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 800,
                stream: false
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            const answer = response.data.choices[0].message.content;
            console.log(`✅ DeepSeek API 调用成功，生成长度: ${answer.length} 字符`);
            return answer;

        } catch (error) {
            console.error('❌ DeepSeek API 调用失败:', error.response?.data || error.message);
            
            // 如果是额度不足或认证失败，切换到模拟模式
            if (error.response?.status === 401 || error.response?.status === 429) {
                console.warn('⚠️ API Key无效或额度不足，切换到模拟回答模式');
                this.useMockLLM = true;
            }
            
            return this.mockLLMResponse(prompt);
        }
    }

    /**
     * 模拟LLM回答 - 改进版本
     */
    mockLLMResponse(prompt) {
        const query = prompt.split('用户问题: "')[1]?.split('"')[0] || '';
        const contextMatch = prompt.match(/相关新闻内容:\n([\s\S]*?)(?=\n请根据以上新闻内容)/);
        const context = contextMatch ? contextMatch[1] : '';
        
        // 从上下文中提取关键信息
        const titles = [];
        const themes = [];
        const locations = [];
        
        const newsBlocks = context.split('\n\n');
        newsBlocks.forEach(block => {
            const titleMatch = block.match(/标题: (.+)/);
            const themeMatch = block.match(/主题: (.+)/);
            const locationMatch = block.match(/位置: (.+)/);
            
            if (titleMatch) titles.push(titleMatch[1]);
            if (themeMatch) themes.push(themeMatch[1]);
            if (locationMatch && locationMatch[1] !== '未知') locations.push(locationMatch[1]);
        });
        
        // 基于查询和上下文生成更相关的回答
        if (query.includes('污染') || query.includes('排放')) {
            return `根据相关新闻报道，${query}问题在国际航运领域受到广泛关注。${titles[0] ? `例如在"${titles[0]}"中提到，` : ''}多国已制定严格的排放标准，要求船舶使用低硫燃料或安装洗涤器系统。国际海事组织(IMO)的2020限硫令要求船舶燃料硫含量不超过0.5%，违规排放可能导致高额罚款。${locations.length > 0 ? `这些措施在${locations.slice(0,2).join('、')}等地区已开始实施。` : ''}`;
        }
        
        if (query.includes('LNG') || query.includes('天然气') || query.includes('清洁能源')) {
            return `相关新闻显示，LNG作为船舶清洁燃料正得到广泛应用。${titles[0] ? `如"${titles[0]}"报道，` : ''}多艘LNG动力船舶已投入使用，使用LNG燃料可显著减少硫氧化物和颗粒物排放。一些港口正在建设LNG加注设施以支持这一转型，这有助于推动绿色航运发展。`;
        }
        
        if (query.includes('保护') || query.includes('生态')) {
            return `海洋生态保护是国际关注的重点。${titles[0] ? `新闻"${titles[0]}"提到，` : ''}各国通过建立海洋保护区、限制在敏感区域的排放和废物倾倒来保护海洋环境。一些地区还制定了特定的保护规范，如海豚保护区和北极航运保护区域。`;
        }
        
        if (query.includes('技术') || query.includes('创新')) {
            return `海洋技术不断创新，相关新闻提到了多种新技术应用。${titles[0] ? `据"${titles[0]}"介绍，` : ''}包括智能监测浮标、油污清理设备、压载水处理系统、混合动力推进系统等技术正在航运领域推广应用，旨在提高运营效率和减少环境影响。`;
        }
        
        if (query.includes('事故') || query.includes('泄漏')) {
            return `关于${query}，新闻报道显示相关部门采取了快速响应措施。${titles[0] ? `如"${titles[0]}"所述，` : ''}包括部署围油栏、使用撇油器进行清理，并对事故原因展开调查，以防止类似事件再次发生。`;
        }
        
        // 通用回答
        return `根据相关新闻资料，${query}在海洋航运和环境保护领域是一个重要议题。${themes.length > 0 ? `涉及的主题包括${[...new Set(themes)].slice(0,3).join('、')}。` : ''}${titles[0] ? `例如"${titles[0]}"报道了相关进展。` : ''}多国和国际组织正在通过法规制定、技术研发和行业合作来应对相关挑战。`;
    }

    /**
     * 降级回答方案
     */
    fallbackAnswer(query, contextResults) {
        if (contextResults.length === 0) {
            return {
                answer: '抱歉，暂时无法回答您的问题。请检查网络连接或稍后重试。',
                sources: [],
                suggestions: ['检查网络连接', '稍后重试']
            };
        }

        const topResults = contextResults.slice(0, 2);
        const answerParts = [];
        
        answerParts.push(`关于"${query}"，根据相关新闻：`);
        
        topResults.forEach((result, index) => {
            const news = result.payload;
            answerParts.push(`${index + 1}. "${news.title}"`);
            if (news.theme) answerParts.push(`   主题: ${news.theme}`);
            if (news.executor) answerParts.push(`   执行方: ${news.executor}`);
            if (news.measure) answerParts.push(`   措施: ${news.measure}`);
        });
        
        answerParts.push('以上信息供您参考。');

        return {
            answer: answerParts.join('\n'),
            sources: topResults.map(result => ({
                id: result.payload.news_id,
                title: result.payload.title,
                score: result.score,
                publish_time: result.payload.publish_time,
                source_url: result.payload.source_url,
                theme: result.payload.theme
            })),
            search_time: new Date().toISOString()
        };
    }
}

module.exports = new QAGenerator();