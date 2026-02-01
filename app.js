/**
 * KONFIGURASI SUPABASE
 * Menggunakan credentials baru yang anda berikan.
 */
const SUPABASE_URL = "https://dflpaypdadctuhrcmavq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmbHBheXBkYWRjdHVocmNtYXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MTcwMTcsImV4cCI6MjA4NTQ5MzAxN30.YZVfciWmp7s0NofEtjGayb175RT1lZsLVoMuzZDjfdc";

// Initialize Supabase Client dengan semakan ralat
let supabase;
if (window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
    alert("Ralat Kritikal: Library Supabase tidak dimuatkan. Sila refresh atau semak internet.");
}

const app = {
    state: {
        user: null,
        profile: null,
        grades: [], 
        currentStudent: null,
    },

    init: async () => {
        console.log("Aplikasi dimulakan...");
        app.showLoading(true);

        try {
            // 1. Semak status login semasa (Session Check)
            const { data: { session } } = await supabase.auth.getSession();
            
            if (session) {
                console.log("Sesi dijumpai:", session.user.email);
                app.state.user = session.user;
                
                // Cuba tarik data, tapi jangan crash jika gagal
                try {
                    await app.fetchProfile();
                    await app.fetchCommonData();
                } catch (dataErr) {
                    console.warn("Amaran data:", dataErr);
                }
                
                app.routeUser();
            } else {
                app.showView('login');
            }

            // 2. Listener untuk perubahan login/logout
            supabase.auth.onAuthStateChange(async (event, session) => {
                console.log("Auth Event:", event);
                if (event === 'SIGNED_OUT') {
                    app.state.user = null;
                    app.state.profile = null;
                    app.showView('login');
                } else if (event === 'SIGNED_IN' && session) {
                    // Logic ini backup jika flow manual handleLogin tidak jalan
                    if (!app.state.user) { 
                        app.state.user = session.user;
                        await app.fetchProfile();
                        app.routeUser();
                    }
                }
            });

            app.setupEventListeners();

        } catch (err) {
            console.error("Init Error:", err);
            app.toast("Ralat memulakan aplikasi", "error");
            app.showView('login'); // Fallback ke login jika semua gagal
        } finally {
            app.showLoading(false);
        }
    },

    // --- PENGESAHAN (AUTHENTICATION) ---

    handleLogin: async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        app.showLoading(true);
        
        try {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            
            if (error) throw error;
            
            console.log("Login berjaya:", data.user);
            app.state.user = data.user;
            
            // Tarik profile sebelum tukar screen
            await app.fetchProfile();
            await app.fetchCommonData();
            
            app.routeUser();
            app.toast('Berjaya log masuk!', 'success');
            
        } catch (error) {
            console.error("Login Error:", error);
            app.toast(`Gagal Log Masuk: ${error.message}`, 'error');
        } finally {
            app.showLoading(false);
        }
    },

    handleLogout: async () => {
        if(confirm("Log keluar?")) {
            app.showLoading(true);
            await supabase.auth.signOut();
            app.showLoading(false);
        }
    },

    fetchProfile: async () => {
        if (!app.state.user) return;
        
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', app.state.user.id)
                .single();
            
            if (error || !data) {
                console.warn('Profile tidak dijumpai dalam DB (Mungkin user baru atau trigger gagal). Menggunakan fallback.');
                // FALLBACK PENTING:
                // Jika DB tak ada data profile, kita buat object sementara
                // supaya app tak crash (Blank Screen).
                const isLikelyAdmin = app.state.user.email.toLowerCase().includes('admin');
                app.state.profile = { 
                    role: isLikelyAdmin ? 'admin' : 'teacher', 
                    full_name: app.state.user.email 
                };
            } else {
                app.state.profile = data;
            }
            
            // Kemaskini UI Sidebar
            const roleDisplay = app.state.profile.role ? app.state.profile.role.toUpperCase() : 'USER';
            const nameDisplay = app.state.profile.full_name || app.state.user.email;
            
            const nameEl = document.getElementById('nav-user-info'); // ID dalam sidebar HTML baru
            if (nameEl) nameEl.innerText = `${nameDisplay} (${roleDisplay})`;

        } catch (err) {
            console.error("Critical Profile Error:", err);
            // Safety Net terakhir
            app.state.profile = { role: 'teacher', full_name: 'User' };
        }
    },

    routeUser: () => {
        // Pastikan sidebar wujud dan hidden class dibuang
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.remove('hidden');

        // Tentukan paparan berdasarkan peranan (role)
        // Guna optional chaining (?.) untuk elak error jika profile null
        const role = app.state.profile?.role || 'teacher';
        const isAdmin = role === 'admin';
        
        const navAdmin = document.getElementById('nav-admin');
        const navTeacher = document.getElementById('nav-teacher');
        
        // Reset active links
        document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

        if (isAdmin) {
            if(navAdmin) navAdmin.classList.remove('hidden');
            app.showView('admin');
            app.loadAdminClasses();
        } else {
            if(navAdmin) navAdmin.classList.add('hidden');
            app.showView('teacher');
        }
    },

    // --- DATA UMUM (COMMON DATA) ---
    
    fetchCommonData: async () => {
        const { data, error } = await supabase.from('grade_levels').select('*').order('id');
        
        if (!error && data) {
            app.state.grades = data;
            app.populateDropdown('class-grade', app.state.grades, 'id', 'name');
            app.populateDropdown('teacher-select-grade', app.state.grades, 'id', 'name', true);
        }
    },

    // --- PENGURUSAN PAPARAN (VIEW MANAGEMENT) ---

    showView: (viewName) => {
        // Sembunyikan semua seksyen
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));
        
        // Jika login screen, sembunyikan sidebar juga
        if (viewName === 'login') {
            document.getElementById('sidebar').classList.add('hidden');
            document.getElementById('view-login').classList.remove('hidden');
            return;
        }

        // Tunjuk paparan yang dipilih
        const viewEl = document.getElementById(`view-${viewName}`);
        if(viewEl) viewEl.classList.remove('hidden');

        // Semakan Keselamatan
        if (viewName === 'admin' && app.state.profile?.role !== 'admin') {
            app.toast('Akses Disekat: Anda bukan Admin', 'error');
            app.showView('teacher');
        }
    },

    // --- LOGIK ADMIN ---

    switchAdminTab: (tabName) => {
        // UI Toggle Butang
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        const btn = document.querySelector(`.tab-btn[onclick*="${tabName}"]`);
        if(btn) btn.classList.add('active');
        
        // UI Toggle Kandungan
        document.querySelectorAll('.admin-tab-content').forEach(d => d.classList.add('hidden'));
        const content = document.getElementById(`admin-tab-${tabName}`);
        if(content) content.classList.remove('hidden');

        // Muatkan Data
        if (tabName === 'classes') app.loadAdminClasses();
        if (tabName === 'students') app.loadAdminStudents();
        if (tabName === 'types') app.loadAdminTypes();
    },

    // 1. Admin: Kelas
    loadAdminClasses: async () => {
        // Elak loading spinner blocking UI flow kalau error kecil
        const gradeFilter = document.getElementById('admin-class-grade-filter').value;
        let query = supabase.from('classes').select('*, grade_levels(name)');
        if (gradeFilter) query = query.eq('grade_level_id', gradeFilter);
        
        const { data, error } = await query.order('name');

        if (error) return app.toast(error.message, 'error');

        // Isi Dropdown filter jika kosong (kali pertama)
        const filterEl = document.getElementById('admin-class-grade-filter');
        if (filterEl && filterEl.children.length <= 1) {
            app.populateDropdown('admin-class-grade-filter', app.state.grades, 'id', 'name', true);
        }

        const tbody = document.getElementById('table-classes-body');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        if(!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">Tiada kelas dijumpai.</td></tr>';
            return;
        }

        data.forEach(cls => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="badge">${cls.grade_levels?.name || '-'}</span></td>
                <td>${cls.name}</td>
                <td style="text-align:right">
                    <button class="btn btn-danger-sm" onclick="app.deleteClass('${cls.id}')">Padam</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    handleClassSubmit: async (e) => {
        e.preventDefault();
        app.showLoading(true);
        const gradeId = document.getElementById('class-grade').value;
        const name = document.getElementById('class-name').value;
        
        const { error } = await supabase.from('classes').insert({ grade_level_id: gradeId, name });
        app.showLoading(false);
        
        if (error) app.toast(error.message, 'error');
        else {
            app.toast('Kelas berjaya ditambah', 'success');
            app.closeModal('modal-class');
            app.loadAdminClasses();
        }
    },

    deleteClass: async (id) => {
        if (!confirm('AWAS: Padam kelas ini? Semua pelajar di dalamnya akan dibuang.')) return;
        const { error } = await supabase.from('classes').delete().eq('id', id);
        if (error) app.toast(error.message, 'error');
        else app.loadAdminClasses();
    },

    // 2. Admin: Pelajar
    loadAdminStudents: async () => {
        const classFilterEl = document.getElementById('admin-student-class-filter');
        const studentClassSelect = document.getElementById('student-class-select');
        
        // Populate dropdowns once
        if (classFilterEl && classFilterEl.children.length <= 1) {
            const {data} = await supabase.from('classes').select('*').order('name');
            if(data) {
                app.populateDropdown('admin-student-class-filter', data, 'id', 'name', true);
                app.populateDropdown('student-class-select', data, 'id', 'name');
            }
        }

        const classFilter = classFilterEl.value;
        const tbody = document.getElementById('table-students-body');

        if (!classFilter) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#888;">Sila pilih kelas untuk melihat pelajar.</td></tr>';
            return;
        }

        app.showLoading(true);
        const { data, error } = await supabase.from('students').select('*').eq('class_id', classFilter).order('full_name');
        app.showLoading(false);

        if (error) return app.toast(error.message, 'error');

        tbody.innerHTML = '';
        if(!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Tiada pelajar dalam kelas ini.</td></tr>';
            return;
        }

        data.forEach(stu => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${stu.student_no || '-'}</td>
                <td>${stu.full_name}</td>
                <td style="text-align:right">
                    <button class="btn btn-danger-sm" onclick="app.deleteStudent('${stu.id}')">Padam</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    handleStudentSubmit: async (e) => {
        e.preventDefault();
        app.showLoading(true);
        const classId = document.getElementById('student-class-select').value;
        const fullName = document.getElementById('student-name').value;
        const studentNo = document.getElementById('student-no').value || null;

        const { error } = await supabase.from('students').insert({ class_id: classId, full_name: fullName, student_no: studentNo });
        app.showLoading(false);

        if (error) app.toast(error.message, 'error');
        else {
            app.toast('Pelajar ditambah', 'success');
            app.closeModal('modal-student');
            app.loadAdminStudents();
        }
    },

    deleteStudent: async (id) => {
        if (!confirm('Padam pelajar ini?')) return;
        const { error } = await supabase.from('students').delete().eq('id', id);
        if (error) app.toast(error.message, 'error');
        else app.loadAdminStudents();
    },

    // 3. Admin: Jenis Aktiviti
    loadAdminTypes: async () => {
        const { data, error } = await supabase.from('cocurricular_types').select('*').order('name');
        if (error) return app.toast(error.message, 'error');
        
        const tbody = document.getElementById('table-types-body');
        tbody.innerHTML = '';
        
        if (data) {
            data.forEach(type => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${type.name}</td>
                    <td style="text-align:right">
                        <button class="btn btn-danger-sm" onclick="app.deleteType('${type.id}')">Padam</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    },

    handleTypeSubmit: async (e) => {
        e.preventDefault();
        const name = document.getElementById('type-name').value;
        const { error } = await supabase.from('cocurricular_types').insert({ name });
        if (error) app.toast(error.message, 'error');
        else {
            app.toast('Jenis aktiviti ditambah', 'success');
            app.closeModal('modal-type');
            app.loadAdminTypes();
        }
    },

    deleteType: async (id) => {
        if (!confirm('Padam kategori aktiviti ini?')) return;
        const { error } = await supabase.from('cocurricular_types').delete().eq('id', id);
        if (error) app.toast(error.message, 'error');
        else app.loadAdminTypes();
    },

    // --- LOGIK GURU (TEACHER) ---

    handleTeacherGradeChange: async () => {
        const gradeId = document.getElementById('teacher-select-grade').value;
        const classSelect = document.getElementById('teacher-select-class');
        
        classSelect.innerHTML = '<option value="">Memuatkan...</option>';
        classSelect.disabled = true;

        if (!gradeId) {
            classSelect.innerHTML = '<option value="">-- Pilih Tingkatan Dahulu --</option>';
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

        app.showLoading(true);
        const { data, error } = await supabase.from('students').select('*').eq('class_id', classId).order('full_name');
        app.showLoading(false);

        if (error) return app.toast(error.message, 'error');

        const grid = document.getElementById('teacher-student-grid');
        grid.innerHTML = '';
        
        if(!data || data.length === 0) {
            grid.innerHTML = '<p style="color:#666; col-span:3;">Tiada pelajar dalam kelas ini.</p>';
        } else {
            data.forEach(stu => {
                const card = document.createElement('div');
                card.className = 'student-card';
                // Generate initial
                const initial = stu.full_name ? stu.full_name.charAt(0).toUpperCase() : '?';
                card.innerHTML = `
                    <div class="avatar">${initial}</div>
                    <h4 style="font-size:1rem; margin-bottom:5px;">${stu.full_name}</h4>
                    <p style="color:#6b7280; font-size:0.8rem;">${stu.student_no || 'Tiada No. Pelajar'}</p>
                `;
                card.onclick = () => app.openStudentDetail(stu);
                grid.appendChild(card);
            });
        }

        document.getElementById('teacher-student-list-container').classList.remove('hidden');
    },

    // --- BUTIRAN PELAJAR & REKOD ---

    openStudentDetail: async (student) => {
        app.state.currentStudent = student;
        document.getElementById('detail-student-name').innerText = student.full_name;
        document.getElementById('detail-student-class').innerText = 'Memuatkan...'; 
        
        const { data } = await supabase.from('classes').select('name').eq('id', student.class_id).single();
        if(data) document.getElementById('detail-student-class').innerText = data.name;

        app.showView('student-detail');
        app.loadStudentEntries(student.id);
    },

    loadStudentEntries: async (studentId) => {
        app.showLoading(true);
        const { data, error } = await supabase
            .from('cocurricular_entries')
            .select(`*, cocurricular_types (name), profiles (full_name)`)
            .eq('student_id', studentId)
            .order('activity_date', { ascending: false });
        app.showLoading(false);

        if (error) return app.toast(error.message, 'error');

        const tbody = document.getElementById('table-entries-body');
        tbody.innerHTML = '';

        if(!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">Tiada rekod pencapaian.</td></tr>';
            return;
        }

        const currentUserId = app.state.user.id;
        const isAdmin = app.state.profile?.role === 'admin';

        data.forEach(entry => {
            const canEdit = isAdmin || entry.created_by === currentUserId;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${entry.activity_date}</td>
                <td><span class="badge">${entry.cocurricular_types?.name || 'Umum'}</span></td>
                <td>${entry.subject}</td>
                <td>${entry.profiles?.full_name || 'Tidak diketahui'}</td>
                <td style="text-align:right">
                    ${canEdit ? `<button class="btn btn-danger-sm" onclick="app.deleteEntry('${entry.id}')">Padam</button>` : '<i class="ph ph-lock-key" style="color:#ccc;"></i>'}
                </td>
            `;
            tbody.appendChild(tr);
        });
    },

    openEntryModal: async () => {
        // Load types
        const { data } = await supabase.from('cocurricular_types').select('*').order('name');
        if (data) {
            app.populateDropdown('entry-type', data, 'id', 'name');
        }
        
        // Set date to today
        document.getElementById('entry-date').valueAsDate = new Date();
        document.getElementById('entry-student-id').value = app.state.currentStudent.id;
        
        app.openModal('modal-entry');
    },

    handleEntrySubmit: async (e) => {
        e.preventDefault();
        app.showLoading(true);
        const student_id = document.getElementById('entry-student-id').value;
        const type_id = document.getElementById('entry-type').value;
        const activity_date = document.getElementById('entry-date').value;
        const subject = document.getElementById('entry-subject').value;

        const { error } = await supabase.from('cocurricular_entries').insert({
            student_id,
            type_id,
            activity_date,
            subject
        });
        app.showLoading(false);

        if (error) app.toast(error.message, 'error');
        else {
            app.toast('Pencapaian direkodkan!', 'success');
            app.closeModal('modal-entry');
            app.loadStudentEntries(student_id);
        }
    },

    deleteEntry: async (id) => {
        if (!confirm('Padam rekod ini?')) return;
        const { error } = await supabase.from('cocurricular_entries').delete().eq('id', id);
        if (error) app.toast(error.message, 'error');
        else app.loadStudentEntries(app.state.currentStudent.id);
    },

    // --- PEMBANTU UI (UI HELPERS) ---

    setupEventListeners: () => {
        const loginForm = document.getElementById('login-form');
        if (loginForm) loginForm.addEventListener('submit', app.handleLogin);
        
        document.getElementById('form-class').addEventListener('submit', app.handleClassSubmit);
        document.getElementById('form-student').addEventListener('submit', app.handleStudentSubmit);
        document.getElementById('form-type').addEventListener('submit', app.handleTypeSubmit);
        document.getElementById('form-entry').addEventListener('submit', app.handleEntrySubmit);
    },

    populateDropdown: (elementId, data, valueKey, textKey, includePlaceholder = false) => {
        const select = document.getElementById(elementId);
        if (!select) return; 
        
        select.innerHTML = '';
        if (includePlaceholder) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.text = '-- Sila Pilih --';
            select.appendChild(opt);
        }
        if (data && Array.isArray(data)) {
            data.forEach(item => {
                const opt = document.createElement('option');
                opt.value = item[valueKey];
                opt.text = item[textKey];
                select.appendChild(opt);
            });
        }
    },

    openModal: (id) => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('hidden');
    },

    closeModal: (id) => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('hidden');
            const form = el.querySelector('form');
            if (form) form.reset();
        }
    },

    showLoading: (isLoading) => {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            if (isLoading) overlay.classList.remove('hidden');
            else overlay.classList.add('hidden');
        }
    },

    toast: (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        
        const icon = type === 'success' ? '<i class="ph ph-check-circle" style="font-size:1.2rem"></i>' : '<i class="ph ph-warning-circle" style="font-size:1.2rem"></i>';
        
        el.innerHTML = `${icon} <span>${message}</span>`;
        container.appendChild(el);
        setTimeout(() => {
            el.style.opacity = '0';
            setTimeout(() => el.remove(), 300);
        }, 3000);
    }
};

// Mulakan Aplikasi
document.addEventListener('DOMContentLoaded', app.init);