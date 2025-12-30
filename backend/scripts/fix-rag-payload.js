// backend/scripts/fix-all-rag-payload.js
const neo4j = require('neo4j-driver');
const { QdrantClient } = require('@qdrant/js-client-rest');

class RAGPayloadFixerAll {
    constructor() {
        this.neo4jDriver = neo4j.driver(
            'bolt://localhost:7687',
            neo4j.auth.basic('neo4j', 'ocean123'),
            { encrypted: false, trust: 'TRUST_ALL_CERTIFICATES' }
        );
        
        this.qdrantClient = new QdrantClient({
            url: 'http://localhost:6333',
            timeout: 60000
        });
        
        this.collectionName = 'marine_news_complete';
        this.batchSize = 10; // 增加批次大小提高效率
    }

    async fixAllPayloads() {
        try {
            console.log('🔧 开始修复所有RAG payload数据...\n');

            // 1. 检查集合状态
            console.log('📊 检查集合状态...');
            await this.checkCollection();

            // 2. 获取所有新闻数据
            console.log('\n📡 获取所有新闻数据...');
            const newsData = await this.getAllNewsData();
            
            if (newsData.length === 0) {
                throw new Error('没有获取到新闻数据');
            }

            // 3. 分批次修复所有payload
            console.log('\n🔄 修复所有payload数据...');
            await this.fixInBatches(newsData);

            console.log('\n🎉 所有RAG payload修复完成！');
            return true;

        } catch (error) {
            console.error('\n❌ 修复失败:', error.message);
            return false;
        } finally {
            await this.neo4jDriver.close();
        }
    }

    async checkCollection() {
        try {
            const collectionInfo = await this.qdrantClient.getCollection(this.collectionName);
            console.log(`✅ 集合状态: ${collectionInfo.status}`);
            console.log(`✅ 向量数量: ${collectionInfo.points_count}`);
            
        } catch (error) {
            console.error('❌ 集合检查失败:', error.message);
            throw error;
        }
    }

    async getAllNewsData() {
        const session = this.neo4jDriver.session();
        try {
            console.log('🔍 查询所有新闻数据...');
            
            const result = await session.run(`
                MATCH (n:News)
                RETURN 
                    n.id as id,
                    n.title as title,
                    n.theme as theme,
                    n.pollution_source as pollution_source,
                    n.measure as measure,
                    n.executor as executor,
                    n.effect_data as effect_data,
                    n.source_url as source_url,
                    n.publish_time as publish_time,
                    n.raw_location as location,
                    n.keywords as keywords
                ORDER BY n.publish_time DESC
            `);

            const newsData = result.records.map(record => {
                const news = {
                    id: record.get('id'),
                    title: record.get('title') || '无标题',
                    theme: record.get('theme') || '',
                    pollution_source: record.get('pollution_source') || '',
                    measure: record.get('measure') || '',
                    executor: record.get('executor') || '',
                    effect_data: record.get('effect_data') || '',
                    source_url: record.get('source_url') || '',
                    publish_time: record.get('publish_time') || '',
                    locations: [],
                    keywords: []
                };

                // 处理位置信息
                const location = record.get('location');
                if (location) {
                    if (Array.isArray(location)) {
                        news.locations = location.filter(loc => loc && loc.trim());
                    } else if (typeof location === 'string' && location.trim()) {
                        try {
                            const parsed = JSON.parse(location);
                            if (Array.isArray(parsed)) {
                                news.locations = parsed.filter(loc => loc && loc.trim());
                            } else {
                                news.locations = [location.trim()];
                            }
                        } catch {
                            if (location.includes(',')) {
                                news.locations = location.split(',')
                                    .map(loc => loc.trim())
                                    .filter(loc => loc);
                            } else {
                                news.locations = [location.trim()];
                            }
                        }
                    }
                }

                // 处理关键词
                const keywords = record.get('keywords');
                if (keywords) {
                    if (Array.isArray(keywords)) {
                        news.keywords = keywords.filter(kw => kw && kw.trim());
                    } else if (typeof keywords === 'string' && keywords.trim()) {
                        try {
                            const parsed = JSON.parse(keywords);
                            if (Array.isArray(parsed)) {
                                news.keywords = parsed.filter(kw => kw && kw.trim());
                            } else {
                                news.keywords = [keywords.trim()];
                            }
                        } catch {
                            if (keywords.includes(',')) {
                                news.keywords = keywords.split(',')
                                    .map(kw => kw.trim())
                                    .filter(kw => kw);
                            } else {
                                news.keywords = [keywords.trim()];
                            }
                        }
                    }
                }

                return news;
            });

            console.log(`✅ 获取 ${newsData.length} 条新闻数据`);
            
            // 显示统计信息
            const withLocations = newsData.filter(item => 
                item.locations && item.locations.length > 0
            ).length;
            console.log(`📍 包含位置信息: ${withLocations}/${newsData.length}`);
            
            return newsData;

        } finally {
            await session.close();
        }
    }

