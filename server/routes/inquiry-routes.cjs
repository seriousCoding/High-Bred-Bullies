// Inquiry management routes
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

function createInquiryRoutes(pool, sendEmail) {
  return {
    // Get all inquiries
    async handleGetInquiries(req, res, pathname) {
      if (pathname !== '/api/inquiries' || req.method !== 'GET') return false;
      
      console.log('📋 Fetching inquiries request received');
      const authResult = authenticateTokenDirect(req);
      if (!authResult.success) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return true;
      }

      try {
        const result = await pool.query(`
          SELECT id, user_id, litter_id, subject, message, response, status, created_at, updated_at, name, email
          FROM inquiries 
          ORDER BY created_at DESC
        `);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result.rows));
      } catch (error) {
        console.error('Fetch inquiries error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to fetch inquiries' }));
      }
      return true;
    },

    // Reply to inquiry
    async handleInquiryReply(req, res, pathname) {
      if (!pathname.match(/^\/api\/inquiries\/[^\/]+\/reply$/) || req.method !== 'PATCH') return false;
      
      console.log('📧 Inquiry response request received');
      const authResult = authenticateTokenDirect(req);
      if (!authResult.success) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return true;
      }
      
      try {
        const inquiryId = pathname.split('/')[3];
        const data = await parseBody(req);
        const { reply } = data;
        
        console.log(`Responding to inquiry ${inquiryId}`);
        
        if (!reply) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Reply message required' }));
          return true;
        }
        
        // Get inquiry details
        const inquiryResult = await pool.query(`
          SELECT id, name, email, subject, message 
          FROM inquiries 
          WHERE id = $1 
          LIMIT 1
        `, [inquiryId]);
        
        if (inquiryResult.rows.length === 0) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Inquiry not found' }));
          return true;
        }
        
        const inquiry = inquiryResult.rows[0];
        console.log(`Found inquiry from ${inquiry.email}`);
        
        // Update inquiry with response
        await pool.query(`
          UPDATE inquiries 
          SET response = $1, status = 'responded', updated_at = NOW()
          WHERE id = $2
        `, [reply, inquiryId]);
        
        // Send response email
        const responseEmailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Response to Your Inquiry</h2>
            
            <p>Hello ${inquiry.name},</p>
            
            <p>Thank you for reaching out to High Bred Bullies. Here's our response to your inquiry:</p>
            
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #555;">Your Original Message</h3>
              <p><strong>Subject:</strong> ${inquiry.subject}</p>
              <p style="line-height: 1.6;">${inquiry.message.replace(/\n/g, '<br>')}</p>
            </div>
            
            <div style="background: #fff; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
              <h3 style="margin-top: 0; color: #555;">Our Response</h3>
              <p style="line-height: 1.6;">${reply.replace(/\n/g, '<br>')}</p>
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background: #e8f4fd; border-radius: 8px;">
              <p style="margin: 0; font-size: 14px; color: #666;">
                If you have any additional questions, please don't hesitate to contact us again.
              </p>
            </div>
            
            <p>Best regards,<br>High Bred Bullies Team</p>
          </div>
        `;
        
        try {
          const emailSuccess = await sendEmail({
            to: inquiry.email,
            subject: `Re: ${inquiry.subject}`,
            html: responseEmailHtml
          });
          
          if (emailSuccess) {
            console.log(`✅ Response email sent successfully to ${inquiry.email}`);
          } else {
            console.error(`❌ Failed to send response email to ${inquiry.email}`);
          }
        } catch (emailError) {
          console.error('Error sending response email:', emailError);
        }
        
        res.writeHead(200);
        res.end(JSON.stringify({ message: 'Response sent successfully' }));
      } catch (error) {
        console.error('Inquiry response error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to send response' }));
      }
      return true;
    },

    // Delete inquiry
    async handleInquiryDelete(req, res, pathname) {
      if (!pathname.match(/^\/api\/inquiries\/[^\/]+$/) || req.method !== 'DELETE') return false;
      
      console.log('🗑️ Delete inquiry request received');
      const authResult = authenticateTokenDirect(req);
      if (!authResult.success) {
        res.writeHead(401);
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return true;
      }
      
      try {
        const inquiryId = pathname.split('/')[3];
        console.log(`Deleting inquiry ${inquiryId}`);
        
        // Delete the inquiry
        const result = await pool.query(`
          DELETE FROM inquiries 
          WHERE id = $1
          RETURNING id
        `, [inquiryId]);
        
        if (result.rows.length === 0) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: 'Inquiry not found' }));
          return true;
        }
        
        console.log(`✅ Successfully deleted inquiry ${inquiryId}`);
        res.writeHead(200);
        res.end(JSON.stringify({ message: 'Inquiry deleted successfully' }));
      } catch (error) {
        console.error('Delete inquiry error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Failed to delete inquiry' }));
      }
      return true;
    }
  };
}

module.exports = { createInquiryRoutes };