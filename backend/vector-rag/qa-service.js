// backend/vector-rag/qa-service.js
const retriever = require('./retriever');
const qaGenerator = require('./qa-generator');
const enhancedRetriever = require('./enhanced-retriever');

class QAService {
    constructor() {
        this.conversationHistory = new Map(); // 存储对话历史
        console.log('✅ QAService 初始化完成');
    }

    /**
     * 处理用户问题 - 增强版本
     */
    async askQuestion(question, filters = {}, sessionId = 'default') {
        try {
            console.log(`\n💬 处理用户问题: "${question}"`);
            console.log(`📊 过滤器:`, filters);
            console.log(`🆔 会话ID: ${sessionId}`);
            
            // 获取对话历史
            const history = this.getConversationHistory(sessionId);
            
            // 使用增强检索器 - 结合向量搜索和分类搜索
            const relevantNews = await enhancedRetriever.enhancedHybridSearch(question, filters);
            
            // 记录检索策略分析
            const strategyAnalysis = enhancedRetriever.getSearchStrategyAnalysis(question);
            console.log('🔍 搜索策略分析:', strategyAnalysis);
            
            // 详细记录检索结果
            console.log('📋 RAG检索到的原始数据:');
            if (relevantNews.length === 0) {
                console.log('   ⚠️ 没有找到相关新闻');
            } else {
                relevantNews.forEach((news, index) => {
                    console.log(`   ${index + 1}. ID: ${news.id}`);
                    console.log(`      news_id: ${news.payload?.news_id}`);
                    console.log(`      标题: ${news.payload?.title}`);
                    console.log(`      搜索类型: ${news.searchType || 'vector'}`);
                    console.log(`      分类匹配: ${news.categoryMatch ? `${news.categoryMatch.score.toFixed(3)} (${news.categoryMatch.matchedCategories}分类)` : 'N/A'}`);
                    console.log(`      分数: ${news.score.toFixed(3)}`);
                    console.log(`      位置: ${news.payload?.locations ? news.payload.locations.join(', ') : '无'}`);
                });
            }

            // 生成答案
            const result = await qaGenerator.generateAnswer(question, relevantNews, history);

            // 修复：确保返回完整的位置信息和其他字段
            if (result.sources && result.sources.length > 0) {
                result.sources = result.sources.map((source, index) => {
                    // 直接从检索结果中获取完整数据
                    const originalNews = relevantNews[index];
                    if (originalNews && originalNews.payload) {
                        return {
                            id: originalNews.id,
                            news_id: originalNews.payload.news_id, // 确保news_id正确传递
                            title: originalNews.payload.title,
                            locations: originalNews.payload.locations || [], // 确保locations正确传递
                            score: originalNews.score,
                            publish_time: originalNews.payload.publish_time,
                            source_url: originalNews.payload.source_url,
                            theme: originalNews.payload.theme,
                            executor: originalNews.payload.executor,
                            keywords: originalNews.payload.keywords,
                            pollution_source: originalNews.payload.pollution_source,
                            measure: originalNews.payload.measure,
                            effect_data: originalNews.payload.effect_data,
                            theme_categories: originalNews.payload.theme_categories || [],
                            location_categories: originalNews.payload.location_categories || [],
                            pollution_categories: originalNews.payload.pollution_categories || [],
                            time_category: originalNews.payload.time_category || '',
                            search_type: originalNews.searchType || 'vector',
                            category_match: originalNews.categoryMatch,
                            payload: originalNews.payload // 保留完整payload用于调试
                        };
                    }
                    // 如果原始数据不存在，返回源数据
                    return source;
                });
            } else {
                // 如果没有sources，从relevantNews创建
                result.sources = relevantNews.map(news => ({
                    id: news.id,
                    news_id: news.payload?.news_id,
                    title: news.payload?.title,
                    locations: news.payload?.locations || [],
                    score: news.score,
                    publish_time: news.payload?.publish_time,
                    source_url: news.payload?.source_url,
                    theme: news.payload?.theme,
                    executor: news.payload?.executor,
                    keywords: news.payload?.keywords,
                    pollution_source: news.payload?.pollution_source,
                    measure: news.payload?.measure,
                    effect_data: news.payload?.effect_data,
                    theme_categories: news.payload?.theme_categories || [],
                    location_categories: news.payload?.location_categories || [],
                    pollution_categories: news.payload?.pollution_categories || [],
                    time_category: news.payload?.time_category || '',
                    search_type: news.searchType || 'vector',
                    category_match: news.categoryMatch,
                    payload: news.payload
                }));
            }

            // 添加搜索策略信息到结果中
            result.searchStrategy = strategyAnalysis;
            result.retrievalType = relevantNews.length > 0 ? 
                relevantNews[0].searchType || 'vector' : 'none';

            // 验证修复后的数据
            console.log('📋 修复后的返回数据:');
            if (result.sources.length > 0) {
                result.sources.forEach((source, index) => {
                    console.log(`   ${index + 1}. news_id: ${source.news_id}`);
                    console.log(`      位置: ${source.locations ? source.locations.join(', ') : '无'}`);
                    console.log(`      标题: ${source.title}`);
                    console.log(`      搜索类型: ${source.search_type}`);
                    console.log(`      主题分类: ${source.theme_categories ? source.theme_categories.join(', ') : '无'}`);
                });
            } else {
                console.log('   ⚠️ 没有相关新闻源');
            }

            // 更新对话历史
            this.updateConversationHistory(sessionId, {
                role: 'user',
                content: question,
                timestamp: new Date().toISOString()
            });
            
            this.updateConversationHistory(sessionId, {
                role: 'assistant',
                content: result.answer,
                timestamp: new Date().toISOString(),
                sources: result.sources,
                searchStrategy: strategyAnalysis
            });
            
            // 添加搜索建议
            result.suggestions = await enhancedRetriever.getEnhancedSearchSuggestions(question);
            
            console.log(`✅ 问题处理完成，生成 ${result.answer.length} 字符的回答`);
            console.log(`📊 返回 ${result.sources.length} 个相关新闻`);
            console.log(`🔍 搜索策略: ${strategyAnalysis.recommendedStrategies.join(', ')}`);
            
            return {
                success: true,
                question: question,
                ...result,
                search_time: new Date().toISOString(),
                session_id: sessionId
            };

        } catch (error) {
            console.error('❌ 问题处理失败:', error);
            return {
                success: false,
                question: question,
                answer: '抱歉，处理您的问题时出现了错误。请稍后重试。',
                sources: [],
                suggestions: ['检查网络连接', '稍后重试', '简化问题'],
                error: error.message,
                search_time: new Date().toISOString()
            };
        }
    }

