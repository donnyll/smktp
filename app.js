/**
 * Configuration
 * REPLACE THESE WITH YOUR VERCEL/SUPABASE KEYS BEFORE DEPLOYING
 */
const SUPABASE_URL = 'https://kjvterwsbnaliyxvbjqt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtqdnRlcndzYm5hbGl5eHZianF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4MzYxMzEsImV4cCI6MjA4NTQxMjEzMX0.NnhnXluFThfUrd4OVBHvwb-QV_CBPSOpDMeV7vqwYXE';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const app = {
    state: {
        user: null,
        profile: null,
        grades: [], // Cached grade levels
        currentStudent: null, // For detail view
    },

    init: async () => {
        app.showLoading(true);
        // Check session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            app.state.user = session.user;
            await app.fetchProfile();
            await app.fetchCommonData();
            app.routeUser();
        } else {
            app.showView('login');
        }
        
        // Setup Auth Listener
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_OUT') {
                app.state.user = null;
                app.state.profile = null;
                app.showView('login');
            }
        });
        
        app.setupEventListeners();
        app.showLoading(false);
    },

    // --- AUTHENTICATION ---

    handleLogin: async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        app.showLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
            app.toast(error.message, 'error');
            app.showLoading(false);
        } else {
            app.state.user = data.user;
            await app.fetchProfile();
            await app.fetchCommonData();
            app.routeUser();
            app.showLoading(false);
        }
    },

    handleLogout: async () => {
        await supabase.auth.signOut();
    },

    fetchProfile: async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', app.state.user.id)
            .single();
        
        if (error) {
            console.error('Profile fetch error', error);
            // Fallback if profile trigger failed
            app.state.profile = { role: 'teacher' };
        } else {
            app.state.profile = data;
        }
        
        // Update Sidebar UI
        document.getElementById('nav-user-info').innerText = `${data?.full_name || app.state.user.email} (${data?.role})`;
    },

    routeUser: () => {
        document.getElementById('sidebar').classList.remove('hidden');
        
        // Role based nav logic
        const isAdmin = app.state.profile.role === 'admin';
        
        if (isAdmin) {
            document.getElementById('nav-admin').classList.remove('hidden');
            app.showView('admin');
            app.loadAdminClasses(); // Default load
        } else {
            document.getElementById('nav-admin').classList.add('hidden');
            app.showView('teacher');
        }
    },

    // --- DATA FETCHING (COMMON) ---
    
    fetchCommonData: async () => {
        // Fetch Grade Levels (Static 1-5, but good to have)
        const { data } = await supabase.from('grade_levels').select('*').order('id');
        app.state.grades = data || [];
        
        // Populate generic dropdowns
        app.populateDropdown('class-grade', app.state.grades, 'id', 'name');
        app.populateDropdown('teacher-select-grade', app.state.grades, 'id', 'name');
    },

    // --- VIEW MANAGEMENT ---

    showView: (viewName) => {
        // Hide all views
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        
        // Show selected
        const viewEl = document.getElementById(`view-${viewName}`);
        if(viewEl) viewEl.classList.remove('hidden');

        // Security check for Admin view
        if (viewName === 'admin' && app.state.profile?.role !== 'admin') {
            app.toast('Unauthorized Access', 'error');
            app.showView('teacher');
        }
    },

    // --- ADMIN LOGIC ---

    switchAdminTab: (tabName) => {
        // UI Toggle
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`.tab-btn[onclick*="${tabName}"]`).classList.add('active');
        
        document.querySelectorAll('.admin-tab-content').forEach(d => d.classList.add('hidden'));
        document.getElementById(`admin-tab-${tabName}`).classList.remove('hidden');

        // Load Data
        if (tabName === 'classes') app.loadAdminClasses();
        if (tabName === 'students') app.loadAdminStudents();
        if (tabName === 'types') app.loadAdminTypes();
    },

    // 1. Admin: Classes
    loadAdminClasses: async () => {
        const gradeFilter = document.getElementById('admin-class-grade-filter').value;
        let query = supabase.from('classes').select('*, grade_levels(name)');
        if (gradeFilter) query = query.eq('grade_level_id', gradeFilter);
        
        const { data, error } = await query.order('name');
        if (error) return app.toast(error.message, 'error');

        // Populate Dropdowns for filter
        if (document.getElementById('admin-class-grade-filter').children.length === 1) {
            app.populateDropdown('admin-class-grade-filter', app.state.grades, 'id', 'name', true);
        }

        const tbody = document.getElementById('table-classes-body');
        tbody.innerHTML = '';
        data.forEach(cls => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${cls.grade_levels.name}</td>
                <td>${cls.name}</td>
                <td>
                    <button class="btn btn-danger-sm" onclick="app.deleteClass('${cls.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    handleClassSubmit: async (e) => {
        e.preventDefault();
        const gradeId = document.getElementById('class-grade').value;
        const name = document.getElementById('class-name').value;
        
        const { error } = await supabase.from('classes').insert({ grade_level_id: gradeId, name });
        if (error) app.toast(error.message, 'error');
        else {
            app.toast('Class created', 'success');
            app.closeModal('modal-class');
            app.loadAdminClasses();
        }
    },

    deleteClass: async (id) => {
        if (!confirm('Delete class? All students in it will be removed.')) return;
        const { error } = await supabase.from('classes').delete().eq('id', id);
        if (error) app.toast(error.message, 'error');
        else app.loadAdminClasses();
    },

    // 2. Admin: Students
    loadAdminStudents: async () => {
        // Load classes for filter first
        if (document.getElementById('admin-student-class-filter').children.length <= 1) {
            const {data} = await supabase.from('classes').select('*').order('name');
            app.populateDropdown('admin-student-class-filter', data, 'id', 'name', true);
            app.populateDropdown('student-class-select', data, 'id', 'name');
        }

        const classFilter = document.getElementById('admin-student-class-filter').value;
        if (!classFilter) {
            document.getElementById('table-students-body').innerHTML = '<tr><td colspan="3">Select a class to view students</td></tr>';
            return;
        }

        const { data, error } = await supabase.from('students').select('*').eq('class_id', classFilter).order('full_name');
        if (error) return app.toast(error.message, 'error');

        const tbody = document.getElementById('table-students-body');
        tbody.innerHTML = '';
        data.forEach(stu => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${stu.student_no || '-'}</td>
                <td>${stu.full_name}</td>
                <td>
                    <button class="btn btn-danger-sm" onclick="app.deleteStudent('${stu.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    handleStudentSubmit: async (e) => {
        e.preventDefault();
        const classId = document.getElementById('student-class-select').value;
        const fullName = document.getElementById('student-name').value;
        const studentNo = document.getElementById('student-no').value || null;

        const { error } = await supabase.from('students').insert({ class_id: classId, full_name: fullName, student_no: studentNo });
        if (error) app.toast(error.message, 'error');
        else {
            app.toast('Student added', 'success');
            app.closeModal('modal-student');
            app.loadAdminStudents();
        }
    },

    deleteStudent: async (id) => {
        if (!confirm('Delete student?')) return;
        const { error } = await supabase.from('students').delete().eq('id', id);
        if (error) app.toast(error.message, 'error');
        else app.loadAdminStudents();
    },

    // 3. Admin: Types
    loadAdminTypes: async () => {
        const { data, error } = await supabase.from('cocurricular_types').select('*').order('name');
        if (error) return app.toast(error.message, 'error');
        
        const tbody = document.getElementById('table-types-body');
        tbody.innerHTML = '';
        data.forEach(type => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${type.name}</td>
                <td>
                    <button class="btn btn-danger-sm" onclick="app.deleteType('${type.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    handleTypeSubmit: async (e) => {
        e.preventDefault();
        const name = document.getElementById('type-name').value;
        const { error } = await supabase.from('cocurricular_types').insert({ name });
        if (error) app.toast(error.message, 'error');
        else {
            app.toast('Type added', 'success');
            app.closeModal('modal-type');
            app.loadAdminTypes();
        }
    },

    deleteType: async (id) => {
        if (!confirm('Delete Activity Type?')) return;
        const { error } = await supabase.from('cocurricular_types').delete().eq('id', id);
        if (error) app.toast(error.message, 'error');
        else app.loadAdminTypes();
    },

    // --- TEACHER LOGIC ---

    handleTeacherGradeChange: async () => {
        const gradeId = document.getElementById('teacher-select-grade').value;
        const classSelect = document.getElementById('teacher-select-class');
        
        classSelect.innerHTML = '<option value="">Loading...</option>';
        classSelect.disabled = true;

        if (!gradeId) {
            classSelect.innerHTML = '<option value="">-- Select Grade First --</option>';
            return;
        }

        const { data, error } = await supabase.from('classes').select('*').eq('grade_level_id', gradeId).order('name');
        if (error) return app.toast(error.message, 'error');

        app.populateDropdown('teacher-select-class', data, 'id', 'name', true);
        classSelect.disabled = false;
        document.getElementById('teacher-student-list-container').classList.add('hidden');
    },

    handleTeacherClassChange: async () => {
        const classId = document.getElementById('teacher-select-class').value;
        if (!classId) return;

        const { data, error } = await supabase.from('students').select('*').eq('class_id', classId).order('full_name');
        if (error) return app.toast(error.message, 'error');

        const grid = document.getElementById('teacher-student-grid');
        grid.innerHTML = '';
        
        data.forEach(stu => {
            const card = document.createElement('div');
            card.className = 'student-card';
            card.innerHTML = `
                <h4>${stu.full_name}</h4>
                <p style="color:#666; font-size:0.8rem; margin-top:5px;">${stu.student_no || ''}</p>
            `;
            card.onclick = () => app.openStudentDetail(stu);
            grid.appendChild(card);
        });

        document.getElementById('teacher-student-list-container').classList.remove('hidden');
    },

    // --- STUDENT DETAIL & ENTRIES ---

    openStudentDetail: async (student) => {
        app.state.currentStudent = student;
        document.getElementById('detail-student-name').innerText = student.full_name;
        document.getElementById('detail-student-class').innerText = 'Loading...'; 
        
        // Fetch Class Name nicely
        const { data } = await supabase.from('classes').select('name').eq('id', student.class_id).single();
        if(data) document.getElementById('detail-student-class').innerText = data.name;

        app.showView('student-detail');
        app.loadStudentEntries(student.id);
    },

    loadStudentEntries: async (studentId) => {
        const { data, error } = await supabase
            .from('cocurricular_entries')
            .select(`
                *,
                cocurricular_types (name),
                profiles (full_name) 
            `) // Note: joined created_by to profiles to show who added it
            .eq('student_id', studentId)
            .order('activity_date', { ascending: false });

        if (error) return app.toast(error.message, 'error');

        const tbody = document.getElementById('table-entries-body');
        tbody.innerHTML = '';

        const currentUserId = app.state.user.id;
        const isAdmin = app.state.profile.role === 'admin';

        data.forEach(entry => {
            const canEdit = isAdmin || entry.created_by === currentUserId;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${entry.activity_date}</td>
                <td>${entry.cocurricular_types.name}</td>
                <td>${entry.subject}</td>
                <td>${entry.profiles?.full_name || 'Unknown'}</td>
                <td>
                    ${canEdit ? `<button class="btn btn-danger-sm" onclick="app.deleteEntry('${entry.id}')">Delete</button>` : '<span style="color:#999;font-size:0.8rem">Locked</span>'}
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    openEntryModal: async () => {
        // Load types for dropdown
        const { data } = await supabase.from('cocurricular_types').select('*').order('name');
        app.populateDropdown('entry-type', data, 'id', 'name');
        
        // Set date to today
        document.getElementById('entry-date').valueAsDate = new Date();
        document.getElementById('entry-student-id').value = app.state.currentStudent.id;
        
        app.openModal('modal-entry');
    },

    handleEntrySubmit: async (e) => {
        e.preventDefault();
        const student_id = document.getElementById('entry-student-id').value;
        const type_id = document.getElementById('entry-type').value;
        const activity_date = document.getElementById('entry-date').value;
        const subject = document.getElementById('entry-subject').value;

        // RLS will check created_by = auth.uid() automatically on insert if we omit it, 
        // OR we can send it explicitly. 
        // Best practice: Let RLS handle the check, send auth.uid() if needed by logic, 
        // but here schema has 'default auth.uid()' on column? 
        // Wait, schema has default. So we just insert data.
        
        const { error } = await supabase.from('cocurricular_entries').insert({
            student_id,
            type_id,
            activity_date,
            subject
        });

        if (error) app.toast(error.message, 'error');
        else {
            app.toast('Achievement recorded', 'success');
            app.closeModal('modal-entry');
            app.loadStudentEntries(student_id);
        }
    },

    deleteEntry: async (id) => {
        if (!confirm('Delete this entry?')) return;
        const { error } = await supabase.from('cocurricular_entries').delete().eq('id', id);
        if (error) app.toast(error.message, 'error');
        else app.loadStudentEntries(app.state.currentStudent.id);
    },

    // --- UI HELPERS ---

    setupEventListeners: () => {
        document.getElementById('login-form').addEventListener('submit', app.handleLogin);
        document.getElementById('form-class').addEventListener('submit', app.handleClassSubmit);
        document.getElementById('form-student').addEventListener('submit', app.handleStudentSubmit);
        document.getElementById('form-type').addEventListener('submit', app.handleTypeSubmit);
        document.getElementById('form-entry').addEventListener('submit', app.handleEntrySubmit);
    },

    populateDropdown: (elementId, data, valueKey, textKey, includePlaceholder = false) => {
        const select = document.getElementById(elementId);
        select.innerHTML = '';
        if (includePlaceholder) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.text = '-- Select --';
            select.appendChild(opt);
        }
        data.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item[valueKey];
            opt.text = item[textKey];
            select.appendChild(opt);
        });
    },

    openModal: (id) => {
        document.getElementById(id).classList.remove('hidden');
    },

    closeModal: (id) => {
        document.getElementById(id).classList.add('hidden');
        // Reset forms inside
        const form = document.querySelector(`#${id} form`);
        if (form) form.reset();
    },

    showLoading: (isLoading) => {
        const overlay = document.getElementById('loading-overlay');
        if (isLoading) overlay.classList.remove('hidden');
        else overlay.classList.add('hidden');
    },

    toast: (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerText = message;
        container.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }
};

// Initialize App on Load
document.addEventListener('DOMContentLoaded', app.init);