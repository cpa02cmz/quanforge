import { generateMetaDescription, analyzeKeywordDensity, calculateReadabilityScore } from './seoEnhanced';

// Enhanced content optimization service for QuantForge AI
export interface ContentAnalysis {
  keywordDensity: Record<string, { density: number; count: number; prominence: number }>;
  readabilityScore: { score: number; level: string; avgWordsPerSentence: number; avgSyllablesPerWord: number };
  seoScore: number;
  recommendations: string[];
  optimizedMetaTags: {
    title: string;
    description: string;
    keywords: string;
  };
}

export interface ContentOptimizerConfig {
  targetKeywords: string[];
  minKeywordDensity: number;
  maxKeywordDensity: number;
  targetReadabilityLevel: 'Easy' | 'Standard' | 'Difficult';
  contentLength: { min: number; max: number };
  metaDescriptionLength: { min: number; max: number };
  titleLength: { min: number; max: number };
}

const DEFAULT_CONFIG: ContentOptimizerConfig = {
  targetKeywords: [
    'MQL5', 'trading robot', 'Expert Advisor', 'AI trading', 'MetaTrader 5',
    'algorithmic trading', 'forex robot', 'automated trading', 'quantitative trading'
  ],
  minKeywordDensity: 1.0,
  maxKeywordDensity: 3.0,
  targetReadabilityLevel: 'Standard',
  contentLength: { min: 300, max: 3000 },
  metaDescriptionLength: { min: 120, max: 160 },
  titleLength: { min: 30, max: 60 }
};

export class ContentOptimizer {
  private config: ContentOptimizerConfig;

