// Blog and social post generation routes
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

function authenticateTokenDirect(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'No token provided' };
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { success: true, userId: decoded.userId, username: decoded.username, isBreeder: decoded.isBreeder };
  } catch (error) {
    return { success: false, error: 'Invalid token' };
  }
}

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function createBlogRoutes(pool) {
  return {
    // Generate blog post
    async handleGenerateBlogPost(req, res, pathname) {
      if (pathname !== '/api/generate-blog-post' || req.method !== 'POST') return false;
      
      console.log('📝 Generate blog post request received');
      const authResult = authenticateTokenDirect(req);
      if (!authResult.success || !authResult.isBreeder) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized - Breeder access required' }));
        return true;
      }

      try {
        const data = await parseBody(req);
        const { topic, category = 'General' } = data;
        
        if (!topic) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Topic is required' }));
          return true;
        }

        // Generate blog post content (mock implementation)
        const title = `${topic}: A Complete Guide for Dog Breeders`;
        const content = `# ${title}

## Introduction

Welcome to our comprehensive guide on ${topic}. As experienced dog breeders, we understand the importance of providing accurate and helpful information to our community.

## Key Points

### Understanding ${topic}

When it comes to ${topic}, there are several important factors to consider:

1. **Research and Planning**: Always start with thorough research
2. **Best Practices**: Follow industry-standard procedures
3. **Safety First**: Prioritize the health and safety of all animals
4. **Documentation**: Keep detailed records of all activities

### Implementation Tips

Here are some practical tips for implementing ${topic} in your breeding program:

- Start with small, manageable steps
- Consult with veterinary professionals
- Monitor progress regularly
- Adjust your approach based on results

## Conclusion

${topic} is an essential aspect of responsible dog breeding. By following these guidelines and staying informed about best practices, you can ensure the best outcomes for your breeding program.

Remember to always prioritize the health and well-being of your dogs, and don't hesitate to seek professional advice when needed.

---

*This article was generated to help our breeding community stay informed about important topics. For specific advice about your breeding program, always consult with qualified professionals.*`;

        const excerpt = `A comprehensive guide to ${topic} for dog breeders, covering essential tips and best practices.`;
        const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        
        // Use valid category values
        const validCategory = ['Training', 'Health', 'Breeding', 'Nutrition', 'General'].includes(category) ? category : 'General';
        
        const blogPostId = require('crypto').randomUUID();
        
        await pool.query(`
          INSERT INTO blog_posts (id, title, content, excerpt, category, published_at, created_at, updated_at, author_name, slug, is_published)
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW(), $6, $7, $8)
        `, [
          blogPostId,
          title,
          content,
          excerpt,
          validCategory,
          'High Bred Bullies Team',
          slug,
          true
        ]);

        console.log(`✅ Blog post generated successfully: ${title}`);
        res.writeHead(200);
        res.end(JSON.stringify({ 
          success: true, 
          message: 'Blog post generated successfully',
          post: {
            id: blogPostId,
            title,
            category: validCategory,
            excerpt
          }
        }));
      } catch (error) {
        console.error('Generate blog post error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to generate blog post' }));
      }
      return true;
    },

    // Generate social post
    async handleGenerateSocialPost(req, res, pathname) {
      if (pathname !== '/api/generate-social-post' || req.method !== 'POST') return false;
      
      console.log('📱 Generate social post request received');
      const authResult = authenticateTokenDirect(req);
      if (!authResult.success || !authResult.isBreeder) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized - Breeder access required' }));
        return true;
      }

      try {
        const data = await parseBody(req);
        const { topic, tone = 'friendly' } = data;
        
        if (!topic) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Topic is required' }));
          return true;
        }

        // Generate social post content
        const postTemplates = {
          friendly: `🐕 Exciting news about ${topic}! 

We're thrilled to share some insights with our amazing community. ${topic} is such an important part of what we do here at High Bred Bullies.

Here's what we want you to know:
✨ Quality comes first, always
🏆 Our puppies are raised with love and care
💝 We're here to support you every step of the way

What questions do you have about ${topic}? Drop them in the comments below! 👇

#HighBredBullies #AmericanBully #DogBreeding #PuppyLife #QualityFirst`,
          
          professional: `Professional Update: ${topic}

At High Bred Bullies, we maintain the highest standards in everything we do. Our approach to ${topic} reflects our commitment to excellence and responsible breeding practices.

Key highlights:
• Industry-leading standards
• Comprehensive health testing
• Ongoing support for our families
• Transparent breeding practices

For more information about our ${topic} protocols, please don't hesitate to reach out.

#HighBredBullies #ProfessionalBreeding #QualityStandards`,
          
          educational: `📚 Educational Post: Understanding ${topic}

Did you know that ${topic} plays a crucial role in responsible dog breeding? Here's what every potential puppy owner should understand:

🔍 Research is key - always ask questions
📋 Documentation matters - health records, lineage, etc.
🏥 Health comes first - proper veterinary care is essential
💕 Lifetime support - a good breeder is always there for you

At High Bred Bullies, we believe in educating our community. Knowledge leads to better outcomes for everyone!

Have questions about ${topic}? We're here to help! 💬

#Education #ResponsibleBreeding #HighBredBullies #PuppyParents`
        };

        const title = `${topic} - ${tone.charAt(0).toUpperCase() + tone.slice(1)} Update`;
        const content = postTemplates[tone] || postTemplates.friendly;
        
        // Ensure is_public column exists
        try {
          await pool.query(`ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true`);
        } catch (e) {
          // Column already exists
        }

        const socialPostId = require('crypto').randomUUID();
        
        await pool.query(`
          INSERT INTO social_posts (id, user_id, title, content, is_featured, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        `, [
          socialPostId,
          authResult.userId,
          title,
          content,
          true
        ]);

        console.log(`✅ Social post generated successfully: ${title}`);
        res.writeHead(200);
        res.end(JSON.stringify({ 
          success: true, 
          message: 'Social post generated successfully',
          post: {
            id: socialPostId,
            title,
            content: content.substring(0, 100) + '...'
          }
        }));
      } catch (error) {
        console.error('Generate social post error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to generate social post' }));
      }
      return true;
    }
  };
}

module.exports = { createBlogRoutes };