// backend/config/qdrant-config.js
const { QdrantClient } = require('@qdrant/js-client-rest');

class QdrantConfig {
    constructor() {
        // 连接Qdrant向量数据库 - 修复连接配置
        this.client = new QdrantClient({
            host: process.env.QDRANT_HOST || 'localhost',
            port: parseInt(process.env.QDRANT_PORT) || 6333,
            timeout: 60000
        });
        
        // 集合名称
        this.collectionName = 'marine_news_complete';
        
        // 向量维度 (BGE-small-zh模型是384维)
        this.vectorSize = 384;
    }

    /**
     * 测试数据库连接
     */
    async testConnection() {
        try {
            console.log('🔌 测试Qdrant连接...');
            const collections = await this.client.getCollections();
            console.log('✅ Qdrant连接成功!');
            console.log(`📊 现有集合: ${collections.collections.map(c => c.name).join(', ') || '无'}`);
            return true;
        } catch (error) {
            console.error('❌ Qdrant连接失败:', error.message);
            console.log('💡 请检查:');
            console.log('   1. Qdrant容器是否运行: docker ps | grep qdrant');
            console.log('   2. 端口是否正确: curl http://localhost:6333/collections');
            return false;
        }
    }

    /**
     * 初始化集合
     */
    async initCollection() {
        try {
            console.log('🔄 初始化向量数据库集合...');
            
            // 检查集合是否存在
            const collections = await this.client.getCollections();
            const exists = collections.collections.find(c => c.name === this.collectionName);
            
            if (exists) {
                console.log('✅ 集合已存在，跳过创建');
                return true;
            }

            // 创建新集合
            await this.client.createCollection(this.collectionName, {
                vectors: {
                    size: this.vectorSize,
                    distance: 'Cosine'  // 余弦相似度，适合文本
                }
            });

            console.log(`✅ 集合 "${this.collectionName}" 创建成功`);

            // 创建索引以便快速过滤
            await this.createIndexes();
            
            return true;

        } catch (error) {
            console.error('❌ 集合初始化失败:', error);
            return false;
        }
    }

    /**
     * 创建payload索引
     */
    async createIndexes() {
        try {
            // 发布时间索引
            await this.client.createPayloadIndex(this.collectionName, {
                field_name: 'publish_time',
                field_schema: 'datetime'
            });

            // 位置索引
            await this.client.createPayloadIndex(this.collectionName, {
                field_name: 'locations',
                field_schema: 'keyword'
            });

            // 主题索引
            await this.client.createPayloadIndex(this.collectionName, {
                field_name: 'theme',
                field_schema: 'keyword'
            });

            console.log('✅ Payload索引创建成功');
        } catch (error) {
            console.warn('⚠️ 索引创建失败（可能已存在）:', error.message);
        }
    }

    /**
     * 获取集合信息
     */
    async getCollectionInfo() {
        try {
            const info = await this.client.getCollection(this.collectionName);
            console.log('📊 集合信息:', {
                名称: info.name,
                向量数量: info.points_count,
                状态: info.status
            });
            return info;
        } catch (error) {
            console.error('获取集合信息失败:', error);
            return null;
        }
    }

    /**
     * 清空集合（开发用）
     */
    async clearCollection() {
        try {
            await this.client.deleteCollection(this.collectionName);
            console.log('🗑️ 集合已清空');
            // 重新初始化
            await this.initCollection();
        } catch (error) {
            console.error('清空集合失败:', error);
        }
    }
}

// 创建单例实例
module.exports = new QdrantConfig();