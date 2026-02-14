// Reserved for future public-page interactions.
document.querySelectorAll('a[href="#"]').forEach((link) => {
  link.addEventListener('click', (event) => event.preventDefault());
});

const DATASET_STORAGE_KEY = 'smart_portal_datasets';
const ICON_PROCESSING = '\u23F3';
const ICON_WAITING = '\ud83d\udfe1';
const ICON_APPROVED = '\u2705';
const ICON_REJECTED = '\u274C';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatUploadDateTime(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function statusWithIcon(type, reason) {
  if (type === 'approved') return 'Approved ' + ICON_APPROVED;
  if (type === 'rejected') return reason ? ('Rejected ' + ICON_REJECTED + ' - ' + reason) : ('Rejected ' + ICON_REJECTED);
  if (type === 'waiting') return 'Waiting for Admin Approval ' + ICON_WAITING;
  return 'Processing ' + ICON_PROCESSING;
}

function decodeStatusEntities(status) {
  return String(status)
    .replaceAll('&amp;#x23F3;', ICON_PROCESSING)
    .replaceAll('&#x23F3;', ICON_PROCESSING)
    .replaceAll('&amp;#x1F7E1;', ICON_WAITING)
    .replaceAll('&#x1F7E1;', ICON_WAITING)
    .replaceAll('&amp;#x2705;', ICON_APPROVED)
    .replaceAll('&#x2705;', ICON_APPROVED)
    .replaceAll('&amp;#x274C;', ICON_REJECTED)
    .replaceAll('&#x274C;', ICON_REJECTED)
    .replaceAll('??', ICON_WAITING)
    .replaceAll('?', ICON_PROCESSING);
}

function normalizeStatus(statusRaw) {
  const decoded = decodeStatusEntities(statusRaw || '').trim();
  const normalized = decoded.toLowerCase();

  if (normalized.includes('approved')) return statusWithIcon('approved');
  if (normalized.includes('rejected')) {
    const reason = decoded.includes('-') ? decoded.split('-').slice(1).join('-').trim() : '';
    return statusWithIcon('rejected', reason);
  }
  if (normalized.includes('waiting')) return statusWithIcon('waiting');
  return statusWithIcon('processing');
}

function slugify(value) {
  return String(value || 'dataset')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'dataset';
}

function makeStableDatasetId(item, index) {
  if (item && item.id) return String(item.id);

  const namePart = slugify(item && item.name);
  const timePart = String(item && (item.uploadedAt || item.uploadDate) || 'time')
    .replace(/[^0-9]/g, '')
    .slice(0, 14) || '0';

  return 'ds-' + index + '-' + namePart + '-' + timePart;
}

function setStoredDatasets(items) {
  localStorage.setItem(DATASET_STORAGE_KEY, JSON.stringify(items));
}

function getStoredDatasets() {
  try {
    const raw = localStorage.getItem(DATASET_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];

    let changed = false;
    const normalizedItems = parsed.map((item, index) => {
      const normalized = {
        id: makeStableDatasetId(item, index),
        name: item && item.name ? String(item.name) : 'Untitled Dataset',
        uploadedAt: item && (item.uploadedAt || item.uploadDate) ? String(item.uploadedAt || item.uploadDate) : new Date().toISOString(),
        status: normalizeStatus(item && item.status),
        uploadedBy: item && item.uploadedBy ? String(item.uploadedBy) : 'user.portal'
      };

      if (!item || item.id !== normalized.id || item.uploadedAt !== normalized.uploadedAt || item.status !== normalized.status || item.name !== normalized.name || item.uploadedBy !== normalized.uploadedBy) {
        changed = true;
      }

      return normalized;
    });

    if (changed) setStoredDatasets(normalizedItems);
    return normalizedItems;
  } catch (error) {
    return [];
  }
}

function getStatusTagClass(status) {
  const normalized = String(status).toLowerCase();
  if (normalized.includes('approved')) return 'tag-ok';
  if (normalized.includes('rejected')) return 'tag-danger';
  if (normalized.includes('waiting')) return 'tag-warn';
  return '';
}

function buildDetailsLink(datasetId) {
  return 'dataset-details.html?id=' + encodeURIComponent(datasetId);
}

function renderDatasetsTable() {
  const tableBody = document.getElementById('datasets-table-body');
  if (!tableBody) return;

  const items = getStoredDatasets();
  if (!items.length) {
    tableBody.innerHTML = '<tr><td colspan="4">No datasets uploaded yet.</td></tr>';
    return;
  }

  tableBody.innerHTML = items.map((item) => {
    const statusClass = getStatusTagClass(item.status);
    return '<tr>' +
      '<td>' + escapeHtml(item.name) + '</td>' +
      '<td>' + escapeHtml(formatUploadDateTime(item.uploadedAt)) + '</td>' +
      '<td><span class="tag ' + statusClass + '">' + escapeHtml(item.status) + '</span></td>' +
      '<td><a class="btn btn-ghost" href="' + buildDetailsLink(item.id) + '">View details</a></td>' +
    '</tr>';
  }).join('');
}

function renderProcessingTable() {
  const tableBody = document.getElementById('processing-table-body');
  if (!tableBody) return;

  const items = getStoredDatasets();
  if (!items.length) {
    tableBody.innerHTML = '<tr><td colspan="4">No datasets uploaded yet.</td></tr>';
    return;
  }

  tableBody.innerHTML = items.map((item) => {
    const statusClass = getStatusTagClass(item.status);
    return '<tr>' +
      '<td>' + escapeHtml(item.name) + '</td>' +
      '<td>' + escapeHtml(formatUploadDateTime(item.uploadedAt)) + '</td>' +
      '<td><span class="tag ' + statusClass + '">' + escapeHtml(item.status) + '</span></td>' +
      '<td><a class="btn btn-ghost" href="' + buildDetailsLink(item.id) + '">View details</a></td>' +
    '</tr>';
  }).join('');
}

function renderDatasetDetails() {
  const heading = document.getElementById('details-name');
  if (!heading) return;

  const params = new URLSearchParams(window.location.search);
  const datasetId = params.get('id');
  const items = getStoredDatasets();
  const item = items.find((entry) => entry.id === datasetId);

  const rowName = document.getElementById('details-name-row');
  const rowTime = document.getElementById('details-time');
  const rowStatus = document.getElementById('details-status');

  if (!item) {
    heading.textContent = 'Dataset Not Found';
    if (rowName) rowName.textContent = 'Dataset not found for this link.';
    if (rowTime) rowTime.textContent = '-';
    if (rowStatus) rowStatus.textContent = 'Unavailable';
    return;
  }

  heading.textContent = item.name;
  if (rowName) rowName.textContent = item.name;
  if (rowTime) rowTime.textContent = formatUploadDateTime(item.uploadedAt);
  if (rowStatus) rowStatus.textContent = item.status;

  const downloadBtn = document.getElementById('details-download');
  if (downloadBtn && String(item.status).toLowerCase().includes('approved')) {
    downloadBtn.classList.remove('hidden');
  }
}

function renderApprovalsTable() {
  const tableBody = document.getElementById('dataset-approvals-body');
  if (!tableBody) return;

  const items = getStoredDatasets();
  const pending = items.filter((item) => {
    const s = item.status.toLowerCase();
    return s.includes('processing') || s.includes('waiting');
  });

  if (!pending.length) {
    tableBody.innerHTML = '<tr><td colspan="6">No datasets waiting for approval.</td></tr>';
    return;
  }

  tableBody.innerHTML = pending.map((item) => {
    return '<tr data-dataset-id="' + escapeHtml(item.id) + '">' +
      '<td>' + escapeHtml(item.name) + '</td>' +
      '<td>' + escapeHtml(item.uploadedBy || 'user.portal') + '</td>' +
      '<td><a class="btn btn-ghost" href="' + buildDetailsLink(item.id) + '">View report</a></td>' +
      '<td><a class="btn btn-ghost" href="upload-dataset.html">Download</a></td>' +
      '<td><a class="btn btn-ghost" href="cleaned-course-registration.csv" download>Download</a></td>' +
      '<td><div class="approval-actions">' +
        '<button class="btn btn-solid" type="button" data-approve="' + escapeHtml(item.id) + '">Approve ' + ICON_APPROVED + '</button>' +
        '<input type="text" placeholder="Reject reason" aria-label="Reject reason" data-reason="' + escapeHtml(item.id) + '" />' +
        '<button class="btn btn-ghost" type="button" data-reject="' + escapeHtml(item.id) + '">Reject ' + ICON_REJECTED + '</button>' +
      '</div></td>' +
    '</tr>';
  }).join('');
}

function updateDatasetStatus(datasetId, nextStatus) {
  const items = getStoredDatasets();
  const index = items.findIndex((item) => item.id === datasetId);
  if (index === -1) return;

  items[index] = { ...items[index], status: nextStatus };
  setStoredDatasets(items);
}

function wireApprovalActions() {
  const tableBody = document.getElementById('dataset-approvals-body');
  if (!tableBody) return;

  tableBody.addEventListener('click', (event) => {
    const approveBtn = event.target.closest('[data-approve]');
    const rejectBtn = event.target.closest('[data-reject]');

    if (approveBtn) {
      const id = approveBtn.getAttribute('data-approve');
      updateDatasetStatus(id, statusWithIcon('approved'));
      renderApprovalsTable();
      return;
    }

    if (rejectBtn) {
      const id = rejectBtn.getAttribute('data-reject');
      const input = tableBody.querySelector('[data-reason="' + CSS.escape(id) + '"]');
      const reason = input ? input.value.trim() : '';

      if (!reason) {
        alert('Please enter a reject reason.');
        if (input) input.focus();
        return;
      }

      updateDatasetStatus(id, statusWithIcon('rejected', reason));
      renderApprovalsTable();
    }
  });
}

function seedInitialDatasetsIfEmpty() {
  const items = getStoredDatasets();
  if (items.length) return;

  const now = Date.now();
  const seed = [
    {
      id: 'seed-1',
      name: 'semester5_attendance.csv',
      uploadedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      status: statusWithIcon('processing'),
      uploadedBy: 'anika.s'
    },
    {
      id: 'seed-2',
      name: 'exam_results_batch2.xlsx',
      uploadedAt: new Date(now - 26 * 60 * 60 * 1000).toISOString(),
      status: statusWithIcon('waiting'),
      uploadedBy: 'dean.office'
    },
    {
      id: 'seed-3',
      name: 'course_registration_jan.csv',
      uploadedAt: new Date(now - 52 * 60 * 60 * 1000).toISOString(),
      status: statusWithIcon('approved'),
      uploadedBy: 'registrar.team'
    },
    {
      id: 'seed-4',
      name: 'student_profile_dump.xlsx',
      uploadedAt: new Date(now - 75 * 60 * 60 * 1000).toISOString(),
      status: statusWithIcon('rejected', 'Invalid headers'),
      uploadedBy: 'staff.user'
    }
  ];

  setStoredDatasets(seed);
}

document.querySelectorAll('[data-login-form]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const emailField = form.querySelector('input[name="email"]');
    const email = emailField ? emailField.value.trim().toLowerCase() : '';

    const isAdmin = email.includes('admin');
    const destination = isAdmin ? 'admin-portal.html' : 'user-portal.html';
    window.location.href = destination;
  });
});