  constructor(config: Partial<ContentOptimizerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Analyze content and provide optimization recommendations
  analyzeContent(content: string, currentTitle?: string, currentDescription?: string): ContentAnalysis {
    const keywordDensity = analyzeKeywordDensity(content, this.config.targetKeywords);
    const readabilityScore = calculateReadabilityScore(content);
    const seoScore = this.calculateSEOScore(content, keywordDensity, readabilityScore);
    const recommendations = this.generateRecommendations(content, keywordDensity, readabilityScore, currentTitle, currentDescription);
    const optimizedMetaTags = this.generateOptimizedMetaTags(content, currentTitle, currentDescription);

    return {
      keywordDensity,
      readabilityScore,
      seoScore,
      recommendations,
      optimizedMetaTags
    };
  }

  // Calculate overall SEO score
  private calculateSEOScore(
    content: string, 
    keywordDensity: Record<string, any>, 
    readabilityScore: any
  ): number {
    let score = 0;
    const maxScore = 100;

    // Content length scoring (20 points)
    const contentLength = content.length;
    if (contentLength >= this.config.contentLength.min && contentLength <= this.config.contentLength.max) {
      score += 20;
    } else if (contentLength >= this.config.contentLength.min * 0.8) {
      score += 10;
    }

    // Keyword density scoring (30 points)
    const targetKeywords = this.config.targetKeywords;
    let keywordScore = 0;
    targetKeywords.forEach(keyword => {
      const density = keywordDensity[keyword]?.density || 0;
      if (density >= this.config.minKeywordDensity && density <= this.config.maxKeywordDensity) {
        keywordScore += 10;
      } else if (density > 0) {
        keywordScore += 5;
      }
    });
    score += Math.min(keywordScore, 30);

    // Readability scoring (20 points)
    const readabilityLevels = { 'Very Easy': 20, 'Easy': 18, 'Fairly Easy': 15, 'Standard': 12, 'Fairly Difficult': 8, 'Difficult': 5, 'Very Difficult': 2 };
    score += readabilityLevels[readabilityScore.level as keyof typeof readabilityLevels] || 0;

    // Structure scoring (15 points)
    if (content.includes('<h1>') || content.match(/^#\s+/m)) score += 5;
    if (content.includes('<h2>') || content.match(/^##\s+/m)) score += 5;
    if (content.includes('<h3>') || content.match(/^###\s+/m)) score += 5;

    // Internal links scoring (10 points)
    const linkCount = (content.match(/<a\s+href=/g) || content.match(/\[.*?\]\(.*?\)/g) || []).length;
    score += Math.min(linkCount * 2, 10);

    // Image optimization scoring (5 points)
    const imageCount = (content.match(/<img/g) || content.match(/!\[.*?\]/g) || []).length;
    if (imageCount > 0) score += 5;

    return Math.min(score, maxScore);
  }

  // Generate optimization recommendations
  private generateRecommendations(
    content: string,
    keywordDensity: Record<string, any>,
    readabilityScore: any,
    currentTitle?: string,
    currentDescription?: string
  ): string[] {
    const recommendations: string[] = [];

    // Content length recommendations
    const contentLength = content.length;
    if (contentLength < this.config.contentLength.min) {
      recommendations.push(`Content is too short (${contentLength} chars). Aim for at least ${this.config.contentLength.min} characters.`);
    } else if (contentLength > this.config.contentLength.max) {
      recommendations.push(`Content is too long (${contentLength} chars). Consider breaking it into smaller sections or reducing to ${this.config.contentLength.max} characters.`);
    }

    // Keyword density recommendations
    this.config.targetKeywords.forEach(keyword => {
      const density = keywordDensity[keyword]?.density || 0;
      if (density < this.config.minKeywordDensity) {
        recommendations.push(`Increase usage of "${keyword}" (current: ${density.toFixed(2)}%, target: ${this.config.minKeywordDensity}%-${this.config.maxKeywordDensity}%)`);
      } else if (density > this.config.maxKeywordDensity) {
        recommendations.push(`Reduce usage of "${keyword}" (current: ${density.toFixed(2)}%, target: ${this.config.minKeywordDensity}%-${this.config.maxKeywordDensity}%)`);
      }
    });

    // Readability recommendations
    if (readabilityScore.level === 'Very Difficult' || readabilityScore.level === 'Difficult') {
      recommendations.push('Content is difficult to read. Consider using shorter sentences and simpler words.');
    } else if (readabilityScore.level === 'Very Easy' || readabilityScore.level === 'Easy') {
      recommendations.push('Content is very easy to read. Consider adding more technical details for expert audience.');
    }

    // Title recommendations
    if (currentTitle) {
      if (currentTitle.length < this.config.titleLength.min) {
        recommendations.push(`Title is too short (${currentTitle.length} chars). Aim for ${this.config.titleLength.min}-${this.config.titleLength.max} characters.`);
      } else if (currentTitle.length > this.config.titleLength.max) {
        recommendations.push(`Title is too long (${currentTitle.length} chars). Aim for ${this.config.titleLength.min}-${this.config.titleLength.max} characters.`);
      }

      const titleHasKeywords = this.config.targetKeywords.some(keyword => 
        currentTitle.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!titleHasKeywords) {
        recommendations.push('Include primary keywords in the title for better SEO.');
      }
    }

    // Meta description recommendations
    if (currentDescription) {
      if (currentDescription.length < this.config.metaDescriptionLength.min) {
        recommendations.push(`Meta description is too short (${currentDescription.length} chars). Aim for ${this.config.metaDescriptionLength.min}-${this.config.metaDescriptionLength.max} characters.`);
      } else if (currentDescription.length > this.config.metaDescriptionLength.max) {
        recommendations.push(`Meta description is too long (${currentDescription.length} chars). Aim for ${this.config.metaDescriptionLength.min}-${this.config.metaDescriptionLength.max} characters.`);
      }

      const descHasKeywords = this.config.targetKeywords.some(keyword => 
        currentDescription.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!descHasKeywords) {
        recommendations.push('Include primary keywords in the meta description.');
      }
    }

    // Structure recommendations
    if (!content.includes('<h1>') && !content.match(/^#\s+/m)) {
      recommendations.push('Add an H1 heading to improve content structure.');
    }
    if (!content.includes('<h2>') && !content.match(/^##\s+/m)) {
      recommendations.push('Add H2 subheadings to break up content and improve readability.');
    }

    // Internal linking recommendations
    const linkCount = (content.match(/<a\s+href=/g) || content.match(/\[.*?\]\(.*?\)/g) || []).length;
    if (linkCount === 0) {
      recommendations.push('Add internal links to related content to improve SEO and user engagement.');
    }

    // Image recommendations
    const imageCount = (content.match(/<img/g) || content.match(/!\[.*?\]/g) || []).length;
    if (imageCount === 0) {
      recommendations.push('Add relevant images with alt text to improve user engagement and SEO.');
    }

    return recommendations;
  }

  // Generate optimized meta tags
  private generateOptimizedMetaTags(
    content: string,
    currentTitle?: string,
    currentDescription?: string
  ): { title: string; description: string; keywords: string } {
    // Extract key phrases for title
    const title = currentTitle || this.generateOptimizedTitle(content);
    
    // Generate optimized description
    const description = currentDescription || generateMetaDescription(content, this.config.metaDescriptionLength.max);
    
    // Generate keywords
    const keywords = this.generateKeywords(content);

    return { title, description, keywords };
  }

  // Generate optimized title
  private generateOptimizedTitle(content: string): string {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const firstSentence = sentences[0]?.trim();
    
    if (firstSentence && firstSentence.length <= this.config.titleLength.max) {
      // Try to include primary keyword
      const primaryKeyword = this.config.targetKeywords[0];
      if (primaryKeyword && firstSentence.toLowerCase().includes(primaryKeyword.toLowerCase())) {
        return firstSentence;
      }
    }

    // Extract title from content
    const titleMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/i) || content.match(/^#\s+(.*)$/m);
    if (titleMatch && titleMatch[1]) {
      const title = titleMatch[1].replace(/<[^>]*>/g, '').trim();
      if (title && title.length <= this.config.titleLength.max) {
        return title;
      }
    }

    // Generate default title
    return 'QuantForge AI - Advanced MQL5 Trading Robot Generator';
  }

  // Generate keywords from content
  private generateKeywords(content: string): string {
    const text = content.replace(/<[^>]*>/g, '').toLowerCase();
    const words = text.split(/\s+/);
    
    // Count word frequency
    const wordFreq: Record<string, number> = {};
    words.forEach(word => {
      if (word.length > 3) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });

    // Filter and sort by frequency and relevance
    const relevantWords = Object.entries(wordFreq)
      .filter(([word]) => !this.isStopWord(word))
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);

    // Combine with target keywords
    const allKeywords = [...this.config.targetKeywords, ...relevantWords];
    return [...new Set(allKeywords)].slice(0, 15).join(', ');
  }

  // Check if word is a stop word
  private isStopWord(word: string): boolean {
    const stopWords = [
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how'
    ];
    return stopWords.includes(word);
  }

  // Generate internal linking suggestions
  generateInternalLinking(content: string, availablePages: Array<{ title: string; url: string; keywords: string[] }>): Array<{ text: string; url: string; relevance: number }> {
    const contentWords = content.toLowerCase().split(/\s+/);
    const links: Array<{ text: string; url: string; relevance: number }> = [];
    
    availablePages.forEach(page => {
      let relevance = 0;
      const pageKeywords = page.keywords.map(k => k.toLowerCase());
      
      pageKeywords.forEach(keyword => {
        const count = contentWords.filter(word => word.includes(keyword)).length;
        relevance += count;
      });
      
      if (relevance > 0) {
        links.push({
          text: page.title,
          url: page.url,
          relevance
        });
      }
    });
    
    return links.sort((a, b) => b.relevance - a.relevance).slice(0, 5);
  }

  // Generate content structure suggestions
  generateStructureSuggestions(content: string): {
    headings: Array<{ level: number; text: string; suggestion: string }>;
    paragraphs: Array<{ length: number; suggestion: string }>;
    lists: Array<{ type: string; suggestion: string }>;
  } {
    const suggestions = {
      headings: [] as Array<{ level: number; text: string; suggestion: string }>,
      paragraphs: [] as Array<{ length: number; suggestion: string }>,
      lists: [] as Array<{ type: string; suggestion: string }>
    };

    // Analyze headings
    const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
    let headingMatch;
    while ((headingMatch = headingRegex.exec(content)) !== null) {
      const level = parseInt(headingMatch[1] || '1');
      const text = headingMatch[2]?.replace(/<[^>]*>/g, '').trim() || '';
      
      if (text.length > 60) {
        suggestions.headings.push({
          level,
          text,
          suggestion: 'Consider shortening this heading for better readability.'
        });
      }
    }

    // Analyze paragraphs
    const paragraphs = content.split(/\n\n+/);
    paragraphs.forEach((paragraph) => {
      const length = paragraph.replace(/<[^>]*>/g, '').length;
      if (length > 300) {
        suggestions.paragraphs.push({
          length,
          suggestion: 'This paragraph is quite long. Consider breaking it into smaller paragraphs.'
        });
      }
    });

    // Suggest lists for better readability
    if (!content.includes('<ul>') && !content.includes('<ol>') && !content.match(/^[\*\-\+]/m)) {
      suggestions.lists.push({
        type: 'general',
        suggestion: 'Consider using bullet points or numbered lists to present information more clearly.'
      });
    }

    return suggestions;
  }
}

// Export singleton instance
export const contentOptimizer = new ContentOptimizer();

// Export utility functions
export const analyzeContentForSEO = (content: string, title?: string, description?: string) => {
  return contentOptimizer.analyzeContent(content, title, description);
};

export const optimizeContent = (content: string, options?: Partial<ContentOptimizerConfig>) => {
  const optimizer = new ContentOptimizer(options);
  return optimizer.analyzeContent(content);
};

export default contentOptimizer;