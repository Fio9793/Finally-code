// backend/vector-rag/category-retriever.js
const embeddingService = require('../services/embedding-service');
const qdrantConfig = require('../config/qdrant-config');

class CategoryRetriever {
    constructor() {
        this.topK = 8;
        this.categoryWeights = {
            'theme_categories': 0.4,
            'pollution_categories': 0.3,
            'location_categories': 0.2,
            'time_category': 0.1
        };
    }

    /**
     * 基于分类标签的扩展搜索
     */
    async searchByCategories(query, filters = {}) {
        try {
            console.log(`🏷️ 执行分类标签搜索: "${query}"`);
            
            // 1. 提取查询中的分类关键词
            const categoryKeywords = await this.extractCategoryKeywords(query);
            console.log('🔍 提取的分类关键词:', categoryKeywords);
            
            if (Object.keys(categoryKeywords).length === 0) {
                console.log('⚠️ 未提取到分类关键词，使用基础向量搜索');
                return [];
            }
            
            // 2. 构建分类过滤器
            const categoryFilter = this.buildCategoryFilter(categoryKeywords, filters);
            
            // 3. 执行分类搜索
            const categoryResults = await this.executeCategorySearch(categoryFilter);
            
            // 4. 计算相关性分数并排序
            const scoredResults = this.scoreResultsByCategoryRelevance(categoryResults, categoryKeywords);
            
            console.log(`✅ 分类标签搜索完成，返回 ${scoredResults.length} 个相关结果`);
            return scoredResults;
            
        } catch (error) {
            console.error('❌ 分类标签搜索失败:', error);
            return [];
        }
    }

    /**
     * 从查询中提取分类关键词
     */
    async extractCategoryKeywords(query) {
        const keywords = {
            theme_categories: [],
            pollution_categories: [],
            location_categories: [],
            time_category: []
        };
        
        // 方法1: 基于预定义词典匹配
        this.matchByDictionary(query, keywords);
        
        // 方法2: 使用向量相似度匹配分类标签
        await this.matchByEmbeddingSimilarity(query, keywords);
        
        // 过滤空数组
        Object.keys(keywords).forEach(key => {
            if (keywords[key].length === 0) {
                delete keywords[key];
            }
        });
        
        return keywords;
    }

    /**
     * 基于词典匹配分类关键词
     */
    matchByDictionary(query, keywords) {
        const categoryDictionaries = this.loadCategoryDictionaries();
        
        Object.keys(categoryDictionaries).forEach(categoryType => {
            const dict = categoryDictionaries[categoryType];
            dict.forEach(term => {
                if (query.toLowerCase().includes(term.toLowerCase())) {
                    keywords[categoryType].push(term);
                }
            });
        });
        
        // 处理同义词和关联词
        this.expandWithSynonyms(query, keywords);
    }

    /**
     * 基于向量相似度匹配分类标签
     */
    async matchByEmbeddingSimilarity(query, keywords) {
        try {
            const queryVector = await embeddingService.generateEmbeddings(query);
            const allCategories = this.getAllCategoryTerms();
            
            // 计算查询与所有分类术语的相似度
            const similarities = [];
            
            for (const [categoryType, terms] of Object.entries(allCategories)) {
                for (const term of terms) {
                    const termVector = await embeddingService.generateEmbeddings(term);
                    const similarity = embeddingService.cosineSimilarity(queryVector, termVector);
                    
                    if (similarity > 0.6) { // 相似度阈值
                        similarities.push({
                            categoryType,
                            term,
                            similarity
                        });
                    }
                }
            }
            
            // 按相似度排序并取前3个
            similarities.sort((a, b) => b.similarity - a.similarity);
            similarities.slice(0, 3).forEach(item => {
                keywords[item.categoryType].push(item.term);
            });
            
        } catch (error) {
            console.warn('向量相似度匹配失败，使用词典匹配:', error.message);
        }
    }

    /**
     * 构建分类过滤器
     */
    buildCategoryFilter(categoryKeywords, existingFilters) {
        const conditions = [];
        
        // 添加分类条件
        Object.keys(categoryKeywords).forEach(categoryType => {
            if (categoryKeywords[categoryType].length > 0) {
                conditions.push({
                    key: categoryType,
                    match: { any: categoryKeywords[categoryType] }
                });
            }
        });
        
        // 合并现有过滤器
        if (existingFilters.timeRange) {
            const [start, end] = existingFilters.timeRange;
            conditions.push({
                key: 'publish_time', 
                range: { gte: start, lte: end }
            });
        }
        
        if (existingFilters.locations && existingFilters.locations.length > 0) {
            conditions.push({
                key: 'locations', 
                match: { any: existingFilters.locations }
            });
        }
        
        return conditions.length > 0 ? { should: conditions } : undefined;
    }

    /**
     * 执行分类搜索
     */
    async executeCategorySearch(filter) {
        try {
            // 使用一个通用的查询向量，或者使用分类关键词的合并向量
            const queryVector = await embeddingService.generateEmbeddings('marine ocean shipping environment');
            
            const searchResult = await qdrantConfig.client.search(qdrantConfig.collectionName, {
                vector: queryVector,
                filter: filter,
                limit: this.topK * 2, // 获取更多结果用于后续排序
                with_payload: true,
                with_vector: false,
                score_threshold: 0.1 // 较低阈值以获取更多相关结果
            });

            return searchResult.map(result => ({
                id: result.id,
                score: result.score,
                payload: result.payload
            }));
            
        } catch (error) {
            console.error('分类搜索执行失败:', error);
            return [];
        }
    }

