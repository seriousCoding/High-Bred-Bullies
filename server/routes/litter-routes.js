// Litter management routes
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

function createLitterRoutes(pool) {
  return {
    // Get breeder's litters
    async handleBreederLitters(req, res, pathname) {
      if (!pathname.startsWith('/api/litters/breeder/') || req.method !== 'GET') return false;
      
      console.log('📋 Fetching litters for breeder');
      const authResult = authenticateTokenDirect(req);
      if (!authResult.success) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return true;
      }

      try {
        const breederId = pathname.split('/')[4];
        console.log(`Fetching litters for breeder ID: ${breederId}`);

        const result = await pool.query(`
          SELECT 
            l.id,
            l.name,
            l.breed,
            l.birth_date,
            l.dam_name,
            l.sire_name,
            l.status,
            l.created_at,
            l.updated_at,
            b.business_name as breeder_name,
            COALESCE(puppet_counts.available_puppies, 0) as available_puppies,
            COALESCE(puppet_counts.total_puppies, 0) as total_puppies
          FROM litters l
          LEFT JOIN breeders b ON l.breeder_id = b.id
          LEFT JOIN (
            SELECT 
              litter_id,
              COUNT(*) as total_puppies,
              COUNT(CASE WHEN status = 'available' THEN 1 END) as available_puppies
            FROM puppies 
            GROUP BY litter_id
          ) puppet_counts ON l.id = puppet_counts.litter_id
          WHERE l.breeder_id = $1
          ORDER BY l.created_at DESC
        `, [breederId]);

        console.log(`Found litters: ${result.rows.length}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.rows));
      } catch (error) {
        console.error('Fetch breeder litters error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to fetch litters' }));
      }
      return true;
    },

    // Get litter management data
    async handleLitterManagement(req, res, pathname) {
      if (!pathname.startsWith('/api/litters/') || !pathname.endsWith('/management') || req.method !== 'GET') return false;
      
      console.log('📋 Fetching litter management data');
      const authResult = authenticateTokenDirect(req);
      if (!authResult.success) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return true;
      }

      try {
        const litterId = pathname.split('/')[3];
        console.log(`Fetching litter management data for ID: ${litterId}`);

        // Get litter details with puppies
        const litterResult = await pool.query(`
          SELECT 
            l.id,
            l.name,
            l.breed,
            l.birth_date,
            l.dam_name,
            l.sire_name,
            l.status,
            l.created_at,
            l.updated_at,
            b.business_name as breeder_name
          FROM litters l
          LEFT JOIN breeders b ON l.breeder_id = b.id
          WHERE l.id = $1
        `, [litterId]);

        if (litterResult.rows.length === 0) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Litter not found' }));
          return true;
        }

        const litter = litterResult.rows[0];

        // Get puppies for this litter
        const puppiesResult = await pool.query(`
          SELECT 
            id,
            name,
            gender,
            color,
            markings,
            birth_weight,
            current_weight,
            price,
            status,
            stripe_price_id,
            created_at,
            updated_at
          FROM puppies 
          WHERE litter_id = $1
          ORDER BY name
        `, [litterId]);

        console.log(`Successfully fetched litter ${litterId} with ${puppiesResult.rows.length} puppies`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          litter,
          puppies: puppiesResult.rows
        }));
      } catch (error) {
        console.error('Fetch litter management error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to fetch litter management data' }));
      }
      return true;
    },

    // Get featured litters
    async handleFeaturedLitters(req, res, pathname) {
      if (pathname !== '/api/litters/featured' || req.method !== 'GET') return false;
      
      try {
        const result = await pool.query(`
          SELECT 
            l.id,
            l.name,
            l.breed,
            l.birth_date,
            l.dam_name,
            l.sire_name,
            l.status,
            l.created_at,
            l.updated_at,
            b.business_name as breeder_name,
            COALESCE(puppet_counts.available_puppies, 0) as available_puppies,
            COALESCE(puppet_counts.total_puppies, 0) as total_puppies
          FROM litters l
          LEFT JOIN breeders b ON l.breeder_id = b.id
          LEFT JOIN (
            SELECT 
              litter_id,
              COUNT(*) as total_puppies,
              COUNT(CASE WHEN status = 'available' THEN 1 END) as available_puppies
            FROM puppies 
            GROUP BY litter_id
          ) puppet_counts ON l.id = puppet_counts.litter_id
          WHERE l.status = 'active'
          ORDER BY l.created_at DESC
          LIMIT 10
        `);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.rows));
      } catch (error) {
        console.error('Fetch featured litters error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to fetch featured litters' }));
      }
      return true;
    },

    // Get upcoming litters
    async handleUpcomingLitters(req, res, pathname) {
      if (pathname !== '/api/litters/upcoming' || req.method !== 'GET') return false;
      
      try {
        const result = await pool.query(`
          SELECT 
            l.id,
            l.name,
            l.breed,
            l.birth_date,
            l.dam_name,
            l.sire_name,
            l.status,
            l.created_at,
            l.updated_at,
            b.business_name as breeder_name,
            COALESCE(puppet_counts.available_puppies, 0) as available_puppies,
            COALESCE(puppet_counts.total_puppies, 0) as total_puppies
          FROM litters l
          LEFT JOIN breeders b ON l.breeder_id = b.id
          LEFT JOIN (
            SELECT 
              litter_id,
              COUNT(*) as total_puppies,
              COUNT(CASE WHEN status = 'available' THEN 1 END) as available_puppies
            FROM puppies 
            GROUP BY litter_id
          ) puppet_counts ON l.id = puppet_counts.litter_id
          WHERE l.status = 'upcoming'
          ORDER BY l.birth_date ASC
          LIMIT 10
        `);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.rows));
      } catch (error) {
        console.error('Fetch upcoming litters error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to fetch upcoming litters' }));
      }
      return true;
    }
  };
}

module.exports = { createLitterRoutes };