    async fixInBatches(newsData) {
        let fixedCount = 0;
        const total = newsData.length;
        let failedCount = 0;

        console.log(`\n🔄 开始修复 ${total} 条数据的payload...`);
        console.log(`⏰ 预计需要 ${Math.ceil(total / this.batchSize)} 个批次\n`);

        for (let i = 0; i < total; i += this.batchSize) {
            const batch = newsData.slice(i, i + this.batchSize);
            const batchNum = Math.floor(i / this.batchSize) + 1;
            const totalBatches = Math.ceil(total / this.batchSize);
            
            console.log(`🔄 处理批次 ${batchNum}/${totalBatches}: ${batch.length} 条新闻`);

            const batchPromises = batch.map(async (newsItem, index) => {
                try {
                    // 查找对应的向量点
                    const searchResults = await this.qdrantClient.search(this.collectionName, {
                        vector: new Array(384).fill(0.1),
                        limit: 5,
                        with_payload: true,
                        filter: {
                            should: [
                                {
                                    key: "title",
                                    match: {
                                        value: newsItem.title
                                    }
                                },
                                {
                                    key: "news_id", 
                                    match: {
                                        value: newsItem.id
                                    }
                                }
                            ]
                        }
                    });

                    if (searchResults.length > 0) {
                        const pointId = searchResults[0].id;
                        
                        await this.qdrantClient.setPayload(this.collectionName, {
                            payload: {
                                news_id: newsItem.id,
                                title: newsItem.title,
                                content: this.prepareText(newsItem),
                                theme: newsItem.theme,
                                locations: newsItem.locations || [],
                                publish_time: newsItem.publish_time,
                                executor: newsItem.executor,
                                keywords: newsItem.keywords || [],
                                source_url: newsItem.source_url,
                                pollution_source: newsItem.pollution_source,
                                measure: newsItem.measure,
                                effect_data: newsItem.effect_data
                            },
                            points: [pointId]
                        });

                        fixedCount++;
                        return { success: true, newsItem };
                    } else {
                        console.log(`   ⚠️ 未找到匹配的向量点: "${newsItem.title.substring(0, 40)}..."`);
                        failedCount++;
                        return { success: false, newsItem, error: '未找到匹配的向量点' };
                    }

                } catch (error) {
                    console.log(`   ❌ 修复失败: "${newsItem.title.substring(0, 40)}..." - ${error.message}`);
                    failedCount++;
                    return { success: false, newsItem, error: error.message };
                }
            });

            // 等待批次完成
            const results = await Promise.allSettled(batchPromises);
            
            const batchSuccess = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
            const batchFailed = results.filter(r => r.status === 'rejected' || !r.value?.success).length;

            console.log(`   ✅ 批次 ${batchNum} 完成: ${batchSuccess} 成功, ${batchFailed} 失败`);
            console.log(`   📊 总进度: ${fixedCount}/${total} (${((fixedCount / total) * 100).toFixed(1)}%)`);

            // 每10个批次显示一次详细统计
            if (batchNum % 10 === 0) {
                console.log(`\n📈 进度总结: ${fixedCount}/${total} (${((fixedCount / total) * 100).toFixed(1)}%)`);
                console.log(`   ✅ 成功: ${fixedCount}`);
                console.log(`   ❌ 失败: ${failedCount}`);
            }

            // 批次间短暂暂停，避免过载
            if (batchNum % 20 === 0) {
                console.log('⏸️  短暂休息...');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        console.log(`\n📊 修复完成统计:`);
        console.log(`   ✅ 成功修复: ${fixedCount} 条数据`);
        console.log(`   ❌ 修复失败: ${failedCount} 条数据`);
        console.log(`   📈 成功率: ${((fixedCount / total) * 100).toFixed(1)}%`);
    }

    prepareText(newsItem) {
        const parts = [];
        
        if (newsItem.title) parts.push(`标题：${newsItem.title}`);
        if (newsItem.theme) parts.push(`主题：${newsItem.theme}`);
        if (newsItem.executor) parts.push(`执行方：${newsItem.executor}`);
        if (newsItem.pollution_source) parts.push(`污染源：${newsItem.pollution_source}`);
        if (newsItem.measure) parts.push(`措施：${newsItem.measure}`);
        if (newsItem.effect_data) parts.push(`效果：${newsItem.effect_data}`);
        if (newsItem.keywords && newsItem.keywords.length > 0) {
            parts.push(`关键词：${newsItem.keywords.join('，')}`);
        }
        
        if (newsItem.locations && newsItem.locations.length > 0) {
            parts.push(`位置：${newsItem.locations.join('，')}`);
        }

        return parts.join('。');
    }

    async comprehensiveTest() {
        try {
            console.log('\n🧪 进行全面测试...');
            
            // 测试1: 随机抽样测试
            console.log('   📋 随机抽样测试...');
            const randomResults = await this.qdrantClient.search(this.collectionName, {
                vector: new Array(384).fill(0.1),
                limit: 20,
                with_payload: true
            });

            let validCount = 0;
            console.log('\n   📊 随机抽样结果:');
            randomResults.forEach((result, index) => {
                const isValid = result.payload.news_id !== undefined && 
                               result.payload.news_id !== null &&
                               result.payload.title !== undefined;
                
                if (isValid) validCount++;
                
                console.log(`     ${index + 1}. ID: ${result.id}`);
                console.log(`        news_id: ${result.payload.news_id}`);
                console.log(`        title: ${result.payload.title}`);
                console.log(`        locations: ${result.payload.locations ? result.payload.locations.join(', ') : '无'}`);
                console.log(`        valid: ${isValid ? '✅' : '❌'}`);
                console.log('');
            });

            // 测试2: 搜索特定位置测试
            console.log('   📍 位置信息搜索测试...');
            const locationResults = await this.qdrantClient.search(this.collectionName, {
                vector: new Array(384).fill(0.1),
                limit: 5,
                with_payload: true,
                filter: {
                    must: [
                        {
                            key: "locations",
                            match: {
                                any: ["United States", "China", "Europe"]
                            }
                        }
                    ]
                }
            });

            console.log(`   📍 找到 ${locationResults.length} 条包含位置信息的结果`);

            // 测试3: 验证数据完整性
            const collectionInfo = await this.qdrantClient.getCollection(this.collectionName);
            console.log(`   📈 最终集合状态: ${collectionInfo.points_count} 个向量点`);

            const successRate = (validCount / 20) * 100;
            console.log(`\n   🎯 测试结果: ${successRate.toFixed(1)}% 的样本数据有效`);

            return successRate > 90; // 90%以上的样本有效就算成功

        } catch (error) {
            console.error('❌ 全面测试失败:', error.message);
            return false;
        }
    }
}

// 运行修复
async function main() {
    const fixer = new RAGPayloadFixerAll();
    
    console.log('========================================');
    console.log('   全部RAG Payload修复工具');
    console.log('========================================\n');
    
    console.log('⚠️  注意: 这将修复所有6756条新闻数据的payload');
    console.log('⏰ 预计需要较长时间，请耐心等待...\n');
    
    const startTime = Date.now();
    const success = await fixer.fixAllPayloads();
    
    const endTime = Date.now();
    const duration = Math.floor((endTime - startTime) / 1000 / 60);
    
    if (success) {
        console.log('\n🧪 进行最终全面测试...');
        const testSuccess = await fixer.comprehensiveTest();
        
        if (testSuccess) {
            console.log(`\n🎉 所有RAG payload修复成功完成！`);
            console.log(`⏱️  总耗时: ${duration} 分钟`);
            console.log('💡 现在RAG问答功能应该完全正常了。');
            
            console.log('\n📋 下一步:');
            console.log('   1. 重启后端服务: npm start');
            console.log('   2. 访问 http://localhost:3000');
            console.log('   3. 测试鲸鱼助手的位置信息显示');
            
        } else {
            console.log(`\n⚠️ 修复完成但测试未完全通过`);
            console.log(`⏱️  运行时间: ${duration} 分钟`);
            console.log('💡 大部分数据已修复，但可能有个别数据需要手动处理。');
        }
    } else {
        console.log(`\n❌ 修复失败！`);
        console.log(`⏱️  运行时间: ${duration} 分钟`);
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ 脚本执行失败:', error);
        process.exit(1);
    });
}

module.exports = RAGPayloadFixerAll;