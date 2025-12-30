// backend/scripts/rebuild-all-news.js
const neo4j = require('neo4j-driver');
const { QdrantClient } = require('@qdrant/js-client-rest');
const fs = require('fs');
const path = require('path');

class RebuildAllNews {
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
        
        // 使用新的集合名称
        this.collectionName = 'marine_news_complete';
        this.batchSize = 10; // 增加批次大小以提高效率
    }

    async rebuildAll() {
        try {
            console.log('🚀 开始重建所有新闻数据...\n');

            // 1. 检查服务状态
            console.log('🔌 检查服务状态...');
            await this.checkServices();

            // 2. 创建集合
            console.log('\n📦 创建 Qdrant 集合...');
            await this.createCollection();

            // 3. 获取所有新闻数据
            console.log('\n📡 获取所有新闻数据...');
            const newsData = await this.getAllNewsData();
            
            if (newsData.length === 0) {
                throw new Error('没有获取到新闻数据');
            }

            // 4. 重建向量索引
            console.log('\n🔧 重建向量索引...');
            await this.rebuildVectors(newsData);

            // 5. 更新配置文件
            console.log('\n⚙️ 更新配置文件...');
            await this.updateConfig();

            console.log('\n🎉 所有新闻重建完成！');
            return true;

        } catch (error) {
            console.error('\n❌ 重建失败:', error.message);
            return false;
        } finally {
            await this.neo4jDriver.close();
        }
    }

    async checkServices() {
        // 检查 Neo4j
        const session = this.neo4jDriver.session();
        try {
            const result = await session.run('MATCH (n:News) RETURN count(n) as count');
            const countRecord = result.records[0].get('count');
            let count;
            
            if (countRecord && typeof countRecord.toNumber === 'function') {
                count = countRecord.toNumber();
            } else {
                count = parseInt(countRecord) || 0;
            }
            
            console.log(`✅ Neo4j 正常，包含 ${count} 条新闻`);
        } finally {
            await session.close();
        }

        // 检查 Qdrant
        try {
            const collections = await this.qdrantClient.getCollections();
            console.log('✅ Qdrant 服务正常');
            console.log(`📊 现有集合: ${collections.collections.map(c => c.name).join(', ') || '无'}`);
        } catch (error) {
            throw new Error('Qdrant 服务不可用: ' + error.message);
        }
    }

    async createCollection() {
        try {
            // 先尝试删除可能存在的同名集合
            try {
                await this.qdrantClient.deleteCollection(this.collectionName);
                console.log('✅ 清理旧集合');
            } catch (error) {
                // 集合不存在，忽略错误
            }

            // 创建新集合
            await this.qdrantClient.createCollection(this.collectionName, {
                vectors: {
                    size: 384,
                    distance: 'Cosine'
                }
            });
            console.log(`✅ 集合 "${this.collectionName}" 创建成功`);
        } catch (error) {
            console.error('❌ 集合创建失败:', error);
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
            
            // 显示位置信息统计
            const withLocations = newsData.filter(item => 
                item.locations && item.locations.length > 0
            ).length;
            console.log(`📍 包含位置信息: ${withLocations}/${newsData.length}`);
            
            // 显示数据样本
            console.log('\n📋 数据样本:');
            newsData.slice(0, 3).forEach((item, index) => {
                console.log(`   ${index + 1}. 标题: ${item.title.substring(0, 40)}...`);
                console.log(`      位置: ${item.locations && item.locations.length > 0 ? item.locations.join(', ') : '无'}`);
            });
            
            return newsData;

        } finally {
            await session.close();
        }
    }

    async rebuildVectors(newsData) {
        const embeddingService = require('../services/embedding-service');
        
        let processed = 0;
        const total = newsData.length;
        let failedBatches = 0;

        console.log(`\n📊 开始处理 ${total} 条新闻数据，批次大小: ${this.batchSize}`);
        console.log(`⏰ 预计需要 ${Math.ceil(total / this.batchSize)} 个批次\n`);

        for (let i = 0; i < total; i += this.batchSize) {
            const batch = newsData.slice(i, i + this.batchSize);
            const batchNum = Math.floor(i/this.batchSize) + 1;
            const totalBatches = Math.ceil(total / this.batchSize);
            
            console.log(`🔄 处理批次 ${batchNum}/${totalBatches}: ${batch.length} 条新闻 (${i+1}-${Math.min(i+this.batchSize, total)})`);
            
            try {
                // 准备文本
                const texts = batch.map(item => this.prepareText(item));
                
                // 生成嵌入向量
                console.log(`  📍 生成嵌入向量...`);
                const embeddings = await embeddingService.generateEmbeddings(texts);

                // 准备点数据
                const points = batch.map((item, index) => ({
                    id: i + index + 1,
                    vector: embeddings[index],
                    payload: {
                        news_id: item.id,
                        title: item.title,
                        content: this.prepareText(item),
                        theme: item.theme,
                        locations: item.locations || [],
                        publish_time: item.publish_time,
                        executor: item.executor,
                        keywords: item.keywords || [],
                        source_url: item.source_url,
                        pollution_source: item.pollution_source,
                        measure: item.measure,
                        effect_data: item.effect_data
                    }
                }));

                // 上传到 Qdrant
                console.log(`  📤 上传到 Qdrant...`);
                await this.qdrantClient.upsert(this.collectionName, {
                    wait: true,
                    points: points
                });

                processed += batch.length;
                const progress = ((processed / total) * 100).toFixed(1);
                console.log(`✅ 批次 ${batchNum} 完成 (${processed}/${total}, ${progress}%)`);

                // 每10个批次显示一次进度总结
                if (batchNum % 10 === 0) {
                    console.log(`\n📈 进度总结: ${processed}/${total} (${progress}%)`);
                    if (failedBatches > 0) {
                        console.log(`⚠️  失败批次: ${failedBatches}`);
                    }
                }

                // 批次间短暂暂停，避免过载
                if (batchNum % 5 === 0) {
                    console.log('⏸️  短暂休息...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }

            } catch (error) {
                failedBatches++;
                console.error(`❌ 批次 ${batchNum} 失败:`, error.message);
                console.log(`⚠️  跳过该批次，继续处理下一批`);
                // 继续处理下一批
            }
        }

        console.log(`\n📊 处理完成: ${processed}/${total} 条数据`);
        if (failedBatches > 0) {
            console.log(`⚠️  失败批次: ${failedBatches}`);
        }
        
        // 最终验证
        await this.finalValidation();
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
        
        // 关键：确保位置信息被包含
        if (newsItem.locations && newsItem.locations.length > 0) {
            parts.push(`位置：${newsItem.locations.join('，')}`);
        }

        return parts.join('。');
    }

    async updateConfig() {
        try {
            const configPath = path.join(__dirname, '../config/qdrant-config.js');
            let content = fs.readFileSync(configPath, 'utf8');
            
            // 更新集合名称
            content = content.replace(
                /this\.collectionName = 'marine_news_vectors';/,
                `this.collectionName = '${this.collectionName}';`
            );
            
            fs.writeFileSync(configPath, content, 'utf8');
            console.log(`✅ 配置文件已更新，使用集合: ${this.collectionName}`);
        } catch (error) {
            console.warn('⚠️ 配置文件更新失败，需要手动更新:', error.message);
            console.log(`💡 请手动修改 config/qdrant-config.js 中的 collectionName 为: ${this.collectionName}`);
        }
    }

    async finalValidation() {
        try {
            console.log('\n🔍 最终验证...');
            
            const collectionInfo = await this.qdrantClient.getCollection(this.collectionName);
            console.log(`✅ 集合状态: ${collectionInfo.status}`);
            console.log(`✅ 向量数量: ${collectionInfo.points_count}`);
            
            // 测试搜索
            const testResults = await this.qdrantClient.search(this.collectionName, {
                vector: new Array(384).fill(0.1),
                limit: 3,
                with_payload: true
            });
            
            console.log(`\n📋 搜索测试结果:`);
            testResults.forEach((result, index) => {
                console.log(`   ${index + 1}. 标题: ${result.payload.title}`);
                console.log(`      位置: ${result.payload.locations ? result.payload.locations.join(', ') : '无'}`);
                console.log(`      分数: ${result.score.toFixed(3)}`);
            });

        } catch (error) {
            console.error('❌ 最终验证失败:', error.message);
        }
    }
}

// 运行重建
async function main() {
    const rebuilder = new RebuildAllNews();
    
    console.log('========================================');
    console.log('   全部新闻数据重建工具');
    console.log('========================================\n');
    
    console.log('⚠️  注意: 这将处理所有6756条新闻数据，可能需要较长时间');
    console.log('💡 建议确保网络连接稳定，耐心等待完成\n');
    
    // 确认操作
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const answer = await new Promise(resolve => {
        rl.question('是否继续？(y/N): ', resolve);
    });

    rl.close();

    if (answer.toLowerCase() !== 'y') {
        console.log('❌ 操作已取消');
        process.exit(0);
    }

    const startTime = Date.now();
    const success = await rebuilder.rebuildAll();
    
    const endTime = Date.now();
    const duration = Math.floor((endTime - startTime) / 1000 / 60);
    
    if (success) {
        console.log(`\n🎉 全部新闻重建成功完成！`);
        console.log(`⏱️  总耗时: ${duration} 分钟`);
        console.log('💡 现在可以测试问答助手的位置信息显示了。');
        
        console.log('\n📋 测试步骤:');
        console.log('   1. 启动后端服务: npm start');
        console.log('   2. 访问 http://localhost:3000');
        console.log('   3. 点击鲸鱼助手提问');
        console.log('   4. 检查右侧相关新闻的位置信息');
        
    } else {
        console.log(`\n❌ 重建失败！`);
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

module.exports = RebuildAllNews;