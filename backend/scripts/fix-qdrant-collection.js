// backend/scripts/clean-qdrant-completely.js
const { execSync } = require('child_process');
const { QdrantClient } = require('@qdrant/js-client-rest');

class QdrantCompleteCleaner {
    constructor() {
        this.collectionName = 'marine_news_vectors';
    }

    async cleanCompletely() {
        try {
            console.log('🧹 开始彻底清理 Qdrant...\n');

            // 1. 检查 Docker 状态
            console.log('🔧 检查 Docker 状态...');
            await this.checkDocker();

            // 2. 停止并删除 Qdrant 容器
            console.log('\n🛑 停止 Qdrant 容器...');
            await this.stopQdrantContainer();

            // 3. 删除 Qdrant 数据目录
            console.log('\n🗑️ 删除 Qdrant 数据目录...');
            await this.deleteQdrantData();

            // 4. 重新启动 Qdrant
            console.log('\n🚀 重新启动 Qdrant...');
            await this.restartQdrant();

            // 5. 验证清理结果
            console.log('\n✅ 验证清理结果...');
            await this.validateCleanup();

            console.log('\n🎉 Qdrant 彻底清理完成！');
            return true;

        } catch (error) {
            console.error('\n❌ 清理失败:', error.message);
            return false;
        }
    }

    async checkDocker() {
        try {
            execSync('docker info', { stdio: 'ignore' });
            console.log('✅ Docker 正在运行');
            return true;
        } catch (error) {
            throw new Error('Docker 没有运行，请启动 Docker 服务');
        }
    }

    async stopQdrantContainer() {
        try {
            // 检查容器是否存在
            try {
                const output = execSync('docker ps -a --format "{{.Names}}"').toString();
                if (output.includes('marine_news_qdrant')) {
                    console.log('🛑 停止并删除 Qdrant 容器...');
                    execSync('docker stop marine_news_qdrant', { stdio: 'inherit' });
                    execSync('docker rm marine_news_qdrant', { stdio: 'inherit' });
                    console.log('✅ Qdrant 容器已删除');
                } else {
                    console.log('ℹ️ Qdrant 容器不存在');
                }
            } catch (error) {
                console.log('⚠️ 容器操作失败，继续执行:', error.message);
            }
        } catch (error) {
            console.error('❌ 停止容器失败:', error.message);
            throw error;
        }
    }

    async deleteQdrantData() {
        try {
            const qdrantDataPath = '../qdrant_data';
            const fs = require('fs');
            const path = require('path');

            if (fs.existsSync(qdrantDataPath)) {
                console.log('🗑️ 删除 Qdrant 数据目录...');
                
                // 在 Windows 上使用 rmdir，在 Unix 上使用 rm -rf
                if (process.platform === 'win32') {
                    try {
                        execSync(`rmdir /s /q "${path.resolve(qdrantDataPath)}"`, { stdio: 'inherit' });
                    } catch (error) {
                        // 如果 rmdir 失败，尝试使用 Node.js 的 fs 删除
                        this.deleteFolderRecursive(qdrantDataPath);
                    }
                } else {
                    execSync(`rm -rf "${path.resolve(qdrantDataPath)}"`, { stdio: 'inherit' });
                }
                
                console.log('✅ Qdrant 数据目录已删除');
            } else {
                console.log('ℹ️ Qdrant 数据目录不存在');
            }
        } catch (error) {
            console.error('❌ 删除数据目录失败:', error.message);
            // 不抛出错误，继续执行
        }
    }

    deleteFolderRecursive(folderPath) {
        const fs = require('fs');
        const path = require('path');
        
        if (fs.existsSync(folderPath)) {
            fs.readdirSync(folderPath).forEach((file) => {
                const curPath = path.join(folderPath, file);
                if (fs.lstatSync(curPath).isDirectory()) {
                    this.deleteFolderRecursive(curPath);
                } else {
                    fs.unlinkSync(curPath);
                }
            });
            fs.rmdirSync(folderPath);
        }
    }

    async restartQdrant() {
        try {
            console.log('🚀 启动新的 Qdrant 容器...');
            
            // 切换到项目根目录启动
            const projectRoot = '../';
            process.chdir(projectRoot);
            
            execSync('docker-compose -f docker-compose.qdrant.yml up -d', { stdio: 'inherit' });
            
            // 等待服务启动
            console.log('⏳ 等待 Qdrant 服务启动...');
            await this.waitForQdrant(60000); // 等待60秒
            
            // 切换回 backend 目录
            process.chdir('backend');
            
        } catch (error) {
            console.error('❌ 重启 Qdrant 失败:', error.message);
            throw error;
        }
    }

    async waitForQdrant(timeout = 60000) {
        const startTime = Date.now();
        const axios = require('axios');
        
        console.log('⏳ 等待 Qdrant 服务启动...');
        
        while (Date.now() - startTime < timeout) {
            try {
                const response = await axios.get('http://localhost:6333/collections', { timeout: 5000 });
                if (response.status === 200) {
                    console.log('✅ Qdrant 服务就绪');
                    return true;
                }
            } catch (error) {
                // 显示进度
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                process.stdout.write(`\r⏳ 等待中... ${elapsed}s`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        throw new Error('Qdrant 服务启动超时');
    }

    async validateCleanup() {
        try {
            const client = new QdrantClient({
                host: 'localhost',
                port: 6333,
                timeout: 30000
            });

            // 检查服务状态
            const collections = await client.getCollections();
            console.log(`✅ Qdrant 服务正常，现有集合: ${collections.collections.map(c => c.name).join(', ') || '无'}`);

            // 尝试创建集合
            console.log('📦 测试创建集合...');
            await client.createCollection(this.collectionName, {
                vectors: {
                    size: 384,
                    distance: 'Cosine'
                }
            });
            console.log('✅ 集合创建测试成功');

            // 清理测试集合
            await client.deleteCollection(this.collectionName);
            console.log('✅ 测试集合清理成功');

        } catch (error) {
            console.error('❌ 验证失败:', error.message);
            throw error;
        }
    }
}

// 运行彻底清理
async function main() {
    const cleaner = new QdrantCompleteCleaner();
    
    console.log('========================================');
    console.log('   Qdrant 彻底清理工具');
    console.log('========================================\n');
    
    console.log('⚠️  警告: 此操作将删除所有 Qdrant 数据！');
    console.log('💡 确保你已经备份了重要数据。\n');
    
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

    const success = await cleaner.cleanCompletely();
    
    if (success) {
        console.log('\n✅ Qdrant 彻底清理成功！');
        console.log('💡 现在可以重新运行向量索引重建。');
    } else {
        console.log('\n❌ Qdrant 彻底清理失败！');
        process.exit(1);
    }
}

if (require.main === module) {
    main().catch(error => {
        console.error('❌ 脚本执行失败:', error);
        process.exit(1);
    });
}

module.exports = QdrantCompleteCleaner;