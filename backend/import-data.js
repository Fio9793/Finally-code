console.log('🚀 开始执行完整数据导入脚本...');
const neo4j = require('neo4j-driver');
const fs = require('fs');
const path = require('path');

// 增强的数据标准化函数 - 包含新增分类字段处理
function normalizeData(news) {
    console.log(`🔧 标准化数据: ${news.title ? news.title.substring(0, 50) + '...' : '无标题'}`);
    
    // 创建标准化副本，保留所有原始字段
    const normalized = { ...news };
    
    // 处理 id - 确保每个记录都有唯一ID
    if (!normalized.id) {
        normalized.id = `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // 标准化字符串字段
    const stringFields = [
        'title', 'theme', 'location', 'pollution_source', 'measure', 
        'executor', 'effect_data', 'source_url', 'publish_time'
    ];
    
    stringFields.forEach(field => {
        if (normalized[field] && typeof normalized[field] !== 'string') {
            normalized[field] = String(normalized[field]);
        } else if (!normalized[field]) {
            normalized[field] = '';
        }
        // 清理字符串两端的空格
        normalized[field] = normalized[field].trim();
    });
    
    // 处理 measure 字段（确保是字符串）
    if (Array.isArray(normalized.measure)) {
        normalized.measure = normalized.measure.join(', ');
    }
    
    // 处理 keywords 字段（确保是数组）
    if (typeof normalized.keywords === 'string') {
        // 尝试解析字符串形式的数组，或者按逗号分割
        try {
            normalized.keywords = JSON.parse(normalized.keywords);
        } catch {
            normalized.keywords = normalized.keywords.split(',').map(k => k.trim()).filter(k => k);
        }
    } else if (!Array.isArray(normalized.keywords)) {
        // 如果既不是字符串也不是数组，设为空数组
        normalized.keywords = [];
    }
    
    // 处理 locations 字段
    if (typeof normalized.location === 'string') {
        normalized.locations = [normalized.location];
    } else if (Array.isArray(normalized.location)) {
        normalized.locations = normalized.location;
    } else if (normalized.locations && typeof normalized.locations === 'string') {
        try {
            normalized.locations = JSON.parse(normalized.locations);
        } catch {
            normalized.locations = [normalized.locations];
        }
    } else if (!normalized.locations || !Array.isArray(normalized.locations)) {
        normalized.locations = [];
    }
    
    // 清理数组中的空值
    normalized.keywords = normalized.keywords.filter(k => k && k.trim());
    normalized.locations = normalized.locations.filter(l => l && l.trim());

    // 处理新增的分类字段
    const categoryFields = [
        'theme_categories',
        'location_categories', 
        'pollution_categories'
    ];
    
    categoryFields.forEach(field => {
        // 初始化字段（避免undefined）
        if (!normalized[field]) {
            normalized[field] = [];
        }
        // 处理字符串形式的数组
        if (typeof normalized[field] === 'string') {
            try {
                normalized[field] = JSON.parse(normalized[field]);
            } catch {
                normalized[field] = [normalized[field]];
            }
        } else if (!Array.isArray(normalized[field])) {
            normalized[field] = [];
        }
        // 清理空值
        normalized[field] = normalized[field].filter(item => item && item.trim());
    });
    
    // 处理 time_category
    if (typeof normalized.time_category !== 'string') {
        normalized.time_category = '';
    } else {
        normalized.time_category = normalized.time_category.trim();
    }
    
    console.log(`✅ 标准化完成 - 位置: ${normalized.locations.length}, 关键词: ${normalized.keywords.length}`);
    console.log(`   📊 分类统计 - 主题分类: ${normalized.theme_categories.length}, 位置分类: ${normalized.location_categories.length}, 污染分类: ${normalized.pollution_categories.length}`);
    if (normalized.keywords.length > 0) {
        console.log(`   📝 关键词示例: ${normalized.keywords.slice(0, 3).join(', ')}`);
    }
    
    return normalized;
}

// Neo4j 连接配置和等待函数
async function waitForNeo4j(retries = 12, delay = 5000) {
    for (let i = 0; i < retries; i++) {
        try {
            const session = driver.session();
            const result = await session.run('RETURN 1 as test');
            await session.close();
            console.log('✅ Neo4j 连接测试成功');
            return true;
        } catch (error) {
            console.log(`⏳ 等待 Neo4j 启动... (${i + 1}/${retries}) - ${error.message}`);
            if (i === retries - 1) {
                console.error('❌ 无法连接到 Neo4j，请检查：');
                console.error('   1. Neo4j 容器是否运行: docker ps');
                console.error('   2. 端口 7687 是否可用');
                console.error('   3. 密码是否正确');
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'ocean123'),
    {
        encrypted: false,
        trust: 'TRUST_ALL_CERTIFICATES',
        maxConnectionLifetime: 3 * 60 * 60 * 1000,
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 120000,
        disableLosslessIntegers: true
    }
);

// 创建所有必要的索引（包含新增分类索引）
async function createIndexes(session) {
    try {
        console.log('🔧 创建索引...');
        
        const indexes = [
            'CREATE INDEX news_id_index IF NOT EXISTS FOR (n:News) ON (n.id)',
            'CREATE INDEX news_title_index IF NOT EXISTS FOR (n:News) ON (n.title)',
            'CREATE INDEX news_publish_time_index IF NOT EXISTS FOR (n:News) ON (n.publish_time)',
            'CREATE INDEX location_name_index IF NOT EXISTS FOR (l:Location) ON (l.name)',
            'CREATE INDEX theme_name_index IF NOT EXISTS FOR (t:Theme) ON (t.name)',
            'CREATE INDEX entity_name_index IF NOT EXISTS FOR (e:Entity) ON (e.name)',
            'CREATE INDEX pollution_source_name_index IF NOT EXISTS FOR (p:PollutionSource) ON (p.name)',
            'CREATE INDEX measure_name_index IF NOT EXISTS FOR (m:Measure) ON (m.name)',
            'CREATE INDEX keyword_name_index IF NOT EXISTS FOR (k:Keyword) ON (k.name)',
            'CREATE INDEX effect_description_index IF NOT EXISTS FOR (e:Effect) ON (e.description)',
            // 新增分类索引
            'CREATE INDEX theme_category_name_index IF NOT EXISTS FOR (tc:ThemeCategory) ON (tc.name)',
            'CREATE INDEX location_category_name_index IF NOT EXISTS FOR (lc:LocationCategory) ON (lc.name)',
            'CREATE INDEX pollution_category_name_index IF NOT EXISTS FOR (pc:PollutionCategory) ON (pc.name)',
            'CREATE INDEX time_category_name_index IF NOT EXISTS FOR (tc:TimeCategory) ON (tc.name)'
        ];
        
        for (const indexQuery of indexes) {
            await session.run(indexQuery);
            console.log(`✅ 创建索引: ${indexQuery.split('IF NOT EXISTS')[0].trim()}...`);
        }
        
        console.log('🎯 所有索引创建完成');
    } catch (error) {
        console.error('❌ 创建索引时出错:', error);
    }
}

// 验证数据导入（包含新增分类验证）
async function verifyDataImport(session) {
    try {
        console.log('\n🔍 验证数据导入结果...');
        
        const verificationQueries = [
            { name: '新闻节点', query: 'MATCH (n:News) RETURN count(n) as count' },
            { name: '位置节点', query: 'MATCH (l:Location) RETURN count(l) as count' },
            { name: '主题节点', query: 'MATCH (t:Theme) RETURN count(t) as count' },
            { name: '执行方节点', query: 'MATCH (e:Entity) RETURN count(e) as count' },
            { name: '污染源节点', query: 'MATCH (p:PollutionSource) RETURN count(p) as count' },
            { name: '措施节点', query: 'MATCH (m:Measure) RETURN count(m) as count' },
            { name: '关键词节点', query: 'MATCH (k:Keyword) RETURN count(k) as count' },
            { name: '效果节点', query: 'MATCH (e:Effect) RETURN count(e) as count' },
            // 新增分类节点验证
            { name: '主题分类节点', query: 'MATCH (tc:ThemeCategory) RETURN count(tc) as count' },
            { name: '位置分类节点', query: 'MATCH (lc:LocationCategory) RETURN count(lc) as count' },
            { name: '污染分类节点', query: 'MATCH (pc:PollutionCategory) RETURN count(pc) as count' },
            { name: '时间分类节点', query: 'MATCH (tc:TimeCategory) RETURN count(tc) as count' },
            // 关系验证
            { name: '位置关系', query: 'MATCH ()-[r:LOCATED_IN]->() RETURN count(r) as count' },
            { name: '主题关系', query: 'MATCH ()-[r:HAS_THEME]->() RETURN count(r) as count' },
            { name: '执行方关系', query: 'MATCH ()-[r:EXECUTED_BY]->() RETURN count(r) as count' },
            { name: '污染源关系', query: 'MATCH ()-[r:RELATED_TO_POLLUTION]->() RETURN count(r) as count' },
            { name: '措施关系', query: 'MATCH ()-[r:IMPLEMENTS_MEASURE]->() RETURN count(r) as count' },
            { name: '关键词关系', query: 'MATCH ()-[r:ABOUT]->() RETURN count(r) as count' },
            { name: '效果关系', query: 'MATCH ()-[r:HAS_EFFECT]->() RETURN count(r) as count' },
            // 新增分类关系验证
            { name: '主题分类关系', query: 'MATCH ()-[r:HAS_THEME_CATEGORY]->() RETURN count(r) as count' },
            { name: '位置分类关系', query: 'MATCH ()-[r:HAS_LOCATION_CATEGORY]->() RETURN count(r) as count' },
            { name: '污染分类关系', query: 'MATCH ()-[r:HAS_POLLUTION_CATEGORY]->() RETURN count(r) as count' },
            { name: '时间分类关系', query: 'MATCH ()-[r:HAS_TIME_CATEGORY]->() RETURN count(r) as count' }
        ];
        
        for (const { name, query } of verificationQueries) {
            try {
                const result = await session.run(query);
                const countRecord = result.records[0].get('count');
                
                // 处理neo4j整数类型
                let count;
                if (countRecord && typeof countRecord.toNumber === 'function') {
                    count = countRecord.toNumber();
                } else if (typeof countRecord === 'number') {
                    count = countRecord;
                } else {
                    count = parseInt(countRecord) || 0;
                }
                
                console.log(`   📊 ${name}: ${count}`);
            } catch (error) {
                console.error(`   ❌ 查询 ${name} 失败:`, error.message);
            }
        }
        
    } catch (error) {
        console.error('❌ 验证数据时出错:', error);
    }
}

// 检查海事知识图谱数据
async function checkMaritimeKG(session) {
    try {
        console.log('\n🔍 检查海事知识图谱数据...');
        
        const maritimeQueries = [
            { name: '海事项目节点', query: 'MATCH (n:MaritimeProject) RETURN count(n) as count' },
            { name: '海事区域节点', query: 'MATCH (n:MaritimeRegion) RETURN count(n) as count' },
            { name: '海事污染源节点', query: 'MATCH (n:MaritimePollutionSource) RETURN count(n) as count' },
            { name: '海事措施节点', query: 'MATCH (n:MaritimeMeasure) RETURN count(n) as count' },
            { name: '海事组织节点', query: 'MATCH (n:MaritimeOrganization) RETURN count(n) as count' },
            { name: '海事效果节点', query: 'MATCH (n:MaritimeEffect) RETURN count(n) as count' },
            { name: '海事时间节点', query: 'MATCH (n:MaritimeTime) RETURN count(n) as count' }
        ];
        
        let hasMaritimeData = false;
        for (const { name, query } of maritimeQueries) {
            try {
                const result = await session.run(query);
                const countRecord = result.records[0].get('count');
                let count;
                
                if (countRecord && typeof countRecord.toNumber === 'function') {
                    count = countRecord.toNumber();
                } else if (typeof countRecord === 'number') {
                    count = countRecord;
                } else {
                    count = parseInt(countRecord) || 0;
                }
                
                console.log(`   📊 ${name}: ${count}`);
                if (count > 0) {
                    hasMaritimeData = true;
                }
            } catch (error) {
                console.log(`   ℹ️ ${name}: 查询失败（可能节点不存在）`);
            }
        }
        
        if (hasMaritimeData) {
            console.log('✅ 检测到海事知识图谱数据，将保留这些数据');
        } else {
            console.log('ℹ️ 未检测到海事知识图谱数据');
        }
        
        return hasMaritimeData;
    } catch (error) {
        console.error('❌ 检查海事知识图谱时出错:', error);
        return false;
    }
}

// 安全地清理新闻数据（不影响海事知识图谱）
async function safelyCleanNewsData(session) {
    try {
        console.log('🗑️ 安全清理新闻数据（保留海事知识图谱）...');
        
        // 只删除新闻相关的节点和关系（包含新增分类）
        const deleteQueries = [
            'MATCH (n:News) DETACH DELETE n',
            'MATCH (n:Location) WHERE NOT (n)<-[:LOCATED_IN]-() DETACH DELETE n',
            'MATCH (n:Theme) WHERE NOT (n)<-[:HAS_THEME]-() DETACH DELETE n',
            'MATCH (n:Entity) WHERE NOT (n)<-[:EXECUTED_BY]-() DETACH DELETE n',
            'MATCH (n:PollutionSource) WHERE NOT (n)<-[:RELATED_TO_POLLUTION]-() DETACH DELETE n',
            'MATCH (n:Measure) WHERE NOT (n)<-[:IMPLEMENTS_MEASURE]-() DETACH DELETE n',
            'MATCH (n:Keyword) WHERE NOT (n)<-[:ABOUT]-() DETACH DELETE n',
            'MATCH (n:Effect) WHERE NOT (n)<-[:HAS_EFFECT]-() DETACH DELETE n',
            // 新增分类节点清理
            'MATCH (n:ThemeCategory) WHERE NOT (n)<-[:HAS_THEME_CATEGORY]-() DETACH DELETE n',
            'MATCH (n:LocationCategory) WHERE NOT (n)<-[:HAS_LOCATION_CATEGORY]-() DETACH DELETE n',
            'MATCH (n:PollutionCategory) WHERE NOT (n)<-[:HAS_POLLUTION_CATEGORY]-() DETACH DELETE n',
            'MATCH (n:TimeCategory) WHERE NOT (n)<-[:HAS_TIME_CATEGORY]-() DETACH DELETE n'
        ];
        
        for (const query of deleteQueries) {
            try {
                const result = await session.run(query);
                console.log(`✅ 执行清理: ${query.split('WHERE')[0].trim()}...`);
            } catch (error) {
                console.warn(`⚠️ 清理时出现警告: ${error.message}`);
            }
        }
        
        console.log('✅ 新闻数据清理完成，海事知识图谱数据已保留');
        
    } catch (error) {
        console.error('❌ 清理新闻数据时出错:', error);
        throw error;
    }
}

// 主导入函数 - 包含新增分类字段处理
async function importJSONToNeo4j() {
    let session;
    
    try {
        console.log('🔌 等待数据库连接...');
        await waitForNeo4j();
        
        session = driver.session();
        
        // 检查是否存在海事知识图谱数据
        const hasMaritimeKG = await checkMaritimeKG(session);
        
        if (hasMaritimeKG) {
            console.log('🛡️ 检测到海事知识图谱，将采用安全清理模式');
            await safelyCleanNewsData(session);
        } else {
            console.log('🗑️ 清理现有数据...');
            await session.run('MATCH (n) DETACH DELETE n');
            console.log('✅ 现有数据清理完成');
        }
        
        console.log('🚀 开始导入JSON数据到Neo4j...');
        
        // 尝试多个可能的文件路径
        const possiblePaths = [
            path.join(__dirname, '../data/news_metadata.json'),
            path.join(__dirname, '../../data/news_metadata.json'),
            path.join(process.cwd(), 'data/news_metadata.json'),
            path.join(process.cwd(), '../data/news_metadata.json')
        ];
        
        let jsonPath = null;
        for (const testPath of possiblePaths) {
            if (fs.existsSync(testPath)) {
                jsonPath = testPath;
                console.log(`✅ 找到数据文件: ${jsonPath}`);
                break;
            }
        }
        
        if (!jsonPath) {
            console.error('❌ 在所有可能路径中都找不到 JSON 文件');
            console.log('当前工作目录:', process.cwd());
            console.log('__dirname:', __dirname);
            process.exit(1);
        }
        
        console.log(`📂 读取文件: ${jsonPath}`);
        
        const fileContent = fs.readFileSync(jsonPath, 'utf8');
        console.log(`📄 文件大小: ${(fileContent.length / 1024).toFixed(2)} KB`);
        
        const jsonData = JSON.parse(fileContent);
        console.log(`✅ 读取到 ${jsonData.length} 条记录`);
        
        // 显示数据结构
        if (jsonData.length > 0) {
            console.log('\n📋 第一条数据字段结构:');
            Object.keys(jsonData[0]).forEach(key => {
                const value = jsonData[0][key];
                console.log(`   ${key}: ${typeof value} - ${Array.isArray(value) ? `[${value.length} items]` : JSON.stringify(value).substring(0, 100)}`);
            });
        }
        
        let successCount = 0;
        let errorCount = 0;
        
        // 分批处理
        const batchSize = 10;
        for (let i = 0; i < jsonData.length; i += batchSize) {
            const batch = jsonData.slice(i, i + batchSize);
            const batchSession = driver.session();
            
            try {
                for (const [index, news] of batch.entries()) {
                    const globalIndex = i + index;
                    try {
                        console.log(`\n--- 处理第 ${globalIndex + 1}/${jsonData.length} 条记录 ---`);
                        
                        // 数据标准化
                        const normalizedNews = normalizeData({...news});
                        const newsId = normalizedNews.id;
                        
                        console.log(`📰 新闻: ${normalizedNews.title.substring(0, 80)}...`);
                        
                        // 1. 创建主新闻节点（包含所有新增字段）
                        await batchSession.run(`
                            CREATE (news:News {
                                id: $id,
                                title: $title,
                                theme: $theme,
                                pollution_source: $pollution_source,
                                measure: $measure,
                                executor: $executor,
                                effect_data: $effect_data,
                                source_url: $source_url,
                                publish_time: $publish_time,
                                raw_location: $raw_location,
                                keywords: $keywords,
                                theme_categories: $theme_categories,
                                location_categories: $location_categories,
                                pollution_categories: $pollution_categories,
                                time_category: $time_category,
                                original_data: $original_data
                            })
                        `, {
                            id: newsId,
                            title: normalizedNews.title,
                            theme: normalizedNews.theme,
                            pollution_source: normalizedNews.pollution_source,
                            measure: normalizedNews.measure,
                            executor: normalizedNews.executor,
                            effect_data: normalizedNews.effect_data,
                            source_url: normalizedNews.source_url,
                            publish_time: normalizedNews.publish_time,
                            raw_location: normalizedNews.location,
                            keywords: normalizedNews.keywords,
                            // 新增分类字段
                            theme_categories: normalizedNews.theme_categories,
                            location_categories: normalizedNews.location_categories,
                            pollution_categories: normalizedNews.pollution_categories,
                            time_category: normalizedNews.time_category,
                            original_data: JSON.stringify(news)
                        });
                        
                        // 2. 创建位置节点和关系
                        console.log(`   📍 创建 ${normalizedNews.locations.length} 个位置`);
                        for (const location of normalizedNews.locations) {
                            if (location && location.trim()) {
                                await batchSession.run(`
                                    MERGE (location:Location {name: $name})
                                    ON CREATE SET location.created_at = timestamp()
                                    WITH location
                                    MATCH (news:News {id: $id})
                                    MERGE (news)-[r:LOCATED_IN]->(location)
                                `, {
                                    name: location.trim(),
                                    id: newsId
                                });
                            }
                        }
                        
                        // 3. 创建主题节点和关系
                        if (normalizedNews.theme && normalizedNews.theme.trim()) {
                            console.log(`   🎯 创建主题: ${normalizedNews.theme.substring(0, 50)}...`);
                            await batchSession.run(`
                                MERGE (theme:Theme {name: $name})
                                ON CREATE SET theme.created_at = timestamp()
                                WITH theme
                                MATCH (news:News {id: $id})
                                MERGE (news)-[r:HAS_THEME]->(theme)
                            `, {
                                name: normalizedNews.theme.trim(),
                                id: newsId
                            });
                        }

                        // 4. 创建主题分类节点和关系
                        console.log(`   🎯 创建 ${normalizedNews.theme_categories.length} 个主题分类`);
                        for (const category of normalizedNews.theme_categories) {
                            if (category && category.trim()) {
                                await batchSession.run(`
                                    MERGE (category:ThemeCategory {name: $name})
                                    ON CREATE SET category.created_at = timestamp()
                                    WITH category
                                    MATCH (news:News {id: $id})
                                    MERGE (news)-[r:HAS_THEME_CATEGORY]->(category)
                                `, {
                                    name: category.trim(),
                                    id: newsId
                                });
                            }
                        }
                        
                        // 5. 创建位置分类节点和关系
                        console.log(`   🌍 创建 ${normalizedNews.location_categories.length} 个位置分类`);
                        for (const category of normalizedNews.location_categories) {
                            if (category && category.trim()) {
                                await batchSession.run(`
                                    MERGE (category:LocationCategory {name: $name})
                                    ON CREATE SET category.created_at = timestamp()
                                    WITH category
                                    MATCH (news:News {id: $id})
                                    MERGE (news)-[r:HAS_LOCATION_CATEGORY]->(category)
                                `, {
                                    name: category.trim(),
                                    id: newsId
                                });
                            }
                        }
                        
                        // 6. 创建污染分类节点和关系
                        console.log(`   ⚠️ 创建 ${normalizedNews.pollution_categories.length} 个污染分类`);
                        for (const category of normalizedNews.pollution_categories) {
                            if (category && category.trim()) {
                                await batchSession.run(`
                                    MERGE (category:PollutionCategory {name: $name})
                                    ON CREATE SET category.created_at = timestamp()
                                    WITH category
                                    MATCH (news:News {id: $id})
                                    MERGE (news)-[r:HAS_POLLUTION_CATEGORY]->(category)
                                `, {
                                    name: category.trim(),
                                    id: newsId
                                });
                            }
                        }
                        
                        // 7. 创建时间分类节点和关系
                        if (normalizedNews.time_category && normalizedNews.time_category.trim()) {
                            console.log(`   ⏰ 创建时间分类: ${normalizedNews.time_category}`);
                            await batchSession.run(`
                                MERGE (category:TimeCategory {name: $name})
                                ON CREATE SET category.created_at = timestamp()
                                WITH category
                                MATCH (news:News {id: $id})
                                MERGE (news)-[r:HAS_TIME_CATEGORY]->(category)
                            `, {
                                name: normalizedNews.time_category.trim(),
                                id: newsId
                            });
                        }
                        
                        // 8. 创建执行方节点和关系
                        if (normalizedNews.executor && normalizedNews.executor.trim()) {
                            console.log(`   👥 处理执行方`);
                            const executors = normalizedNews.executor.split(',').map(e => e.trim()).filter(e => e);
                            for (const executor of executors) {
                                if (executor) {
                                    await batchSession.run(`
                                        MERGE (entity:Entity {name: $name, type: 'executor'})
                                        ON CREATE SET entity.created_at = timestamp()
                                        WITH entity
                                        MATCH (news:News {id: $id})
                                        MERGE (news)-[r:EXECUTED_BY]->(entity)
                                    `, {
                                        name: executor,
                                        id: newsId
                                    });
                                }
                            }
                        }
                        
                        // 9. 创建污染源节点和关系
                        if (normalizedNews.pollution_source && normalizedNews.pollution_source.trim()) {
                            console.log(`   🏭 创建污染源: ${normalizedNews.pollution_source.substring(0, 50)}...`);
                            await batchSession.run(`
                                MERGE (pollution:PollutionSource {name: $name})
                                ON CREATE SET pollution.created_at = timestamp()
                                WITH pollution
                                MATCH (news:News {id: $id})
                                MERGE (news)-[r:RELATED_TO_POLLUTION]->(pollution)
                            `, {
                                name: normalizedNews.pollution_source.trim(),
                                id: newsId
                            });
                        }
                        
                        // 10. 创建措施节点和关系
                        if (normalizedNews.measure && normalizedNews.measure.trim()) {
                            console.log(`   ⚙️ 处理措施`);
                            const measures = normalizedNews.measure.split(',').map(m => m.trim()).filter(m => m);
                            for (const measure of measures) {
                                if (measure) {
                                    await batchSession.run(`
                                        MERGE (measure:Measure {name: $name})
                                        ON CREATE SET measure.created_at = timestamp()
                                        WITH measure
                                        MATCH (news:News {id: $id})
                                        MERGE (news)-[r:IMPLEMENTS_MEASURE]->(measure)
                                    `, {
                                        name: measure,
                                        id: newsId
                                    });
                                }
                            }
                        }
                        
                        // 11. 创建关键词节点和关系
                        console.log(`   🔑 创建 ${normalizedNews.keywords.length} 个关键词`);
                        for (const keyword of normalizedNews.keywords) {
                            if (keyword && keyword.trim()) {
                                await batchSession.run(`
                                    MERGE (keyword:Keyword {name: $name})
                                    ON CREATE SET keyword.created_at = timestamp()
                                    WITH keyword
                                    MATCH (news:News {id: $id})
                                    MERGE (news)-[r:ABOUT]->(keyword)
                                `, {
                                    name: keyword.trim(),
                                    id: newsId
                                });
                            }
                        }
                        
                        // 12. 创建效果数据节点和关系
                        if (normalizedNews.effect_data && normalizedNews.effect_data.trim()) {
                            console.log(`   📈 创建效果数据`);
                            await batchSession.run(`
                                MERGE (effect:Effect {description: $description})
                                ON CREATE SET effect.created_at = timestamp()
                                WITH effect
                                MATCH (news:News {id: $id})
                                MERGE (news)-[r:HAS_EFFECT]->(effect)
                            `, {
                                description: normalizedNews.effect_data.trim(),
                                id: newsId
                            });
                        }
                        
                        successCount++;
                        console.log(`✅ 第 ${globalIndex + 1} 条记录导入成功`);
                        
                    } catch (error) {
                        errorCount++;
                        console.error(`❌ 处理第 ${globalIndex + 1} 条记录时出错:`, error.message);
                        console.error('问题数据:', JSON.stringify(news, null, 2));
                    }
                }
                
                console.log(`\n📊 批次完成: ${Math.min(i + batchSize, jsonData.length)}/${jsonData.length}`);
                
            } finally {
                await batchSession.close();
            }
        }
        
        console.log('\n🎉 数据导入完成！');
        console.log(`✅ 成功: ${successCount} 条`);
        console.log(`❌ 失败: ${errorCount} 条`);
        
        // 创建索引
        await createIndexes(session);
        
        // 验证数据导入
        await verifyDataImport(session);
        
        // 再次检查海事知识图谱数据是否完好
        if (hasMaritimeKG) {
            console.log('\n🔍 验证海事知识图谱数据完整性...');
            await checkMaritimeKG(session);
            console.log('✅ 海事知识图谱数据完好无损');
        }
        
        // 显示数据统计
        console.log('\n📈 数据导入统计:');
        console.log(`   新闻记录: ${successCount}/${jsonData.length}`);
        if (errorCount > 0) {
            console.log(`   失败记录: ${errorCount}`);
        }
        
    } catch (error) {
        console.error('💥 导入数据时发生严重错误:', error);
        throw error;
    } finally {
        if (session) {
            await session.close();
        }
        await driver.close();
    }
}

// 执行导入
importJSONToNeo4j().then(() => {
    console.log('\n🏁 所有操作完成！');
    console.log('💡 您可以在 Neo4j Browser 中使用以下查询查看数据:');
    console.log('   MATCH (n:News) RETURN n LIMIT 10');
    console.log('   MATCH (n:News)-[r]->(m) RETURN n, r, m LIMIT 25');
    console.log('   MATCH (n:MaritimeProject) RETURN n LIMIT 10');
    console.log('   MATCH (n:ThemeCategory) RETURN n LIMIT 10'); // 新增分类查询示例
    process.exit(0);
}).catch(error => {
    console.error('💥 导入失败:', error);
    process.exit(1);
});