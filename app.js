/* ========= CONFIG ========= */
const SUPABASE_URL = "https://oeotoszsrxfsautcshcb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lb3Rvc3pzcnhmc2F1dGNzaGNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk5MjA1MDIsImV4cCI6MjA4NTQ5NjUwMn0.okSwQfgKVVq_51OgtFJ08vOAGEOrQ9lSh-_KCrJvvxk";

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ========= STATE ========= */
const state = {
  session: null,
  user: null,
  profile: null,
  role: null,

  gradeLevels: [],
  types: [],
  teachers: [], 

  // System Settings
  settings: {
    app_logo: "",
    login_bg: ""
  },

  // Admin
  adminSelectedGrade: 1,
  adminClasses: [],
  adminSelectedClassId: null,
  adminStudents: [],
  adminTeacherList: [],

  // Teacher
  teacherSelectedGrade: 1,
  teacherClasses: [],
  teacherSelectedClassId: null,
  teacherStudents: [],
  selectedStudent: null,
  studentEntries: [],
};

/* ========= DOM ========= */
const $ = (sel) => document.querySelector(sel);

const views = {
  login: $("#view-login"),
  admin: $("#view-admin"),
  teacher: $("#view-teacher"),
  student: $("#view-student-detail"),
};

const unauthorizedEl = $("#unauthorized");
const loadingOverlay = $("#loading-overlay");
const toastContainer = $("#toast-container");

const navLogin = $("#nav-login");
const navAdmin = $("#nav-admin");
const navTeacher = $("#nav-teacher");
const logoutBtn = $("#btn-logout");

const userBadge = $("#user-badge");
const userEmail = $("#user-email");
const userRole = $("#user-role");

const loginForm = $("#form-login");
const signupPanel = $("#signup-panel");
const goSignupBtn = $("#btn-go-signup");
const cancelSignupBtn = $("#btn-cancel-signup");
const signupForm = $("#form-signup");

// Admin Tabs
const tabBtns = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

const adminGradeSelect = $("#admin-grade-select");
const adminClassSelect = $("#admin-class-select");
const btnClassCreate = $("#btn-class-create");
const btnStudentCreate = $("#btn-student-create");
const btnTypeCreate = $("#btn-type-create");
const btnTeacherCreate = $("#btn-teacher-create");

const tblClassesBody = $("#tbl-classes tbody");
const tblStudentsBody = $("#tbl-students tbody");
const tblTypesBody = $("#tbl-types tbody");
const tblTeachersBody = $("#tbl-teachers tbody");

// Settings Elements
const formSettingLogo = $("#form-setting-logo");
const formSettingBg = $("#form-setting-bg");
const fileLogo = $("#file-logo");
const urlLogo = $("#url-logo");
const fileBg = $("#file-bg");
const urlBg = $("#url-bg"); 
const previewLogo = $("#preview-logo");
const previewLogoPH = $("#preview-logo-placeholder");
const previewBg = $("#preview-bg");
const previewBgPH = $("#preview-bg-placeholder");

const brandIconContainer = $("#brand-icon-container");
const brandDefaultIcon = $("#brand-default-icon");
const brandCustomImg = $("#brand-custom-img");

const teacherGradeSelect = $("#teacher-grade-select");
const teacherClassSelect = $("#teacher-class-select");
const studentSearch = $("#student-search");
const tblTeacherStudentsBody = $("#tbl-teacher-students tbody");

const studentTitle = $("#student-detail-title");
const studentSub = $("#student-detail-sub");
const backTeacherBtn = $("#btn-back-teacher");

// Borang Entry Baru
const entryForm = $("#form-entry");
const entrySubject = $("#entry-subject");
const entryDate = $("#entry-date");
const entryType = $("#entry-type");
const entryAchievement = $("#entry-achievement");
const tblEntriesBody = $("#tbl-entries tbody");

/* New Simple Teacher Select (Replaced Search) */
const entryTeacherSelect = $("#entry-teacher-select");

/* Export buttons */
const btnExportAdmin = $("#btn-export-admin");
const btnExportStudent = $("#btn-export-student");

/* Modal */
const modal = $("#modal");
const modalForm = $("#modal-form");
const modalTitle = $("#modal-title");
const modalBody = $("#modal-body");
const modalCancel = $("#modal-cancel");
const modalSubmit = $("#modal-submit");

let modalResolver = null;
let modalFieldDefs = [];

/* ========= UI HELPERS ========= */
function setLoading(on) {
  loadingOverlay.classList.toggle("hidden", !on);
}

function toast(title, msg, type = "ok", ttl = 2800) {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  const icon = type === 'ok' ? '<i class="ph ph-check-circle"></i>' : 
               type === 'err' ? '<i class="ph ph-warning"></i>' : 
               '<i class="ph ph-info"></i>';
               
  el.innerHTML = `
    <div style="display:flex; gap:10px;">
      <div style="font-size:20px; color:inherit; display:flex; align-items:center;">${icon}</div>
      <div>
        <div class="title">${escapeHtml(title)}</div>
        <div class="msg">${escapeHtml(msg || "")}</div>
      </div>
    </div>
  `;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateX(20px)";
    setTimeout(() => el.remove(), 300);
  }, ttl);
}

function showUnauthorized(message) {
  const span = unauthorizedEl.querySelector('span');
  if(span) span.textContent = message;
  unauthorizedEl.classList.remove("hidden");
}

function clearUnauthorized() {
  unauthorizedEl.classList.add("hidden");
}

function setActiveNav(key) {
  [navLogin, navAdmin, navTeacher].forEach((b) => b.classList.remove("active"));
  if (key === "login") navLogin.classList.add("active");
  if (key === "admin") navAdmin.classList.add("active");
  if (key === "teacher") navTeacher.classList.add("active");
}