document.querySelectorAll('[data-register-form]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const passwordField = form.querySelector('input[name="password"]');
    const confirmField = form.querySelector('input[name="confirm-password"]');

    if (!passwordField || !confirmField) {
      window.location.href = 'signin.html';
      return;
    }

    if (passwordField.value !== confirmField.value) {
      confirmField.setCustomValidity('Passwords do not match.');
      confirmField.reportValidity();
      return;
    }

    confirmField.setCustomValidity('');
    window.location.href = 'signin.html';
  });

  const confirmField = form.querySelector('input[name="confirm-password"]');
  if (confirmField) {
    confirmField.addEventListener('input', () => {
      confirmField.setCustomValidity('');
    });
  }
});

document.querySelectorAll('[data-upload-form]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const title = form.querySelector('input[name="dataset-title"]');
    const fileInput = form.querySelector('input[name="dataset-file"]');
    const fileName = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0].name : '';
    const datasetName = title && title.value.trim() ? title.value.trim() : (fileName || 'Untitled Dataset');

    const nowIso = new Date().toISOString();
    const existing = getStoredDatasets();
    existing.unshift({
      id: 'ds-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      name: datasetName,
      uploadedAt: nowIso,
      status: statusWithIcon('processing'),
      uploadedBy: 'user.portal'
    });
    setStoredDatasets(existing);

    window.location.href = 'processing.html';
  });
});

seedInitialDatasetsIfEmpty();
renderDatasetsTable();
renderProcessingTable();
renderDatasetDetails();
renderApprovalsTable();
wireApprovalActions();
