/* ========= CONFIG =========
   1) Create Supabase project
   2) Run schema.sql in Supabase SQL Editor
   3) Put your URL + anon key below
*/
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

  // Admin
  adminSelectedGrade: 1,
  adminClasses: [],
  adminSelectedClassId: null,
  adminStudents: [],

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

const adminGradeSelect = $("#admin-grade-select");
const adminClassSelect = $("#admin-class-select");
const btnClassCreate = $("#btn-class-create");
const btnStudentCreate = $("#btn-student-create");
const btnTypeCreate = $("#btn-type-create");

const tblClassesBody = $("#tbl-classes tbody");
const tblStudentsBody = $("#tbl-students tbody");
const tblTypesBody = $("#tbl-types tbody");

const teacherGradeSelect = $("#teacher-grade-select");
const teacherClassSelect = $("#teacher-class-select");
const studentSearch = $("#student-search");
const tblTeacherStudentsBody = $("#tbl-teacher-students tbody");

const studentTitle = $("#student-detail-title");
const studentSub = $("#student-detail-sub");
const backTeacherBtn = $("#btn-back-teacher");
const entryForm = $("#form-entry");
const entrySubject = $("#entry-subject");
const entryDate = $("#entry-date");
const entryType = $("#entry-type");
const tblEntriesBody = $("#tbl-entries tbody");

/* Export buttons */
const btnExportAdmin = $("#btn-export-admin");
const btnExportTeacher = $("#btn-export-teacher");
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
  el.innerHTML = `
    <div class="title">${escapeHtml(title)}</div>
    <div class="msg">${escapeHtml(msg || "")}</div>
  `;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(-6px)";
    setTimeout(() => el.remove(), 200);
  }, ttl);
}

function showUnauthorized(message) {
  unauthorizedEl.textContent = message;
  unauthorizedEl.classList.remove("hidden");
}

function clearUnauthorized() {
  unauthorizedEl.classList.add("hidden");
  unauthorizedEl.textContent = "";
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
    return;
  }

  if (!state.user) {
    views.login.classList.remove("hidden");
    setActiveNav("login");
    return;
  }

  if (key === "admin") {
    if (state.role !== "admin") {
      showUnauthorized("Unauthorized: Admin console is only accessible to admin users.");
      toast("Unauthorized", "You don't have permission to access Admin.", "warn");
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
function openModal({ title, submitText = "Save", fields = [], initial = {} }) {
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
    wrap.appendChild(input);
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
      toast("Validation", `${f.label} is required.`, "warn");
      el.focus();
      return;
    }
    if (f.minLength && val && val.length < f.minLength) {
      toast("Validation", `${f.label} must be at least ${f.minLength} characters.`, "warn");
      el.focus();
      return;
    }
    values[f.name] = val;
  }

  if (modalResolver) modalResolver(values);
  modalResolver = null;
  closeModal();
});