    /**
     * 根据分类相关性对结果进行评分
     */
    scoreResultsByCategoryRelevance(results, categoryKeywords) {
        return results.map(result => {
            let categoryScore = 0;
            let matchedCategories = 0;
            
            // 计算分类匹配分数
            Object.keys(categoryKeywords).forEach(categoryType => {
                const resultCategories = result.payload[categoryType] || [];
                const queryCategories = categoryKeywords[categoryType];
                
                // 检查重叠
                const overlap = queryCategories.filter(cat => 
                    resultCategories.some(rc => rc.toLowerCase().includes(cat.toLowerCase()) ||
                                              cat.toLowerCase().includes(rc.toLowerCase()))
                ).length;
                
                if (overlap > 0) {
                    categoryScore += overlap * this.categoryWeights[categoryType];
                    matchedCategories++;
                }
            });
            
            // 综合分数 = 向量相似度分数 * 0.6 + 分类匹配分数 * 0.4
            const finalScore = (result.score * 0.6) + (categoryScore * 0.4);
            
            return {
                ...result,
                score: finalScore,
                categoryMatch: {
                    score: categoryScore,
                    matchedCategories: matchedCategories
                }
            };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, this.topK);
    }

    /**
     * 加载分类词典
     */
    loadCategoryDictionaries() {
        return {
            theme_categories: [
                'LNG-fueled vessel construction', 'Battery-hybrid system', 'Dual-fuel engine',
                'Carbon capture', 'Wind-assisted propulsion', 'Methanol-fueled vessel',
                'Hydrogen dual-fuel', 'Scrubber installation', 'Solar power system',
                'Biofuel adoption', 'Ammonia fuel technology', 'Oil spill response',
                'Ballast water treatment', 'Electric pilot boat', 'Zero-emission vessel'
            ],
            pollution_categories: [
                'Oil spills', 'Fuel combustion emissions', 'Ballast water invasive species',
                'Sulfur oxide emissions', 'Nitrogen oxide emissions', 'Methane emissions',
                'Plastic pollution', 'Greenhouse gas emissions', 'Chemical spills',
                'Sewage discharge', 'Noise pollution', 'Thermal pollution'
            ],
            location_categories: [
                'Arctic', 'Atlantic Ocean', 'Pacific Ocean', 'Baltic Sea', 'Mediterranean Sea',
                'North Sea', 'Caribbean Sea', 'Gulf of Mexico', 'Great Lakes', 'Coastal Areas',
                'European Union', 'North America', 'Asia', 'Global shipping routes'
            ],
            time_category: [
                '2023', '2024', '2025', 'Q1', 'Q2', 'Q3', 'Q4', 'Spring', 'Summer', 'Autumn', 'Winter'
            ]
        };
    }

    /**
     * 获取所有分类术语
     */
    getAllCategoryTerms() {
        const dictionaries = this.loadCategoryDictionaries();
        // 添加更多相关术语
        dictionaries.theme_categories.push(
            'emissions reduction', 'clean energy', 'environmental protection',
            'sustainable shipping', 'green technology', 'climate change'
        );
        
        dictionaries.pollution_categories.push(
            'environmental impact', 'pollution control', 'waste management',
            'emission control', 'environmental damage'
        );
        
        return dictionaries;
    }

    /**
     * 扩展同义词和关联词
     */
    expandWithSynonyms(query, keywords) {
        const synonymMap = {
            '污染': ['pollution', 'contamination', 'emission'],
            '减排': ['emission reduction', 'carbon reduction', 'decarbonization'],
            'LNG': ['liquefied natural gas', 'natural gas', 'clean fuel'],
            '技术': ['technology', 'innovation', 'system', 'solution'],
            '保护': ['protection', 'conservation', 'preservation'],
            '生态': ['ecology', 'ecosystem', 'environment'],
            '航运': ['shipping', 'maritime', 'navigation', 'vessel'],
            '能源': ['energy', 'fuel', 'power']
        };
        
        Object.keys(synonymMap).forEach(chineseTerm => {
            if (query.includes(chineseTerm)) {
                synonymMap[chineseTerm].forEach(englishTerm => {
                    // 根据术语类型添加到相应的分类
                    if (englishTerm.includes('emission') || englishTerm.includes('pollution')) {
                        keywords.pollution_categories.push(englishTerm);
                    } else if (englishTerm.includes('technology') || englishTerm.includes('system')) {
                        keywords.theme_categories.push(englishTerm);
                    } else if (englishTerm.includes('fuel') || englishTerm.includes('energy')) {
                        keywords.theme_categories.push(englishTerm);
                    }
                });
            }
        });
    }

    /**
     * 测试分类搜索
     */
    async testCategorySearch(query = "LNG动力船舶减排技术") {
        try {
            console.log('🧪 测试分类搜索功能...');
            const results = await this.searchByCategories(query);
            
            console.log(`📊 测试结果: ${results.length} 条记录`);
            results.forEach((result, index) => {
                console.log(`   ${index + 1}. 综合分数: ${result.score.toFixed(3)}`);
                console.log(`      分类匹配: ${result.categoryMatch.score.toFixed(3)} (${result.categoryMatch.matchedCategories}个分类)`);
                console.log(`      标题: ${result.payload.title}`);
                console.log(`      主题分类: ${result.payload.theme_categories?.join(', ') || '无'}`);
            });
            
            return results;
        } catch (error) {
            console.error('测试分类搜索失败:', error);
            return [];
        }
    }
}

module.exports = new CategoryRetriever();