/**
 * KONFIGURASI SUPABASE
 * Menggunakan credentials yang anda berikan.
 */
const SUPABASE_URL = "https://dflpaypdadctuhrcmavq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmbHBheXBkYWRjdHVocmNtYXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MTcwMTcsImV4cCI6MjA4NTQ5MzAxN30.YZVfciWmp7s0NofEtjGayb175RT1lZsLVoMuzZDjfdc";

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- APP STATE ---
const state = {
    user: null,
    profile: null,
    activeView: 'login',
    admin: {
        activeGrade: 1,
        activeClass: null,
        classes: [],
        students: [],
        types: []
    },
    teacher: {
        activeGrade: 1,
        activeClass: null,
        activeStudent: null,
        students: [],
        history: []
    }
};

// --- ROUTING ---
const router = {
    views: ['login', 'signup', 'admin', 'teacher', 'student-detail', 'unauthorized'],
    
    async navigate(viewId, params = {}) {
        // Auth Guards
        if (viewId === 'admin' && state.profile?.role !== 'admin') {
            viewId = 'unauthorized';
        }

        this.views.forEach(v => {
            const el = document.getElementById(`view-${v}`);
            if (el) el.classList.add('hidden');
        });

        const target = document.getElementById(`view-${viewId}`);
        if (target) target.classList.remove('hidden');
        
        state.activeView = viewId;
        
        // Navigation visual update
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.id === `nav-${viewId}`) btn.classList.add('active');
        });

        // Lifecycle Hooks
        if (viewId === 'admin') await admin.init();
        if (viewId === 'teacher') await teacher.init();
    }
};

// --- AUTH MODULE ---
const auth = {
    async init() {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            await this.handleLoginSuccess(session.user);
        } else {
            router.navigate('login');
        }

        // Listen for auth changes
        supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session) {
                await this.handleLoginSuccess(session.user);
            } else if (event === 'SIGNED_OUT') {
                state.user = null;
                state.profile = null;
                ui.toggleSidebar(false);
                router.navigate('login');
            }
        });
    },

    async handleLoginSuccess(user) {
        state.user = user;
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        
        if (error) {
            console.error("Profile error:", error);
            return;
        }

        state.profile = profile;
        document.getElementById('user-display').innerText = `${profile.full_name} (${profile.role})`;
        
        ui.toggleSidebar(true);
        if (profile.role === 'admin') {
            document.getElementById('nav-admin').classList.remove('hidden');
            router.navigate('admin');
        } else {
            document.getElementById('nav-admin').classList.add('hidden');
            router.navigate('teacher');
        }
    },

    async login(email, password) {
        ui.setLoading(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        ui.setLoading(false);
        if (error) ui.notify(error.message, 'error');
    },

    async signup(email, password, fullName) {
        ui.setLoading(true);
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } }
        });
        ui.setLoading(false);
        if (error) ui.notify(error.message, 'error');
        else ui.notify("Registration successful! You can now login.", 'success');
    },

    async logout() {
        await supabase.auth.signOut();
    },

    toggleSignup() {
        const current = state.activeView;
        router.navigate(current === 'login' ? 'signup' : 'login');
    }
};

