const { isAllowed, normalizeRole } = require('./matrix');
const { jwtVerify } = require('jose');
const { executeQuery } = require('../database');

const PRIMARY_JWT_RAW = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const PREVIOUS_JWT_RAW = process.env.JWT_SECRET_PREVIOUS;
const JWT_SECRET = new TextEncoder().encode(PRIMARY_JWT_RAW);
const JWT_SECRET_PREVIOUS = PREVIOUS_JWT_RAW ? new TextEncoder().encode(PREVIOUS_JWT_RAW) : null;

// Public pedagogical timetable and schedule resources that are open to view on dashboard
const PUBLIC_VIEW_RESOURCES = new Set([
    'professors',
    'courses',
    'rooms',
    'groups',
    'sessions',
    'assignments',
    'extra_sessions',
    'time_slots',
    'departments',
    'academic_years',
    'semesters',
    'print_settings'
]);

async function verifyTokenFallback(token) {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload;
    } catch (primaryError) {
        if (JWT_SECRET_PREVIOUS) {
            try {
                const { payload } = await jwtVerify(token, JWT_SECRET_PREVIOUS);
                return payload;
            } catch (prevError) {
                return null;
            }
        }
        return null;
    }
}

/**
 * Extracts and parses custom permissions from user payload or object.
 */
function parseCustomPermissions(user) {
    if (!user) return null;
    if (user.customPermissions && typeof user.customPermissions === 'object') {
        return user.customPermissions;
    }
    if (user.permissions) {
        if (typeof user.permissions === 'object') return user.permissions;
        try {
            return JSON.parse(user.permissions);
        } catch (e) {
            return null;
        }
    }
    return null;
}

/**
 * Express middleware factory for enforcing Role-Based Access Control (RBAC).
 * 
 * @param {string} resource - The target resource (e.g. 'users', 'departments', 'backup')
 * @param {string} action - The action type ('view', 'create', 'update', 'delete', 'export', 'activate')
 * @param {object} [options] - Additional domain scope or ownership checks
 */
function authorize(resource, action, options = {}) {
    return async (req, res, next) => {
        // 1. Feature Flag: Emergency rollback switch
        const isRbacEnabled = process.env.FEATURE_RBAC !== 'false';
        if (!isRbacEnabled) {
            return next();
        }

        // 2. Dynamic RBAC Exemptions (no redeployment required)
        const exemptions = (process.env.RBAC_EXEMPTIONS || '')
            .split(',')
            .map(s => s.trim().toLowerCase())
            .filter(Boolean);
        const routeKey = `${resource}:${action}`.toLowerCase();
        if (exemptions.includes(routeKey) || exemptions.includes(req.path.toLowerCase())) {
            return next();
        }

        // 3. Ensure user identity is authenticated
        if (!req.user) {
            const token = req.cookies?.['__Host-token'] || 
                          req.cookies?.token || 
                          (req.headers.authorization && req.headers.authorization.replace(/^Bearer\s+/, ''));
            if (token) {
                const user = await verifyTokenFallback(token);
                if (user) {
                    req.user = user;
                }
            }
        }

        // 3.1 Fallback for client transition: if req.user is missing but x-user-id header is provided
        if (!req.user && req.headers?.['x-user-id']) {
            try {
                const uRows = await executeQuery(
                    'SELECT id, username, role, is_active FROM users WHERE id = ? AND is_active = 1',
                    [req.headers['x-user-id']]
                );
                if (uRows && uRows.length > 0) {
                    req.user = {
                        id: uRows[0].id,
                        userId: uRows[0].id,
                        username: uRows[0].username,
                        role: uRows[0].role
                    };
                }
            } catch (dbErr) {
                // ignore
            }
        }

        // 3.2 If user is unauthenticated:
        if (!req.user) {
            // Allow public read-only pedagogical timetable views without blocking frontend dashboard/schedules
            if (action === 'view' && PUBLIC_VIEW_RESOURCES.has(resource)) {
                return next();
            }
            return res.status(401).json({
                error: 'UNAUTHORIZED',
                message: 'المصادقة مطلوبة للوصول إلى هذا المورد'
            });
        }

        const userRole = normalizeRole(req.user.role);
        const isAdmin = userRole === 'admin';
        const actorId = String(req.user.id || req.user.userId || '');

        // 4. Critical Security Rule: Prevent Self-Role Promotion & Unauthorized Profile Mutating
        if (resource === 'users' && (action === 'update' || action === 'create')) {
            if (req.body && req.body.role) {
                const requestedRole = normalizeRole(req.body.role);
                if (!isAdmin && requestedRole !== userRole) {
                    return res.status(403).json({
                        error: 'FORBIDDEN_ROLE_PROMOTION',
                        message: 'غير مصرح لك بترقية أو تعديل أدوار المستخدمين'
                    });
                }
            }

            // If updating user and not admin: user can ONLY update their own record
            if (action === 'update' && !isAdmin && req.params.id) {
                if (String(req.params.id) !== actorId) {
                    return res.status(403).json({
                        error: 'FORBIDDEN_CROSS_USER_UPDATE',
                        message: 'غير مصرح لك بتعديل بيانات مستخدم آخر'
                    });
                }
            }
        }

        // 5. Custom Domain Scope / Ownership Validator Callback
        if (typeof options.checkScope === 'function') {
            const scopeAllowed = await options.checkScope(req, req.user);
            if (!scopeAllowed) {
                return res.status(403).json({
                    error: 'FORBIDDEN_SCOPE',
                    message: 'المورد المطلوب يقع خارج نطاق صلاحيات حسابك (القسم / الصلاحية)'
                });
            }
        }

        // 6. Matrix & Custom Permissions Evaluation
        const customPerms = parseCustomPermissions(req.user);
        const allowed = isAllowed(userRole, resource, action, customPerms);

        if (!allowed) {
            return res.status(403).json({
                error: 'FORBIDDEN',
                message: `ليس لديك صلاحية [${action}] على مورد [${resource}]`
            });
        }

        next();
    };
}

module.exports = {
    authorize,
    parseCustomPermissions
};
