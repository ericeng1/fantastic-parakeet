import { supabase } from "./supabaseClient.js";

// -------- AUTH GATE --------
const { data: { session } } = await supabase.auth.getSession();
if (!session) { window.location.href = "login.html"; }
const currentUser = session.user;

const userBar   = document.getElementById("user-bar");
const userEmail = document.getElementById("user-email");
if (userBar)   userBar.style.display = "flex";
if (userEmail) userEmail.textContent = currentUser.email || "Signed in";

document.getElementById("signout-btn")?.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "login.html";
});

// -------- DROPDOWNS --------
const makerSelect    = document.getElementById("maker");
const categorySelect = document.getElementById("category");
const materialSelect = document.getElementById("material");
const addCategoryBtn = document.getElementById("add-category-btn");
const addMaterialBtn = document.getElementById("add-material-btn");
const form           = document.getElementById("itemForm");
const status         = document.getElementById("status");

function createOption(value, text) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = text;
  return option;
}

async function loadDropdown(table, selectElement, displayFunc) {
  const { data, error } = await supabase.from(table).select("*").order("id");
  if (error) { console.error(`Error loading ${table}:`, error); return; }
  selectElement.innerHTML = "";
  selectElement.appendChild(createOption("", `-- Select ${table.slice(0, -1)} --`));
  data.forEach(row => selectElement.appendChild(createOption(row.id, displayFunc(row))));
}

async function init() {
  await loadDropdown("brands",     makerSelect,    row => `${row.company || ""} ${row.first_name || ""} ${row.last_name || ""}`.trim());
  await loadDropdown("categories", categorySelect, row => row.name);
  await loadDropdown("materials",  materialSelect, row => row.name);
}

init();

// -------- ADD NEW CATEGORY / MATERIAL --------
async function addNewEntry(table, selectElement, displayFunc) {
  const name = prompt(`Enter new ${table.slice(0, -1)} name:`)?.trim();
  if (!name) return;
  const { error } = await supabase.from(table).insert([{ name }]);
  if (error) return alert("Error: " + error.message);
  await loadDropdown(table, selectElement, displayFunc);
  const options = Array.from(selectElement.options);
  options[options.length - 1].selected = true;
}

addCategoryBtn.addEventListener("click", () => addNewEntry("categories", categorySelect, row => row.name));
addMaterialBtn.addEventListener("click", () => addNewEntry("materials",  materialSelect, row => row.name));

// -------- MULTI-IMAGE PREVIEW --------
// Tracks the File objects the user has selected, capped at 10
let selectedFiles = [];
const MAX_PHOTOS  = 10;

const imageInput  = document.getElementById("images");
const previewStrip = document.getElementById("preview-strip");

imageInput.addEventListener("change", () => {
  const incoming = Array.from(imageInput.files);

  // Merge with already-selected files, dedupe by name+size, cap at MAX_PHOTOS
  const merged = [...selectedFiles];
  for (const file of incoming) {
    if (merged.length >= MAX_PHOTOS) break;
    const isDupe = merged.some(f => f.name === file.name && f.size === file.size);
    if (!isDupe) merged.push(file);
  }
  selectedFiles = merged;

  // Reset input so the same file can be re-selected if removed
  imageInput.value = "";

  renderPreviews();
});

function renderPreviews() {
  previewStrip.innerHTML = "";

  selectedFiles.forEach((file, idx) => {
    const wrapper = document.createElement("div");
    wrapper.className = "preview-strip-item";

    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    img.alt = file.name;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-btn";
    removeBtn.textContent = "✕";
    removeBtn.title = "Remove photo";
    removeBtn.addEventListener("click", () => {
      selectedFiles.splice(idx, 1);
      renderPreviews();
    });

    wrapper.appendChild(img);
    wrapper.appendChild(removeBtn);
    previewStrip.appendChild(wrapper);
  });

  // Show count if any files selected
  if (selectedFiles.length > 0) {
    const count = document.createElement("p");
    count.className = "preview-count";
    count.textContent = `${selectedFiles.length} / ${MAX_PHOTOS} photo${selectedFiles.length !== 1 ? "s" : ""} selected`;
    previewStrip.appendChild(count);
  }
}

// -------- UPLOAD IMAGE TO SUPABASE STORAGE --------
const BUCKET = "item-images";

async function uploadImage(file) {
  if (!file) return null;
  const filename = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name.replace(/\s+/g, "_")}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, file, { cacheControl: "3600", upsert: false });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

// -------- FORM SUBMIT --------
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const submitBtn = form.querySelector(".submit-btn");
  submitBtn.disabled = true;

  const filesToUpload = selectedFiles.slice(0, MAX_PHOTOS);

  if (filesToUpload.length > 0) {
    status.textContent = `Uploading ${filesToUpload.length} photo${filesToUpload.length !== 1 ? "s" : ""}…`;
    status.style.color = "#2d6cdf";
  } else {
    status.textContent = "Saving item…";
    status.style.color = "#2d6cdf";
  }

  try {
    // Upload all selected files in parallel
    const urls = await Promise.all(filesToUpload.map(f => uploadImage(f)));

    status.textContent = "Saving item…";

    // Map urls into image_url1 … image_url10
    const imageFields = {};
    for (let i = 0; i < MAX_PHOTOS; i++) {
      imageFields[`image_url${i + 1}`] = urls[i] ?? null;
    }

    const item = {
      user_id:      currentUser.id,
      is_private:   document.getElementById("is_private").checked,
      maker_id:     makerSelect.value || null,
      category_id:  categorySelect.value || null,
      material_id:  materialSelect.value || null,
      born_on_date: document.getElementById("born_on_date").value || null,
      msrp:         document.getElementById("msrp").value || null,
      size:         document.getElementById("size").value || null,
      variant:      document.getElementById("variant").value,
      extra:        document.getElementById("extra").value,
      comments:     document.getElementById("comments").value,
      ...imageFields,
    };

    const { error } = await supabase.from("items").insert([item]);

    if (error) {
      status.textContent = "Error saving item: " + error.message;
      status.style.color = "red";
    } else {
      status.textContent = "Item saved!";
      status.style.color = "green";
      form.reset();
      selectedFiles = [];
      renderPreviews();
    }
  } catch (err) {
    status.textContent = err.message;
    status.style.color = "red";
  } finally {
    submitBtn.disabled = false;
  }
});