function showView(key) {
  Object.values(views).forEach((v) => v.classList.add("hidden"));
  clearUnauthorized();

  if (key === "login") {
    views.login.classList.remove("hidden");
    setActiveNav("login");
    // Ensure styles are applied even on login screen
    applySystemSettings(); 
    return;
  }

  if (!state.user) {
    views.login.classList.remove("hidden");
    setActiveNav("login");
    return;
  }

  if (key === "admin") {
    if (state.role !== "admin") {
      showUnauthorized("Tidak Sah: Konsol Admin hanya untuk pentadbir.");
      toast("Akses Ditolak", "Anda tiada kebenaran untuk akses Admin.", "warn");
      views.teacher.classList.remove("hidden");
      setActiveNav("teacher");
      return;
    }
    views.admin.classList.remove("hidden");
    setActiveNav("admin");
    return;
  }

  if (key === "teacher") {
    views.teacher.classList.remove("hidden");
    setActiveNav("teacher");
    return;
  }

  if (key === "student") {
    views.student.classList.remove("hidden");
    setActiveNav("teacher");
    return;
  }
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ========= MODAL ========= */
function openModal({ title, submitText = "Simpan", fields = [], initial = {} }) {
  modalTitle.textContent = title;
  modalSubmit.textContent = submitText;
  modalBody.innerHTML = "";
  modalFieldDefs = fields;

  fields.forEach((f) => {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const id = `modal_${f.name}`;

    const label = document.createElement("label");
    label.setAttribute("for", id);
    label.textContent = f.label;

    let input;
    if (f.type === "select") {
      input = document.createElement("select");
      (f.options || []).forEach((opt) => {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        input.appendChild(o);
      });
    } else {
      input = document.createElement("input");
      input.type = f.type || "text";
    }

    input.id = id;
    if (f.required) input.required = true;
    if (f.minLength) input.minLength = f.minLength;
    if (f.placeholder) input.placeholder = f.placeholder;

    const initVal = initial[f.name];
    if (initVal !== undefined && initVal !== null) input.value = String(initVal);

    wrap.appendChild(label);
    
    const inputWrapper = document.createElement("div");
    inputWrapper.className = f.type === 'select' ? "select-wrapper" : ""; 
    inputWrapper.appendChild(input);
    
    wrap.appendChild(inputWrapper);
    modalBody.appendChild(wrap);
  });

  return new Promise((resolve) => {
    modalResolver = resolve;
    if (typeof modal.showModal === "function") modal.showModal();
    else modal.setAttribute("open", "open");
  });
}

function closeModal() {
  if (typeof modal.close === "function") modal.close();
  else modal.removeAttribute("open");
}
window.closeModal = closeModal; 

modalCancel.addEventListener("click", () => {
  if (modalResolver) modalResolver(null);
  modalResolver = null;
  closeModal();
});

modalForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const values = {};
  for (const f of modalFieldDefs) {
    const el = $(`#modal_${f.name}`);
    const val = el.value?.trim();
    if (f.required && !val) {
      toast("Validasi", `${f.label} diperlukan.`, "warn");
      el.focus();
      return;
    }
    if (f.minLength && val && val.length < f.minLength) {
      toast("Validasi", `${f.label} mesti sekurang-kurangnya ${f.minLength} aksara.`, "warn");
      el.focus();
      return;
    }
    values[f.name] = val;
  }

  if (modalResolver) modalResolver(values);
  modalResolver = null;
  closeModal();
});

/* ========= TAB NAVIGATION (ADMIN) ========= */
tabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    tabBtns.forEach(b => b.classList.remove("active"));
    tabContents.forEach(c => c.classList.add("hidden"));
    
    btn.classList.add("active");
    const tabId = `tab-${btn.dataset.tab}`;
    const target = document.getElementById(tabId);
    if(target) target.classList.remove("hidden");
  });
});

/* ========= SYSTEM SETTINGS LOGIC ========= */

async function fetchSystemSettings() {
  // Fetch from DB
  const { data, error } = await sb.from("app_settings").select("*");
  if (error && error.code !== 'PGRST116') {
      console.warn("Error fetching settings, using defaults.", error);
      return;
  }

  if (data) {
    data.forEach(row => {
      state.settings[row.key] = row.value;
    });
  }
  applySystemSettings();
}

function applySystemSettings() {
  const { app_logo, login_bg } = state.settings;
  const loginView = $("#view-login");

  // 1. Logo Logic
  if (app_logo) {
    brandDefaultIcon.classList.add("hidden");
    brandCustomImg.src = app_logo;
    brandCustomImg.classList.remove("hidden");
    brandIconContainer.style.background = "transparent"; 
    
    // Update preview in admin
    previewLogo.src = app_logo;
    previewLogo.classList.remove("hidden");
    previewLogoPH.classList.add("hidden");
    urlLogo.value = app_logo;
  } else {
    // Revert to default
    brandDefaultIcon.classList.remove("hidden");
    brandCustomImg.classList.add("hidden");
    brandIconContainer.style.background = ""; 
    
    previewLogo.classList.add("hidden");
    previewLogoPH.classList.remove("hidden");
    urlLogo.value = "";
  }

  // 2. Background Logic (Improved)
  if (login_bg) {
    // Set directly via JS style property instead of CSS variable to ensure it applies
    loginView.style.backgroundImage = `url('${login_bg}')`;
    loginView.classList.add('has-custom-bg');
    
    // Update preview
    previewBg.src = login_bg;
    previewBg.classList.remove("hidden");
    previewBgPH.classList.add("hidden");
    
    // Safety check to ensure urlBg is an input text element, not file
    if(urlBg && urlBg.type === 'text') {
        urlBg.value = login_bg;
    }
  } else {
    loginView.style.backgroundImage = '';
    loginView.classList.remove('has-custom-bg');
    
    previewBg.classList.add("hidden");
    previewBgPH.classList.remove("hidden");
    if(urlBg && urlBg.type === 'text') {
        urlBg.value = "";
    }
  }
}

async function uploadToStorage(file, folder = "uploads") {
  const ext = file.name.split('.').pop();
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
  
  // Try uploading to 'public' bucket
  const { data, error } = await sb.storage.from("public").upload(fileName, file, {
    cacheControl: "3600",
    upsert: false
  });

  if (error) throw error;

  // Get Public URL
  const { data: { publicUrl } } = sb.storage.from("public").getPublicUrl(fileName);
  return publicUrl;
}

async function saveSetting(key, value) {
  const { error } = await sb.from("app_settings").upsert({ key, value });
  if (error) throw error;
  state.settings[key] = value;
}

// Event Listeners for Settings Forms
formSettingLogo.addEventListener("submit", async (e) => {
  e.preventDefault();
  setLoading(true);
  try {
    let finalUrl = urlLogo.value.trim();
    const file = fileLogo.files[0];

    if (file) {
      finalUrl = await uploadToStorage(file, "logos");
    }

    if (!finalUrl && !file) {
      if(confirm("Kosongkan logo dan guna ikon asal?")) {
        finalUrl = "";
      } else {
        setLoading(false);
        return;
      }
    }

    await saveSetting("app_logo", finalUrl);
    applySystemSettings();
    toast("Berjaya", "Logo sistem dikemaskini.", "ok");
    fileLogo.value = ""; // clear input
  } catch (err) {
    console.error(err);
    if(err.message.includes("bucket")) {
       toast("Ralat Storage", "Bucket 'public' tidak ditemui. Sila baca arahan DB.", "err", 5000);
    } else {
       toast("Ralat", "Gagal menyimpan logo: " + err.message, "err");
    }
  } finally {
    setLoading(false);
  }
});

formSettingBg.addEventListener("submit", async (e) => {
  e.preventDefault();
  setLoading(true);
  try {
    let finalUrl = urlBg.value.trim();
    const file = fileBg.files[0];

    if (file) {
      finalUrl = await uploadToStorage(file, "backgrounds");
    }

    await saveSetting("login_bg", finalUrl);
    applySystemSettings();
    toast("Berjaya", "Latar belakang log masuk dikemaskini.", "ok");
    fileBg.value = "";
  } catch (err) {
    console.error(err);
    if(err.message.includes("bucket")) {
       toast("Ralat Storage", "Bucket 'public' tidak ditemui. Sila baca arahan DB.", "err", 5000);
    } else {
       toast("Ralat", "Gagal menyimpan background: " + err.message, "err");
    }
  } finally {
    setLoading(false);
  }
});

