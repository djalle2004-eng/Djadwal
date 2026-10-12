const express = require('express');
const router = express.Router();
const { executeQuery } = require('./database');
const bcrypt = require('bcrypt');
const { SignJWT, jwtVerify } = require('jose');
const emailService = require('./emailService');

// --- Types & Constants ---
const PRIMARY_JWT_RAW = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const PREVIOUS_JWT_RAW = process.env.JWT_SECRET_PREVIOUS;

const JWT_SECRET = new TextEncoder().encode(PRIMARY_JWT_RAW);
const JWT_SECRET_PREVIOUS = PREVIOUS_JWT_RAW ? new TextEncoder().encode(PREVIOUS_JWT_RAW) : null;

// --- Auth Helpers ---
async function createToken(payload) {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('7d')
        .setIssuedAt()
        .sign(JWT_SECRET);
}

async function verifyToken(token) {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload;
    } catch (primaryError) {
        // Seamless key rotation fallback: verify with previous secret
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

// Middleware to verify session
async function requireAuth(req, res, next) {
    // Check hardened __Host-token first, with legacy fallback to token cookie
    const token = req.cookies['__Host-token'] || req.cookies.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const user = await verifyToken(token);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    req.user = user;
    next();
}

// Helper to record audit logs
async function logAudit(req, { action, entity_type, entity_id = null, details = null, user_id = null }) {
    try {
        let finalUserId = user_id;
        if (!finalUserId && req) {
            if (req.user && req.user.id) {
                finalUserId = req.user.id;
            } else if (req.user && req.user.userId) {
                finalUserId = req.user.userId;
            } else if (req.headers && req.headers['x-user-id']) {
                const parsed = parseInt(req.headers['x-user-id'], 10);
                if (!isNaN(parsed)) finalUserId = parsed;
            } else if (req.body && req.body.currentUserId) {
                finalUserId = parseInt(req.body.currentUserId, 10);
            } else if (req.cookies && req.cookies.token) {
                const payload = await verifyToken(req.cookies.token);
                if (payload && (payload.id || payload.userId)) {
                    finalUserId = payload.id || payload.userId;
                }
            }
        }

        const ip = req ? (req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || null) : null;

        await executeQuery(
            `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [finalUserId || null, action, entity_type, entity_id, details, ip]
        );
    } catch (err) {
        console.error('⚠️ Failed to write audit log:', err.message);
    }
}

// --- Auth Routes ---

router.post('/auth/signup', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !email.endsWith('@univ-eloued.dz')) {
            return res.status(400).json({ error: 'Email must be @univ-eloued.dz' });
        }

        const existingUser = await executeQuery('SELECT * FROM users WHERE email = $1', [email]);
        if (existingUser.length > 0) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const safeEmail = String(email).trim();
        const result = await executeQuery(
            "INSERT INTO users (username, email, password_hash, role, is_active) VALUES (?, ?, ?, 'PROFESSOR', 1) RETURNING id, email, role",
            [safeEmail, safeEmail, hashedPassword]
        );
        const user = result[0];

        // Create Professor Profile Placeholder
        // 'name' is required by legacy Djadwal schema
        await executeQuery(
            "INSERT INTO professors (user_id, name, professional_email, full_name_arabic, full_name_latin, academic_rank, department, primary_phone, phd_specialization) VALUES (?, ?, ?, '', '', '', '', '', '')",
            [user.id, email.split('@')[0], email]
        );

        // Generate Token
        const token = await createToken({ userId: user.id, email: user.email, role: user.role });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({ user });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/auth/signin', async (req, res) => {
    try {
        const { email, password } = req.body;

        const users = await executeQuery('SELECT * FROM users WHERE email = $1', [email]);
        const user = users[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!user.is_active) {
            return res.status(403).json({ error: 'Account is disabled' });
        }

        const token = await createToken({ userId: user.id, email: user.email, role: user.role });

        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        res.json({ user: { id: user.id, email: user.email, role: user.role } });
    } catch (error) {
        console.error('Signin error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.post('/auth/signout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true });
});

router.get('/auth/me', async (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.json({ user: null });

    const payload = await verifyToken(token);
    if (!payload) return res.json({ user: null });

    const users = await executeQuery('SELECT id, email, role FROM users WHERE id = $1', [payload.userId]);
    res.json({ user: users[0] || null });
});

router.post('/auth/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const users = await executeQuery('SELECT * FROM users WHERE email = $1', [email]);
        const user = users[0];

        if (!user) return res.json({ success: true }); // Silent fail for security

        // Generate Token
        const token = require('crypto').randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour

        await executeQuery(
            'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
            [user.id, token, expiresAt.toISOString()] // ISO string for SQLite/Turso
        );

        // Send Email (if configured)
        const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173'}/takleef/reset-password?token=${token}`;

        if (process.env.EMAIL_USER) {
            await emailService.sendEmail(
                email,
                'استعادة كلمة المرور - منصة التكليف',
                `<p>لاستعادة كلمة المرور، يرجى النقر على الرابط التالي:</p><a href="${resetLink}">${resetLink}</a>`
            );
        } else {
            // For dev without email service, maybe log it or return it?
            // Returning it in dev mode only
            if (process.env.NODE_ENV !== 'production') {
                return res.json({ success: true, debugToken: token, debugLink: resetLink });
            }
        }

        res.json({ success: true });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Profile Routes ---

router.get('/profile', requireAuth, async (req, res) => {
    try {
        const result = await executeQuery('SELECT * FROM professors WHERE user_id = $1', [req.user.userId]);
        const profile = result[0];

        // Return email from user record if not in profile (or sync it)
        if (profile && !profile.professional_email) {
            profile.professional_email = req.user.email;
        }

        res.json(profile || { user_id: req.user.userId, email: req.user.email });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/profile', requireAuth, async (req, res) => {
    try {
        const {
            full_name_arabic, full_name_latin, academic_rank,
            professional_email, personal_email, primary_phone, secondary_phone,
            phd_specialization, field_of_research, department
        } = req.body;

        // Upsert profile
        const existing = await executeQuery('SELECT id FROM professors WHERE user_id = $1', [req.user.userId]);

        if (existing.length > 0) {
            await executeQuery(
                `UPDATE professors SET 
                full_name_arabic=$1, full_name_latin=$2, academic_rank=$3, 
                professional_email=$4, personal_email=$5, primary_phone=$6, 
                secondary_phone=$7, phd_specialization=$8, field_of_research=$9, 
                department=$10, profile_completed=1
                WHERE user_id=$11`,
                [full_name_arabic, full_name_latin, academic_rank, professional_email, personal_email, primary_phone, secondary_phone, phd_specialization, field_of_research, department, req.user.userId]
            );
        } else {
            await executeQuery(
                `INSERT INTO professors 
                (user_id, full_name_arabic, full_name_latin, academic_rank, professional_email, personal_email, primary_phone, secondary_phone, phd_specialization, field_of_research, department, profile_completed) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1)`,
                [req.user.userId, full_name_arabic, full_name_latin, academic_rank, professional_email, personal_email, primary_phone, secondary_phone, phd_specialization, field_of_research, department]
            );
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Preferences Routes ---

router.get('/preferences', requireAuth, async (req, res) => {
    try {
        const { academic_year } = req.query; // optional filter

        // Get all active modules first
        // In a real app we might filter by department/specialty

        const modules = await executeQuery('SELECT * FROM modules ORDER BY semester, module_name_arabic');
        const preferences = await executeQuery('SELECT * FROM preferences WHERE professor_id = $1', [req.user.userId]);

        res.json({ modules, preferences });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/preferences', requireAuth, async (req, res) => {
    try {
        const { preferences, academic_year_id } = req.body; // preferences: Array of { module_id, teaching_type, priority }

        if (!Array.isArray(preferences)) {
            return res.status(400).json({ error: 'Preferences must be an array' });
        }

        // Transaction-like approach (delete all for this year then insert new ones? Or Upsert?)
        // Takleef logic seems to be specific selections.
        // Let's iterate and upsert.

        for (const pref of preferences) {
            // Check if exists
            const existing = await executeQuery(
                'SELECT id FROM preferences WHERE professor_id = $1 AND module_id = $2 AND academic_year_id = $3',
                [req.user.userId, pref.module_id, academic_year_id || 1] // Default year 1 if not sent
            );

            if (existing.length > 0) {
                await executeQuery(
                    'UPDATE preferences SET teaching_type = $1, priority_level = $2 WHERE id = $3',
                    [pref.teaching_type, pref.priority_level, existing[0].id]
                );
            } else {
                await executeQuery(
                    'INSERT INTO preferences (professor_id, module_id, academic_year_id, teaching_type, priority_level) VALUES ($1, $2, $3, $4, $5)',
                    [req.user.userId, pref.module_id, academic_year_id || 1, pref.teaching_type, pref.priority_level]
                );
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Preferences save error:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/departments', async (req, res) => {
    try {
        const result = await executeQuery('SELECT * FROM departments ORDER BY name');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/departments', async (req, res) => {
    try {
        const { name, code } = req.body;
        const result = await executeQuery('INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING *', [name, code]);
        await logAudit(req, { action: 'create', entity_type: 'department', entity_id: result[0]?.id, details: `إضافة قسم: ${name}` });
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/departments/:id', async (req, res) => {
    try {
        const { name, code } = req.body;
        const { id } = req.params;
        const result = await executeQuery('UPDATE departments SET name = $1, code = $2 WHERE id = $3 RETURNING *', [name, code, id]);
        await logAudit(req, { action: 'update', entity_type: 'department', entity_id: id, details: `تعديل قسم: ${name}` });
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/departments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('DELETE FROM departments WHERE id = $1', [id]);
        await logAudit(req, { action: 'delete', entity_type: 'department', entity_id: id, details: `حذف قسم رقم: ${id}` });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Professors ---
router.get('/professors', async (req, res) => {
    try {
        const result = await executeQuery('SELECT * FROM professors ORDER BY name');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/professors', async (req, res) => {
    try {
        const { name, email, metadata } = req.body;
        const meta = typeof metadata === 'string' ? JSON.parse(metadata) : (metadata || {});
        const phone = (meta.phone || '').trim();
        const title = (meta.title || '').trim();
        const academic_title = (meta.academic_title || '').trim();

        const result = await executeQuery(
            'INSERT INTO professors (name, email, phone, title, academic_title) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, email, phone, title, academic_title]
        );
        await logAudit(req, { action: 'create', entity_type: 'professor', entity_id: result[0]?.id, details: `إضافة أستاذ: ${name}` });
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/professors/:id', async (req, res) => {
    try {
        const { name, email, metadata } = req.body;
        const { id } = req.params;
        const meta = typeof metadata === 'string' ? JSON.parse(metadata) : (metadata || {});
        const phone = (meta.phone || '').trim();
        const title = (meta.title || '').trim();
        const academic_title = (meta.academic_title || '').trim();

        const result = await executeQuery(
            'UPDATE professors SET name = $1, email = $2, phone = $3, title = $4, academic_title = $5 WHERE id = $6 RETURNING *',
            [name, email, phone, title, academic_title, id]
        );
        await logAudit(req, { action: 'update', entity_type: 'professor', entity_id: id, details: `تعديل أستاذ: ${name}` });
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/professors/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('DELETE FROM professors WHERE id = $1', [id]);
        await logAudit(req, { action: 'delete', entity_type: 'professor', entity_id: id, details: `حذف أستاذ رقم: ${id}` });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Rooms ---
router.get('/rooms', async (req, res) => {
    try {
        const result = await executeQuery('SELECT * FROM rooms ORDER BY name');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/rooms', async (req, res) => {
    try {
        const { name, capacity } = req.body;
        const result = await executeQuery('INSERT INTO rooms (name, capacity) VALUES ($1, $2) RETURNING *', [name, capacity]);
        await logAudit(req, { action: 'create', entity_type: 'room', entity_id: result[0]?.id, details: `إضافة قاعة: ${name} (سعة: ${capacity || 0})` });
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/rooms/:id', async (req, res) => {
    try {
        const { name, capacity } = req.body;
        const { id } = req.params;
        const result = await executeQuery('UPDATE rooms SET name = $1, capacity = $2 WHERE id = $3 RETURNING *', [name, capacity, id]);
        await logAudit(req, { action: 'update', entity_type: 'room', entity_id: id, details: `تعديل قاعة: ${name}` });
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/rooms/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('DELETE FROM rooms WHERE id = $1', [id]);
        await logAudit(req, { action: 'delete', entity_type: 'room', entity_id: id, details: `حذف قاعة رقم: ${id}` });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Courses ---
router.get('/courses', async (req, res) => {
    try {
        const result = await executeQuery('SELECT * FROM courses ORDER BY name');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/courses', async (req, res) => {
    try {
        const { name, code, metadata } = req.body;
        const result = await executeQuery('INSERT INTO courses (name, code, metadata) VALUES ($1, $2, $3) RETURNING *', [name, code, metadata]);
        await logAudit(req, { action: 'create', entity_type: 'course', entity_id: result[0]?.id, details: `إضافة مقياس: ${name} (${code || ''})` });
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/courses/:id', async (req, res) => {
    try {
        const { name, code, metadata } = req.body;
        const { id } = req.params;
        const result = await executeQuery('UPDATE courses SET name = $1, code = $2, metadata = $3 WHERE id = $4 RETURNING *', [name, code, metadata, id]);
        await logAudit(req, { action: 'update', entity_type: 'course', entity_id: id, details: `تعديل مقياس: ${name}` });
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/courses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('DELETE FROM courses WHERE id = $1', [id]);
        await logAudit(req, { action: 'delete', entity_type: 'course', entity_id: id, details: `حذف مقياس رقم: ${id}` });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Groups ---
router.get('/groups', async (req, res) => {
    try {
        const result = await executeQuery('SELECT * FROM groups ORDER BY name');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/groups', async (req, res) => {
    try {
        const { name, department_id, group_type, specialization, parent_group_id, year } = req.body;
        const result = await executeQuery(
            'INSERT INTO groups (name, department_id, group_type, specialization, parent_group_id, year) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, department_id, group_type, specialization, parent_group_id, year]
        );
        await logAudit(req, { action: 'create', entity_type: 'group', entity_id: result[0]?.id, details: `إضافة فوج: ${name} (${specialization || ''})` });
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/groups/:id', async (req, res) => {
    try {
        const { name, department_id, group_type, specialization, parent_group_id, year } = req.body;
        const { id } = req.params;
        const result = await executeQuery(
            'UPDATE groups SET name = $1, department_id = $2, group_type = $3, specialization = $4, parent_group_id = $5, year = $6 WHERE id = $7 RETURNING *',
            [name, department_id, group_type, specialization, parent_group_id, year, id]
        );
        await logAudit(req, { action: 'update', entity_type: 'group', entity_id: id, details: `تعديل فوج: ${name}` });
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/groups/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('DELETE FROM groups WHERE id = $1', [id]);
        await logAudit(req, { action: 'delete', entity_type: 'group', entity_id: id, details: `حذف فوج رقم: ${id}` });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Assignments ---
router.get('/assignments', async (req, res) => {
    try {
        const { academicYear, semester, specialization } = req.query;
        let query = `
      SELECT a.*, 
             p.name as professor_name,
             c.name as course_name,
             r.name as room_name,
             g.name as group_name
      FROM assignments a
      LEFT JOIN professors p ON a.professor_id = p.id
      LEFT JOIN courses c ON a.course_id = c.id
      LEFT JOIN rooms r ON a.room_id = r.id
      LEFT JOIN groups g ON a.group_id = g.id
    `;

        const conditions = [];
        const params = [];

        if (academicYear) {
            conditions.push('a.academic_year = $' + (params.length + 1));
            params.push(academicYear);
        }

        if (semester) {
            conditions.push('a.semester = $' + (params.length + 1));
            params.push(semester);
        }

        if (specialization) {
            conditions.push('g.specialization = $' + (params.length + 1));
            params.push(specialization);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY a.day_of_week, a.start_time';

        const result = await executeQuery(query, params);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/assignments', async (req, res) => {
    try {
        const { group_id, course_id, professor_id, room_id, day_of_week, start_time, end_time, academic_year, semester, specialization } = req.body;
        const result = await executeQuery(
            'INSERT INTO assignments (group_id, course_id, professor_id, room_id, day_of_week, start_time, end_time, academic_year, semester, specialization) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
            [group_id, course_id, professor_id, room_id, day_of_week, start_time, end_time, academic_year, semester, specialization]
        );
        await logAudit(req, {
            action: 'create',
            entity_type: 'assignment',
            entity_id: result[0]?.id,
            details: `إضافة حصة في الجدول (يوم: ${day_of_week}, ${start_time}-${end_time})`
        });
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/assignments/:id', async (req, res) => {
    try {
        const { group_id, course_id, professor_id, room_id, day_of_week, start_time, end_time, academic_year, semester, specialization } = req.body;
        const { id } = req.params;
        const result = await executeQuery(
            'UPDATE assignments SET group_id = $1, course_id = $2, professor_id = $3, room_id = $4, day_of_week = $5, start_time = $6, end_time = $7, academic_year = $8, semester = $9, specialization = $10 WHERE id = $11 RETURNING *',
            [group_id, course_id, professor_id, room_id, day_of_week, start_time, end_time, academic_year, semester, specialization, id]
        );
        await logAudit(req, {
            action: 'update',
            entity_type: 'assignment',
            entity_id: id,
            details: `تعديل/نقل حصة رقم: ${id} (يوم: ${day_of_week}, ${start_time}-${end_time})`
        });
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/assignments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('DELETE FROM assignments WHERE id = $1', [id]);
        await logAudit(req, { action: 'delete', entity_type: 'assignment', entity_id: id, details: `حذف حصة رقم: ${id}` });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Academic Years ---
router.get('/academic-years', async (req, res) => {
    try {
        const result = await executeQuery('SELECT * FROM academic_years ORDER BY year_name');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/academic-years/active', async (req, res) => {
    try {
        const result = await executeQuery('SELECT * FROM academic_years WHERE is_current = 1 LIMIT 1');
        res.json(result[0] || null);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/academic-years', async (req, res) => {
    try {
        const { yearName, setAsCurrent } = req.body;
        const result = await executeQuery(
            'INSERT INTO academic_years (year_name, is_current) VALUES ($1, $2) RETURNING *',
            [yearName, setAsCurrent ? 1 : 0]
        );

        if (setAsCurrent) {
            await executeQuery('UPDATE academic_years SET is_current = 0 WHERE id != $1', [result[0].id]);
        }

        await logAudit(req, { action: 'create', entity_type: 'academic_year', entity_id: result[0]?.id, details: `إضافة سنة دراسية: ${yearName}` });
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/academic-years/:id/activate', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('UPDATE academic_years SET is_current = 0');
        const result = await executeQuery('UPDATE academic_years SET is_current = 1 WHERE id = $1 RETURNING *', [id]);
        await logAudit(req, { action: 'activate', entity_type: 'academic_year', entity_id: id, details: `تفعيل السنة الدراسية رقم: ${id}` });
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/academic-years/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('DELETE FROM academic_years WHERE id = $1', [id]);
        await logAudit(req, { action: 'delete', entity_type: 'academic_year', entity_id: id, details: `حذف سنة دراسية رقم: ${id}` });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Semesters ---
router.get('/semesters', async (req, res) => {
    try {
        const { academicYearId } = req.query;
        let query = 'SELECT * FROM semesters';
        let params = [];

        if (academicYearId) {
            query += ' WHERE academic_year_id = $1';
            params.push(academicYearId);
        }

        query += ' ORDER BY semester_name';
        const result = await executeQuery(query, params);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/semesters/active', async (req, res) => {
    try {
        const { academicYearId } = req.query;
        let query = 'SELECT * FROM semesters WHERE is_current = 1';
        let params = [];

        if (academicYearId) {
            query += ' AND academic_year_id = $1';
            params.push(academicYearId);
        }

        query += ' LIMIT 1';
        const result = await executeQuery(query, params);
        res.json(result[0] || null);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/semesters', async (req, res) => {
    try {
        const { academicYearId, semesterName, startDate, endDate, setAsCurrent, isPublic } = req.body;
        const result = await executeQuery(
            'INSERT INTO semesters (academic_year_id, semester_name, start_date, end_date, is_current, is_public) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [academicYearId, semesterName, startDate, endDate, setAsCurrent ? 1 : 0, isPublic !== false ? 1 : 0]
        );

        if (setAsCurrent) {
            await executeQuery('UPDATE semesters SET is_current = 0 WHERE id != $1', [result[0].id]);
        }

        await logAudit(req, { action: 'create', entity_type: 'semester', entity_id: result[0]?.id, details: `إضافة فصل دراسي: ${semesterName}` });
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/semesters/:id', async (req, res) => {
    try {
        const { semesterName, startDate, endDate, isPublic } = req.body;
        const { id } = req.params;

        // Build dynamic update query to handle optional isPublic
        let query = 'UPDATE semesters SET semester_name = $1, start_date = $2, end_date = $3';
        let params = [semesterName, startDate, endDate];

        if (isPublic !== undefined) {
            query += ', is_public = $4';
            params.push(isPublic ? 1 : 0);
            query += ' WHERE id = $5 RETURNING *';
            params.push(id);
        } else {
            query += ' WHERE id = $4 RETURNING *';
            params.push(id);
        }

        const result = await executeQuery(query, params);
        await logAudit(req, { action: 'update', entity_type: 'semester', entity_id: id, details: `تعديل فصل دراسي: ${semesterName}` });
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/semesters/:id/activate', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('UPDATE semesters SET is_current = 0');
        const result = await executeQuery('UPDATE semesters SET is_current = 1 WHERE id = $1 RETURNING *', [id]);
        await logAudit(req, { action: 'activate', entity_type: 'semester', entity_id: id, details: `تفعيل الفصل الدراسي رقم: ${id}` });
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/semesters/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('DELETE FROM semesters WHERE id = $1', [id]);
        await logAudit(req, { action: 'delete', entity_type: 'semester', entity_id: id, details: `حذف فصل دراسي رقم: ${id}` });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Extra Sessions ---
router.get('/extra-sessions', async (req, res) => {
    try {
        const result = await executeQuery(`
            SELECT 
                es.*,
                p.name as professor_name,
                c.name as course_name,
                g.name as group_name,
                r.name as room_name
            FROM extra_sessions es
            LEFT JOIN professors p ON es.professor_id = p.id
            LEFT JOIN courses c ON es.course_id = c.id
            LEFT JOIN groups g ON es.group_id = g.id
            LEFT JOIN rooms r ON es.room_id = r.id
            ORDER BY es.session_date, es.start_time
        `);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Archive past sessions
router.post('/extra-sessions/archive', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const result = await executeQuery(
            'UPDATE extra_sessions SET is_archived = 1 WHERE session_date < $1 AND (is_archived = 0 OR is_archived IS NULL) RETURNING id',
            [today]
        );
        res.json({ archived: result.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/extra-sessions', async (req, res) => {
    try {
        const session = req.body;
        // Whitelist valid columns to prevent SQL errors with extra UI fields
        const validColumns = [
            'room_id', 'professor_id', 'group_id', 'course_id', 'session_date',
            'start_time', 'end_time', 'session_type', 'description', 'reason',
            'semester', 'academic_year', 'exam_note', 'is_archived'
        ];

        const filteredSession = {};
        Object.keys(session).forEach(key => {
            if (validColumns.includes(key)) {
                filteredSession[key] = session[key];
            }
        });

        // Ensure defaults if missing
        if (!filteredSession.is_archived) filteredSession.is_archived = 0;

        const columns = Object.keys(filteredSession).join(', ');
        const placeholders = Object.keys(filteredSession).map((_, i) => `$${i + 1}`).join(', ');
        const values = Object.values(filteredSession);

        const result = await executeQuery(
            `INSERT INTO extra_sessions (${columns}) VALUES (${placeholders}) RETURNING *`,
            values
        );
        const created = result[0] || {};
        await logAudit(req, {
            action: 'create',
            entity_type: 'extra_session',
            entity_id: created.id,
            details: `إضافة حصة إضافية/امتحان لتاريخ ${filteredSession.session_date || ''} الساعة ${filteredSession.start_time || ''}`
        });
        res.json(created);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/extra-sessions/:id', async (req, res) => {
    try {
        const session = req.body;
        const { id } = req.params;

        const validColumns = [
            'room_id', 'professor_id', 'group_id', 'course_id', 'session_date',
            'start_time', 'end_time', 'session_type', 'description', 'reason',
            'semester', 'academic_year', 'exam_note', 'is_archived'
        ];

        const filteredSession = {};
        Object.keys(session).forEach(key => {
            if (validColumns.includes(key)) {
                filteredSession[key] = session[key];
            }
        });

        const updates = Object.keys(filteredSession).map((key, i) => `${key} = $${i + 1}`).join(', ');
        const values = [...Object.values(filteredSession), id];

        const result = await executeQuery(
            `UPDATE extra_sessions SET ${updates} WHERE id = $${values.length} RETURNING *`,
            values
        );
        await logAudit(req, {
            action: 'update',
            entity_type: 'extra_session',
            entity_id: id,
            details: `تعديل حصة إضافية/امتحان رقم: ${id}`
        });
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/extra-sessions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('DELETE FROM extra_sessions WHERE id = $1', [id]);
        await logAudit(req, {
            action: 'delete',
            entity_type: 'extra_session',
            entity_id: id,
            details: `حذف حصة إضافية/امتحان رقم: ${id}`
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Users & Auth ---
router.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const users = await executeQuery('SELECT * FROM users WHERE username = $1', [username]);

        if (users.length === 0) {
            return res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect' });
        }

        const user = users[0];
        const match = await bcrypt.compare(password, user.password_hash);

        if (!match) {
            return res.status(401).json({ error: 'Nom d\'utilisateur ou mot de passe incorrect' });
        }

        if (!user.is_active) {
            return res.status(403).json({ error: 'Compte désactivé' });
        }

        // Update last login
        await executeQuery('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

        // Audit log login
        await logAudit(req, {
            action: 'login',
            entity_type: 'user',
            entity_id: user.id,
            details: `تسجيل الدخول للمستخدم: ${user.username} (${user.role || ''})`,
            user_id: user.id
        });

        // Create session token
        const token = await createToken({
            id: user.id,
            username: user.username,
            role: user.role
        });

        const isProduction = process.env.NODE_ENV === 'production';
        const cookieMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

        if (isProduction) {
            // __Host- prefix guarantees Secure, Path=/, and origin-bound
            res.cookie('__Host-token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'strict',
                path: '/',
                maxAge: cookieMaxAge
            });

            // Red Line 2: Legacy fallback cookie for 1 release unless disabled
            if (process.env.LEGACY_COOKIE_FALLBACK !== 'false') {
                res.cookie('token', token, {
                    httpOnly: true,
                    secure: true,
                    sameSite: 'strict',
                    path: '/',
                    maxAge: cookieMaxAge
                });
            }
        } else {
            // Development cookie (browsers reject __Host- over plain HTTP localhost)
            res.cookie('token', token, {
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
                path: '/',
                maxAge: cookieMaxAge
            });
        }

        // Remove password hash before sending back
        delete user.password_hash;
        user.token = token;
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/auth/logout - Clear session cookies
router.post('/auth/logout', (req, res) => {
    res.clearCookie('__Host-token', { path: '/' });
    res.clearCookie('token', { path: '/' });
    res.json({ success: true, message: 'Déconnexion réussie' });
});

router.get('/users', async (req, res) => {
    try {
        const result = await executeQuery('SELECT id, username, full_name, email, role, professor_id, is_active, last_login, created_at FROM users ORDER BY username');
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/users', async (req, res) => {
    try {
        const { username, password, full_name, email, role, professor_id } = req.body;
        const password_hash = await bcrypt.hash(password, 10);

        const result = await executeQuery(
            'INSERT INTO users (username, password_hash, full_name, email, role, professor_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, username, full_name, email, role, professor_id, is_active, created_at',
            [username, password_hash, full_name, email, role, professor_id]
        );
        const newUser = result[0];
        await logAudit(req, {
            action: 'create',
            entity_type: 'user',
            entity_id: newUser.id,
            details: `إنشاء مستخدم جديد: ${username} (${role || 'user'})`
        });
        res.json(newUser);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/users/:id', async (req, res) => {
    try {
        const { username, full_name, email, role, professor_id, is_active } = req.body;
        const { id } = req.params;

        const result = await executeQuery(
            'UPDATE users SET username = $1, full_name = $2, email = $3, role = $4, professor_id = $5, is_active = $6 WHERE id = $7 RETURNING id, username, full_name, email, role, professor_id, is_active, created_at',
            [username, full_name, email, role, professor_id, is_active, id]
        );
        await logAudit(req, {
            action: 'update',
            entity_type: 'user',
            entity_id: id,
            details: `تحديث بيانات المستخدم: ${username || id}`
        });
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('DELETE FROM users WHERE id = $1', [id]);
        await logAudit(req, {
            action: 'delete',
            entity_type: 'user',
            entity_id: id,
            details: `حذف المستخدم رقم: ${id}`
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/users/:id/permissions', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await executeQuery('SELECT permissions FROM users WHERE id = $1', [id]);
        if (result.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Return parsed JSON or empty object
        const permissions = result[0].permissions ? JSON.parse(result[0].permissions) : {};
        res.json(permissions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/users/:id/permissions', async (req, res) => {
    try {
        const { id } = req.params;
        const { permissions } = req.body; // Expecting JSON object
        const permissionsJson = JSON.stringify(permissions);

        await executeQuery('UPDATE users SET permissions = $1 WHERE id = $2', [permissionsJson, id]);
        await logAudit(req, {
            action: 'update',
            entity_type: 'user',
            entity_id: id,
            details: `تعديل صلاحيات المستخدم رقم: ${id}`
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Audit Logs ---
router.get('/audit-logs', async (req, res) => {
    try {
        const { user_id, action, entity_type, limit = 1000 } = req.query;
        let query = `
            SELECT 
                al.*,
                u.username as user_name,
                u.full_name
            FROM audit_log al
            LEFT JOIN users u ON al.user_id = u.id
        `;
        const conditions = [];
        const params = [];

        if (user_id) {
            params.push(user_id);
            conditions.push(`al.user_id = $${params.length}`);
        }
        if (action && action !== 'all') {
            params.push(action);
            conditions.push(`al.action = $${params.length}`);
        }
        if (entity_type && entity_type !== 'all') {
            params.push(entity_type);
            conditions.push(`al.entity_type = $${params.length}`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ` ORDER BY al.created_at DESC LIMIT ${parseInt(limit, 10) || 1000}`;

        const result = await executeQuery(query, params);
        const rows = Array.isArray(result) ? result : (result?.rows || []);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/audit-logs', async (req, res) => {
    try {
        const { action, entity_type, entity_id, details } = req.body;
        await logAudit(req, { action, entity_type, entity_id, details });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Time Slots ---
router.get('/time-slots', async (req, res) => {
    try {
        // Hardcoded time slots as they are usually static, or fetch from DB if you have a table
        const timeSlots = [
            { id: 1, start: '08:00', end: '09:30', label: '08:00 - 09:30' },
            { id: 2, start: '09:30', end: '11:00', label: '09:30 - 11:00' },
            { id: 3, start: '11:00', end: '12:30', label: '11:00 - 12:30' },
            { id: 4, start: '12:30', end: '14:00', label: '12:30 - 14:00' },
            { id: 5, start: '14:00', end: '15:30', label: '14:00 - 15:30' },
            { id: 6, start: '15:30', end: '17:00', label: '15:30 - 17:00' }
        ];
        res.json(timeSlots);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Ensure permissions column exists in users table
const ensurePermissionsColumn = async () => {
    try {
        await executeQuery('SELECT permissions FROM users LIMIT 1');
        console.log('✅ Verified permissions column exists in users table');
    } catch (error) {
        // If error (likely "no such column"), add it
        console.log('⚠️ Permissions column missing, adding it...');
        try {
            await executeQuery('ALTER TABLE users ADD COLUMN permissions TEXT');
            console.log('✅ Added permissions column to users table');
        } catch (alterError) {
            console.error('❌ Failed to add permissions column:', alterError);
        }
    }
};
ensurePermissionsColumn();

// --- Logo Upload & Print Settings ---
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for logo uploads (Memory Storage for Database Persistence)
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|svg|ico/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only image files (JPEG, PNG, SVG, ICO) are allowed'));
        }
    }
});

// Upload logo endpoint
router.post('/upload-logo', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { type } = req.body; // 'university' or 'faculty'

        // Convert buffer to Base64 Data URI
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;

        // Save to database (using camelCase keys to match frontend)
        const settingKey = type === 'university' ? 'universityLogoUrl' : 'facultyLogoUrl';

        await executeQuery(
            `INSERT INTO print_settings (setting_key, setting_value, updated_at) 
             VALUES ($1, $2, CURRENT_TIMESTAMP) 
             ON CONFLICT(setting_key) 
             DO UPDATE SET setting_value = $3, updated_at = CURRENT_TIMESTAMP`,
            [settingKey, dataURI, dataURI]
        );

        await logAudit(req, {
            action: 'update',
            entity_type: 'settings',
            entity_id: settingKey,
            details: `تحديث شعار ${type === 'university' ? 'الجامعة' : 'الكلية'}`
        });

        res.json({ url: dataURI, message: 'Logo uploaded successfully' });
    } catch (error) {
        console.error('Error uploading logo:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get print settings
router.get('/print-settings', async (req, res) => {
    try {
        const settings = await executeQuery('SELECT setting_key, setting_value FROM print_settings');

        const result = {};

        settings.forEach(setting => {
            let key = setting.setting_key;
            let val = setting.setting_value;

            // Map legacy snake_case to camelCase for frontend compatibility
            if (key === 'university_logo_url') key = 'universityLogoUrl';
            if (key === 'faculty_logo_url') key = 'facultyLogoUrl';
            if (key === 'university_name') key = 'universityName';
            if (key === 'faculty_name') key = 'facultyName';

            // Convert number strings back to numbers if possible
            const numVal = Number(val);

            if (!isNaN(numVal) && val !== '' && val !== null && !key.includes('Url') && !key.includes('Name') && !key.includes('Text')) {
                // Only parse as number if it's not a name/url/text field (safety check)
                result[key] = numVal;
            } else if (val === 'true') {
                result[key] = true;
            } else if (val === 'false') {
                result[key] = false;
            } else {
                result[key] = val;
            }
        });

        res.json(result);
    } catch (error) {
        console.error('Error fetching print settings:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update print settings
router.put('/print-settings', async (req, res) => {
    try {
        const settings = req.body;
        const keys = Object.keys(settings);

        for (const key of keys) {
            let value = settings[key];

            // Convert boolean/numbers to string for storage
            if (typeof value !== 'string') {
                value = String(value);
            }

            await executeQuery(
                `INSERT INTO print_settings (setting_key, setting_value, updated_at) 
                 VALUES ($1, $2, CURRENT_TIMESTAMP) 
                 ON CONFLICT(setting_key) 
                 DO UPDATE SET setting_value = $3, updated_at = CURRENT_TIMESTAMP`,
                [key, value, value]
            );
        }

        await logAudit(req, {
            action: 'update',
            entity_type: 'settings',
            entity_id: 'print_settings',
            details: `تحديث إعدادات الطباعة (${keys.length} إعداد)`
        });

        res.json({ success: true, message: 'Print settings updated successfully' });
    } catch (error) {
        console.error('Error updating print settings:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Backup & Export ---
router.get('/export/data', async (req, res) => {
    try {
        // Export all tables
        const backup = {
            timestamp: new Date().toISOString(),
            version: '28.11.25.Turso',
            tables: {}
        };

        // List of tables to export
        const tables = [
            'academic_years',
            'semesters',
            'departments',
            'groups',
            'professors',
            'courses',
            'rooms',
            'assignments',
            'extra_sessions',
            'users',
            'print_settings',
            'audit_log'
        ];

        // Export each table
        for (const table of tables) {
            try {
                const data = await executeQuery(`SELECT * FROM ${table}`);
                backup.tables[table] = data;
            } catch (error) {
                console.warn(`Could not export table ${table}:`, error.message);
                backup.tables[table] = [];
            }
        }

        res.json(backup);
    } catch (error) {
        console.error('Error creating backup:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Email Routes ---

const { google } = require('googleapis');



// GET /gmail-auth-url
// GET /gmail-auth-url
router.get('/gmail-auth-url', (req, res) => {
    try {
        console.log('Generating Auth URL with:', {
            clientId: process.env.GMAIL_CLIENT_ID ? 'Set' : 'Missing',
            redirectUri: process.env.GMAIL_REDIRECT_URI
        });

        const oauth2Client = new google.auth.OAuth2(
            process.env.GMAIL_CLIENT_ID,
            process.env.GMAIL_CLIENT_SECRET,
            process.env.GMAIL_REDIRECT_URI
        );

        const scopes = [
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/userinfo.email'
        ];

        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent'
        });

        res.json({ url });
    } catch (error) {
        console.error('Error generating auth URL:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /email/oauth2callback
router.get('/email/oauth2callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.status(400).send('No code provided');
    }

    try {
        const oauth2Client = new google.auth.OAuth2(
            process.env.GMAIL_CLIENT_ID,
            process.env.GMAIL_CLIENT_SECRET,
            process.env.GMAIL_REDIRECT_URI
        );

        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Fetch user profile to get email
        const oauth2 = google.oauth2({
            auth: oauth2Client,
            version: 'v2'
        });
        const { data } = await oauth2.userinfo.get();
        const userEmail = data.email;

        console.log('Authenticated user:', userEmail);

        if (tokens.refresh_token) {
            await executeQuery(
                `UPDATE email_settings 
         SET gmail_refresh_token = ?, app_email = ?, is_authenticated = 1, last_auth_date = datetime('now'), updated_at = datetime('now')
         WHERE id = 1`,
                [tokens.refresh_token, userEmail]
            );
            console.log('Successfully authenticated and saved refresh token');
        } else {
            await executeQuery(
                `UPDATE email_settings 
         SET app_email = ?, is_authenticated = 1, last_auth_date = datetime('now'), updated_at = datetime('now')
         WHERE id = 1`,
                [userEmail]
            );
            console.warn('Authenticated but no refresh token returned (already authorized?)');
        }

        // Send a script to close the popup
        res.send(`
            <html>
                <body>
                    <h1>Authentication Successful!</h1>
                    <p>Connected as: <strong>${userEmail}</strong></p>
                    <p>You can close this window now.</p>
                    <script>
                        window.close();
                    </script>
                </body>
            </html>
        `);

    } catch (error) {
        console.error('Error in OAuth callback:', error);
        res.status(500).send(`Authentication failed: ${error.message}`);
    }
});

// POST /gmail-auth-code
router.post('/gmail-auth-code', async (req, res) => {
    try {
        const { code } = req.body;

        const oauth2Client = new google.auth.OAuth2(
            process.env.GMAIL_CLIENT_ID,
            process.env.GMAIL_CLIENT_SECRET,
            process.env.GMAIL_REDIRECT_URI
        );

        const { tokens } = await oauth2Client.getToken(code);

        if (tokens.refresh_token) {
            await executeQuery(
                `UPDATE email_settings 
         SET gmail_refresh_token = ?, is_authenticated = 1, last_auth_date = datetime('now'), updated_at = datetime('now')
         WHERE id = 1`,
                [tokens.refresh_token]
            );
            res.json({ success: true });
        } else {
            // If no refresh token returned (user already authorized), try to use existing one or fail
            // Usually Google only returns refresh token on first consent or if prompt='consent'
            res.json({ success: true, note: 'No refresh token returned, assuming existing one is valid' });
        }
    } catch (error) {
        console.error('Error exchanging code:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /gmail-auth-status
router.get('/gmail-auth-status', async (req, res) => {
    try {
        const result = await executeQuery(
            'SELECT is_authenticated FROM email_settings WHERE id = 1'
        );
        res.json({ authenticated: !!result[0]?.is_authenticated });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /send-professor-schedule
router.post('/send-professor-schedule', async (req, res) => {
    try {
        console.log('🔵 ROUTE HIT: /send-professor-schedule');
        const { professorId, pdfBase64, semester } = req.body;

        if (!professorId || !pdfBase64) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 1. Get professor details
        const professors = await executeQuery('SELECT * FROM professors WHERE id = ?', [professorId]);
        if (professors.length === 0) {
            return res.status(404).json({ error: 'Professor not found' });
        }
        const professor = professors[0];

        if (!professor.email) {
            return res.status(400).json({ error: 'Professor has no email address' });
        }

        // 2. Get email settings (refresh token)
        const settings = await executeQuery('SELECT * FROM email_settings WHERE id = 1');

        console.log('DEBUG: Full email settings:', JSON.stringify(settings, null, 2));

        if (settings.length === 0 || !settings[0].gmail_refresh_token) {
            return res.status(401).json({ error: 'Gmail not authenticated' });
        }

        console.log('DEBUG: Email settings retrieved:', settings[0]);

        const userEmail = settings[0].app_email;
        console.log('DEBUG: Using email from DB:', userEmail);
        if (!userEmail) {
            return res.status(401).json({ error: 'Sender email not found. Please reconnect Gmail.' });
        }

        // 3. Initialize email service
        await emailService.initialize(settings[0].gmail_refresh_token, userEmail);

        // 4. Convert base64 to buffer
        const pdfBuffer = Buffer.from(pdfBase64, 'base64');

        // 5. Send email
        const info = await emailService.sendProfessorSchedule(professor, pdfBuffer, semester);

        // 6. Log email
        await executeQuery(
            `INSERT INTO email_logs (professor_id, recipient_email, subject, status, sent_at)
       VALUES (?, ?, ?, 'sent', datetime('now'))`,
            [professor.id, professor.email, `جدولك الدراسي - ${semester}`]
        );

        res.json({ success: true, messageId: info.messageId });

    } catch (error) {
        console.error('❌ Error in /send-professor-schedule:', error);
        console.error('Stack trace:', error.stack);

        // Log failure
        if (req.body.professorId) {
            const professors = await executeQuery('SELECT email FROM professors WHERE id = ?', [req.body.professorId]);
            const email = professors.length > 0 ? professors[0].email : 'unknown';
            await executeQuery(
                `INSERT INTO email_logs (professor_id, recipient_email, subject, status, error_message, sent_at)
         VALUES (?, ?, ?, 'failed', ?, datetime('now'))`,
                [req.body.professorId, email, `جدولك الدراسي - ${req.body.semester}`, error.message]
            );
        }

        res.status(500).json({ error: error.message });
    }
});

// Debug route
router.get('/debug/email-settings', async (req, res) => {
    try {
        const settings = await executeQuery('SELECT * FROM email_settings');
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ==========================================
// Sandbox API Endpoints
// ==========================================

// POST /api/sandbox/save - Save current sandbox state
router.post('/sandbox/save', async (req, res) => {
    try {
        const { name, data } = req.body;

        if (!data) {
            return res.status(400).json({ error: 'Data is required' });
        }

        const snapshotName = name || `Draft ${new Date().toLocaleString()}`;
        const result = await executeQuery(
            'INSERT INTO sandbox_snapshots (name, data) VALUES (?, ?)',
            [snapshotName, JSON.stringify(data)]
        );

        await logAudit(req, {
            action: 'create',
            entity_type: 'sandbox',
            entity_id: result?.lastInsertRowid || null,
            details: `حفظ مسودة في صندوق التجارب: ${snapshotName}`
        });

        res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
        console.error('Error saving sandbox snapshot:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/sandbox/list - List saved snapshots
router.get('/sandbox/list', async (req, res) => {
    try {
        const snapshots = await executeQuery(
            'SELECT id, name, created_at FROM sandbox_snapshots ORDER BY created_at DESC'
        );
        res.json(snapshots);
    } catch (error) {
        console.error('Error listing sandbox snapshots:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/sandbox/load/:id - Load a specific snapshot
router.get('/sandbox/load/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const snapshot = await executeQuery(
            'SELECT * FROM sandbox_snapshots WHERE id = ?',
            [id]
        );

        if (!snapshot[0]) {
            return res.status(404).json({ error: 'Snapshot not found' });
        }

        // Parse the JSON data before sending
        const data = JSON.parse(snapshot[0].data);
        res.json({ ...snapshot[0], data });
    } catch (error) {
        console.error('Error loading sandbox snapshot:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/sandbox/:id - Delete a snapshot
router.delete('/sandbox/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('DELETE FROM sandbox_snapshots WHERE id = ?', [id]);
        await logAudit(req, {
            action: 'delete',
            entity_type: 'sandbox',
            entity_id: id,
            details: `حذف مسودة من صندوق التجارب رقم: ${id}`
        });
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting sandbox snapshot:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- App Config ---
router.get('/app-config', async (req, res) => {
    try {
        const rows = await executeQuery('SELECT key, value FROM app_config');
        const config = {};
        rows.forEach(row => {
            config[row.key] = row.value;
        });
        res.json(config);
    } catch (error) {
        console.error('Error fetching app config:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- AI Proxy with Rate Limiting and Token Guard ---
const aiRateLimitMap = new Map(); // ip -> { count, resetTime }

router.post('/ai/assist', async (req, res) => {
    try {
        const clientIp = req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || 'unknown';
        const now = Date.now();
        const limitWindowMs = 60 * 1000; // 1 minute
        const maxRequestsPerWindow = 15;

        // Rate limiting
        let rateData = aiRateLimitMap.get(clientIp);
        if (!rateData || now > rateData.resetTime) {
            rateData = { count: 1, resetTime: now + limitWindowMs };
            aiRateLimitMap.set(clientIp, rateData);
        } else {
            rateData.count++;
            if (rateData.count > maxRequestsPerWindow) {
                return res.status(429).json({
                    error: 'RATE_LIMIT_EXCEEDED',
                    message: 'تجاوزت الحد المسموح به من طلبات المساعد الذكي. يرجى الانتظار دقيقة واحدة قبل المحاولة مجددًا.'
                });
            }
        }

        const { prompt, model = 'gemini-1.5-pro' } = req.body;

        if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            return res.status(400).json({
                error: 'INVALID_INPUT',
                message: 'نص الطلب (prompt) مطلوب ويجب أن يكون نصًا صالحًا.'
            });
        }

        // Hard cap to prevent token flooding
        const MAX_PROMPT_LENGTH = 4000;
        if (prompt.length > MAX_PROMPT_LENGTH) {
            return res.status(400).json({
                error: 'PAYLOAD_TOO_LARGE',
                message: `حجم النص يتجاوز الحد المسموح به (${MAX_PROMPT_LENGTH} حرف).`
            });
        }

        const geminiKey = process.env.GEMINI_API_KEY;
        const openRouterKey = process.env.OPENROUTER_API_KEY;

        if (!geminiKey && !openRouterKey) {
            return res.status(503).json({
                error: 'AI_UNAVAILABLE',
                message: 'خدمة المساعد الذكي غير مهيأة على الخادم. يرجى ضبط مفتاح GEMINI_API_KEY في ملف التكوين.'
            });
        }

        if (geminiKey) {
            const chosenModel = model || 'gemini-1.5-pro';
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${chosenModel}:generateContent?key=${geminiKey}`;

            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        maxOutputTokens: 2048,
                        temperature: 0.2
                    }
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                return res.status(response.status).json({
                    error: 'GEMINI_UPSTREAM_ERROR',
                    message: 'حدث خطأ أثناء التواصل مع مزود الذكاء الاصطناعي.',
                    details: process.env.NODE_ENV !== 'production' ? errText : undefined
                });
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return res.json({ text, model: chosenModel });
        }

        if (openRouterKey) {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openRouterKey}`
                },
                body: JSON.stringify({
                    model: 'google/gemini-pro',
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: 2048
                })
            });

            if (!response.ok) {
                return res.status(502).json({
                    error: 'OPENROUTER_UPSTREAM_ERROR',
                    message: 'حدث خطأ أثناء معالجة طلب الذكاء الاصطناعي عبر OpenRouter.'
                });
            }

            const data = await response.json();
            const text = data.choices?.[0]?.message?.content || '';
            return res.json({ text, model: 'openrouter/gemini-pro' });
        }
    } catch (error) {
        res.status(500).json({
            error: 'AI_PROXY_INTERNAL_ERROR',
            message: 'حدث خطأ داخلي أثناء معالجة طلب المساعد الذكي.'
        });
    }
});

// Testing helpers exports (non-breaking, allows test validation)
router._authHelpers = {
    createToken,
    verifyToken
};

module.exports = router;
