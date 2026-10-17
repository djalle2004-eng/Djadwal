/**
 * Djadwal Centralized Authorization Matrix (RBAC)
 * 
 * Defines explicit Allow/Deny policies for each (Role x Resource x Action).
 * Security Philosophy:
 * - Default DENY: Any unmapped role, resource, or action is strictly rejected.
 * - Least Privilege: Roles only possess the permissions necessary for their duties.
 * - Backward Compatible: Matches existing client-side definitions from src/services/authService.ts
 */

const ALL_PERMISSIONS = {
    view: true,
    create: true,
    update: true,
    delete: true,
    export: true,
    activate: true,
    admin: true
};

const VIEW_ONLY = {
    view: true,
    create: false,
    update: false,
    delete: false,
    export: false,
    activate: false,
    admin: false
};

const VIEW_AND_EXPORT = {
    view: true,
    create: false,
    update: false,
    delete: false,
    export: true,
    activate: false,
    admin: false
};

const NO_PERMISSIONS = {
    view: false,
    create: false,
    update: false,
    delete: false,
    export: false,
    activate: false,
    admin: false
};

const ROLE_PERMISSIONS_MATRIX = {
    admin: {
        academic_years: ALL_PERMISSIONS,
        semesters: ALL_PERMISSIONS,
        professors: ALL_PERMISSIONS,
        courses: ALL_PERMISSIONS,
        rooms: ALL_PERMISSIONS,
        groups: ALL_PERMISSIONS,
        departments: ALL_PERMISSIONS,
        assignments: ALL_PERMISSIONS,
        sessions: ALL_PERMISSIONS,
        extra_sessions: ALL_PERMISSIONS,
        reports: ALL_PERMISSIONS,
        users: ALL_PERMISSIONS,
        permissions: ALL_PERMISSIONS,
        settings: ALL_PERMISSIONS,
        app_config: ALL_PERMISSIONS,
        print_settings: ALL_PERMISSIONS,
        backup: ALL_PERMISSIONS,
        sandbox_snapshots: ALL_PERMISSIONS,
        audit_logs: ALL_PERMISSIONS,
        email: ALL_PERMISSIONS,
        ai: ALL_PERMISSIONS
    },
    schedule_manager: {
        academic_years: VIEW_ONLY,
        semesters: VIEW_ONLY,
        professors: VIEW_ONLY,
        courses: VIEW_ONLY,
        rooms: VIEW_ONLY,
        groups: VIEW_ONLY,
        departments: VIEW_ONLY,
        assignments: { view: true, create: true, update: true, delete: true, export: true, activate: false, admin: false },
        sessions: { view: true, create: true, update: true, delete: true, export: true, activate: false, admin: false },
        extra_sessions: { view: true, create: true, update: true, delete: true, export: true, activate: false, admin: false },
        reports: VIEW_AND_EXPORT,
        users: NO_PERMISSIONS,
        permissions: NO_PERMISSIONS,
        settings: NO_PERMISSIONS,
        app_config: VIEW_ONLY,
        print_settings: VIEW_ONLY,
        backup: NO_PERMISSIONS,
        sandbox_snapshots: { view: true, create: true, update: true, delete: false, export: false, activate: false, admin: false },
        audit_logs: NO_PERMISSIONS,
        email: { view: true, create: false, update: false, delete: false, export: false, activate: false, admin: false },
        ai: { view: true, create: true, update: false, delete: false, export: false, activate: false, admin: false }
    },
    staff: {
        academic_years: VIEW_ONLY,
        semesters: VIEW_ONLY,
        professors: VIEW_ONLY,
        courses: VIEW_ONLY,
        rooms: VIEW_ONLY,
        groups: VIEW_ONLY,
        departments: VIEW_ONLY,
        assignments: VIEW_ONLY,
        sessions: VIEW_ONLY,
        extra_sessions: VIEW_ONLY,
        reports: VIEW_AND_EXPORT,
        users: NO_PERMISSIONS,
        permissions: NO_PERMISSIONS,
        settings: NO_PERMISSIONS,
        app_config: VIEW_ONLY,
        print_settings: VIEW_ONLY,
        backup: NO_PERMISSIONS,
        sandbox_snapshots: VIEW_ONLY,
        audit_logs: NO_PERMISSIONS,
        email: NO_PERMISSIONS,
        ai: { view: true, create: true, update: false, delete: false, export: false, activate: false, admin: false }
    },
    professor: {
        academic_years: VIEW_ONLY,
        semesters: VIEW_ONLY,
        professors: VIEW_ONLY,
        courses: VIEW_ONLY,
        rooms: VIEW_ONLY,
        groups: VIEW_ONLY,
        departments: VIEW_ONLY,
        assignments: VIEW_ONLY,
        sessions: VIEW_ONLY,
        extra_sessions: VIEW_ONLY,
        reports: VIEW_ONLY,
        users: NO_PERMISSIONS,
        permissions: NO_PERMISSIONS,
        settings: NO_PERMISSIONS,
        app_config: VIEW_ONLY,
        print_settings: VIEW_ONLY,
        backup: NO_PERMISSIONS,
        sandbox_snapshots: NO_PERMISSIONS,
        audit_logs: NO_PERMISSIONS,
        email: NO_PERMISSIONS,
        ai: { view: true, create: true, update: false, delete: false, export: false, activate: false, admin: false }
    }
};

/**
 * Normalizes role string to canonical lowercase format.
 */
function normalizeRole(role) {
    if (!role) return 'unknown';
    const r = String(role).trim().toLowerCase();
    return r;
}

/**
 * Checks if a given role is allowed to perform an action on a resource.
 * Supports custom user overrides if provided.
 */
function isAllowed(role, resource, action, customPermissions = null) {
    const canonicalRole = normalizeRole(role);
    const canonicalAction = String(action).toLowerCase();

    // 1. Check custom permissions if user has explicit overrides
    if (customPermissions && typeof customPermissions === 'object') {
        const resPerms = customPermissions[resource];
        if (resPerms && typeof resPerms[canonicalAction] === 'boolean') {
            return resPerms[canonicalAction];
        }
    }

    // 2. Lookup standard role matrix
    const roleConfig = ROLE_PERMISSIONS_MATRIX[canonicalRole];
    if (!roleConfig) {
        // Red Line 3: Log undefined roles for admin evaluation, default to safe DENY
        console.warn(`[RBAC-ALERT] Unrecognized role encountered: "${role}". Access DENIED by default.`);
        return false;
    }

    const resourceConfig = roleConfig[resource];
    if (!resourceConfig) {
        console.warn(`[RBAC-ALERT] Unrecognized resource: "${resource}" for role "${canonicalRole}". Access DENIED.`);
        return false;
    }

    return Boolean(resourceConfig[canonicalAction]);
}

/**
 * Returns permissions map for a role.
 */
function getRolePermissions(role) {
    const canonicalRole = normalizeRole(role);
    return ROLE_PERMISSIONS_MATRIX[canonicalRole] || null;
}

module.exports = {
    ROLE_PERMISSIONS_MATRIX,
    normalizeRole,
    isAllowed,
    getRolePermissions
};