// Auto-preview when selecting file
fileLogo.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if(file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            previewLogo.src = ev.target.result;
            previewLogo.classList.remove("hidden");
            previewLogoPH.classList.add("hidden");
        };
        reader.readAsDataURL(file);
    }
});

fileBg.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if(file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            previewBg.src = ev.target.result;
            previewBg.classList.remove("hidden");
            previewBgPH.classList.add("hidden");
        };
        reader.readAsDataURL(file);
    }
});

/* ========= SUPABASE HELPERS ========= */
async function getProfileOrThrow() {
  const uid = state.user.id;

  const { data, error } = await sb
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", uid)
    .single();

  if (error && error.code === "PGRST116") {
    // Auto-create profile jika tiada (biasanya untuk first login)
    // UPDATE: Gunakan user_metadata.full_name jika ada (dari proses signup)
    const metaName = state.user.user_metadata?.full_name;
    const finalName = metaName || state.user.email || "";

    const { error: insErr } = await sb.from("profiles").insert({
      id: uid,
      full_name: finalName,
      role: "teacher",
    });
    if (insErr) throw insErr;

    const { data: data2, error: err2 } = await sb
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", uid)
      .single();
    if (err2) throw err2;
    return data2;
  }

  if (error) throw error;
  return data;
}

async function fetchGradeLevels() {
  const { data, error } = await sb.from("grade_levels").select("id, name").order("id", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function fetchTypes() {
  const { data, error } = await sb.from("cocurricular_types").select("id, name").order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function fetchAllTeachers() {
  // Ambil semua profil (guru & admin)
  const { data, error } = await sb.from("profiles").select("id, full_name, role").order("full_name", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function fetchClassesByGrade(gradeLevelId) {
  const { data, error } = await sb
    .from("classes")
    .select("id, grade_level_id, name")
    .eq("grade_level_id", gradeLevelId)
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function fetchStudentsByClass(classId) {
  const { data, error } = await sb
    .from("students")
    .select("id, class_id, full_name, student_no")
    .eq("class_id", classId)
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function fetchEntriesByStudent(studentId) {
  const { data, error } = await sb
    .from("cocurricular_entries")
    .select(`
      id, subject, activity_date, created_by, created_at, type_id, achievement, teacher_advisor_id,
      cocurricular_types(name),
      profiles!cocurricular_entries_teacher_advisor_id_fkey(full_name)
    `)
    .eq("student_id", studentId)
    .order("activity_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Mungkin kolum teacher_advisor_id/achievement belum wujud. Cuba query asal.", error);
    const { data: fallback, error: err2 } = await sb
        .from("cocurricular_entries")
        .select(`id, subject, activity_date, created_by, created_at, type_id, cocurricular_types(name)`)
        .eq("student_id", studentId)
        .order("activity_date", { ascending: false });
    if(err2) throw err2;
    return fallback || [];
  }
  return data || [];
}

/* ========= CRUD (Admin) ========= */
async function createClass(payload) {
  const { error } = await sb.from("classes").insert(payload);
  if (error) throw error;
}
async function updateClass(id, payload) {
  const { error } = await sb.from("classes").update(payload).eq("id", id);
  if (error) throw error;
}
async function deleteClass(id) {
  const { error } = await sb.from("classes").delete().eq("id", id);
  if (error) throw error;
}

async function createStudent(payload) {
  const { error } = await sb.from("students").insert(payload);
  if (error) throw error;
}
async function updateStudent(id, payload) {
  const { error } = await sb.from("students").update(payload).eq("id", id);
  if (error) throw error;
}
async function deleteStudent(id) {
  const { error } = await sb.from("students").delete().eq("id", id);
  if (error) throw error;
}

async function createType(payload) {
  const { error } = await sb.from("cocurricular_types").insert(payload);
  if (error) throw error;
}
async function updateType(id, payload) {
  const { error } = await sb.from("cocurricular_types").update(payload).eq("id", id);
  if (error) throw error;
}
async function deleteType(id) {
  const { error } = await sb.from("cocurricular_types").delete().eq("id", id);
  if (error) throw error;
}

/* CRUD Guru (Profiles) */
async function createTeacherProfile(payload) {
  const { error } = await sb.from("profiles").insert(payload);
  if (error) throw error;
}
async function updateTeacherProfile(id, payload) {
  const { error } = await sb.from("profiles").update(payload).eq("id", id);
  if (error) throw error;
}
async function deleteTeacherProfile(id) {
  const { error } = await sb.from("profiles").delete().eq("id", id);
  if (error) throw error;
}

/* ========= CRUD (Entries) ========= */
async function createEntry(payload) {
  const { error } = await sb.from("cocurricular_entries").insert(payload);
  if (error) throw error;
}
async function updateEntry(id, payload) {
  const { error } = await sb.from("cocurricular_entries").update(payload).eq("id", id);
  if (error) throw error;
}
async function deleteEntry(id) {
  const { error } = await sb.from("cocurricular_entries").delete().eq("id", id);
  if (error) throw error;
}

/* ========= EXPORT EXCEL (SheetJS) ========= */
async function fetchAllRows(table, select = "*", orderCol = "id", ascending = true, pageSize = 1000) {
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await sb.from(table).select(select).order(orderCol, { ascending }).range(from, from + pageSize - 1);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function exportFullReportExcel() {
  setLoading(true);
  try {
    const gradeLevels = await fetchAllRows("grade_levels", "id,name");
    const classes = await fetchAllRows("classes", "id,grade_level_id,name");
    const students = await fetchAllRows("students", "id,class_id,full_name,student_no");
    const types = await fetchAllRows("cocurricular_types", "id,name");
    const entries = await fetchAllRows("cocurricular_entries", "*");
    const profiles = await fetchAllRows("profiles", "id,full_name");

    const gradeMap = new Map(gradeLevels.map(g => [g.id, g.name]));
    const classMap = new Map(classes.map(c => [c.id, c]));
    const typeMap = new Map(types.map(t => [t.id, t.name]));
    const studentMap = new Map(students.map(s => [s.id, s]));
    const teacherMap = new Map(profiles.map(p => [p.id, p.full_name]));

    const entriesByClass = {};

    entries.forEach(e => {
      const student = studentMap.get(e.student_id);
      if (!student) return;
      
      const cls = classMap.get(student.class_id);
      const className = cls ? cls.name : "Tanpa Kelas";
      
      if (!entriesByClass[className]) {
        entriesByClass[className] = [];
      }

      const typeName = typeMap.get(e.type_id) || "Lain-lain";
      const teacherName = teacherMap.get(e.teacher_advisor_id) || teacherMap.get(e.created_by) || "-";
      const gradeName = cls ? (gradeMap.get(cls.grade_level_id) || "-") : "-";

      entriesByClass[className].push({
        "Nama Murid": student.full_name,
        "No. Pelajar": student.student_no || "",
        "Tingkatan": gradeName,
        "Tarikh": e.activity_date,
        "Kategori": typeName,
        "Aktiviti": e.subject,
        "Pencapaian": e.achievement || "Penyertaan",
        "Guru Pengiring": teacherName
      });
    });

    const wb = XLSX.utils.book_new();

    if (Object.keys(entriesByClass).length === 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([]), "Tiada Data");
    } else {
      const sortedClasses = Object.keys(entriesByClass).sort();
      
      sortedClasses.forEach(clsName => {
        const data = entriesByClass[clsName];
        data.sort((a,b) => a["Nama Murid"].localeCompare(b["Nama Murid"]) || b["Tarikh"].localeCompare(a["Tarikh"]));
        
        const ws = XLSX.utils.json_to_sheet(data);
        const wscols = [
          {wch:30}, {wch:12}, {wch:10}, {wch:12}, {wch:20}, {wch:35}, {wch:15}, {wch:25}
        ];
        ws['!cols'] = wscols;

        XLSX.utils.book_append_sheet(wb, ws, clsName.substring(0, 31)); 
      });
    }

    XLSX.writeFile(wb, `Laporan_PAJSK_Lengkap_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast("Eksport Berjaya", "Laporan Excel telah dimuat turun.", "ok", 4000);

  } catch (err) {
    console.error(err);
    toast("Gagal Eksport", "Berlaku ralat semasa menjana Excel.", "err");
  } finally {
    setLoading(false);
  }
}

/* ========= RENDERERS ========= */
function populateGradeSelect(selectEl, selectedId) {
  selectEl.innerHTML = "";
  state.gradeLevels.forEach((g) => {
    const opt = document.createElement("option");
    opt.value = String(g.id);
    opt.textContent = g.name;
    selectEl.appendChild(opt);
  });
  selectEl.value = String(selectedId ?? 1);
}

function populateTypeSelect(selectEl, selectedId = "") {
  selectEl.innerHTML = `<option value="">Silih Pilih Kategori...</option>`;
  state.types.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    selectEl.appendChild(opt);
  });
  if (selectedId) selectEl.value = selectedId;
}

function populateTeacherSelect(selectEl, selectedId = "") {
  if(selectEl) {
    selectEl.innerHTML = `<option value="">Pilih Guru...</option>`;
    state.teachers.forEach((t) => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.full_name;
      selectEl.appendChild(opt);
    });
    if (selectedId) selectEl.value = selectedId;
  }
}

function gradeName(id) {
  const g = state.gradeLevels.find((x) => x.id === Number(id));
  return g ? g.name : `Tingkatan ${id}`;
}

/* Admin tables */
function renderClassesTable() {
  tblClassesBody.innerHTML = "";
  if (!state.adminClasses.length) {
    tblClassesBody.innerHTML = `<tr><td colspan="3" class="muted">Tiada kelas dijumpai.</td></tr>`;
    return;
  }

  state.adminClasses.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(c.name)}</td>
      <td><span class="badge neutral">${escapeHtml(gradeName(c.grade_level_id))}</span></td>
      <td class="right">
        <div class="actions">
          <button class="btn-icon" title="Edit" data-action="edit" data-id="${c.id}"><i class="ph ph-pencil-simple"></i></button>
          <button class="btn-icon" title="Padam" style="color:var(--accent-red)" data-action="del" data-id="${c.id}"><i class="ph ph-trash"></i></button>
        </div>
      </td>
    `;
    tblClassesBody.appendChild(tr);
  });
}

function populateAdminClassSelect() {
  adminClassSelect.innerHTML = "";
  if (!state.adminClasses.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "Tiada kelas";
    adminClassSelect.appendChild(opt);
    adminClassSelect.disabled = true;
    state.adminSelectedClassId = null;
    return;
  }

  adminClassSelect.disabled = false;
  state.adminClasses.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    adminClassSelect.appendChild(opt);
  });

  if (state.adminSelectedClassId && state.adminClasses.some(c => c.id === state.adminSelectedClassId)) {
    adminClassSelect.value = state.adminSelectedClassId;
  } else {
    state.adminSelectedClassId = state.adminClasses[0].id;
    adminClassSelect.value = state.adminSelectedClassId;
  }
}

function renderStudentsTable() {
  tblStudentsBody.innerHTML = "";
  if (!state.adminSelectedClassId) {
    tblStudentsBody.innerHTML = `<tr><td colspan="3" class="muted">Pilih kelas untuk lihat murid.</td></tr>`;
    return;
  }
  if (!state.adminStudents.length) {
    tblStudentsBody.innerHTML = `<tr><td colspan="3" class="muted">Tiada murid dalam kelas ini.</td></tr>`;
    return;
  }

  state.adminStudents.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(s.full_name)}</td>
      <td>${escapeHtml(s.student_no || "-")}</td>
      <td class="right">
        <div class="actions">
          <button class="btn-icon" title="Edit" data-action="edit" data-id="${s.id}"><i class="ph ph-pencil-simple"></i></button>
          <button class="btn-icon" title="Padam" style="color:var(--accent-red)" data-action="del" data-id="${s.id}"><i class="ph ph-trash"></i></button>
        </div>
      </td>
    `;
    tblStudentsBody.appendChild(tr);
  });
}

function renderTypesTable() {
  tblTypesBody.innerHTML = "";
  if (!state.types.length) {
    tblTypesBody.innerHTML = `<tr><td colspan="2" class="muted">Tiada jenis ditemui.</td></tr>`;
    return;
  }

  state.types.forEach((t) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(t.name)}</td>
      <td class="right">
        <div class="actions">
          <button class="btn-icon" title="Edit" data-action="edit" data-id="${t.id}"><i class="ph ph-pencil-simple"></i></button>
          <button class="btn-icon" title="Padam" style="color:var(--accent-red)" data-action="del" data-id="${t.id}"><i class="ph ph-trash"></i></button>
        </div>
      </td>
    `;
    tblTypesBody.appendChild(tr);
  });
}

function renderTeachersTable() {
  tblTeachersBody.innerHTML = "";
  if (!state.adminTeacherList.length) {
    tblTeachersBody.innerHTML = `<tr><td colspan="3" class="muted">Tiada profil guru dijumpai.</td></tr>`;
    return;
  }

  state.adminTeacherList.forEach((t) => {
    const isSelf = t.id === state.user.id;
    const roleBadge = t.role === 'admin' ? '<span class="badge ok">Admin</span>' : '<span class="badge neutral">Guru</span>';
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <span style="font-weight:600">${escapeHtml(t.full_name)}</span>
        ${isSelf ? '<span class="badge ok" style="margin-left:5px">Anda</span>' : ''}
      </td>
      <td>${roleBadge}</td>
      <td class="right">
        <div class="actions">
          <button class="btn-icon" title="Edit" data-action="edit" data-id="${t.id}"><i class="ph ph-pencil-simple"></i></button>
          <button class="btn-icon" title="Padam" style="color:var(--accent-red)" data-action="del" data-id="${t.id}" ${isSelf ? 'disabled' : ''}><i class="ph ph-trash"></i></button>
        </div>
      </td>
    `;
    tblTeachersBody.appendChild(tr);
  });
}

/* Teacher view */
function populateTeacherClassSelect() {
  teacherClassSelect.innerHTML = "";
  if (!state.teacherClasses.length) {
    teacherClassSelect.disabled = true;
    teacherClassSelect.innerHTML = `<option value="">Tiada Kelas</option>`;
    state.teacherSelectedClassId = null;
    return;
  }
  teacherClassSelect.disabled = false;

  state.teacherClasses.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    teacherClassSelect.appendChild(opt);
  });

  if (state.teacherSelectedClassId && state.teacherClasses.some(c => c.id === state.teacherSelectedClassId)) {
    teacherClassSelect.value = state.teacherSelectedClassId;
  } else {
    state.teacherSelectedClassId = state.teacherClasses[0].id;
    teacherClassSelect.value = state.teacherSelectedClassId;
  }
}

function renderTeacherStudents() {
  const q = (studentSearch.value || "").trim().toLowerCase();
  const rows = q
    ? state.teacherStudents.filter(s => (s.full_name || "").toLowerCase().includes(q))
    : state.teacherStudents;

  tblTeacherStudentsBody.innerHTML = "";
  if (!state.teacherSelectedClassId) {
    tblTeacherStudentsBody.innerHTML = `<tr><td colspan="3" class="muted">Sila pilih kelas.</td></tr>`;
    return;
  }
  if (!rows.length) {
    tblTeacherStudentsBody.innerHTML = `<tr><td colspan="3" class="muted">Tiada murid dijumpai.</td></tr>`;
    return;
  }

  rows.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span style="font-weight:600">${escapeHtml(s.full_name)}</span></td>
      <td>${escapeHtml(s.student_no || "-")}</td>
      <td class="right">
        <button class="btn sm primary" data-action="open" data-id="${s.id}">
          Lihat Profil <i class="ph ph-caret-right"></i>
        </button>
      </td>
    `;
    tblTeacherStudentsBody.appendChild(tr);
  });
}

function renderEntriesTable() {
  tblEntriesBody.innerHTML = "";
  if (!state.selectedStudent) {
    tblEntriesBody.innerHTML = `<tr><td colspan="5" class="muted">Tiada murid dipilih.</td></tr>`;
    return;
  }

  if (!state.studentEntries.length) {
    tblEntriesBody.innerHTML = `<tr><td colspan="5" class="muted">Tiada rekod pencapaian.</td></tr>`;
    return;
  }

  state.studentEntries.forEach((e) => {
    const canManage = (state.role === "admin") || (e.created_by === state.user.id);
    const typeName = e.cocurricular_types?.name || "(Tidak Diketahui)";
    const teacherName = e.profiles?.full_name || "(Guru)";
    const achievement = e.achievement || "Penyertaan";
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(e.activity_date)}</td>
      <td><span class="badge neutral">${escapeHtml(typeName)}</span></td>
      <td>
        <div style="font-weight:500">${escapeHtml(e.subject)}</div>
        <div style="font-size:11px; color:var(--text-muted)">${escapeHtml(achievement)}</div>
      </td>
      <td><span style="font-size:12px">${escapeHtml(teacherName)}</span></td>
      <td class="right">
        <div class="actions">
          <button class="btn-icon" title="Edit" data-action="edit" data-id="${e.id}" ${canManage ? "" : "disabled"} style="${canManage?'':'opacity:0.3'}">
            <i class="ph ph-pencil-simple"></i>
          </button>
          <button class="btn-icon" title="Padam" data-action="del" data-id="${e.id}" ${canManage ? "" : "disabled"} style="${canManage?'color:var(--accent-red)':'opacity:0.3'}">
            <i class="ph ph-trash"></i>
          </button>
        </div>
      </td>
    `;
    tblEntriesBody.appendChild(tr);
  });
}

/* ========= LOADERS ========= */
async function loadBootstrapData() {
  await fetchSystemSettings();
  
  state.gradeLevels = await fetchGradeLevels();
  state.types = await fetchTypes();
  state.teachers = await fetchAllTeachers(); 

  populateGradeSelect(adminGradeSelect, state.adminSelectedGrade);
  populateGradeSelect(teacherGradeSelect, state.teacherSelectedGrade);
  
  populateTypeSelect(entryType);
  populateTeacherSelect(entryTeacherSelect); 

  renderTypesTable();
}

async function loadAdminData() {
  state.adminClasses = await fetchClassesByGrade(state.adminSelectedGrade);
  renderClassesTable();
  populateAdminClassSelect();
  
  state.adminTeacherList = await fetchAllTeachers();
  renderTeachersTable();

  if (state.adminSelectedClassId) {
    state.adminStudents = await fetchStudentsByClass(state.adminSelectedClassId);
  } else {
    state.adminStudents = [];
  }
  renderStudentsTable();
}

async function loadTeacherClassesAndStudents() {
  state.teacherClasses = await fetchClassesByGrade(state.teacherSelectedGrade);
  populateTeacherClassSelect();

  if (state.teacherSelectedClassId) {
    state.teacherStudents = await fetchStudentsByClass(state.teacherSelectedClassId);
  } else {
    state.teacherStudents = [];
  }
  renderTeacherStudents();
}

async function openStudent(studentId) {
  const student = state.teacherStudents.find(s => s.id === studentId)
    || state.adminStudents.find(s => s.id === studentId);

  state.selectedStudent = student || { id: studentId, full_name: "Murid" };

  studentTitle.textContent = state.selectedStudent.full_name;
  const gradeLabel = gradeName(state.teacherSelectedGrade);
  const classLabel = state.teacherClasses.find(c => c.id === state.teacherSelectedClassId)?.name || "";
  studentSub.textContent = `${gradeLabel} • ${classLabel}`;

  // Reset form
  populateTypeSelect(entryType);
  populateTeacherSelect(entryTeacherSelect); // Ensure fresh list

  entrySubject.value = "";
  entryDate.valueAsDate = new Date();
  entryAchievement.value = "Penyertaan";
  
  // Set default guru pengiring kepada current user jika dia guru
  const currentUserIsTeacher = state.teachers.find(t => t.id === state.user.id);
  if(currentUserIsTeacher) {
      entryTeacherSelect.value = state.user.id;
  } else {
      entryTeacherSelect.value = "";
  }

  state.studentEntries = await fetchEntriesByStudent(studentId);
  renderEntriesTable();

  showView("student");
}

/* ========= AUTH + ROUTING ========= */
function updateAuthUI() {
  const authed = !!state.user;
  const isAdmin = state.role === "admin";

  document.querySelectorAll(".requires-auth").forEach((el) => {
    el.classList.toggle("hidden", !authed);
  });
  
  navLogin.classList.toggle("hidden", authed);
  navAdmin.classList.toggle("hidden", !(authed && isAdmin));
  navTeacher.classList.toggle("hidden", !authed);
  logoutBtn.classList.toggle("hidden", !authed);

  userBadge.classList.toggle("hidden", !authed);

  if (authed) {
    userEmail.textContent = state.user.email || "(tiada emel)";
    const r = state.role === "admin" ? "Pentadbir" : "Guru";
    userRole.textContent = r;
  }
}

async function routeAfterLogin() {
  updateAuthUI();

  if (!state.user) {
    showView("login");
    return;
  }

  if (state.role === "admin") {
    showView("admin");
    await refreshAllAdmin();
  } else {
    showView("teacher");
    await refreshAllTeacher();
  }
}

async function refreshAllAdmin() {
  setLoading(true);
  try {
    await loadBootstrapData();
    await loadAdminData();
    toast("Sistem Sedia", "Data admin berjaya dimuat turun.", "ok");
  } catch (e) {
    toast("Ralat", e.message || "Gagal memuat turun data admin.", "err");
  } finally {
    setLoading(false);
  }
}

async function refreshAllTeacher() {
  setLoading(true);
  try {
    await loadBootstrapData();
    await loadTeacherClassesAndStudents();
    toast("Sistem Sedia", "Dashboard guru sedia.", "ok");
  } catch (e) {
    toast("Ralat", e.message || "Gagal memuat turun data guru.", "err");
  } finally {
    setLoading(false);
  }
}

/* ========= EVENTS ========= */
navLogin.addEventListener("click", () => showView("login"));
navAdmin.addEventListener("click", async () => {
  showView("admin");
  if (state.role === "admin") await refreshAllAdmin();
});
navTeacher.addEventListener("click", async () => {
  showView("teacher");
  await refreshAllTeacher();
});

logoutBtn.addEventListener("click", async () => {
  setLoading(true);
  try {
    await sb.auth.signOut();
    toast("Log Keluar", "Anda telah log keluar.", "ok");
  } catch (e) {
    toast("Ralat", e.message || "Gagal log keluar.", "err");
  } finally {
    setLoading(false);
  }
});

/* Export click handlers */
btnExportAdmin?.addEventListener("click", async () => {
  await exportFullReportExcel();
});
btnExportStudent?.addEventListener("click", async () => {
  const sId = state.selectedStudent?.id;
  if(!sId) return;
  toast("Info", "Sedang menjana CSV untuk murid ini...", "ok");
});


goSignupBtn.addEventListener("click", () => signupPanel.classList.remove("hidden"));
cancelSignupBtn.addEventListener("click", () => signupPanel.classList.add("hidden"));

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearUnauthorized();

  const email = $("#login-email").value.trim();
  const password = $("#login-password").value;

  if (!email || !password) {
    toast("Validasi", "Emel dan kata laluan diperlukan.", "warn");
    return;
  }

  setLoading(true);
  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;

    state.session = data.session;
    state.user = data.user;

    state.profile = await getProfileOrThrow();
    state.role = state.profile.role;

    toast("Selamat Kembali", `Log masuk sebagai ${state.role}.`, "ok");
    await routeAfterLogin();
  } catch (err) {
    toast("Log Masuk Gagal", "Emel atau kata laluan salah.", "err");
  } finally {
    setLoading(false);
  }
});

/* SIGNUP LOGIC (UPDATED WITH FULL NAME) */
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const fullName = $("#signup-fullname").value.trim();
  const email = $("#signup-email").value.trim();
  const password = $("#signup-password").value;

  if (!fullName) {
    toast("Validasi", "Sila masukkan Nama Penuh.", "warn");
    return;
  }

  setLoading(true);
  try {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        // Hantar full_name sebagai metadata
        data: { full_name: fullName }
      }
    });
    if (error) throw error;

    toast("Akaun Dicipta", "Sila log masuk sekarang.", "ok", 4200);
    signupPanel.classList.add("hidden");
    
    // Reset form
    $("#signup-fullname").value = "";
    $("#signup-email").value = "";
    $("#signup-password").value = "";

  } catch (err) {
    toast("Pendaftaran Gagal", err.message, "err");
  } finally {
    setLoading(false);
  }
});

/* Admin grade change */
adminGradeSelect.addEventListener("change", async () => {
  state.adminSelectedGrade = Number(adminGradeSelect.value);
  setLoading(true);
  try {
    await loadAdminData(); 
  } catch (e) {
    toast("Ralat", e.message, "err");
  } finally {
    setLoading(false);
  }
});

/* Admin class change -> load students */
adminClassSelect.addEventListener("change", async () => {
  state.adminSelectedClassId = adminClassSelect.value || null;
  setLoading(true);
  try {
    state.adminStudents = state.adminSelectedClassId
      ? await fetchStudentsByClass(state.adminSelectedClassId)
      : [];
    renderStudentsTable();
  } catch (e) {
    toast("Ralat", e.message, "err");
  } finally {
    setLoading(false);
  }
});

/* Create class */
btnClassCreate.addEventListener("click", async () => {
  if (state.role !== "admin") return;

  const values = await openModal({
    title: "Cipta Kelas Baru",
    submitText: "Cipta",
    fields: [
      {
        name: "grade_level_id",
        label: "Tingkatan",
        type: "select",
        required: true,
        options: state.gradeLevels.map(g => ({ value: String(g.id), label: g.name })),
      },
      { name: "name", label: "Nama Kelas", type: "text", required: true, minLength: 1, placeholder: "cth. Amanah" },
    ],
    initial: { grade_level_id: String(state.adminSelectedGrade), name: "" }
  });

  if (!values) return;

  setLoading(true);
  try {
    await createClass({
      grade_level_id: Number(values.grade_level_id),
      name: values.name.trim(),
    });
    toast("Berjaya", "Kelas dicipta.", "ok");
    state.adminSelectedGrade = Number(values.grade_level_id);
    adminGradeSelect.value = String(state.adminSelectedGrade);
    await loadAdminData();
  } catch (e) {
    toast("Ralat", e.message, "err");
  } finally {
    setLoading(false);
  }
});

/* Classes table actions */
tblClassesBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;

  const row = state.adminClasses.find(c => c.id === id);
  if (!row) return;

  if (action === "edit") {
    const values = await openModal({
      title: "Kemaskini Kelas",
      submitText: "Kemaskini",
      fields: [
        {
          name: "grade_level_id",
          label: "Tingkatan",
          type: "select",
          required: true,
          options: state.gradeLevels.map(g => ({ value: String(g.id), label: g.name })),
        },
        { name: "name", label: "Nama Kelas", type: "text", required: true, minLength: 1 },
      ],
      initial: { grade_level_id: String(row.grade_level_id), name: row.name }
    });
    if (!values) return;

    setLoading(true);
    try {
      await updateClass(id, {
        grade_level_id: Number(values.grade_level_id),
        name: values.name.trim(),
      });
      toast("Berjaya", "Kelas dikemaskini.", "ok");
      await loadAdminData();
    } catch (err) {
      toast("Ralat", err.message, "err");
    } finally {
      setLoading(false);
    }
  }

  if (action === "del") {
    if (!confirm(`Padam kelas "${row.name}"? Murid dan rekod dalam kelas ini akan turut dipadam.`)) return;
    setLoading(true);
    try {
      await deleteClass(id);
      toast("Dipadam", "Kelas berjaya dipadam.", "ok");
      await loadAdminData();
    } catch (err) {
      toast("Ralat", err.message, "err");
    } finally {
      setLoading(false);
    }
  }
});

/* Create student */
btnStudentCreate.addEventListener("click", async () => {
  if (state.role !== "admin") return;

  if (!state.adminSelectedClassId) {
    toast("Pilih Kelas", "Sila pilih kelas dahulu.", "warn");
    return;
  }

  const values = await openModal({
    title: "Daftar Murid Baru",
    submitText: "Daftar",
    fields: [
      {
        name: "class_id",
        label: "Kelas",
        type: "select",
        required: true,
        options: state.adminClasses.map(c => ({ value: c.id, label: c.name })),
      },
      { name: "full_name", label: "Nama Penuh", type: "text", required: true, minLength: 1 },
      { name: "student_no", label: "No. Matrik/IC (Pilihan)", type: "text", required: false },
    ],
    initial: { class_id: state.adminSelectedClassId, full_name: "", student_no: "" }
  });

  if (!values) return;

  setLoading(true);
  try {
    await createStudent({
      class_id: values.class_id,
      full_name: values.full_name.trim(),
      student_no: values.student_no ? values.student_no.trim() : null
    });
    toast("Berjaya", "Murid didaftarkan.", "ok");
    state.adminStudents = await fetchStudentsByClass(state.adminSelectedClassId);
    renderStudentsTable();
  } catch (err) {
    toast("Ralat", err.message, "err");
  } finally {
    setLoading(false);
  }
});

/* Students table actions */
tblStudentsBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;

  const row = state.adminStudents.find(s => s.id === id);
  if (!row) return;

  if (action === "edit") {
    const values = await openModal({
      title: "Kemaskini Murid",
      submitText: "Kemaskini",
      fields: [
        {
          name: "class_id",
          label: "Kelas",
          type: "select",
          required: true,
          options: state.adminClasses.map(c => ({ value: c.id, label: c.name })),
        },
        { name: "full_name", label: "Nama Penuh", type: "text", required: true, minLength: 1 },
        { name: "student_no", label: "No. Matrik/IC", type: "text", required: false },
      ],
      initial: { class_id: row.class_id, full_name: row.full_name, student_no: row.student_no || "" }
    });
    if (!values) return;

    setLoading(true);
    try {
      await updateStudent(id, {
        class_id: values.class_id,
        full_name: values.full_name.trim(),
        student_no: values.student_no ? values.student_no.trim() : null
      });
      toast("Berjaya", "Data murid dikemaskini.", "ok");
      state.adminSelectedClassId = values.class_id;
      adminClassSelect.value = values.class_id;
      state.adminStudents = await fetchStudentsByClass(state.adminSelectedClassId);
      renderStudentsTable();
    } catch (err) {
      toast("Ralat", err.message, "err");
    } finally {
      setLoading(false);
    }
  }

  if (action === "del") {
    if (!confirm(`Padam murid "${row.full_name}"?`)) return;
    setLoading(true);
    try {
      await deleteStudent(id);
      toast("Dipadam", "Murid dipadam.", "ok");
      state.adminStudents = await fetchStudentsByClass(state.adminSelectedClassId);
      renderStudentsTable();
    } catch (err) {
      toast("Ralat", err.message, "err");
    } finally {
      setLoading(false);
    }
  }
});

/* Create Type */
btnTypeCreate.addEventListener("click", async () => {
  const values = await openModal({
    title: "Tambah Jenis Kokurikulum",
    submitText: "Tambah",
    fields: [
      { name: "name", label: "Nama Jenis", type: "text", required: true, minLength: 1, placeholder: "cth. Kelab Persatuan" }
    ],
    initial: { name: "" }
  });
  if (!values) return;

  setLoading(true);
  try {
    await createType({ name: values.name.trim() });
    toast("Berjaya", "Jenis ditambah.", "ok");
    state.types = await fetchTypes();
    renderTypesTable();
    populateTypeSelect(entryType);
  } catch (err) {
    toast("Ralat", err.message, "err");
  } finally {
    setLoading(false);
  }
});

/* Types table actions */
tblTypesBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  
  if (action === "edit") {
    const row = state.types.find(t => t.id === id);
    const values = await openModal({
      title: "Edit Jenis",
      submitText: "Simpan",
      fields: [{ name: "name", label: "Nama", type: "text", required: true, minLength: 1 }],
      initial: { name: row.name }
    });
    if(!values) return;
    
    setLoading(true);
    try {
      await updateType(id, { name: values.name.trim() });
      toast("Berjaya", "Jenis dikemaskini.", "ok");
      state.types = await fetchTypes();
      renderTypesTable();
    } catch(e) { toast("Ralat", e.message, "err"); }
    finally { setLoading(false); }
  }
  
  if (action === "del") {
     if(!confirm("Padam jenis ini?")) return;
     setLoading(true);
     try {
       await deleteType(id);
       toast("Dipadam", "Jenis berjaya dipadam.", "ok");
       state.types = await fetchTypes();
       renderTypesTable();
     } catch(e) { toast("Ralat", e.message, "err"); }
     finally { setLoading(false); }
  }
});

/* Manage Teachers (Admin) */
btnTeacherCreate.addEventListener("click", async () => {
  const values = await openModal({
    title: "Tambah Profil Guru",
    submitText: "Tambah",
    fields: [
      { name: "full_name", label: "Nama Penuh", type: "text", required: true },
      { name: "role", label: "Peranan", type: "select", options:[{value:"teacher", label:"Guru"}, {value:"admin", label:"Admin"}] }
    ],
    initial: { full_name: "", role: "teacher" }
  });
  if(!values) return;

  setLoading(true);
  try {
    const fakeId = crypto.randomUUID();
    await createTeacherProfile({
      id: fakeId,
      full_name: values.full_name,
      role: values.role
    });
    toast("Berjaya", "Profil guru ditambah. Sila minta guru daftar akaun dengan emel.", "ok");
    state.adminTeacherList = await fetchAllTeachers();
    renderTeachersTable();
  } catch(e) {
    toast("Ralat", e.message, "err");
  } finally {
    setLoading(false);
  }
});

tblTeachersBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  
  if(action === "edit") {
    const row = state.adminTeacherList.find(t => t.id === id);
    const values = await openModal({
      title: "Edit Profil Guru",
      fields: [
        { name: "full_name", label: "Nama Penuh", type: "text", required: true },
        { name: "role", label: "Peranan", type: "select", options:[{value:"teacher", label:"Guru"}, {value:"admin", label:"Admin"}] }
      ],
      initial: { full_name: row.full_name, role: row.role }
    });
    if(!values) return;
    
    setLoading(true);
    try {
      await updateTeacherProfile(id, { full_name: values.full_name, role: values.role });
      toast("Berjaya", "Profil guru dikemaskini.", "ok");
      state.adminTeacherList = await fetchAllTeachers();
      renderTeachersTable();
    } catch(e) { toast("Ralat", e.message, "err"); }
    finally { setLoading(false); }
  }
  
  if(action === "del") {
    if(!confirm("Padam profil guru ini? Mereka akan kehilangan akses.")) return;
    setLoading(true);
    try {
      await deleteTeacherProfile(id);
      toast("Dipadam", "Profil guru dipadam.", "ok");
      state.adminTeacherList = await fetchAllTeachers();
      renderTeachersTable();
    } catch(e) { toast("Ralat", e.message, "err"); }
    finally { setLoading(false); }
  }
});


/* Teacher grade/class changes */
teacherGradeSelect.addEventListener("change", async () => {
  state.teacherSelectedGrade = Number(teacherGradeSelect.value);
  setLoading(true);
  try {
    await loadTeacherClassesAndStudents();
  } catch (e) {
    toast("Ralat", e.message, "err");
  } finally {
    setLoading(false);
  }
});

teacherClassSelect.addEventListener("change", async () => {
  state.teacherSelectedClassId = teacherClassSelect.value || null;
  setLoading(true);
  try {
    state.teacherStudents = state.teacherSelectedClassId
      ? await fetchStudentsByClass(state.teacherSelectedClassId)
      : [];
    renderTeacherStudents();
  } catch (e) {
    toast("Ralat", e.message, "err");
  } finally {
    setLoading(false);
  }
});

studentSearch.addEventListener("input", () => renderTeacherStudents());

/* Open student from teacher list */
tblTeacherStudentsBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  if (btn.dataset.action !== "open") return;

  const id = btn.dataset.id;
  setLoading(true);
  try {
    await openStudent(id);
  } catch (err) {
    toast("Ralat", err.message, "err");
  } finally {
    setLoading(false);
  }
});

backTeacherBtn.addEventListener("click", async () => {
  showView("teacher");
  await refreshAllTeacher();
});

/* Add entry (Updated to use Select instead of Search) */
entryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!state.selectedStudent) return;

  const subject = entrySubject.value.trim();
  const activity_date = entryDate.value;
  const type_id = entryType.value;
  const achievement = entryAchievement.value;
  const teacher_id = entryTeacherSelect.value;

  if (!subject || subject.length < 3) {
    toast("Validasi", "Aktiviti diperlukan (min 3 aksara).", "warn");
    entrySubject.focus();
    return;
  }
  if (!activity_date) {
    toast("Validasi", "Tarikh diperlukan.", "warn");
    entryDate.focus();
    return;
  }
  if (!type_id) {
    toast("Validasi", "Kategori diperlukan.", "warn");
    entryType.focus();
    return;
  }
  if (!teacher_id) {
    toast("Validasi", "Sila pilih Guru Pengiring.", "warn");
    entryTeacherSelect.focus();
    return;
  }

  setLoading(true);
  try {
    await createEntry({
      student_id: state.selectedStudent.id,
      type_id,
      subject,
      activity_date,
      achievement,
      teacher_advisor_id: teacher_id,
      created_by: state.user.id,
    });

    toast("Disimpan", "Rekod berjaya ditambah.", "ok");
    entrySubject.value = "";
    entryDate.valueAsDate = new Date();
    // Keep Teacher & Category selected for convenience
    
    state.studentEntries = await fetchEntriesByStudent(state.selectedStudent.id);
    renderEntriesTable();
  } catch (err) {
    toast("Ralat", err.message, "err");
  } finally {
    setLoading(false);
  }
});

/* Entry actions */
tblEntriesBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const id = btn.dataset.id;
  const action = btn.dataset.action;
  const row = state.studentEntries.find(x => x.id === id);
  if (!row) return;

  if (action === "edit") {
    const values = await openModal({
      title: "Edit Rekod",
      submitText: "Kemaskini",
      fields: [
        { name: "subject", label: "Aktiviti", type: "text", required: true, minLength: 3 },
        { name: "activity_date", label: "Tarikh", type: "date", required: true },
        { name: "type_id", label: "Kategori", type: "select", required: true, options: state.types.map(t => ({ value: t.id, label: t.name })) },
        { name: "achievement", label: "Pencapaian", type: "select", required: true, options: [
            {value:"Penyertaan", label:"Penyertaan Sahaja"},
            {value:"Johan", label:"Johan (No. 1)"},
            {value:"Naib Johan", label:"Naib Johan (No. 2)"},
            {value:"Ketiga", label:"Ketiga (No. 3)"},
            {value:"Keempat", label:"Keempat (No. 4)"},
            {value:"Kelima", label:"Kelima (No. 5)"},
        ]},
        { name: "teacher_advisor_id", label: "Guru Pengiring", type: "select", required:true, options: state.teachers.map(t => ({value:t.id, label:t.full_name})) }
      ],
      initial: {
        subject: row.subject,
        activity_date: row.activity_date,
        type_id: row.type_id,
        achievement: row.achievement || "Penyertaan",
        teacher_advisor_id: row.teacher_advisor_id || ""
      }
    });

    if (!values) return;

    setLoading(true);
    try {
      await updateEntry(id, {
        subject: values.subject.trim(),
        activity_date: values.activity_date,
        type_id: values.type_id,
        achievement: values.achievement,
        teacher_advisor_id: values.teacher_advisor_id
      });
      toast("Berjaya", "Rekod dikemaskini.", "ok");
      state.studentEntries = await fetchEntriesByStudent(state.selectedStudent.id);
      renderEntriesTable();
    } catch (err) {
      toast("Ralat", err.message, "err");
    } finally {
      setLoading(false);
    }
  }

  if (action === "del") {
    if (!confirm("Padam rekod ini?")) return;
    setLoading(true);
    try {
      await deleteEntry(id);
      toast("Dipadam", "Rekod dipadam.", "ok");
      state.studentEntries = await fetchEntriesByStudent(state.selectedStudent.id);
      renderEntriesTable();
    } catch (err) {
      toast("Ralat", err.message, "err");
    } finally {
      setLoading(false);
    }
  }
});

/* ========= INIT ========= */
async function init() {
  if (SUPABASE_URL.includes("YOUR_")) {
    toast("Setup Diperlukan", "Sila tetapkan SUPABASE_URL & KEY.", "warn", 6000);
  }

  setLoading(true);
  try {
    const { data } = await sb.auth.getSession();
    state.session = data.session;
    state.user = data.session?.user || null;

    if (state.user) {
      state.profile = await getProfileOrThrow();
      state.role = state.profile.role;
      await fetchSystemSettings();
    } else {
      await fetchSystemSettings();
    }

    updateAuthUI();
    await routeAfterLogin();
  } catch (e) {
    toast("Ralat", e.message, "err");
    showView("login");
  } finally {
    setLoading(false);
  }

  sb.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    state.user = session?.user || null;

    if (state.user) {
      try {
        state.profile = await getProfileOrThrow();
        state.role = state.profile.role;
        await fetchSystemSettings();
      } catch (e) {
        state.profile = null;
        state.role = null;
      }
    } else {
      state.profile = null;
      state.role = null;
      state.selectedStudent = null;
    }

    updateAuthUI();
    await routeAfterLogin();
  });
}

init();