// --- ADMIN MODULE ---
const admin = {
    async init() {
        ui.setLoading(true);
        await this.loadInitialData();
        this.renderGrades();
        await this.loadClasses();
        await this.loadTypes();
        ui.setLoading(false);
    },

    async loadInitialData() {
        const { data: grades } = await supabase.from('grade_levels').select('*').order('id');
        this.grades = grades || [];
    },

    renderGrades() {
        const select = document.getElementById('admin-grade-filter');
        select.innerHTML = this.grades.map(g => `<option value="${g.id}">Form ${g.id}</option>`).join('');
        select.value = state.admin.activeGrade;
        select.onchange = (e) => {
            state.admin.activeGrade = parseInt(e.target.value);
            this.loadClasses();
        };
    },

    async loadClasses() {
        const { data, error } = await supabase
            .from('classes')
            .select('*')
            .eq('grade_level_id', state.admin.activeGrade)
            .order('name');
        
        state.admin.classes = data || [];
        this.renderClasses();
    },

    renderClasses() {
        const list = document.getElementById('admin-class-list');
        list.innerHTML = state.admin.classes.map(c => `
            <li class="p-3 flex justify-between items-center group cursor-pointer hover:bg-indigo-50 ${state.admin.activeClass?.id === c.id ? 'bg-indigo-50 border-r-4 border-indigo-600' : ''}" 
                onclick="admin.selectClass('${c.id}')">
                <span class="font-medium text-slate-700">${c.name}</span>
                <div class="hidden group-hover:flex gap-2">
                    <button onclick="event.stopPropagation(); admin.openClassModal('${c.id}')" class="text-xs text-blue-600 hover:underline">Edit</button>
                    <button onclick="event.stopPropagation(); admin.deleteClass('${c.id}')" class="text-xs text-red-600 hover:underline">Del</button>
                </div>
            </li>
        `).join('') || '<p class="p-4 text-xs text-gray-400">No classes found.</p>';
    },

    async selectClass(classId) {
        state.admin.activeClass = state.admin.classes.find(c => c.id === classId);
        document.getElementById('admin-active-class-name').innerText = state.admin.activeClass.name;
        document.getElementById('btn-add-student').disabled = false;
        this.renderClasses(); // Refresh to show highlight
        this.loadStudents();
    },

    async loadStudents() {
        if (!state.admin.activeClass) return;
        const { data } = await supabase
            .from('students')
            .select('*')
            .eq('class_id', state.admin.activeClass.id)
            .order('full_name');
        
        state.admin.students = data || [];
        this.renderStudents();
    },

    renderStudents() {
        const tbody = document.getElementById('admin-student-table');
        tbody.innerHTML = state.admin.students.map(s => `
            <tr>
                <td class="p-3 font-mono text-slate-500">${s.student_no || '-'}</td>
                <td class="p-3 font-semibold">${s.full_name}</td>
                <td class="p-3 text-right">
                    <button onclick="admin.openStudentModal('${s.id}')" class="text-blue-600 mr-3">Edit</button>
                    <button onclick="admin.deleteStudent('${s.id}')" class="text-red-600">Delete</button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="3" class="p-8 text-center text-gray-400">No students enrolled.</td></tr>';
    },

    async loadTypes() {
        const { data } = await supabase.from('cocurricular_types').select('*').order('name');
        state.admin.types = data || [];
        this.renderTypes();
    },

    renderTypes() {
        const container = document.getElementById('admin-type-list');
        container.innerHTML = state.admin.types.map(t => `
            <div class="bg-gray-100 p-2 rounded text-xs flex justify-between items-center group">
                <span class="truncate pr-2">${t.name}</span>
                <button onclick="admin.deleteType('${t.id}')" class="hidden group-hover:block text-red-500 font-bold">×</button>
            </div>
        `).join('') || '<p class="text-gray-400 italic text-sm">No types defined.</p>';
    },

    // --- Modals & CRUD ---
    openClassModal(id = null) {
        const existing = id ? state.admin.classes.find(c => c.id === id) : null;
        ui.showModal(
            existing ? 'Edit Class' : 'Create Class',
            `<div class="space-y-4">
                <label class="block text-sm">Class Name (e.g. 1 Alpha)</label>
                <input type="text" id="modal-field-1" value="${existing?.name || ''}" class="w-full p-2 border rounded">
            </div>`,
            async () => {
                const name = document.getElementById('modal-field-1').value;
                if (!name) return;
                const payload = { name, grade_level_id: state.admin.activeGrade };
                const req = id 
                    ? supabase.from('classes').update(payload).eq('id', id)
                    : supabase.from('classes').insert(payload);
                const { error } = await req;
                if (!error) { ui.closeModal(); this.loadClasses(); }
                else ui.notify(error.message, 'error');
            }
        );
    },

    async deleteClass(id) {
        if (!confirm("Delete class and all its student records?")) return;
        const { error } = await supabase.from('classes').delete().eq('id', id);
        if (!error) {
            if (state.admin.activeClass?.id === id) state.admin.activeClass = null;
            this.loadClasses();
        }
    },

    openStudentModal(id = null) {
        const existing = id ? state.admin.students.find(s => s.id === id) : null;
        ui.showModal(
            existing ? 'Edit Student' : 'Enroll Student',
            `<div class="space-y-4">
                <div>
                    <label class="block text-sm mb-1">Full Name</label>
                    <input type="text" id="modal-field-1" value="${existing?.full_name || ''}" class="w-full p-2 border rounded">
                </div>
                <div>
                    <label class="block text-sm mb-1">Student No (Optional)</label>
                    <input type="text" id="modal-field-2" value="${existing?.student_no || ''}" class="w-full p-2 border rounded">
                </div>
            </div>`,
            async () => {
                const full_name = document.getElementById('modal-field-1').value;
                const student_no = document.getElementById('modal-field-2').value;
                if (!full_name) return;
                const payload = { full_name, student_no: student_no || null, class_id: state.admin.activeClass.id };
                const req = id 
                    ? supabase.from('students').update(payload).eq('id', id)
                    : supabase.from('students').insert(payload);
                const { error } = await req;
                if (!error) { ui.closeModal(); this.loadStudents(); }
                else ui.notify(error.message, 'error');
            }
        );
    },

    async deleteStudent(id) {
        if (!confirm("Are you sure? All co-curricular history will be deleted.")) return;
        const { error } = await supabase.from('students').delete().eq('id', id);
        if (!error) this.loadStudents();
    },

    openTypeModal() {
        ui.showModal('New Category', 
            `<input type="text" id="modal-field-1" placeholder="e.g. Football, Debating" class="w-full p-2 border rounded">`,
            async () => {
                const name = document.getElementById('modal-field-1').value;
                if (!name) return;
                const { error } = await supabase.from('cocurricular_types').insert({ name });
                if (!error) { ui.closeModal(); this.loadTypes(); }
                else ui.notify(error.message, 'error');
            }
        );
    },

    async deleteType(id) {
        const { error } = await supabase.from('cocurricular_types').delete().eq('id', id);
        if (!error) this.loadTypes();
        else ui.notify("Cannot delete category as it is currently in use by records.", "error");
    }
};

// --- TEACHER MODULE ---
const teacher = {
    async init() {
        ui.setLoading(true);
        const { data: grades } = await supabase.from('grade_levels').select('*').order('id');
        const { data: types } = await supabase.from('cocurricular_types').select('*').order('name');
        
        state.admin.types = types || []; // Used for entry dropdown
        
        const gSelect = document.getElementById('teacher-grade-select');
        gSelect.innerHTML = grades.map(g => `<option value="${g.id}">Form ${g.id}</option>`).join('');
        gSelect.value = state.teacher.activeGrade;
        gSelect.onchange = (e) => this.handleGradeChange(parseInt(e.target.value));

        await this.handleGradeChange(state.teacher.activeGrade);
        ui.setLoading(false);
    },

    async handleGradeChange(gradeId) {
        state.teacher.activeGrade = gradeId;
        const { data: classes } = await supabase
            .from('classes')
            .select('*')
            .eq('grade_level_id', gradeId)
            .order('name');
        
        const cSelect = document.getElementById('teacher-class-select');
        cSelect.innerHTML = (classes || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        state.teacher.activeClass = classes?.[0]?.id || null;
    },

    async loadStudents() {
        const classId = document.getElementById('teacher-class-select').value;
        if (!classId) return;
        
        ui.setLoading(true);
        const { data } = await supabase
            .from('students')
            .select('*')
            .eq('class_id', classId)
            .order('full_name');
        
        state.teacher.students = data || [];
        this.renderStudents();
        ui.setLoading(false);
    },

    renderStudents() {
        const container = document.getElementById('teacher-student-container');
        container.classList.remove('hidden');
        container.innerHTML = state.teacher.students.map(s => `
            <div class="bg-white p-4 rounded-lg shadow border border-transparent hover:border-indigo-300 cursor-pointer transition"
                 onclick="teacher.viewStudentDetail('${s.id}')">
                <div class="text-xs font-mono text-slate-400 mb-1">${s.student_no || 'NO ID'}</div>
                <div class="font-bold text-lg">${s.full_name}</div>
                <div class="text-indigo-600 text-sm mt-2">View History &rarr;</div>
            </div>
        `).join('') || '<div class="col-span-full text-center py-10 bg-gray-50 rounded">No students found in this class.</div>';
    },

    async viewStudentDetail(id) {
        state.teacher.activeStudent = state.teacher.students.find(s => s.id === id);
        router.navigate('student-detail');
        
        document.getElementById('detail-student-name').innerText = state.teacher.activeStudent.full_name;
        document.getElementById('detail-student-meta').innerText = `${state.teacher.activeStudent.student_no || 'No ID'}`;
        
        await this.loadHistory();
    },

    async loadHistory() {
        const { data, error } = await supabase
            .from('cocurricular_entries')
            .select('*, cocurricular_types(name)')
            .eq('student_id', state.teacher.activeStudent.id)
            .order('activity_date', { ascending: false });
        
        state.teacher.history = data || [];
        this.renderHistory();
    },

    renderHistory() {
        const tbody = document.getElementById('history-table-body');
        tbody.innerHTML = state.teacher.history.map(e => {
            const isOwner = e.created_by === state.user.id || state.profile.role === 'admin';
            return `
                <tr>
                    <td class="p-3 whitespace-nowrap">${new Date(e.activity_date).toLocaleDateString()}</td>
                    <td class="p-3"><span class="px-2 py-1 bg-slate-100 rounded text-xs">${e.cocurricular_types.name}</span></td>
                    <td class="p-3">${e.subject}</td>
                    <td class="p-3 text-right">
                        ${isOwner ? `
                            <button onclick="teacher.openEntryModal('${e.id}')" class="text-blue-600 hover:underline mr-2">Edit</button>
                            <button onclick="teacher.deleteEntry('${e.id}')" class="text-red-600 hover:underline">Del</button>
                        ` : '<span class="text-gray-400 italic text-xs">Read Only</span>'}
                    </td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="4" class="p-8 text-center text-gray-400 italic">No achievements recorded.</td></tr>';
    },

    openEntryModal(id = null) {
        const existing = id ? state.teacher.history.find(e => e.id === id) : null;
        const typeOptions = state.admin.types.map(t => `<option value="${t.id}" ${existing?.type_id === t.id ? 'selected' : ''}>${t.name}</option>`).join('');

        ui.showModal(
            existing ? 'Update Achievement' : 'Add New Achievement',
            `<div class="space-y-4">
                <div>
                    <label class="block text-sm mb-1">Category</label>
                    <select id="modal-field-1" class="w-full p-2 border rounded">${typeOptions}</select>
                </div>
                <div>
                    <label class="block text-sm mb-1">Activity Date</label>
                    <input type="date" id="modal-field-2" value="${existing?.activity_date || new Date().toISOString().split('T')[0]}" class="w-full p-2 border rounded">
                </div>
                <div>
                    <label class="block text-sm mb-1">Description / Subject</label>
                    <textarea id="modal-field-3" class="w-full p-2 border rounded" rows="3" placeholder="Min 3 chars">${existing?.subject || ''}</textarea>
                </div>
            </div>`,
            async () => {
                const type_id = document.getElementById('modal-field-1').value;
                const activity_date = document.getElementById('modal-field-2').value;
                const subject = document.getElementById('modal-field-3').value;

                if (!subject || subject.length < 3) return ui.notify("Description too short", "error");

                const payload = {
                    student_id: state.teacher.activeStudent.id,
                    type_id,
                    activity_date,
                    subject,
                    created_by: state.user.id
                };

                const req = id 
                    ? supabase.from('cocurricular_entries').update({ type_id, activity_date, subject }).eq('id', id)
                    : supabase.from('cocurricular_entries').insert(payload);

                const { error } = await req;
                if (!error) { ui.closeModal(); this.loadHistory(); }
                else ui.notify(error.message, 'error');
            }
        );
    },

    async deleteEntry(id) {
        if (!confirm("Delete this record permanently?")) return;
        const { error } = await supabase.from('cocurricular_entries').delete().eq('id', id);
        if (!error) this.loadHistory();
        else ui.notify(error.message, "error");
    },

    backToMain() {
        router.navigate('teacher');
    }
};

// --- UI UTILS ---
const ui = {
    setLoading(isLoading) {
        document.getElementById('loading').classList.toggle('hidden', !isLoading);
    },

    notify(msg, type = 'success') {
        const toast = document.getElementById('toast');
        toast.innerText = msg;
        toast.className = `fixed top-4 right-4 p-4 rounded shadow-lg transition-all duration-300 z-[100] ${type}`;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    },

    toggleSidebar(show) {
        const sb = document.getElementById('sidebar');
        const main = document.getElementById('main-content');
        if (show) {
            sb.classList.remove('hidden');
            sb.classList.add('flex');
            main.classList.add('md:ml-64');
        } else {
            sb.classList.add('hidden');
            sb.classList.remove('flex');
            main.classList.remove('md:ml-64');
        }
    },

    showModal(title, contentHtml, onConfirm) {
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-content').innerHTML = contentHtml;
        const submitBtn = document.getElementById('modal-submit');
        
        // Clone and replace to remove old listeners
        const newBtn = submitBtn.cloneNode(true);
        submitBtn.parentNode.replaceChild(newBtn, submitBtn);
        
        newBtn.onclick = onConfirm;
        document.getElementById('modal-container').classList.replace('hidden', 'flex');
    },

    closeModal() {
        document.getElementById('modal-container').classList.replace('flex', 'hidden');
    }
};

// --- INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    // Check if Supabase keys are set
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        alert("Please set SUPABASE_URL and SUPABASE_ANON_KEY in app.js");
        return;
    }

    // Attach form listeners
    document.getElementById('form-login').onsubmit = (e) => {
        e.preventDefault();
        auth.login(document.getElementById('login-email').value, document.getElementById('login-password').value);
    };

    document.getElementById('form-signup').onsubmit = (e) => {
        e.preventDefault();
        auth.signup(
            document.getElementById('signup-email').value,
            document.getElementById('signup-password').value,
            document.getElementById('signup-name').value
        );
    };

    auth.init();
});