const neo4j = require('neo4j-driver');

async function testNeo4jConnection(driver) {
    try {
        const session = driver.session();
        const result = await session.run('RETURN 1 as test');
        await session.close();
        return result.records.length > 0;
    } catch (error) {
        return false;
    }
}

async function importMaritimeKG() {
    let driver;
    try {
        driver = neo4j.driver(
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

        console.log('🔌 测试Neo4j连接...');
        const isConnected = await testNeo4jConnection(driver);
        if (!isConnected) {
            throw new Error('无法连接到Neo4j数据库，请检查服务是否运行');
        }
        console.log('✅ Neo4j连接成功');

        const MaritimeKnowledgeGraphBuilder = require('./maritime-kg-builder');
        
        const builder = new MaritimeKnowledgeGraphBuilder(
            'bolt://localhost:7687',
            'neo4j',
            'ocean123',
            { database: 'maritimekg' }
        );

        console.log('🛡️ 开始构建知识图谱（新闻数据将受到保护）...');
        
        const success = await builder.buildKnowledgeGraph();

        if (success) {
            console.log('🎉 海事知识图谱数据导入成功！');
            console.log('✅ 新闻数据已完整保留');
            return true;
        } else {
            console.error('❌ 海事知识图谱数据导入失败！');
            return false;
        }
    } catch (error) {
        console.error('💥 导入海事知识图谱数据时发生错误:', error.message);
        console.log('请检查:');
        console.log('  1. Neo4j服务是否正在运行');
        console.log('  2. 用户名和密码是否正确');
        console.log('  3. 数据库名称是否正确');
        return false;
    } finally {
        if (driver) {
            await driver.close();
        }
    }
}

// 运行海事知识图谱导入
if (require.main === module) {
    importMaritimeKG().then(success => {
        if (success) {
            console.log('🎯 海事知识图谱数据导入进程完成');
            process.exit(0);
        } else {
            console.error('💥 海事知识图谱数据导入失败');
            process.exit(1);
        }
    });
}

module.exports = importMaritimeKG;