    /**
     * 获取对话历史
     */
    getConversationHistory(sessionId) {
        const history = this.conversationHistory.get(sessionId) || [];
        console.log(`📚 获取会话 ${sessionId} 的历史记录: ${history.length} 条消息`);
        return history;
    }

    /**
     * 更新对话历史
     */
    updateConversationHistory(sessionId, message) {
        if (!this.conversationHistory.has(sessionId)) {
            this.conversationHistory.set(sessionId, []);
        }
        
        const history = this.conversationHistory.get(sessionId);
        history.push(message);
        
        // 限制历史记录长度
        if (history.length > 10) {
            history.splice(0, history.length - 10);
        }
        
        this.conversationHistory.set(sessionId, history);
        console.log(`📝 更新会话 ${sessionId} 的历史记录，当前长度: ${history.length}`);
    }

    /**
     * 清空对话历史
     */
    clearConversationHistory(sessionId = 'default') {
        this.conversationHistory.set(sessionId, []);
        console.log(`🗑️ 清空会话 ${sessionId} 的历史记录`);
        return { 
            success: true, 
            message: '对话历史已清空',
            session_id: sessionId
        };
    }

    /**
     * 获取会话列表
     */
    getSessions() {
        const sessions = Array.from(this.conversationHistory.keys());
        console.log(`📋 获取会话列表: ${sessions.length} 个会话`);
        return sessions;
    }