/* ========= SUPABASE HELPERS ========= */
async function getProfileOrThrow() {
  const uid = state.user.id;

  const { data, error } = await sb
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", uid)
    .single();

  // If row doesn't exist (should exist due to trigger), create it as teacher.
  if (error && error.code === "PGRST116") {
    const { error: insErr } = await sb.from("profiles").insert({
      id: uid,
      full_name: state.user.email || "",
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
  const { data, error } = await sb
    .from("grade_levels")
    .select("id, name")
    .order("id", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function fetchTypes() {
  const { data, error } = await sb
    .from("cocurricular_types")
    .select("id, name")
    .order("name", { ascending: true });

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
    .select("id, subject, activity_date, created_by, created_at, type_id, cocurricular_types(name)")
    .eq("student_id", studentId)
    .order("activity_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
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

/* ========= EXPORT CSV (Admin + Teacher) ========= */
function csvEscape(v) {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function buildCSV(headers, rows) {
  const head = headers.map(csvEscape).join(",");
  const lines = rows.map(r => headers.map(h => csvEscape(r[h])).join(","));
  return [head, ...lines].join("\n");
}

function downloadTextFile(filename, content, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function tsForFile() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function fetchAllRows(table, select = "*", orderCol = "id", ascending = true, pageSize = 1000, applyFilters = null) {
  let all = [];
  let from = 0;

  while (true) {
    let q = sb.from(table).select(select).order(orderCol, { ascending });
    if (applyFilters) q = applyFilters(q);

    const { data, error } = await q.range(from, from + pageSize - 1);
    if (error) throw error;

    all.push(...(data || []));
    if (!data || data.length < pageSize) break;

    from += pageSize;
  }

  return all;
}

async function exportAllDataCSVs() {
  setLoading(true);
  try {
    const grade_levels = await fetchAllRows("grade_levels", "id,name", "id", true);
    const classes = await fetchAllRows("classes", "id,grade_level_id,name,created_at,updated_at", "created_at", true);
    const students = await fetchAllRows("students", "id,class_id,full_name,student_no,created_at,updated_at", "created_at", true);
    const types = await fetchAllRows("cocurricular_types", "id,name,created_at,updated_at", "created_at", true);
    const entries = await fetchAllRows(
      "cocurricular_entries",
      "id,student_id,type_id,subject,activity_date,created_by,created_at,updated_at",
      "created_at",
      true
    );

    const gradeMap = new Map(grade_levels.map(g => [g.id, g.name]));
    const classMap = new Map(classes.map(c => [c.id, c]));
    const typeMap = new Map(types.map(t => [t.id, t.name]));
    const studentMap = new Map(students.map(s => [s.id, s]));

    // classes.csv
    const classRows = classes.map(c => ({
      id: c.id,
      grade_level_id: c.grade_level_id,
      grade_name: gradeMap.get(c.grade_level_id) || "",
      name: c.name,
      created_at: c.created_at,
      updated_at: c.updated_at
    }));
    const classesCSV = buildCSV(
      ["id","grade_level_id","grade_name","name","created_at","updated_at"],
      classRows
    );

    // students.csv
    const studentRows = students.map(s => {
      const cls = classMap.get(s.class_id);
      const gradeId = cls?.grade_level_id ?? "";
      return {
        id: s.id,
        class_id: s.class_id,
        class_name: cls?.name || "",
        grade_level_id: gradeId,
        grade_name: gradeId ? (gradeMap.get(gradeId) || "") : "",
        full_name: s.full_name,
        student_no: s.student_no || "",
        created_at: s.created_at,
        updated_at: s.updated_at
      };
    });
    const studentsCSV = buildCSV(
      ["id","class_id","class_name","grade_level_id","grade_name","full_name","student_no","created_at","updated_at"],
      studentRows
    );

    // types.csv
    const typeRows = types.map(t => ({
      id: t.id,
      name: t.name,
      created_at: t.created_at,
      updated_at: t.updated_at
    }));
    const typesCSV = buildCSV(
      ["id","name","created_at","updated_at"],
      typeRows
    );

    // entries.csv (flatten)
    const entryRows = entries.map(e => {
      const s = studentMap.get(e.student_id);
      const cls = s ? classMap.get(s.class_id) : null;
      const gradeId = cls?.grade_level_id ?? "";
      return {
        id: e.id,
        activity_date: e.activity_date,
        subject: e.subject,
        type_id: e.type_id,
        type_name: typeMap.get(e.type_id) || "",
        student_id: e.student_id,
        student_name: s?.full_name || "",
        student_no: s?.student_no || "",
        class_id: s?.class_id || "",
        class_name: cls?.name || "",
        grade_level_id: gradeId,
        grade_name: gradeId ? (gradeMap.get(gradeId) || "") : "",
        created_by: e.created_by,
        created_at: e.created_at,
        updated_at: e.updated_at
      };
    });

    entryRows.sort((a, b) => {
      const g = String(a.grade_level_id).localeCompare(String(b.grade_level_id));
      if (g !== 0) return g;
      const c = String(a.class_name).localeCompare(String(b.class_name));
      if (c !== 0) return c;
      const s = String(a.student_name).localeCompare(String(b.student_name));
      if (s !== 0) return s;
      return String(b.activity_date).localeCompare(String(a.activity_date));
    });

    const entriesCSV = buildCSV(
      ["id","activity_date","subject","type_id","type_name","student_id","student_name","student_no","class_id","class_name","grade_level_id","grade_name","created_by","created_at","updated_at"],
      entryRows
    );

    const stamp = tsForFile();

    downloadTextFile(`classes_${stamp}.csv`, classesCSV);
    setTimeout(() => downloadTextFile(`students_${stamp}.csv`, studentsCSV), 150);
    setTimeout(() => downloadTextFile(`types_${stamp}.csv`, typesCSV), 300);
    setTimeout(() => downloadTextFile(`entries_${stamp}.csv`, entriesCSV), 450);

    toast("Export", "CSV downloaded (classes, students, types, entries).", "ok", 3500);
  } catch (err) {
    toast("Export failed", err.message || "Could not export CSV.", "err");
  } finally {
    setLoading(false);
  }
}

async function exportStudentEntriesCSV(studentId) {
  if (!studentId) {
    toast("Export", "No student selected.", "warn");
    return;
  }

  setLoading(true);
  try {
    const types = await fetchAllRows("cocurricular_types", "id,name", "name", true);
    const typeMap = new Map(types.map(t => [t.id, t.name]));

    const entries = await fetchAllRows(
      "cocurricular_entries",
      "id,student_id,type_id,subject,activity_date,created_by,created_at,updated_at",
      "created_at",
      true,
      1000,
      (q) => q.eq("student_id", studentId)
    );

    const rows = entries.map(e => ({
      id: e.id,
      activity_date: e.activity_date,
      type_id: e.type_id,
      type_name: typeMap.get(e.type_id) || "",
      subject: e.subject,
      created_by: e.created_by,
      created_at: e.created_at,
      updated_at: e.updated_at
    }));

    rows.sort((a, b) => String(b.activity_date).localeCompare(String(a.activity_date)));

    const csv = buildCSV(
      ["id","activity_date","type_id","type_name","subject","created_by","created_at","updated_at"],
      rows
    );

    const stamp = tsForFile();
    downloadTextFile(`student_entries_${studentId}_${stamp}.csv`, csv);

    toast("Export", "Student entries CSV downloaded.", "ok");
  } catch (err) {
    toast("Export failed", err.message || "Could not export student CSV.", "err");
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
  selectEl.innerHTML = `<option value="">Select type…</option>`;
  state.types.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.name;
    selectEl.appendChild(opt);
  });
  if (selectedId) selectEl.value = selectedId;
}

function gradeName(id) {
  const g = state.gradeLevels.find((x) => x.id === Number(id));
  return g ? g.name : `Form ${id}`;
}

/* Admin tables */
function renderClassesTable() {
  tblClassesBody.innerHTML = "";
  if (!state.adminClasses.length) {
    tblClassesBody.innerHTML = `<tr><td colspan="3" class="muted">No classes found.</td></tr>`;
    return;
  }

  state.adminClasses.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(c.name)}</td>
      <td>${escapeHtml(gradeName(c.grade_level_id))}</td>
      <td class="right">
        <div class="actions">
          <button class="btn secondary" data-action="edit" data-id="${c.id}">Edit</button>
          <button class="btn danger" data-action="del" data-id="${c.id}">Delete</button>
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
    opt.textContent = "No classes";
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
    tblStudentsBody.innerHTML = `<tr><td colspan="3" class="muted">Select a class.</td></tr>`;
    return;
  }
  if (!state.adminStudents.length) {
    tblStudentsBody.innerHTML = `<tr><td colspan="3" class="muted">No students found.</td></tr>`;
    return;
  }

  state.adminStudents.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(s.full_name)}</td>
      <td>${escapeHtml(s.student_no || "-")}</td>
      <td class="right">
        <div class="actions">
          <button class="btn secondary" data-action="edit" data-id="${s.id}">Edit</button>
          <button class="btn danger" data-action="del" data-id="${s.id}">Delete</button>
        </div>
      </td>
    `;
    tblStudentsBody.appendChild(tr);
  });
}

function renderTypesTable() {
  tblTypesBody.innerHTML = "";
  if (!state.types.length) {
    tblTypesBody.innerHTML = `<tr><td colspan="2" class="muted">No types found.</td></tr>`;
    return;
  }

  state.types.forEach((t) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(t.name)}</td>
      <td class="right">
        <div class="actions">
          <button class="btn secondary" data-action="edit" data-id="${t.id}">Edit</button>
          <button class="btn danger" data-action="del" data-id="${t.id}">Delete</button>
        </div>
      </td>
    `;
    tblTypesBody.appendChild(tr);
  });
}

/* Teacher view */
function populateTeacherClassSelect() {
  teacherClassSelect.innerHTML = "";
  if (!state.teacherClasses.length) {
    teacherClassSelect.disabled = true;
    teacherClassSelect.innerHTML = `<option value="">No classes</option>`;
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
    tblTeacherStudentsBody.innerHTML = `<tr><td colspan="3" class="muted">Select a class.</td></tr>`;
    return;
  }
  if (!rows.length) {
    tblTeacherStudentsBody.innerHTML = `<tr><td colspan="3" class="muted">No students found.</td></tr>`;
    return;
  }

  rows.forEach((s) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(s.full_name)}</td>
      <td>${escapeHtml(s.student_no || "-")}</td>
      <td class="right">
        <button class="btn primary" data-action="open" data-id="${s.id}">Open</button>
      </td>
    `;
    tblTeacherStudentsBody.appendChild(tr);
  });
}

function renderEntriesTable() {
  tblEntriesBody.innerHTML = "";
  if (!state.selectedStudent) {
    tblEntriesBody.innerHTML = `<tr><td colspan="5" class="muted">No student selected.</td></tr>`;
    return;
  }

  if (!state.studentEntries.length) {
    tblEntriesBody.innerHTML = `<tr><td colspan="5" class="muted">No entries yet.</td></tr>`;
    return;
  }

  state.studentEntries.forEach((e) => {
    const canManage = (state.role === "admin") || (e.created_by === state.user.id);
    const typeName = e.cocurricular_types?.name || "(Unknown)";
    const createdTag = e.created_by === state.user.id ? `<span class="badge ok">mine</span>` : `<span class="badge">teacher</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(e.activity_date)}</td>
      <td>${escapeHtml(typeName)}</td>
      <td>${escapeHtml(e.subject)}</td>
      <td>${createdTag}</td>
      <td class="right">
        <div class="actions">
          <button class="btn secondary" data-action="edit" data-id="${e.id}" ${canManage ? "" : "disabled"}>Edit</button>
          <button class="btn danger" data-action="del" data-id="${e.id}" ${canManage ? "" : "disabled"}>Delete</button>
        </div>
      </td>
    `;
    tblEntriesBody.appendChild(tr);
  });
}

/* ========= LOADERS ========= */
async function loadBootstrapData() {
  state.gradeLevels = await fetchGradeLevels();
  state.types = await fetchTypes();

  populateGradeSelect(adminGradeSelect, state.adminSelectedGrade);
  populateGradeSelect(teacherGradeSelect, state.teacherSelectedGrade);
  populateTypeSelect(entryType);

  renderTypesTable();
}

async function loadAdminClassesAndStudents() {
  state.adminClasses = await fetchClassesByGrade(state.adminSelectedGrade);
  renderClassesTable();
  populateAdminClassSelect();

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

  state.selectedStudent = student || { id: studentId, full_name: "Student" };

  studentTitle.textContent = state.selectedStudent.full_name;
  const gradeLabel = gradeName(state.teacherSelectedGrade);
  const classLabel = state.teacherClasses.find(c => c.id === state.teacherSelectedClassId)?.name || "";
  studentSub.textContent = `${gradeLabel}${classLabel ? " • " + classLabel : ""}`;

  populateTypeSelect(entryType);
  entrySubject.value = "";
  entryDate.valueAsDate = new Date();

  state.studentEntries = await fetchEntriesByStudent(studentId);
  renderEntriesTable();

  showView("student");
}

/* ========= AUTH + ROUTING ========= */
function updateAuthUI() {
  const authed = !!state.user;

  document.querySelectorAll(".requires-auth").forEach((el) => {
    el.classList.toggle("hidden", !authed);
  });

  userBadge.classList.toggle("hidden", !authed);

  if (authed) {
    userEmail.textContent = state.user.email || "(no email)";
    userRole.textContent = state.role || "teacher";
  }

  navAdmin.classList.toggle("hidden", !authed);
  navTeacher.classList.toggle("hidden", !authed);
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
    await loadAdminClassesAndStudents();
    toast("Ready", "Admin console loaded.", "ok");
  } catch (e) {
    toast("Error", e.message || "Failed to load admin data.", "err");
  } finally {
    setLoading(false);
  }
}

async function refreshAllTeacher() {
  setLoading(true);
  try {
    await loadBootstrapData();
    await loadTeacherClassesAndStudents();
    toast("Ready", "Teacher view loaded.", "ok");
  } catch (e) {
    toast("Error", e.message || "Failed to load teacher data.", "err");
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
    toast("Signed out", "You have been logged out.", "ok");
  } catch (e) {
    toast("Error", e.message || "Logout failed.", "err");
  } finally {
    setLoading(false);
  }
});

/* Export click handlers */
btnExportAdmin?.addEventListener("click", async () => {
  await exportAllDataCSVs();
});
btnExportTeacher?.addEventListener("click", async () => {
  await exportAllDataCSVs();
});
btnExportStudent?.addEventListener("click", async () => {
  await exportStudentEntriesCSV(state.selectedStudent?.id);
});

goSignupBtn.addEventListener("click", () => signupPanel.classList.remove("hidden"));
cancelSignupBtn.addEventListener("click", () => signupPanel.classList.add("hidden"));

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearUnauthorized();

  const email = $("#login-email").value.trim();
  const password = $("#login-password").value;

  if (!email || !password) {
    toast("Validation", "Email and password are required.", "warn");
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

    toast("Welcome", `Signed in as ${state.role}.`, "ok");
    await routeAfterLogin();
  } catch (err) {
    toast("Login failed", err.message || "Invalid credentials.", "err");
  } finally {
    setLoading(false);
  }
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = $("#signup-email").value.trim();
  const password = $("#signup-password").value;

  setLoading(true);
  try {
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: "" }
      }
    });
    if (error) throw error;

    toast("Signed up", "Teacher account created. You may need to confirm email (depending on Auth settings).", "ok", 4200);
    signupPanel.classList.add("hidden");

    const s = data.session;
    if (s) {
      state.session = s;
      state.user = data.user;
      state.profile = await getProfileOrThrow();
      state.role = state.profile.role;
      await routeAfterLogin();
    }
  } catch (err) {
    toast("Sign up failed", err.message || "Could not create user.", "err");
  } finally {
    setLoading(false);
  }
});

/* Admin grade change */
adminGradeSelect.addEventListener("change", async () => {
  state.adminSelectedGrade = Number(adminGradeSelect.value);
  setLoading(true);
  try {
    await loadAdminClassesAndStudents();
  } catch (e) {
    toast("Error", e.message || "Failed loading classes.", "err");
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
    toast("Error", e.message || "Failed loading students.", "err");
  } finally {
    setLoading(false);
  }
});

/* Create class */
btnClassCreate.addEventListener("click", async () => {
  if (state.role !== "admin") return;

  const values = await openModal({
    title: "Create Class",
    submitText: "Create",
    fields: [
      {
        name: "grade_level_id",
        label: "Grade",
        type: "select",
        required: true,
        options: state.gradeLevels.map(g => ({ value: String(g.id), label: g.name })),
      },
      { name: "name", label: "Class Name", type: "text", required: true, minLength: 1, placeholder: "e.g., Amanah" },
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
    toast("Success", "Class created.", "ok");
    state.adminSelectedGrade = Number(values.grade_level_id);
    adminGradeSelect.value = String(state.adminSelectedGrade);
    await loadAdminClassesAndStudents();
  } catch (e) {
    toast("Error", e.message || "Class create blocked (RLS?)", "err");
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
      title: "Edit Class",
      submitText: "Save",
      fields: [
        {
          name: "grade_level_id",
          label: "Grade",
          type: "select",
          required: true,
          options: state.gradeLevels.map(g => ({ value: String(g.id), label: g.name })),
        },
        { name: "name", label: "Class Name", type: "text", required: true, minLength: 1 },
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
      toast("Success", "Class updated.", "ok");
      state.adminSelectedGrade = Number(values.grade_level_id);
      adminGradeSelect.value = String(state.adminSelectedGrade);
      await loadAdminClassesAndStudents();
    } catch (err) {
      toast("Error", err.message || "Update blocked (RLS?)", "err");
    } finally {
      setLoading(false);
    }
  }

  if (action === "del") {
    if (!confirm(`Delete class "${row.name}"? This will also delete students & entries in it.`)) return;

    setLoading(true);
    try {
      await deleteClass(id);
      toast("Deleted", "Class deleted.", "ok");
      await loadAdminClassesAndStudents();
    } catch (err) {
      toast("Error", err.message || "Delete blocked (RLS?)", "err");
    } finally {
      setLoading(false);
    }
  }
});

/* Create student */
btnStudentCreate.addEventListener("click", async () => {
  if (state.role !== "admin") return;

  if (!state.adminSelectedClassId) {
    toast("Select class", "Please select a class first.", "warn");
    return;
  }

  const values = await openModal({
    title: "Create Student",
    submitText: "Create",
    fields: [
      {
        name: "class_id",
        label: "Class",
        type: "select",
        required: true,
        options: state.adminClasses.map(c => ({ value: c.id, label: c.name })),
      },
      { name: "full_name", label: "Full Name", type: "text", required: true, minLength: 1, placeholder: "Student name" },
      { name: "student_no", label: "Student No (optional)", type: "text", required: false, placeholder: "e.g., S12345" },
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
    toast("Success", "Student created.", "ok");
    state.adminSelectedClassId = values.class_id;
    adminClassSelect.value = values.class_id;

    state.adminStudents = await fetchStudentsByClass(state.adminSelectedClassId);
    renderStudentsTable();
  } catch (err) {
    toast("Error", err.message || "Create blocked (RLS?)", "err");
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
      title: "Edit Student",
      submitText: "Save",
      fields: [
        {
          name: "class_id",
          label: "Class",
          type: "select",
          required: true,
          options: state.adminClasses.map(c => ({ value: c.id, label: c.name })),
        },
        { name: "full_name", label: "Full Name", type: "text", required: true, minLength: 1 },
        { name: "student_no", label: "Student No (optional)", type: "text", required: false },
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
      toast("Success", "Student updated.", "ok");

      state.adminSelectedClassId = values.class_id;
      adminClassSelect.value = values.class_id;

      state.adminStudents = await fetchStudentsByClass(state.adminSelectedClassId);
      renderStudentsTable();
    } catch (err) {
      toast("Error", err.message || "Update blocked (RLS?)", "err");
    } finally {
      setLoading(false);
    }
  }

  if (action === "del") {
    if (!confirm(`Delete student "${row.full_name}"? Entries will be deleted too.`)) return;

    setLoading(true);
    try {
      await deleteStudent(id);
      toast("Deleted", "Student deleted.", "ok");
      state.adminStudents = await fetchStudentsByClass(state.adminSelectedClassId);
      renderStudentsTable();
    } catch (err) {
      toast("Error", err.message || "Delete blocked (RLS?)", "err");
    } finally {
      setLoading(false);
    }
  }
});

/* Create type */
btnTypeCreate.addEventListener("click", async () => {
  if (state.role !== "admin") return;

  const values = await openModal({
    title: "Create Co-curricular Type",
    submitText: "Create",
    fields: [
      { name: "name", label: "Type Name", type: "text", required: true, minLength: 1, placeholder: "e.g., Sports" }
    ],
    initial: { name: "" }
  });
  if (!values) return;

  setLoading(true);
  try {
    await createType({ name: values.name.trim() });
    toast("Success", "Type created.", "ok");
    state.types = await fetchTypes();
    renderTypesTable();
    populateTypeSelect(entryType);
  } catch (err) {
    toast("Error", err.message || "Create blocked (RLS?)", "err");
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

  const row = state.types.find(t => t.id === id);
  if (!row) return;

  if (action === "edit") {
    const values = await openModal({
      title: "Edit Type",
      submitText: "Save",
      fields: [
        { name: "name", label: "Type Name", type: "text", required: true, minLength: 1 }
      ],
      initial: { name: row.name }
    });
    if (!values) return;

    setLoading(true);
    try {
      await updateType(id, { name: values.name.trim() });
      toast("Success", "Type updated.", "ok");
      state.types = await fetchTypes();
      renderTypesTable();
      populateTypeSelect(entryType);
    } catch (err) {
      toast("Error", err.message || "Update blocked (RLS?)", "err");
    } finally {
      setLoading(false);
    }
  }

  if (action === "del") {
    if (!confirm(`Delete type "${row.name}"? This may fail if entries reference it.`)) return;

    setLoading(true);
    try {
      await deleteType(id);
      toast("Deleted", "Type deleted.", "ok");
      state.types = await fetchTypes();
      renderTypesTable();
      populateTypeSelect(entryType);
    } catch (err) {
      toast("Error", err.message || "Delete failed (in use?)", "err");
    } finally {
      setLoading(false);
    }
  }
});

/* Teacher grade/class changes */
teacherGradeSelect.addEventListener("change", async () => {
  state.teacherSelectedGrade = Number(teacherGradeSelect.value);
  setLoading(true);
  try {
    await loadTeacherClassesAndStudents();
  } catch (e) {
    toast("Error", e.message || "Failed loading classes.", "err");
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
    toast("Error", e.message || "Failed loading students.", "err");
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
    toast("Error", err.message || "Failed opening student.", "err");
  } finally {
    setLoading(false);
  }
});

backTeacherBtn.addEventListener("click", async () => {
  showView("teacher");
  await refreshAllTeacher();
});

/* Add entry (date boleh apa-apa) */
entryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!state.selectedStudent) return;

  const subject = entrySubject.value.trim();
  const activity_date = entryDate.value;
  const type_id = entryType.value;

  if (!subject || subject.length < 3) {
    toast("Validation", "Subject is required (min 3 chars).", "warn");
    entrySubject.focus();
    return;
  }
  if (!activity_date) {
    toast("Validation", "Activity date is required.", "warn");
    entryDate.focus();
    return;
  }
  if (!type_id) {
    toast("Validation", "Type is required.", "warn");
    entryType.focus();
    return;
  }

  setLoading(true);
  try {
    await createEntry({
      student_id: state.selectedStudent.id,
      type_id,
      subject,
      activity_date,
      created_by: state.user.id,
    });

    toast("Saved", "Entry created.", "ok");
    entrySubject.value = "";
    entryDate.valueAsDate = new Date();
    entryType.value = "";

    state.studentEntries = await fetchEntriesByStudent(state.selectedStudent.id);
    renderEntriesTable();
  } catch (err) {
    toast("Error", err.message || "Insert blocked (RLS?)", "err");
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

  const canManage = (state.role === "admin") || (row.created_by === state.user.id);
  if (!canManage) {
    toast("Unauthorized", "You can only manage entries you created (unless admin).", "warn");
    return;
  }

  if (action === "edit") {
    const values = await openModal({
      title: "Edit Entry",
      submitText: "Save",
      fields: [
        { name: "subject", label: "Subject", type: "text", required: true, minLength: 3 },
        { name: "activity_date", label: "Activity Date", type: "date", required: true },
        {
          name: "type_id",
          label: "Type",
          type: "select",
          required: true,
          options: state.types.map(t => ({ value: t.id, label: t.name })),
        },
      ],
      initial: {
        subject: row.subject,
        activity_date: row.activity_date,
        type_id: row.type_id
      }
    });

    if (!values) return;

    setLoading(true);
    try {
      await updateEntry(id, {
        subject: values.subject.trim(),
        activity_date: values.activity_date,
        type_id: values.type_id
      });
      toast("Success", "Entry updated.", "ok");
      state.studentEntries = await fetchEntriesByStudent(state.selectedStudent.id);
      renderEntriesTable();
    } catch (err) {
      toast("Error", err.message || "Update blocked (RLS?)", "err");
    } finally {
      setLoading(false);
    }
  }

  if (action === "del") {
    if (!confirm("Delete this entry?")) return;

    setLoading(true);
    try {
      await deleteEntry(id);
      toast("Deleted", "Entry deleted.", "ok");
      state.studentEntries = await fetchEntriesByStudent(state.selectedStudent.id);
      renderEntriesTable();
    } catch (err) {
      toast("Error", err.message || "Delete blocked (RLS?)", "err");
    } finally {
      setLoading(false);
    }
  }
});

/* ========= INIT ========= */
async function init() {
  if (SUPABASE_URL.includes("YOUR_") || SUPABASE_ANON_KEY.includes("YOUR_")) {
    toast("Setup needed", "Set SUPABASE_URL and SUPABASE_ANON_KEY in app.js", "warn", 6000);
  }

  setLoading(true);
  try {
    const { data } = await sb.auth.getSession();
    state.session = data.session;
    state.user = data.session?.user || null;

    if (state.user) {
      state.profile = await getProfileOrThrow();
      state.role = state.profile.role;
    }

    updateAuthUI();
    await routeAfterLogin();
  } catch (e) {
    toast("Error", e.message || "Initialization failed.", "err");
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
      } catch (e) {
        toast("Error", e.message || "Profile read failed.", "err");
        state.profile = null;
        state.role = null;
      }
    } else {
      state.profile = null;
      state.role = null;
      state.selectedStudent = null;
      state.studentEntries = [];
    }

    updateAuthUI();
    await routeAfterLogin();
  });
}

init();

