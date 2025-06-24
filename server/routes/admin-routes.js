// Admin management routes
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
    return { success: true, userId: decoded.userId, username: decoded.username };
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

function createAdminRoutes(pool) {
  return {
    // Get admin orders
    async handleAdminOrders(req, res, pathname) {
      if (pathname !== '/api/admin/orders' || req.method !== 'GET') return false;
      
      console.log('📋 Fetching admin orders');
      const authResult = authenticateTokenDirect(req);
      if (!authResult.success) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return true;
      }

      try {
        const result = await pool.query(`
          SELECT 
            o.id,
            o.user_id,
            o.total_amount,
            o.status,
            o.stripe_session_id,
            o.delivery_method,
            o.delivery_address,
            o.notes,
            o.created_at,
            o.updated_at,
            up.username as customer_email,
            up.first_name,
            up.last_name
          FROM orders o
          LEFT JOIN user_profiles up ON o.user_id = up.id
          ORDER BY o.created_at DESC
        `);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.rows));
      } catch (error) {
        console.error('Fetch admin orders error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to fetch orders' }));
      }
      return true;
    },

    // Get archived orders
    async handleArchivedOrders(req, res, pathname) {
      if (pathname !== '/api/admin/archived-orders' || req.method !== 'GET') return false;
      
      console.log('📋 Fetching archived orders');
      const authResult = authenticateTokenDirect(req);
      if (!authResult.success) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return true;
      }

      try {
        const result = await pool.query(`
          SELECT 
            o.id,
            o.user_id,
            o.total_amount,
            o.status,
            o.stripe_session_id,
            o.delivery_method,
            o.delivery_address,
            o.notes,
            o.created_at,
            o.updated_at,
            up.username as customer_email,
            up.first_name,
            up.last_name
          FROM orders o
          LEFT JOIN user_profiles up ON o.user_id = up.id
          WHERE o.status IN ('completed', 'cancelled', 'delivered')
          ORDER BY o.updated_at DESC
        `);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.rows));
      } catch (error) {
        console.error('Fetch archived orders error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to fetch archived orders' }));
      }
      return true;
    },

    // Get order details
    async handleOrderDetails(req, res, pathname) {
      if (!pathname.startsWith('/api/orders/') || !pathname.endsWith('/details') || req.method !== 'GET') return false;
      
      console.log('📋 Fetching order details');
      const authResult = authenticateTokenDirect(req);
      if (!authResult.success) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return true;
      }

      try {
        const orderId = pathname.split('/')[3];
        
        // Get order with customer details
        const orderResult = await pool.query(`
          SELECT 
            o.id,
            o.user_id,
            o.total_amount,
            o.status,
            o.stripe_session_id,
            o.delivery_method,
            o.delivery_address,
            o.notes,
            o.created_at,
            o.updated_at,
            up.username as customer_email,
            up.first_name,
            up.last_name
          FROM orders o
          LEFT JOIN user_profiles up ON o.user_id = up.id
          WHERE o.id = $1
        `, [orderId]);

        if (orderResult.rows.length === 0) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Order not found' }));
          return true;
        }

        // Get order items (puppies)
        const itemsResult = await pool.query(`
          SELECT 
            oi.id,
            oi.puppy_id,
            oi.price,
            oi.quantity,
            p.name as puppy_name,
            p.gender,
            p.color,
            l.name as litter_name,
            l.breed
          FROM order_items oi
          LEFT JOIN puppies p ON oi.puppy_id = p.id
          LEFT JOIN litters l ON p.litter_id = l.id
          WHERE oi.order_id = $1
        `, [orderId]);

        const order = {
          ...orderResult.rows[0],
          items: itemsResult.rows
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(order));
      } catch (error) {
        console.error('Fetch order details error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to fetch order details' }));
      }
      return true;
    },

    // Cancel order
    async handleCancelOrder(req, res, pathname) {
      if (!pathname.match(/^\/api\/orders\/[^\/]+\/cancel$/) || req.method !== 'POST') return false;
      
      console.log('❌ Cancel order request');
      const authResult = authenticateTokenDirect(req);
      if (!authResult.success) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return true;
      }

      try {
        const orderId = pathname.split('/')[3];
        
        // Update order status to cancelled
        const result = await pool.query(`
          UPDATE orders 
          SET status = 'cancelled', updated_at = NOW()
          WHERE id = $1
          RETURNING id
        `, [orderId]);

        if (result.rows.length === 0) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Order not found' }));
          return true;
        }

        // Make puppies available again
        await pool.query(`
          UPDATE puppies 
          SET status = 'available'
          WHERE id IN (
            SELECT puppy_id FROM order_items WHERE order_id = $1
          )
        `, [orderId]);

        console.log(`✅ Order ${orderId} cancelled successfully`);
        res.writeHead(200);
        res.end(JSON.stringify({ message: 'Order cancelled successfully' }));
      } catch (error) {
        console.error('Cancel order error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to cancel order' }));
      }
      return true;
    },

    // Get social posts for admin
    async handleAdminSocialPosts(req, res, pathname) {
      if (pathname !== '/api/admin/social-posts' || req.method !== 'GET') return false;
      
      console.log('📋 Fetching admin social posts');
      const authResult = authenticateTokenDirect(req);
      if (!authResult.success) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return true;
      }

      try {
        const result = await pool.query(`
          SELECT 
            sp.id,
            sp.user_id,
            sp.title,
            sp.content,
            sp.image_url,
            sp.is_featured,
            sp.created_at,
            sp.updated_at,
            up.username,
            up.first_name,
            up.last_name,
            (SELECT COUNT(*) FROM social_post_likes WHERE post_id = sp.id) as likes_count,
            (SELECT COUNT(*) FROM social_post_comments WHERE post_id = sp.id) as comments_count
          FROM social_posts sp
          LEFT JOIN user_profiles up ON sp.user_id = up.id
          ORDER BY sp.created_at DESC
        `);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.rows));
      } catch (error) {
        console.error('Fetch admin social posts error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to fetch social posts' }));
      }
      return true;
    },

    // Get blog posts for admin
    async handleAdminBlogPosts(req, res, pathname) {
      if (pathname !== '/api/admin/blog-posts' || req.method !== 'GET') return false;
      
      console.log('📋 Fetching admin blog posts');
      const authResult = authenticateTokenDirect(req);
      if (!authResult.success) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return true;
      }

      try {
        const result = await pool.query(`
          SELECT 
            bp.id,
            bp.title,
            bp.content,
            bp.excerpt,
            bp.category,
            bp.image_url,
            bp.is_published,
            bp.published_at,
            bp.created_at,
            bp.updated_at,
            bp.author_id,
            up.username as author_name
          FROM blog_posts bp
          LEFT JOIN user_profiles up ON bp.author_id = up.id
          ORDER BY bp.created_at DESC
        `);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.rows));
      } catch (error) {
        console.error('Fetch admin blog posts error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to fetch blog posts' }));
      }
      return true;
    }
  };
}

module.exports = { createAdminRoutes };