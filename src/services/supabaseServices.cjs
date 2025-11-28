const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Departments
async function getDepartments() {
  const { data, error } = await supabase.from('departments').select('*');
  if (error) throw error;
  return data;
}

async function addDepartment(name, code) {
  const { data, error } = await supabase.from('departments').insert([{ name, code }]).select();
  if (error) throw error;
  return data[0];
}

async function updateDepartment(id, name, code) {
  const { data, error } = await supabase.from('departments').update({ name, code }).eq('id', id).select();
  if (error) throw error;
  return data[0];
}

async function deleteDepartment(id) {
  const { error } = await supabase.from('departments').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// Professors
async function getProfessors() {
  const { data, error } = await supabase.from('professors').select('*');
  if (error) throw error;
  return data;
}

async function addProfessor(name, email) {
  const { data, error } = await supabase.from('professors').insert([{ name, email }]).select();
  if (error) throw error;
  return data[0];
}

async function updateProfessor(id, name, email) {
  const { data, error } = await supabase.from('professors').update({ name, email }).eq('id', id).select();
  if (error) throw error;
  return data[0];
}

async function deleteProfessor(id) {
  const { error } = await supabase.from('professors').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// Academic Years
async function getAcademicYears() {
  const { data, error } = await supabase.from('academic_years').select('*');
  if (error) throw error;
  return data;
}

async function getActiveAcademicYear() {
  const { data, error } = await supabase.from('academic_years').select('*').eq('is_active', true).single();
  if (error) throw error;
  return data;
}

async function addAcademicYear(yearName, setAsCurrent) {
  const { data, error } = await supabase.from('academic_years').insert([
    { name: yearName, is_active: setAsCurrent }
  ]).select();
  if (error) throw error;
  return data[0];
}

async function setActiveAcademicYear(yearId) {
  const { error: resetError } = await supabase.from('academic_years').update({ is_active: false }).neq('id', yearId);
  if (resetError) throw resetError;

  const { data, error } = await supabase.from('academic_years').update({ is_active: true }).eq('id', yearId).select();
  if (error) throw error;
  return data[0];
}

async function deleteAcademicYear(yearId) {
  const { error } = await supabase.from('academic_years').delete().eq('id', yearId);
  if (error) throw error;
  return true;
}

// Semesters
async function getSemesters(academicYearId) {
  const { data, error } = await supabase.from('semesters').select('*').eq('academic_year_id', academicYearId);
  if (error) throw error;
  return data;
}

async function getActiveSemester(academicYearId) {
  const { data, error } = await supabase.from('semesters')
    .select('*')
    .eq('academic_year_id', academicYearId)
    .eq('is_active', true)
    .single();
  if (error) throw error;
  return data;
}

async function addSemester(academicYearId, semesterName, startDate, endDate, setAsCurrent) {
  const { data, error } = await supabase.from('semesters').insert([{
    academic_year_id: academicYearId,
    name: semesterName,
    start_date: startDate,
    end_date: endDate,
    is_active: setAsCurrent
  }]).select();
  if (error) throw error;
  return data[0];
}

async function setActiveSemester(semesterId) {
  const { data: semester } = await supabase.from('semesters').select('academic_year_id').eq('id', semesterId).single();
  
  const { error: resetError } = await supabase.from('semesters')
    .update({ is_active: false })
    .eq('academic_year_id', semester.academic_year_id);
  if (resetError) throw resetError;

  const { data, error } = await supabase.from('semesters').update({ is_active: true }).eq('id', semesterId).select();
  if (error) throw error;
  return data[0];
}

async function deleteSemester(semesterId) {
  const { error } = await supabase.from('semesters').delete().eq('id', semesterId);
  if (error) throw error;
  return true;
}

// Rooms
async function getRooms() {
  const { data, error } = await supabase.from('rooms').select('*');
  if (error) throw error;
  return data;
}

async function addRoom(name, capacity) {
  const { data, error } = await supabase.from('rooms').insert([{ name, capacity }]).select();
  if (error) throw error;
  return data[0];
}

async function updateRoom(id, name, capacity) {
  const { data, error } = await supabase.from('rooms').update({ name, capacity }).eq('id', id).select();
  if (error) throw error;
  return data[0];
}

async function deleteRoom(id) {
  const { error } = await supabase.from('rooms').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// Groups
async function getGroups() {
  const { data, error } = await supabase.from('groups').select('*');
  if (error) throw error;
  return data;
}

async function addGroup(name, specialization, parent_group_id, department_id, group_type, year) {
  const { data, error } = await supabase.from('groups').insert([{
    name,
    specialization,
    parent_group_id,
    department_id,
    group_type,
    year
  }]).select();
  if (error) throw error;
  return data[0];
}

async function updateGroup(id, name, specialization, parent_group_id, department_id, group_type, year) {
  const { data, error } = await supabase.from('groups').update({
    name,
    specialization,
    parent_group_id,
    department_id,
    group_type,
    year
  }).eq('id', id).select();
  if (error) throw error;
  return data[0];
}

async function deleteGroup(id) {
  const { error } = await supabase.from('groups').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// Courses
async function getCourses() {
  const { data, error } = await supabase.from('courses').select('*');
  if (error) throw error;
  return data;
}

async function addCourse(name, code, metadata) {
  const { data, error } = await supabase.from('courses').insert([{ name, code, metadata }]).select();
  if (error) throw error;
  return data[0];
}

async function updateCourse(id, name, code, metadata) {
  const { data, error } = await supabase.from('courses').update({ name, code, metadata }).eq('id', id).select();
  if (error) throw error;
  return data[0];
}

async function deleteCourse(id) {
  const { error } = await supabase.from('courses').delete().eq('id', id);
  if (error) throw error;
  return true;
}

// Assignments
async function getAssignments() {
  const { data, error } = await supabase.from('assignments').select(`
    *,
    groups (*),
    courses (*),
    professors (*),
    rooms (*)
  `);
  if (error) throw error;
  return data;
}

async function addAssignment(group_id, course_id, professor_id, room_id, day_of_week, start_time, end_time, session_type) {
  const { data, error } = await supabase.from('assignments').insert([{
    group_id,
    course_id,
    professor_id,
    room_id,
    day_of_week,
    start_time,
    end_time,
    session_type
  }]).select();
  if (error) throw error;
  return data[0];
}

async function updateAssignment(id, group_id, course_id, professor_id, room_id, day_of_week, start_time, end_time, session_type) {
  const { data, error } = await supabase.from('assignments').update({
    group_id,
    course_id,
    professor_id,
    room_id,
    day_of_week,
    start_time,
    end_time,
    session_type
  }).eq('id', id).select();
  if (error) throw error;
  return data[0];
}

async function deleteAssignment(id) {
  const { error } = await supabase.from('assignments').delete().eq('id', id);
  if (error) throw error;
  return true;
}

module.exports = {
  getDepartments,
  addDepartment,
  updateDepartment,
  deleteDepartment,
  getProfessors,
  addProfessor,
  updateProfessor,
  deleteProfessor,
  getAcademicYears,
  getActiveAcademicYear,
  addAcademicYear,
  setActiveAcademicYear,
  deleteAcademicYear,
  getSemesters,
  getActiveSemester,
  addSemester,
  setActiveSemester,
  deleteSemester,
  getRooms,
  addRoom,
  updateRoom,
  deleteRoom,
  getGroups,
  addGroup,
  updateGroup,
  deleteGroup,
  getCourses,
  addCourse,
  updateCourse,
  deleteCourse,
  getAssignments,
  addAssignment,
  updateAssignment,
  deleteAssignment
}; 