    /**
     * 获取热门问题
     */
    getPopularQuestions() {
        const questions = [
            "最近有哪些海洋污染事件？",
            "LNG动力船舶的发展现状如何？",
            "国际航运减排政策有哪些？",
            "海洋生态保护的最新措施是什么？",
            "绿色航运技术的发展趋势？",
            "油轮泄漏事故的应对方案？",
            "清洁能源在航运中的应用情况？",
            "船舶排放标准的最新要求？",
            "塑料污染治理有哪些创新方法？",
            "珊瑚礁保护的国际合作情况？"
        ];
        console.log(`📢 提供 ${questions.length} 个热门问题`);
        return questions;
    }

    /**
     * 获取服务状态
     */
    getServiceStatus() {
        const status = {
            service: 'QAService',
            active_sessions: this.conversationHistory.size,
            total_messages: Array.from(this.conversationHistory.values())
                .reduce((total, history) => total + history.length, 0),
            timestamp: new Date().toISOString(),
            version: '1.1.0', // 版本更新
            features: ['vector_search', 'category_search', 'enhanced_hybrid_search']
        };
        console.log('📊 服务状态:', status);
        return status;
    }

    /**
     * 测试问答功能 - 增强版本
     */
    async testQA(question = "LNG动力船舶减排技术") {
        try {
            console.log('🧪 测试问答功能...');
            const result = await this.askQuestion(question);
            
            console.log('📋 测试结果:');
            console.log(`   成功: ${result.success}`);
            console.log(`   回答长度: ${result.answer.length}`);
            console.log(`   相关新闻: ${result.sources.length} 条`);
            console.log(`   搜索策略: ${result.searchStrategy.recommendedStrategies.join(', ')}`);
            console.log(`   检索类型: ${result.retrievalType}`);
            
            if (result.sources.length > 0) {
                console.log('   新闻详情:');
                result.sources.forEach((source, index) => {
                    console.log(`     ${index + 1}. news_id: ${source.news_id}`);
                    console.log(`         位置: ${source.locations ? source.locations.join(', ') : '无'}`);
                    console.log(`         搜索类型: ${source.search_type}`);
                    console.log(`         主题分类: ${source.theme_categories ? source.theme_categories.join(', ') : '无'}`);
                    console.log(`         分数: ${source.score.toFixed(3)}`);
                });
            }
            
            return result;
        } catch (error) {
            console.error('测试问答失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 比较搜索策略效果
     */
    async compareSearchStrategies(question = "LNG动力船舶减排技术") {
        try {
            console.log('🔬 比较搜索策略效果...');
            
            const [vectorResults, categoryResults, hybridResults] = await Promise.all([
                retriever.hybridSearch(question, {}),
                require('./category-retriever').searchByCategories(question, {}),
                enhancedRetriever.enhancedHybridSearch(question, {})
            ]);
            
            const comparison = {
                question: question,
                vector_search: {
                    count: vectorResults.length,
                    top_scores: vectorResults.slice(0, 3).map(r => ({
                        title: r.payload.title,
                        score: r.score.toFixed(3)
                    }))
                },
                category_search: {
                    count: categoryResults.length,
                    top_scores: categoryResults.slice(0, 3).map(r => ({
                        title: r.payload.title,
                        score: r.score.toFixed(3),
                        category_match: r.categoryMatch
                    }))
                },
                enhanced_hybrid_search: {
                    count: hybridResults.length,
                    top_scores: hybridResults.slice(0, 3).map(r => ({
                        title: r.payload.title,
                        score: r.score.toFixed(3),
                        search_type: r.searchType,
                        category_match: r.categoryMatch
                    }))
                }
            };
            
            console.log('📊 策略比较结果:', comparison);
            return comparison;
            
        } catch (error) {
            console.error('策略比较失败:', error);
            return { error: error.message };
        }
    }
}

module.exports = new QAService();