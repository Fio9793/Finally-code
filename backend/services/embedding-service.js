// backend/services/embedding-service.js
const axios = require('axios');
const textProcessor = require('./text-processor');

class EmbeddingService {
    constructor() {
        // 使用本地嵌入服务或云端API
        this.embeddingUrl = process.env.EMBEDDING_URL || 'http://localhost:8000/embed';
        this.useLocalFallback = true; // 是否使用本地降级方案
    }

    async generateEmbeddings(texts) {
        try {
            console.log('🔧 生成文本嵌入...');
            
            // 如果是数组，批量处理
            if (Array.isArray(texts)) {
                const embeddings = [];
                for (const text of texts) {
                    const embedding = await this.getEmbedding(text);
                    embeddings.push(embedding);
                }
                return embeddings;
            } else {
                // 单文本处理
                return await this.getEmbedding(texts);
            }
        } catch (error) {
            console.error('❌ 嵌入生成失败，使用降级方案:', error.message);
            return this.fallbackEmbedding(texts);
        }
    }

    async getEmbedding(text) {
        // 尝试使用本地嵌入服务
        if (!this.useLocalFallback) {
            try {
                const response = await axios.post(this.embeddingUrl, {
                    text: text
                }, {
                    timeout: 30000
                });
                return response.data.embedding;
            } catch (error) {
                console.warn('⚠️ 本地嵌入服务失败，切换到降级方案');
                this.useLocalFallback = true;
            }
        }
        
        // 降级方案：使用TF-IDF风格的简单向量
        return this.fallbackEmbedding(text);
    }

    fallbackEmbedding(text) {
        if (Array.isArray(text)) {
            return text.map(t => this.createSimpleVector(t));
        }
        return this.createSimpleVector(text);
    }

    createSimpleVector(text) {
        // 创建384维的简单向量（模拟BGE-small-zh）
        const vector = new Array(384).fill(0);
        const words = textProcessor.segment(text);
        
        // 简单的词哈希分布
        words.forEach(word => {
            const hash = this.stringHash(word);
            const index = Math.abs(hash) % 384;
            vector[index] += 1;
        });
        
        // 归一化
        return this.normalizeVector(vector);
    }

    stringHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return hash;
    }

    normalizeVector(vector) {
        const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        if (norm === 0) return vector;
        return vector.map(val => val / norm);
    }

    /**
     * 计算向量相似度
     */
    cosineSimilarity(vec1, vec2) {
        if (vec1.length !== vec2.length) {
            throw new Error('向量维度不匹配');
        }
        
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        
        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }
        
        if (norm1 === 0 || norm2 === 0) return 0;
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }
}

module.exports = new EmbeddingService();