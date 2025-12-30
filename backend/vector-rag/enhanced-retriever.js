// backend/vector-rag/enhanced-retriever.js
const semanticRetriever = require('./retriever');
const categoryRetriever = require('./category-retriever');

class EnhancedRetriever {
    constructor() {
        this.topK = 10;
    }

    /**
     * 增强的混合搜索 - 结合向量搜索和分类搜索
     */
    async enhancedHybridSearch(query, filters = {}) {
        try {
            console.log(`🎯 执行增强混合搜索: "${query}"`);
            
            // 并行执行两种搜索
            const [vectorResults, categoryResults] = await Promise.all([
                semanticRetriever.hybridSearch(query, filters),
                categoryRetriever.searchByCategories(query, filters)
            ]);
            
            console.log(`📊 搜索结果统计: 向量搜索 ${vectorResults.length} 条, 分类搜索 ${categoryResults.length} 条`);
            
            // 合并和去重结果
            const mergedResults = this.mergeAndRankResults(vectorResults, categoryResults);
            
            console.log(`✅ 增强混合搜索完成，返回 ${mergedResults.length} 个去重结果`);
            
            return mergedResults.slice(0, this.topK);
            
        } catch (error) {
            console.error('❌ 增强混合搜索失败:', error);
            // 降级到基础向量搜索
            return await semanticRetriever.hybridSearch(query, filters);
        }
    }

    /**
     * 合并和排序结果
     */
    mergeAndRankResults(vectorResults, categoryResults) {
        const resultMap = new Map();
        
        // 添加向量搜索结果
        vectorResults.forEach(result => {
            const key = result.payload.news_id;
            result.searchType = 'vector';
            resultMap.set(key, result);
        });
        
        // 合并分类搜索结果
        categoryResults.forEach(result => {
            const key = result.payload.news_id;
            if (resultMap.has(key)) {
                // 如果已存在，更新分数（取较高分）
                const existing = resultMap.get(key);
                existing.score = Math.max(existing.score, result.score);
                existing.searchType = 'both';
                if (result.categoryMatch) {
                    existing.categoryMatch = result.categoryMatch;
                }
            } else {
                result.searchType = 'category';
                resultMap.set(key, result);
            }
        });
        
        // 转换为数组并排序
        return Array.from(resultMap.values())
            .sort((a, b) => b.score - a.score);
    }

    /**
     * 获取搜索策略分析
     */
    getSearchStrategyAnalysis(query) {
        const analysis = {
            query: query,
            recommendedStrategies: [],
            confidence: 0.8
        };
        
        // 分析查询类型，推荐搜索策略
        if (this.containsTechnicalTerms(query)) {
            analysis.recommendedStrategies.push('category_search');
            analysis.confidence = 0.9;
        }
        
        if (this.containsGeographicTerms(query)) {
            analysis.recommendedStrategies.push('location_filter');
        }
        
        if (this.containsTemporalTerms(query)) {
            analysis.recommendedStrategies.push('time_filter');
        }
        
        if (analysis.recommendedStrategies.length === 0) {
            analysis.recommendedStrategies.push('vector_semantic_search');
        }
        
        return analysis;
    }

    containsTechnicalTerms(query) {
        const techTerms = ['LNG', '减排', '技术', '系统', '燃料', '发动机', '电池', '氢能'];
        return techTerms.some(term => query.includes(term));
    }

    containsGeographicTerms(query) {
        const geoTerms = ['太平洋', '大西洋', '北极', '欧洲', '亚洲', '美国', '中国'];
        return geoTerms.some(term => query.includes(term));
    }

    containsTemporalTerms(query) {
        const timeTerms = ['最近', '今年', '去年', '季度', '月份', '2023', '2024'];
        return timeTerms.some(term => query.includes(term));
    }

    /**
     * 获取搜索建议 - 增强版本
     */
    async getEnhancedSearchSuggestions(query) {
        const baseSuggestions = await semanticRetriever.getSearchSuggestions(query);
        
        // 基于分类分析添加专业建议
        const categoryAnalysis = this.getSearchStrategyAnalysis(query);
        
        if (categoryAnalysis.recommendedStrategies.includes('category_search')) {
            baseSuggestions.push(...[
                '查看相关技术分类',
                '搜索专业解决方案',
                '浏览类似技术案例'
            ]);
        }
        
        return [...new Set(baseSuggestions)].slice(0, 8);
    }
}

module.exports = new EnhancedRetriever();