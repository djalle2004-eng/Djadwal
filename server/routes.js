const express = require('express');
const router = express.Router();
const { executeQuery } = require('./database');
const bcrypt = require('bcrypt');

// --- Departments ---
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
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/departments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('DELETE FROM departments WHERE id = $1', [id]);
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
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/professors/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('DELETE FROM professors WHERE id = $1', [id]);
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
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/rooms/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('DELETE FROM rooms WHERE id = $1', [id]);
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
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/courses/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('DELETE FROM courses WHERE id = $1', [id]);
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
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/groups/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('DELETE FROM groups WHERE id = $1', [id]);
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
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/assignments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('DELETE FROM assignments WHERE id = $1', [id]);
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
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/academic-years/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('DELETE FROM academic_years WHERE id = $1', [id]);
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
        const { academicYearId, semesterName, startDate, endDate, setAsCurrent } = req.body;
        const result = await executeQuery(
            'INSERT INTO semesters (academic_year_id, semester_name, start_date, end_date, is_current) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [academicYearId, semesterName, startDate, endDate, setAsCurrent ? 1 : 0]
        );

        if (setAsCurrent) {
            await executeQuery('UPDATE semesters SET is_current = 0 WHERE id != $1', [result[0].id]);
        }

        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/semesters/:id', async (req, res) => {
    try {
        const { semesterName, startDate, endDate } = req.body;
        const { id } = req.params;
        const result = await executeQuery(
            'UPDATE semesters SET semester_name = $1, start_date = $2, end_date = $3 WHERE id = $4 RETURNING *',
            [semesterName, startDate, endDate, id]
        );
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
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/semesters/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('DELETE FROM semesters WHERE id = $1', [id]);
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

router.post('/extra-sessions', async (req, res) => {
    try {
        const session = req.body;
        // Assuming session object matches DB columns
        const columns = Object.keys(session).join(', ');
        const placeholders = Object.keys(session).map((_, i) => `$${i + 1}`).join(', ');
        const values = Object.values(session);

        const result = await executeQuery(
            `INSERT INTO extra_sessions (${columns}) VALUES (${placeholders}) RETURNING *`,
            values
        );
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/extra-sessions/:id', async (req, res) => {
    try {
        const session = req.body;
        const { id } = req.params;

        const updates = Object.keys(session).map((key, i) => `${key} = $${i + 1}`).join(', ');
        const values = [...Object.values(session), id];

        const result = await executeQuery(
            `UPDATE extra_sessions SET ${updates} WHERE id = $${values.length} RETURNING *`,
            values
        );
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/extra-sessions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('DELETE FROM extra_sessions WHERE id = $1', [id]);
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

        // Remove password hash before sending back
        delete user.password_hash;
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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
        res.json(result[0]);
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
        res.json(result[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await executeQuery('DELETE FROM users WHERE id = $1', [id]);
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
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Audit Logs ---
router.get('/audit-logs', async (req, res) => {
    try {
        const result = await executeQuery(`
            SELECT 
                al.*,
                u.username as user_name,
                u.full_name
            FROM audit_log al
            LEFT JOIN users u ON al.user_id = u.id
            ORDER BY al.created_at DESC
            LIMIT 1000
        `);
        res.json(result.rows || []);
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

        // Save to database
        const settingKey = type === 'university' ? 'university_logo_url' : 'faculty_logo_url';

        await executeQuery(
            `INSERT INTO print_settings (setting_key, setting_value, updated_at) 
             VALUES ($1, $2, CURRENT_TIMESTAMP) 
             ON CONFLICT(setting_key) 
             DO UPDATE SET setting_value = $3, updated_at = CURRENT_TIMESTAMP`,
            [settingKey, dataURI, dataURI]
        );

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

        const result = {
            universityLogoUrl: '',
            facultyLogoUrl: '',
            universityName: 'جامعة الشهيد حمه لخضر - الوادي',
            facultyName: 'كلية العلوم الاقتصادية والتجارية وعلوم التسيير'
        };

        settings.forEach(setting => {
            if (setting.setting_key === 'university_logo_url') {
                result.universityLogoUrl = setting.setting_value || '';
            } else if (setting.setting_key === 'faculty_logo_url') {
                result.facultyLogoUrl = setting.setting_value || '';
            } else if (setting.setting_key === 'university_name') {
                result.universityName = setting.setting_value || result.universityName;
            } else if (setting.setting_key === 'faculty_name') {
                result.facultyName = setting.setting_value || result.facultyName;
            }
        });

        res.json(result);
    } catch (error) {
        console.error('Error fetching print settings:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update print settings (names only, logos via upload)
router.put('/print-settings', async (req, res) => {
    try {
        const { universityName, facultyName } = req.body;

        if (universityName) {
            await executeQuery(
                `INSERT INTO print_settings (setting_key, setting_value, updated_at) 
                 VALUES ($1, $2, CURRENT_TIMESTAMP) 
                 ON CONFLICT(setting_key) 
                 DO UPDATE SET setting_value = $3, updated_at = CURRENT_TIMESTAMP`,
                ['university_name', universityName, universityName]
            );
        }

        if (facultyName) {
            await executeQuery(
                `INSERT INTO print_settings (setting_key, setting_value, updated_at) 
                 VALUES ($1, $2, CURRENT_TIMESTAMP) 
                 ON CONFLICT(setting_key) 
                 DO UPDATE SET setting_value = $3, updated_at = CURRENT_TIMESTAMP`,
                ['faculty_name', facultyName, facultyName]
            );
        }

        res.json({ success: true, message: 'Print settings updated successfully' });
    } catch (error) {
        console.error('Error updating print settings:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
