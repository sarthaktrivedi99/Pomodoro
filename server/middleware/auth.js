import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { User } from '../models/index.js';

const CASDOOR_ENDPOINT = process.env.CASDOOR_ENDPOINT || 'http://localhost:8000';

const client = jwksClient({
    jwksUri: `${CASDOOR_ENDPOINT}/.well-known/jwks`,
    requestHeaders: {}, // Add if needed
    timeout: 30000
});

function getKey(header, callback) {
    client.getSigningKey(header.kid, function (err, key) {
        if (err) {
            console.error('JWKS fetch error:', err);
            return callback(err, null);
        }
        const signingKey = key.getPublicKey();
        callback(null, signingKey);
    });
}

export function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify using RS256 and Key from JWKS
    jwt.verify(token, getKey, { algorithms: ['RS256'] }, async (err, decoded) => {
        if (err) {
            console.error('Token verification error:', err.message);
            return res.status(403).json({ error: 'Invalid or expired token', details: err.message });
        }

        // Token is valid. Now map to local user.
        // Decoded token from Casdoor has 'sub' (User ID) or 'name'/'preferred_username' 

        try {
            // Find user by auth_id (sub)
            let user = await User.findOne({ where: { auth_id: decoded.sub } });

            if (!user) {
                // Fallback: This might happen if user registered via frontend (Casdoor) directly 
                // and hasn't hit our /login proxy yet. Or maybe just map by username if auth_id not found?
                // For security, rely on auth_id. 
                // But for migration, we might want to check username?
                // Let's stick to auth_id for new flow.

                // If the user called /api/auth/login, we already upserted them in auth.js.
                // So they should exist.
                return res.status(401).json({ error: 'User not registered in local system' });
            }

            req.user = user;
            next();
        } catch (dbError) {
            console.error('DB User fetch error:', dbError);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    });
}
