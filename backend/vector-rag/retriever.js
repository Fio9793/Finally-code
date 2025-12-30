// backend/vector-rag/retriever.js
const embeddingService = require('../services/embedding-service');
const qdrantConfig = require('../config/qdrant-config');

class SemanticRetriever {
    constructor() {
        this.topK = 10; // 增加检索数量
    }

    /**
     * 语义搜索
     */
    async search(query, filters = {}) {
        try {
            console.log(`🔍 执行语义搜索: "${query}"`);
            const queryVector = await embeddingService.generateEmbeddings(query);
            const filter = this.buildFilter(filters);
            
            console.log('📊 检索参数:', {
                topK: this.topK,
                filters: filter,
                score_threshold: 0.2
            });

            const searchResult = await qdrantConfig.client.search(qdrantConfig.collectionName, {
                vector: queryVector,
                filter: filter,
                limit: this.topK,
                with_payload: true,
                with_vector: false,
                score_threshold: 0.2 // 降低相似度阈值
            });

            console.log(`✅ 找到 ${searchResult.length} 个相关结果`);
            
            // 修复：确保返回格式包含所有必要字段
            const formattedResults = searchResult.map(result => {
                const payload = result.payload || {};
                return {
                    id: result.id,
                    score: result.score,
                    payload: {
                        news_id: payload.news_id,
                        title: payload.title,
                        content: payload.content,
                        theme: payload.theme,
                        locations: payload.locations || [],
                        publish_time: payload.publish_time,
                        executor: payload.executor,
                        keywords: payload.keywords || [],
                        source_url: payload.source_url,
                        pollution_source: payload.pollution_source,
                        measure: payload.measure,
                        effect_data: payload.effect_data
                    }
                };
            });

            // 调试：显示前3个结果的分数和标题
            if (formattedResults.length > 0) {
                console.log('📋 检索结果示例:');
                formattedResults.slice(0, 3).forEach((result, index) => {
                    console.log(`   ${index + 1}. 分数: ${result.score.toFixed(3)}`);
                    console.log(`      news_id: ${result.payload.news_id}`);
                    console.log(`      标题: ${result.payload.title}`);
                    console.log(`      位置: ${result.payload.locations ? result.payload.locations.join(', ') : '无'}`);
                });
            }

            return formattedResults;
        } catch (error) {
            console.error('❌ 语义检索失败:', error);
            return [];
        }
    }

    /**
     * 构建过滤器
     */
    buildFilter(filters) {
        const conditions = [];
        
        if (filters.timeRange) {
            const [start, end] = filters.timeRange;
            conditions.push({
                key: 'publish_time', 
                range: { gte: start, lte: end }
            });
        }
        
        if (filters.locations && filters.locations.length > 0) {
            conditions.push({
                key: 'locations', 
                match: { any: filters.locations }
            });
        }
        
        if (filters.themes && filters.themes.length > 0) {
            conditions.push({
                key: 'theme', 
                match: { any: filters.themes }
            });
        }
        
        return conditions.length > 0 ? { must: conditions } : undefined;
    }

    /**
     * 混合搜索 - 结合多种策略
     */
    async hybridSearch(query, filters = {}) {
        try {
            console.log(`🎯 执行混合搜索: "${query}"`);
            
            // 尝试多种搜索策略
            const strategies = [
                this.search(query, filters), // 原始查询
                this.search(this.expandQuery(query), filters), // 扩展查询
            ];

            const results = await Promise.all(strategies);
            const allResults = results.flat();

            // 去重并排序
            const uniqueResults = this.deduplicateResults(allResults);
            
            console.log(`✅ 混合搜索完成，返回 ${uniqueResults.length} 个去重结果`);
            
            return uniqueResults.slice(0, this.topK);
        } catch (error) {
            console.error('❌ 混合搜索失败:', error);
            return this.search(query, filters); // 降级到基础搜索
        }
    }

    /**
     * 扩展查询词
     */
    expandQuery(query) {
        const queryExpansions = {
            '海洋保护': '海洋环境保护 生态保护 海洋保护区 生物多样性',
            '污染事件': '污染事故 泄漏事件 环境事故 油污泄漏',
            '减排': '碳排放 温室气体 二氧化碳 减排技术 碳中和',
            'LNG': '液化天然气 清洁燃料 天然气动力 替代燃料',
            '技术': '技术创新 科技 研发 新技术 智能化',
            '政策': '法规 标准 合规 监管 国际公约',
            '航运': '海运 船舶 船只 海事 航海',
            '生态': '生态系统 生物 珊瑚礁 海洋生物'
        };

        let expandedQuery = query;
        Object.keys(queryExpansions).forEach(key => {
            if (query.includes(key)) {
                expandedQuery += ' ' + queryExpansions[key];
            }
        });

        console.log(`🔍 查询扩展: "${query}" -> "${expandedQuery}"`);
        return expandedQuery;
    }

    /**
     * 结果去重
     */
    deduplicateResults(results) {
        const seen = new Set();
        return results.filter(result => {
            const key = result.payload.news_id;
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        }).sort((a, b) => b.score - a.score);
    }

    /**
     * 获取搜索建议
     */
    async getSearchSuggestions(query) {
        try {
            // 基于查询内容提供更相关的建议
            const suggestionsMap = {
                '保护': ['海洋生态保护措施', '海洋保护区建设', '生物多样性保护', '珊瑚礁保护'],
                '污染': ['海洋污染治理', '油污泄漏处理', '塑料污染防治', '化学污染'],
                'LNG': ['LNG动力船舶', '清洁能源应用', '天然气燃料技术', '替代燃料'],
                '技术': ['绿色航运技术', '减排技术创新', '智能船舶发展', '数字化航运'],
                '政策': ['国际航运政策', '环保法规更新', '碳排放标准', 'IMO法规'],
                '航运': ['绿色航运', '船舶能效', '航线优化', '港口环保'],
                '生态': ['海洋生态系统', '生物多样性', '栖息地保护', '物种保护']
            };

            let suggestions = [
                '海洋污染治理措施', 
                'LNG动力船舶发展', 
                '碳排放标准',
                '海洋生态保护', 
                '绿色航运技术', 
                '油轮泄漏事故',
                '清洁能源应用',
                '船舶排放控制'
            ];

            // 根据查询内容添加相关建议
            Object.keys(suggestionsMap).forEach(key => {
                if (query.includes(key)) {
                    suggestions = [...suggestions, ...suggestionsMap[key]];
                }
            });

            return [...new Set(suggestions)].slice(0, 6);
        } catch (error) {
            console.error('获取搜索建议失败:', error);
            return [
                '海洋污染治理',
                'LNG动力船舶', 
                '碳排放政策',
                '生态保护措施'
            ];
        }
    }

    /**
     * 测试搜索功能
     */
    async testSearch(query = "海洋生态保护") {
        try {
            console.log('🧪 测试搜索功能...');
            const results = await this.search(query);
            
            console.log(`📊 测试结果: ${results.length} 条记录`);
            results.forEach((result, index) => {
                console.log(`   ${index + 1}. 分数: ${result.score.toFixed(3)}`);
                console.log(`      news_id: ${result.payload.news_id}`);
                console.log(`      标题: ${result.payload.title}`);
                console.log(`      位置: ${result.payload.locations ? result.payload.locations.join(', ') : '无'}`);
            });
            
            return results;
        } catch (error) {
            console.error('测试搜索失败:', error);
            return [];
        }
    }
}

module.exports = new SemanticRetriever();