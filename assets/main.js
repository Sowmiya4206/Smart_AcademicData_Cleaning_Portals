document.querySelectorAll('a[href="#"]').forEach((link) => {
  link.addEventListener('click', (event) => event.preventDefault());
});

const DATASET_STORAGE_KEY = 'smart_portal_datasets';
const CURRENT_USER_STORAGE_KEY = 'smart_portal_current_user';
const API_BASE = window.location.protocol === 'http:' || window.location.protocol === 'https:'
  ? window.location.origin + '/api'
  : 'http://localhost:3000/api';
const PRIMARY_ADMIN_EMAIL = 'admin@smartdataportal.edu';

const ICON_PROCESSING = '\u23F3';
const ICON_WAITING = '\u{1F7E1}';
const ICON_APPROVED = '\u2705';
const ICON_REJECTED = '\u274C';

const FALLBACK_USERS = [
  {
    id: 'user-admin-1',
    name: 'Admin User',
    email: 'admin@smartdataportal.edu',
    institution: 'Smart Data Portal',
    role: 'admin',
    status: 'active',
    createdAt: '2026-04-08T18:00:00.000Z'
  },
  {
    id: 'user-demo-1',
    name: 'Alex Carter',
    email: 'alex.carter@university.edu',
    institution: 'Example University',
    role: 'staff',
    status: 'active',
    createdAt: '2026-04-08T18:05:00.000Z'
  },
  {
    id: 'user-demo-2',
    name: 'Ravi Menon',
    email: 'ravi.menon@campus.edu',
    institution: 'City College',
    role: 'student',
    status: 'blocked',
    createdAt: '2026-04-08T18:10:00.000Z'
  },
  {
    id: 'user-demo-3',
    name: 'Nina Roy',
    email: 'nina.roy@institute.edu',
    institution: 'State Institute of Tech',
    role: 'staff',
    status: 'active',
    createdAt: '2026-04-08T18:12:00.000Z'
  }
];

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
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

function formatRelativeTime(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Unknown time';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return diffMinutes + ' min ago';

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return diffHours + ' hr ago';

  const diffDays = Math.round(diffHours / 24);
  return diffDays + ' day' + (diffDays === 1 ? '' : 's') + ' ago';
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

function normalizeDatasetRecord(item, index) {
  return {
    id: makeStableDatasetId(item, index),
    name: item && item.name ? String(item.name) : 'Untitled Dataset',
    uploadedAt: item && (item.uploadedAt || item.uploadDate) ? String(item.uploadedAt || item.uploadDate) : new Date().toISOString(),
    status: normalizeStatus(item && item.status),
    uploadedBy: item && item.uploadedBy ? String(item.uploadedBy) : 'user.portal',
    description: item && item.description ? String(item.description) : '',
    fileName: item && item.fileName ? String(item.fileName) : '',
    cleaningOptions: Array.isArray(item && item.cleaningOptions) ? item.cleaningOptions.map(String) : [],
    verifiedAt: item && item.verifiedAt ? String(item.verifiedAt) : '',
    verifiedBy: item && item.verifiedBy ? String(item.verifiedBy) : '',
    verifiedByName: item && item.verifiedByName ? String(item.verifiedByName) : '',
    decisionReason: item && item.decisionReason ? String(item.decisionReason) : '',
    autoApproveRequested: Boolean(item && item.autoApproveRequested)
  };
}

function normalizeUserRecord(user, index) {
  return {
    id: user && user.id ? String(user.id) : 'user-' + index,
    name: user && user.name ? String(user.name) : 'Unnamed User',
    email: user && user.email ? String(user.email).toLowerCase() : '',
    institution: user && user.institution ? String(user.institution) : 'Unknown Institution',
    role: normalizeRoleValue(user && user.role ? String(user.role) : 'staff'),
    status: user && user.status ? String(user.status).toLowerCase() : 'active',
    createdAt: user && user.createdAt ? String(user.createdAt) : new Date().toISOString(),
    updatedAt: user && user.updatedAt ? String(user.updatedAt) : ''
  };
}

function titleCase(value) {
  return String(value || '')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeRoleValue(role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'admin') return 'admin';
  if (normalized === 'student') return 'student';
  return 'staff';
}

function canAccessAdminDashboard(role) {
  const normalized = normalizeRoleValue(role);
  return normalized === 'admin';
}

function isPrimaryAdminEmail(email) {
  return String(email || '').trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
}

function isAuthorizedAdminUser(user) {
  return Boolean(
    user &&
    canAccessAdminDashboard(user.role) &&
    isPrimaryAdminEmail(user.email) &&
    String(user.status || 'active').toLowerCase() === 'active'
  );
}

function isStudentUser(user) {
  return Boolean(
    user &&
    normalizeRoleValue(user.role) === 'student' &&
    String(user.status || 'active').toLowerCase() === 'active'
  );
}

function isStaffReviewer(user) {
  return Boolean(
    user &&
    normalizeRoleValue(user.role) === 'staff' &&
    String(user.status || 'active').toLowerCase() === 'active'
  );
}

function getDashboardPathForRole(role) {
  return canAccessAdminDashboard(role) ? 'admin-portal.html' : 'user-portal.html';
}

function enforceRoleAccess() {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const currentUser = getCurrentUser();
  const adminOnlyPages = ['admin-portal.html', 'manage-users.html', 'reports-logs.html'];
  const userOnlyPages = ['user-portal.html'];
  const studentOnlyPages = ['upload-dataset.html'];

  if (currentPage === 'dataset-approvals.html') {
    window.location.href = currentUser ? 'user-portal.html' : 'signin.html';
    return false;
  }

  if (!currentUser) {
    if (adminOnlyPages.includes(currentPage) || userOnlyPages.includes(currentPage) || studentOnlyPages.includes(currentPage)) {
      window.location.href = adminOnlyPages.includes(currentPage) ? 'signin.html?mode=admin' : 'signin.html';
      return false;
    }
    return true;
  }

  if (adminOnlyPages.includes(currentPage) && !isAuthorizedAdminUser(currentUser)) {
    window.location.href = 'signin.html?mode=admin';
    return false;
  }

  if (userOnlyPages.includes(currentPage) && isAuthorizedAdminUser(currentUser)) {
    window.location.href = getDashboardPathForRole(currentUser.role);
    return false;
  }

  if (studentOnlyPages.includes(currentPage) && !isStudentUser(currentUser)) {
    window.location.href = 'user-portal.html';
    return false;
  }

  return true;
}

function setStoredDatasets(items) {
  localStorage.setItem(DATASET_STORAGE_KEY, JSON.stringify(items.map(normalizeDatasetRecord)));
}

function getStoredDatasets() {
  try {
    const raw = localStorage.getItem(DATASET_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];

    const normalizedItems = parsed.map(normalizeDatasetRecord);
    if (JSON.stringify(parsed) !== JSON.stringify(normalizedItems)) {
      setStoredDatasets(normalizedItems);
    }

    return normalizedItems;
  } catch (error) {
    return [];
  }
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    return raw ? normalizeUserRecord(JSON.parse(raw)) : null;
  } catch (error) {
    return null;
  }
}

function setCurrentUser(user) {
  if (!user) {
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    return;
  }

  localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(normalizeUserRecord(user)));
}

async function apiRequest(path, options = {}) {
  const requestInit = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  };

  if (options.body !== undefined) {
    requestInit.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(API_BASE + path, requestInit);
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(payload.error || 'Request failed.');
      error.networkError = false;
      throw error;
    }

    return payload;
  } catch (error) {
    if (error.networkError === false) throw error;
    const networkError = new Error('Backend unavailable.');
    networkError.networkError = true;
    throw networkError;
  }
}

async function syncDatasetsFromServer() {
  const payload = await apiRequest('/datasets');
  const datasets = Array.isArray(payload.datasets) ? payload.datasets.map(normalizeDatasetRecord) : [];
  if (datasets.length || getStoredDatasets().length) setStoredDatasets(datasets);
  return datasets;
}

async function syncAppStateFromServer() {
  const payload = await apiRequest('/bootstrap');
  const datasets = Array.isArray(payload.datasets) ? payload.datasets.map(normalizeDatasetRecord) : [];
  if (datasets.length || getStoredDatasets().length) {
    setStoredDatasets(datasets);
  }
  return payload;
}

async function fetchUsersFromServer() {
  const payload = await apiRequest('/users');
  return Array.isArray(payload.users) ? payload.users.map(normalizeUserRecord) : [];
}

async function updateUserRemote(userId, updates) {
  const payload = await apiRequest('/users/' + encodeURIComponent(userId), {
    method: 'PATCH',
    body: updates
  });
  return payload.user ? normalizeUserRecord(payload.user) : null;
}

async function deleteUserRemote(userId) {
  await apiRequest('/users/' + encodeURIComponent(userId), {
    method: 'DELETE'
  });
}

async function fetchReportsFromServer() {
  const payload = await apiRequest('/reports');
  return payload.reports || null;
}

async function createDatasetRemote(datasetInput) {
  const payload = await apiRequest('/datasets', {
    method: 'POST',
    body: datasetInput
  });

  if (Array.isArray(payload.datasets)) {
    setStoredDatasets(payload.datasets.map(normalizeDatasetRecord));
  } else if (payload.dataset) {
    const items = [normalizeDatasetRecord(payload.dataset), ...getStoredDatasets()];
    setStoredDatasets(items);
  }
}

async function updateDatasetStatusRemote(datasetId, nextStatus, reason = '') {
  const currentUser = getCurrentUser();
  const payload = await apiRequest('/datasets/' + encodeURIComponent(datasetId) + '/status', {
    method: 'PATCH',
    body: {
      status: nextStatus,
      reason,
      verifier: currentUser ? {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role
      } : null
    }
  });

  if (Array.isArray(payload.datasets)) {
    setStoredDatasets(payload.datasets.map(normalizeDatasetRecord));
  }
}

function getStatusTagClass(status) {
  const normalized = String(status).toLowerCase();
  if (normalized.includes('approved') || normalized === 'active') return 'tag-ok';
  if (normalized.includes('rejected') || normalized === 'blocked') return 'tag-danger';
  if (normalized.includes('waiting')) return 'tag-warn';
  return '';
}

function buildDetailsLink(datasetId) {
  return 'dataset-details.html?id=' + encodeURIComponent(datasetId);
}

function buildCleanedFileName(item) {
  const baseName = String(item && (item.fileName || item.name) || 'cleaned-dataset.csv')
    .replace(/\.[^.]+$/, '')
    .trim() || 'cleaned-dataset';
  return baseName + '-cleaned.csv';
}

function buildDownloadLink(item) {
  return '<a class="btn btn-solid" href="cleaned-course-registration.csv" download="' + escapeHtml(buildCleanedFileName(item)) + '">Download Cleaned File</a>';
}

function resolveCurrentUploader() {
  const currentUser = getCurrentUser();
  if (!currentUser) return 'user.portal';
  return currentUser.email || currentUser.name || 'user.portal';
}

function datasetsForCurrentUser(items) {
  const currentUser = getCurrentUser();
  if (!currentUser) return items;

  const identities = [currentUser.email, currentUser.name]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return items.filter((item) => identities.includes(String(item.uploadedBy || '').toLowerCase()));
}

function pendingDatasetsForStaff(items) {
  return items.filter((item) => {
    const status = String(item.status || '').toLowerCase();
    return status.includes('processing') || status.includes('waiting');
  });
}

function renderDatasetsTable() {
  const tableBody = document.getElementById('datasets-table-body');
  if (!tableBody) return;

  const items = datasetsForCurrentUser(getStoredDatasets());
  if (!items.length) {
    tableBody.innerHTML = '<tr><td colspan="5">No datasets uploaded yet.</td></tr>';
    return;
  }

  tableBody.innerHTML = items.map((item) => {
    const statusClass = getStatusTagClass(item.status);
    let decisionSource = 'Pending review';
    if (String(item.verifiedBy || '').toLowerCase() === 'system') decisionSource = 'System';
    else if (item.verifiedByName || item.verifiedBy) decisionSource = 'Staff';
    const actionCell = String(item.status).toLowerCase().includes('approved')
      ? buildDownloadLink(item)
      : '<a class="btn btn-ghost" href="' + buildDetailsLink(item.id) + '">View details</a>';
    return '<tr>' +
      '<td>' + escapeHtml(item.name) + '</td>' +
      '<td>' + escapeHtml(formatUploadDateTime(item.uploadedAt)) + '</td>' +
      '<td><span class="tag ' + statusClass + '">' + escapeHtml(item.status) + '</span></td>' +
      '<td>' + escapeHtml(decisionSource) + '</td>' +
      '<td>' + actionCell + '</td>' +
      '</tr>';
  }).join('');
}

function renderProcessingTable() {
  const tableBody = document.getElementById('processing-table-body');
  if (!tableBody) return;

  const items = datasetsForCurrentUser(getStoredDatasets());
  if (!items.length) {
    tableBody.innerHTML = '<tr><td colspan="4">No datasets uploaded yet.</td></tr>';
    return;
  }

  tableBody.innerHTML = items.map((item) => {
    const statusClass = getStatusTagClass(item.status);
    const actionCell = String(item.status).toLowerCase().includes('approved')
      ? buildDownloadLink(item)
      : '<a class="btn btn-ghost" href="' + buildDetailsLink(item.id) + '">View details</a>';
    return '<tr>' +
      '<td>' + escapeHtml(item.name) + '</td>' +
      '<td>' + escapeHtml(formatUploadDateTime(item.uploadedAt)) + '</td>' +
      '<td><span class="tag ' + statusClass + '">' + escapeHtml(item.status) + '</span></td>' +
      '<td>' + actionCell + '</td>' +
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
  const rowDecision = document.getElementById('details-decision');
  const rowReason = document.getElementById('details-reason');

  if (!item) {
    heading.textContent = 'Dataset Not Found';
    if (rowName) rowName.textContent = 'Dataset not found for this link.';
    if (rowTime) rowTime.textContent = '-';
    if (rowStatus) rowStatus.textContent = 'Unavailable';
    if (rowDecision) rowDecision.textContent = '-';
    if (rowReason) rowReason.textContent = '-';
    return;
  }

  heading.textContent = item.name;
  if (rowName) rowName.textContent = item.name;
  if (rowTime) rowTime.textContent = formatUploadDateTime(item.uploadedAt);
  if (rowStatus) rowStatus.textContent = item.status;
  if (rowDecision) {
    const normalizedStatus = String(item.status || '').toLowerCase();
    if (String(item.verifiedBy || '').toLowerCase() === 'system') {
      rowDecision.textContent = 'Approved by System';
    } else if (item.verifiedByName || item.verifiedBy) {
      rowDecision.textContent = (normalizedStatus.includes('rejected') ? 'Reviewed by Staff: ' : 'Approved by Staff: ') + (item.verifiedByName || item.verifiedBy);
    } else {
      rowDecision.textContent = 'Pending review';
    }
  }
  if (rowReason) {
    rowReason.textContent = item.decisionReason || (item.autoApproveRequested ? 'Auto-approval requested.' : '-');
  }

  const downloadBtn = document.getElementById('details-download');
  if (downloadBtn) {
    if (String(item.status).toLowerCase().includes('approved')) {
      downloadBtn.classList.remove('hidden');
      downloadBtn.setAttribute('href', 'cleaned-course-registration.csv');
      downloadBtn.setAttribute('download', buildCleanedFileName(item));
    } else {
      downloadBtn.classList.add('hidden');
      downloadBtn.removeAttribute('download');
    }
  }
}

function renderApprovalsTable() {
  const tableBody = document.getElementById('dataset-approvals-body');
  if (!tableBody) return;

  const pending = pendingDatasetsForStaff(getStoredDatasets());

  if (!pending.length) {
    tableBody.innerHTML = '<tr><td colspan="6">No student datasets are waiting for staff review.</td></tr>';
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

function renderStaffPortalQueue() {
  const tableBody = document.getElementById('staff-review-body');
  if (!tableBody) return;

  const pending = pendingDatasetsForStaff(getStoredDatasets());
  if (!pending.length) {
    tableBody.innerHTML = '<tr><td colspan="5">No student datasets are waiting for staff review.</td></tr>';
    return;
  }

  tableBody.innerHTML = pending.map((item) => {
    return '<tr data-dataset-id="' + escapeHtml(item.id) + '">' +
      '<td>' + escapeHtml(item.name) + '</td>' +
      '<td>' + escapeHtml(item.uploadedBy || 'student.portal') + '</td>' +
      '<td>' + escapeHtml(formatUploadDateTime(item.uploadedAt)) + '</td>' +
      '<td><a class="btn btn-ghost" href="' + buildDetailsLink(item.id) + '">Open details</a></td>' +
      '<td><div class="approval-actions">' +
      '<button class="btn btn-solid" type="button" data-approve="' + escapeHtml(item.id) + '">Approve ' + ICON_APPROVED + '</button>' +
      '<input type="text" placeholder="Reject reason" aria-label="Reject reason" data-reason="' + escapeHtml(item.id) + '" />' +
      '<button class="btn btn-ghost" type="button" data-reject="' + escapeHtml(item.id) + '">Reject ' + ICON_REJECTED + '</button>' +
      '</div></td>' +
      '</tr>';
  }).join('');
}

function updateDatasetStatusLocal(datasetId, nextStatus) {
  const items = getStoredDatasets();
  const index = items.findIndex((item) => item.id === datasetId);
  if (index === -1) return;

  items[index] = { ...items[index], status: nextStatus };
  setStoredDatasets(items);
}

function renderAdminDashboard() {
  const totalNode = document.getElementById('admin-total-datasets');
  if (!totalNode) return;

  const items = getStoredDatasets().slice().sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  const pending = items.filter((item) => {
    const status = item.status.toLowerCase();
    return status.includes('processing') || status.includes('waiting');
  });
  const approved = items.filter((item) => item.status.toLowerCase().includes('approved'));
  const rejected = items.filter((item) => item.status.toLowerCase().includes('rejected'));
  const reviewedCount = approved.length + rejected.length;
  const approvalRate = reviewedCount ? Math.round((approved.length / reviewedCount) * 100) : 0;

  totalNode.textContent = String(items.length);
  document.getElementById('admin-pending-count').textContent = String(pending.length);
  document.getElementById('admin-approved-count').textContent = String(approved.length);
  document.getElementById('admin-rejected-count').textContent = String(rejected.length);
  document.getElementById('admin-approval-rate').textContent = approvalRate + '%';

  const queuePressure = pending.length >= 5 ? 'High' : pending.length >= 2 ? 'Medium' : 'Low';
  const queueSummary = pending.length
    ? pending.length + ' dataset' + (pending.length === 1 ? ' is' : 's are') + ' waiting for review.'
    : 'No datasets are waiting for review right now.';
  document.getElementById('admin-queue-pressure').textContent = queuePressure;
  document.getElementById('admin-queue-summary').textContent = queueSummary;

  const latestUpload = items[0];
  if (latestUpload) {
    document.getElementById('admin-latest-upload').textContent = latestUpload.name;
    document.getElementById('admin-latest-upload-meta').textContent = 'Submitted by ' + latestUpload.uploadedBy + ' - ' + formatRelativeTime(latestUpload.uploadedAt);
  }

  const syncNode = document.getElementById('admin-last-sync');
  if (syncNode) {
    syncNode.textContent = 'Synced ' + formatRelativeTime(new Date().toISOString());
  }

  const queueBody = document.getElementById('admin-review-queue');
  if (queueBody) {
    if (!pending.length) {
      queueBody.innerHTML = '<tr><td colspan="3">No datasets waiting for review.</td></tr>';
    } else {
      queueBody.innerHTML = pending.slice(0, 5).map((item) => {
        const statusClass = getStatusTagClass(item.status);
        return '<tr>' +
          '<td><a href="' + buildDetailsLink(item.id) + '">' + escapeHtml(item.name) + '</a></td>' +
          '<td>' + escapeHtml(item.uploadedBy) + '</td>' +
          '<td><span class="tag ' + statusClass + '">' + escapeHtml(item.status) + '</span></td>' +
          '</tr>';
      }).join('');
    }
  }

  const activityFeed = document.getElementById('admin-activity-feed');
  if (activityFeed) {
    if (!items.length) {
      activityFeed.innerHTML = '<li>No recent activity available.</li>';
    } else {
      activityFeed.innerHTML = items.slice(0, 4).map((item) => {
        const normalizedStatus = item.status.toLowerCase();
        let title = 'Dataset uploaded';

        if (normalizedStatus.includes('approved')) title = 'Dataset approved';
        if (normalizedStatus.includes('rejected')) title = 'Dataset rejected';
        if (normalizedStatus.includes('waiting')) title = 'Awaiting admin decision';

        return '<li>' +
          '<strong>' + escapeHtml(title) + '</strong>' +
          '<span>' + escapeHtml(item.name) + ' - ' + escapeHtml(item.uploadedBy) + ' - ' + escapeHtml(formatRelativeTime(item.uploadedAt)) + '</span>' +
          '</li>';
      }).join('');
    }
  }

  const healthHeadline = document.getElementById('admin-health-headline');
  const healthCopy = document.getElementById('admin-health-copy');
  const nextAction = document.getElementById('admin-next-action');
  const nextActionCopy = document.getElementById('admin-next-action-copy');

  if (healthHeadline && healthCopy && nextAction && nextActionCopy) {
    if (pending.length >= 5) {
      healthHeadline.textContent = 'Review queue needs attention';
      healthCopy.textContent = 'Approval workload is climbing and may delay turnaround times.';
      nextAction.textContent = 'Triage the oldest pending datasets';
      nextActionCopy.textContent = 'Start with submissions that have been waiting the longest to prevent a backlog.';
    } else if (rejected.length > approved.length && reviewedCount >= 2) {
      healthHeadline.textContent = 'Data quality risk is elevated';
      healthCopy.textContent = 'Rejected datasets now exceed approvals, which may indicate upload or formatting issues.';
      nextAction.textContent = 'Inspect repeated rejection reasons';
      nextActionCopy.textContent = 'Use reports to identify whether a template or import source is causing failures.';
    } else {
      healthHeadline.textContent = 'Review queue is stable';
      healthCopy.textContent = 'Current review load looks healthy and the portal is operating within normal flow.';
      nextAction.textContent = pending.length ? 'Review pending submissions' : 'Monitor new uploads';
      nextActionCopy.textContent = pending.length
        ? 'Open the approval workspace to process new datasets.'
        : 'There is no backlog right now, so the next step is watching for new submissions.';
    }
  }
}

function seedInitialDatasetsIfEmpty() {
  if (getStoredDatasets().length) return;

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

function computeReportsFromLocal(users, datasets) {
  const uploadsByInstitutionMap = {};
  const userInstitutionMap = {};

  users.forEach((user) => {
    userInstitutionMap[String(user.email).toLowerCase()] = user.institution;
  });

  datasets.forEach((dataset) => {
    const uploader = String(dataset.uploadedBy || '').toLowerCase();
    const institution = userInstitutionMap[uploader] || 'Unknown Institution';
    uploadsByInstitutionMap[institution] = (uploadsByInstitutionMap[institution] || 0) + 1;
  });

  const uploadsByInstitution = Object.entries(uploadsByInstitutionMap)
    .sort((a, b) => b[1] - a[1])
    .map(([institution, uploads]) => ({ institution, uploads }));

  const commonIssues = [
    { issueType: 'Missing values', count: datasets.length * 2 + datasets.filter((item) => item.status.toLowerCase().includes('rejected')).length * 3 },
    { issueType: 'Duplicate records', count: datasets.length + datasets.filter((item) => item.status.toLowerCase().includes('waiting')).length * 2 },
    { issueType: 'Invalid date formats', count: Math.max(1, datasets.filter((item) => item.status.toLowerCase().includes('processing')).length) },
    { issueType: 'Inconsistent IDs', count: Math.max(1, Math.floor(datasets.length / 2)) }
  ].sort((a, b) => b.count - a.count);

  return {
    summary: {
      totalUploads: datasets.length,
      activeInstitutions: uploadsByInstitution.length,
      totalIssues: commonIssues.reduce((sum, item) => sum + item.count, 0),
      adminActions: datasets.filter((item) => {
        const status = item.status.toLowerCase();
        return status.includes('approved') || status.includes('rejected');
      }).length
    },
    uploadsByInstitution,
    commonIssues,
    recentLogs: datasets.slice().sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()).slice(0, 6).map((dataset) => ({
      at: dataset.uploadedAt,
      message: dataset.status.toLowerCase().includes('approved')
        ? 'Admin action: Approved dataset ' + dataset.name
        : dataset.status.toLowerCase().includes('rejected')
          ? 'Admin action: Rejected dataset ' + dataset.name
          : dataset.status.toLowerCase().includes('waiting')
            ? 'Cleaning completed: waiting for admin approval for ' + dataset.name
            : 'Upload accepted: ' + dataset.name
    }))
  };
}

function renderManageUsers(users) {
  const body = document.getElementById('users-table-body');
  if (!body) return;

  const normalizedUsers = users.map(normalizeUserRecord);
  const totalNode = document.getElementById('users-total-count');
  const activeNode = document.getElementById('users-active-count');
  const blockedNode = document.getElementById('users-blocked-count');
  const adminNode = document.getElementById('users-admin-count');

  if (totalNode) totalNode.textContent = String(normalizedUsers.length);
  if (activeNode) activeNode.textContent = String(normalizedUsers.filter((user) => user.status === 'active').length);
  if (blockedNode) blockedNode.textContent = String(normalizedUsers.filter((user) => user.status === 'blocked').length);
  if (adminNode) adminNode.textContent = String(normalizedUsers.filter((user) => user.role === 'staff').length);

  if (!normalizedUsers.length) {
    body.innerHTML = '<tr><td colspan="6">No users found.</td></tr>';
    return;
  }

  body.innerHTML = normalizedUsers.map((user) => {
    const statusClass = getStatusTagClass(user.status);
    const nextAction = user.status === 'blocked' ? 'Unblock' : 'Block';
    return '<tr data-user-id="' + escapeHtml(user.id) + '">' +
      '<td>' + escapeHtml(user.name) + '</td>' +
      '<td>' + escapeHtml(user.email) + '</td>' +
      '<td>' + escapeHtml(user.institution) + '</td>' +
      '<td>' + escapeHtml(titleCase(user.role)) + '</td>' +
      '<td><span class="tag ' + statusClass + '">' + escapeHtml(titleCase(user.status)) + '</span></td>' +
      '<td class="user-actions-cell">' +
      '<button class="btn btn-ghost" type="button" data-user-toggle="' + escapeHtml(user.id) + '">' + nextAction + '</button>' +
      '<button class="btn btn-ghost" type="button" data-user-delete="' + escapeHtml(user.id) + '">Delete user</button>' +
      '</td>' +
      '</tr>';
  }).join('');
}

function wireManageUsersActions() {
  const body = document.getElementById('users-table-body');
  if (!body) return;

  body.addEventListener('click', async (event) => {
    const toggleBtn = event.target.closest('[data-user-toggle]');
    const deleteBtn = event.target.closest('[data-user-delete]');
    if (!toggleBtn && !deleteBtn) return;

    const users = await loadUsers();

    if (toggleBtn) {
      const userId = toggleBtn.getAttribute('data-user-toggle');
      const user = users.find((item) => item.id === userId);
      if (!user) return;

      const nextStatus = user.status === 'blocked' ? 'active' : 'blocked';
      const updatedLocal = users.map((item) => item.id === userId ? { ...item, status: nextStatus } : item);
      renderManageUsers(updatedLocal);

      try {
        const updatedUser = await updateUserRemote(userId, { status: nextStatus });
        const merged = users.map((item) => item.id === userId ? updatedUser : item);
        renderManageUsers(merged);
      } catch (error) {
        renderManageUsers(updatedLocal);
      }

      return;
    }

    if (deleteBtn) {
      const userId = deleteBtn.getAttribute('data-user-delete');
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.id === userId) {
        alert('You cannot delete the currently signed-in user.');
        return;
      }

      const remaining = users.filter((item) => item.id !== userId);
      renderManageUsers(remaining);

      try {
        await deleteUserRemote(userId);
      } catch (error) {
        renderManageUsers(users);
      }
    }
  });
}

function renderUserDashboard() {
  const titleNode = document.getElementById('user-dashboard-title');
  if (!titleNode) return;

  const currentUser = getCurrentUser();
  const allItems = getStoredDatasets();
  const studentView = isStudentUser(currentUser);
  const items = studentView ? datasetsForCurrentUser(allItems) : pendingDatasetsForStaff(allItems);
  const approved = studentView
    ? items.filter((item) => item.status.toLowerCase().includes('approved')).length
    : allItems.filter((item) => item.status.toLowerCase().includes('approved')).length;
  const pending = items.filter((item) => {
    const status = item.status.toLowerCase();
    return status.includes('processing') || status.includes('waiting');
  }).length;

  if (currentUser && currentUser.name) {
    titleNode.textContent = studentView
      ? 'Welcome back, ' + currentUser.name + '.'
      : 'Welcome back, ' + currentUser.name + '. Staff review queue is ready.';
  } else {
    titleNode.textContent = 'Welcome back to your dashboard.';
  }

  const uploadedNode = document.getElementById('user-files-uploaded');
  const cleanedNode = document.getElementById('user-files-cleaned');
  const pendingNode = document.getElementById('user-files-pending');
  const stat1Label = document.getElementById('dashboard-stat-1-label');
  const stat2Label = document.getElementById('dashboard-stat-2-label');
  const stat3Label = document.getElementById('dashboard-stat-3-label');
  const portalRoleLabel = document.getElementById('portal-role-label');
  const statsHeading = document.getElementById('dashboard-stats-heading');
  const actionsHeading = document.getElementById('dashboard-actions-heading');
  if (uploadedNode) uploadedNode.textContent = String(items.length);
  if (cleanedNode) cleanedNode.textContent = String(approved);
  if (pendingNode) pendingNode.textContent = String(pending);
  if (stat1Label) stat1Label.textContent = studentView ? 'Files Uploaded' : 'Queue Items';
  if (stat2Label) stat2Label.textContent = studentView ? 'Files Cleaned' : 'Approved Datasets';
  if (stat3Label) stat3Label.textContent = studentView ? 'Pending Approvals' : 'Waiting Review';
  if (portalRoleLabel) portalRoleLabel.textContent = studentView ? 'Student Portal' : 'Staff Portal';
  if (statsHeading) statsHeading.textContent = studentView ? 'Quick Stats' : 'Review Snapshot';
  if (actionsHeading) actionsHeading.textContent = studentView ? 'Actions' : 'Staff Workspace';
  document.title = (studentView ? 'Student Portal' : 'Staff Portal') + ' | Smart Academic Data Cleaning Portal';

  const studentIntro = document.getElementById('student-dashboard-copy');
  const staffIntro = document.getElementById('staff-dashboard-copy');
  const studentActions = document.getElementById('student-dashboard-actions');
  const staffPanel = document.getElementById('staff-review-panel');
  if (studentIntro) studentIntro.hidden = !studentView;
  if (staffIntro) staffIntro.hidden = studentView;
  if (studentActions) studentActions.hidden = !studentView;
  if (staffPanel) staffPanel.hidden = studentView;

  renderStaffPortalQueue();
}

function renderProfile() {
  const form = document.querySelector('[data-profile-form]');
  if (!form) return;

  const currentUser = normalizeUserRecord(getCurrentUser() || FALLBACK_USERS[1]);
  const datasets = datasetsForCurrentUser(getStoredDatasets());
  const approvedCount = datasets.filter((item) => item.status.toLowerCase().includes('approved')).length;

  form.querySelector('#profile-name').value = currentUser.name || '';
  form.querySelector('#profile-email').value = currentUser.email || '';
  form.querySelector('#profile-institution').value = currentUser.institution || '';
  const roleField = form.querySelector('#profile-role');
  if (roleField) {
    if (currentUser.role === 'admin') {
      let adminOption = roleField.querySelector('option[value="admin"]');
      if (!adminOption) {
        adminOption = document.createElement('option');
        adminOption.value = 'admin';
        adminOption.textContent = 'Administrator (System)';
        roleField.appendChild(adminOption);
      }
      roleField.value = 'admin';
      roleField.disabled = true;
    } else {
      const adminOption = roleField.querySelector('option[value="admin"]');
      if (adminOption) adminOption.remove();
      roleField.value = currentUser.role === 'student' ? 'student' : 'staff';
      roleField.disabled = false;
    }
  }

  const statusText = titleCase(currentUser.status || 'active');
  const statusChip = document.getElementById('profile-status-chip');
  const roleChip = document.getElementById('profile-role-chip');
  const institutionNode = document.getElementById('profile-summary-institution');
  const submittedNode = document.getElementById('profile-summary-submitted');
  const approvedNode = document.getElementById('profile-summary-approved');
  const profileStatusNode = document.getElementById('profile-summary-status');
  const preferenceRoleNode = document.getElementById('profile-preference-role');
  const lastUpdatedNode = document.getElementById('profile-last-updated');
  const accessTierNode = document.getElementById('profile-access-tier');

  if (statusChip) statusChip.textContent = 'Account status: ' + statusText;
  if (roleChip) roleChip.textContent = 'Role: ' + titleCase(currentUser.role);
  if (institutionNode) institutionNode.textContent = currentUser.institution;
  if (submittedNode) submittedNode.textContent = String(datasets.length);
  if (approvedNode) approvedNode.textContent = String(approvedCount);
  if (profileStatusNode) profileStatusNode.textContent = statusText;
  if (preferenceRoleNode) preferenceRoleNode.textContent = titleCase(currentUser.role);
  if (lastUpdatedNode) lastUpdatedNode.textContent = currentUser.updatedAt ? formatUploadDateTime(currentUser.updatedAt) : formatUploadDateTime(currentUser.createdAt);
  if (accessTierNode) {
    accessTierNode.textContent = currentUser.role === 'admin'
      ? 'Administrator access'
      : currentUser.role === 'student'
        ? 'Student upload access'
        : 'Staff review access';
  }
}

function wireProfileForm() {
  const form = document.querySelector('[data-profile-form]');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.id) {
      alert('Please sign in again to update your profile.');
      window.location.href = 'signin.html';
      return;
    }

    const payload = {
      name: form.querySelector('#profile-name').value.trim(),
      email: form.querySelector('#profile-email').value.trim().toLowerCase(),
      institution: form.querySelector('#profile-institution').value.trim(),
      role: currentUser.role === 'admin'
        ? 'admin'
        : form.querySelector('#profile-role').value.trim().toLowerCase(),
      password: form.querySelector('#new-password').value.trim()
    };

    if (!payload.password) delete payload.password;

    try {
      const updatedUser = await updateUserRemote(currentUser.id, payload);
      if (updatedUser) setCurrentUser(updatedUser);
      renderProfile();
      alert('Profile updated successfully.');
    } catch (error) {
      if (!error.networkError) {
        alert(error.message);
        return;
      }

      setCurrentUser({ ...currentUser, ...payload, updatedAt: new Date().toISOString() });
      renderProfile();
      alert('Profile updated locally. Start the backend to save it permanently.');
    }
  });
}

function renderReports(reports) {
  const totalUploadsNode = document.getElementById('reports-total-uploads');
  if (!totalUploadsNode || !reports) return;

  const activeInstitutionsNode = document.getElementById('reports-active-institutions');
  const totalIssuesNode = document.getElementById('reports-total-issues');
  const adminActionsNode = document.getElementById('reports-admin-actions');
  const institutionsBody = document.getElementById('reports-institutions-body');
  const issuesBody = document.getElementById('reports-issues-body');
  const highestLoadNode = document.getElementById('reports-highest-load');
  const highestLoadCopyNode = document.getElementById('reports-highest-load-copy');
  const topRiskNode = document.getElementById('reports-top-risk');
  const topRiskCopyNode = document.getElementById('reports-top-risk-copy');
  const logsBox = document.getElementById('reports-system-logs');

  totalUploadsNode.textContent = String(reports.summary.totalUploads || 0);
  activeInstitutionsNode.textContent = String(reports.summary.activeInstitutions || 0);
  totalIssuesNode.textContent = String(reports.summary.totalIssues || 0);
  adminActionsNode.textContent = String(reports.summary.adminActions || 0);

  const institutions = Array.isArray(reports.uploadsByInstitution) ? reports.uploadsByInstitution : [];
  institutionsBody.innerHTML = institutions.length
    ? institutions.map((row) => '<tr><td>' + escapeHtml(row.institution) + '</td><td>' + escapeHtml(row.uploads) + '</td></tr>').join('')
    : '<tr><td colspan="2">No upload data available.</td></tr>';

  const issues = Array.isArray(reports.commonIssues) ? reports.commonIssues : [];
  issuesBody.innerHTML = issues.length
    ? issues.map((row) => '<tr><td>' + escapeHtml(row.issueType) + '</td><td>' + escapeHtml(row.count) + '</td></tr>').join('')
    : '<tr><td colspan="2">No issue data available.</td></tr>';

  const highestLoad = institutions[0];
  if (highestLoad) {
    highestLoadNode.textContent = highestLoad.institution;
    highestLoadCopyNode.textContent = 'Upload volume is highest here with ' + highestLoad.uploads + ' datasets, so review traffic may grow fastest in this institution.';
  }

  const topRisk = issues[0];
  if (topRisk) {
    topRiskNode.textContent = topRisk.issueType + ' remains dominant';
    topRiskCopyNode.textContent = 'This issue appears ' + topRisk.count + ' times and is the best candidate for template or training improvements.';
  }

  const logs = Array.isArray(reports.recentLogs) ? reports.recentLogs : [];
  logsBox.innerHTML = logs.length
    ? logs.map((log) => '<p><span>' + escapeHtml(formatUploadDateTime(log.at)) + '</span> ' + escapeHtml(log.message) + '</p>').join('')
    : '<p><span>No logs</span> Recent system activity will appear here.</p>';
}

async function loadUsers() {
  try {
    return await fetchUsersFromServer();
  } catch (error) {
    return FALLBACK_USERS.map(normalizeUserRecord);
  }
}

async function loadReports() {
  try {
    return await fetchReportsFromServer();
  } catch (error) {
    return computeReportsFromLocal(FALLBACK_USERS.map(normalizeUserRecord), getStoredDatasets());
  }
}

function wireLogoutLinks() {
  document.querySelectorAll('a[href="signin.html"]').forEach((link) => {
    link.addEventListener('click', () => {
      setCurrentUser(null);
    });
  });
}

document.querySelectorAll('[data-login-form]').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const params = new URLSearchParams(window.location.search);
    const adminOnly = params.get('mode') === 'admin';
    const identifierField = form.querySelector('input[name="identifier"]');
    const passwordField = form.querySelector('input[name="password"]');
    const identifier = identifierField ? identifierField.value.trim() : '';
    const normalizedIdentifier = identifier.toLowerCase();
    const password = passwordField ? passwordField.value : '';

    try {
      const payload = await apiRequest('/signin', {
        method: 'POST',
        body: { identifier, password, adminOnly }
      });

      setCurrentUser(payload.user || null);
      window.location.href = payload.destination || getDashboardPathForRole(payload.user && payload.user.role);
    } catch (error) {
      if (!error.networkError) {
        alert(error.message);
        return;
      }

      const fallbackUser = FALLBACK_USERS.find((user) => {
        return user.email.toLowerCase() === normalizedIdentifier || user.name.toLowerCase() === normalizedIdentifier;
      });
      if (adminOnly && !isAuthorizedAdminUser(fallbackUser)) {
        alert('Admin login requires an admin email account.');
        return;
      }
      if (fallbackUser) setCurrentUser(fallbackUser);
      window.location.href = getDashboardPathForRole(fallbackUser && fallbackUser.role);
    }
  });
});

function updateSigninMode() {
  const form = document.querySelector('[data-login-form]');
  if (!form) return;

  const params = new URLSearchParams(window.location.search);
  const adminOnly = params.get('mode') === 'admin';
  const heading = document.querySelector('.auth-panel h1');
  const intro = document.querySelector('.auth-panel p');
  const identifierLabel = form.querySelector('label[for="identifier"]');
  const identifierInput = form.querySelector('#identifier');
  const helperLines = document.querySelectorAll('.switch-link');

  if (!adminOnly) return;

  if (heading) heading.textContent = 'Admin Login';
  if (intro) intro.textContent = 'Continue with admin@smartdataportal.edu to verify and approve student data.';
  if (identifierLabel) identifierLabel.textContent = 'Admin Email';
  if (identifierInput) identifierInput.placeholder = 'admin@smartdataportal.edu';
  if (helperLines[1]) helperLines[1].textContent = 'Only admin@smartdataportal.edu can open the Admin Dashboard.';
}

document.querySelectorAll('[data-register-form]').forEach((form) => {
  form.addEventListener('submit', async (event) => {
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

    const formData = new FormData(form);
    const signupData = Object.fromEntries(formData.entries());

    try {
      const response = await apiRequest('/signup', {
        method: 'POST',
        body: signupData
      });

      if (response.user) {
        setCurrentUser(response.user);
      }
    } catch (error) {
      if (!error.networkError) {
        alert(error.message);
        return;
      }
    }

    window.location.href = 'signin.html';
  });

  const confirmField = form.querySelector('input[name="confirm-password"]');
  if (confirmField) {
    confirmField.addEventListener('input', () => {
      confirmField.setCustomValidity('');
    });
  }
});

document.querySelectorAll('[data-forgot-password-form]').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const identifierField = form.querySelector('input[name="identifier"]');
    const passwordField = form.querySelector('input[name="password"]');
    const confirmField = form.querySelector('input[name="confirm-password"]');
    const identifier = identifierField ? identifierField.value.trim() : '';
    const normalizedIdentifier = identifier.toLowerCase();
    const password = passwordField ? passwordField.value : '';
    const confirmPassword = confirmField ? confirmField.value : '';

    if (password !== confirmPassword) {
      if (confirmField) {
        confirmField.setCustomValidity('Passwords do not match.');
        confirmField.reportValidity();
      }
      return;
    }

    if (confirmField) {
      confirmField.setCustomValidity('');
    }

    try {
      const payload = await apiRequest('/reset-password', {
        method: 'POST',
        body: { identifier, password }
      });

      const currentUser = getCurrentUser();
      const currentUserMatches = currentUser && (
        currentUser.email === normalizedIdentifier ||
        String(currentUser.name || '').toLowerCase() === normalizedIdentifier
      );
      if (currentUserMatches && payload.user) {
        setCurrentUser(payload.user);
      }

      alert('Password reset successful. Please sign in with your new password.');
      window.location.href = 'signin.html';
    } catch (error) {
      if (!error.networkError) {
        alert(error.message);
        return;
      }

      alert('Backend unavailable. Start the server to reset your password.');
    }
  });

  const confirmField = form.querySelector('input[name="confirm-password"]');
  if (confirmField) {
    confirmField.addEventListener('input', () => {
      confirmField.setCustomValidity('');
    });
  }
});

document.querySelectorAll('[data-upload-form]').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const currentUser = getCurrentUser();
    if (!isStudentUser(currentUser)) {
      alert('Only active student accounts can upload datasets.');
      window.location.href = 'user-portal.html';
      return;
    }

    const titleField = form.querySelector('input[name="dataset-title"]');
    const descriptionField = form.querySelector('textarea[name="description"]');
    const fileInput = form.querySelector('input[name="dataset-file"]');
    const autoApproveInput = form.querySelector('input[name="auto-approve"]');
    const fileName = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0].name : '';
    const datasetName = titleField && titleField.value.trim() ? titleField.value.trim() : (fileName || 'Untitled Dataset');
    const cleaningOptions = Array.from(form.querySelectorAll('input[name="cleaning"]:checked')).map((input) => input.value);
    const autoApproveRequested = Boolean(autoApproveInput && autoApproveInput.checked);

    const localEntry = normalizeDatasetRecord({
      id: 'ds-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      name: datasetName,
      uploadedAt: new Date().toISOString(),
      status: statusWithIcon('waiting'),
      uploadedBy: resolveCurrentUploader(),
      description: descriptionField ? descriptionField.value.trim() : '',
      fileName,
      cleaningOptions
    });

    try {
      await createDatasetRemote({
        name: datasetName,
        uploadedBy: localEntry.uploadedBy,
        description: localEntry.description,
        fileName,
        cleaningOptions,
        autoApproveRequested,
        uploader: {
          id: currentUser.id,
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
          status: currentUser.status
        }
      });
    } catch (error) {
      if (!error.networkError) {
        alert(error.message);
        return;
      }
      const existing = getStoredDatasets();
      existing.unshift(localEntry);
      setStoredDatasets(existing);
    }

    renderAllDatasetViews();
    renderUserDashboard();
    renderProfile();
    window.location.href = 'processing.html';
  });
});

function updateUploadAccessState() {
  const uploadLink = document.getElementById('upload');
  if (!uploadLink) return;

  const currentUser = getCurrentUser();
  if (isStudentUser(currentUser)) {
    uploadLink.textContent = 'Upload Dataset';
    uploadLink.removeAttribute('aria-disabled');
    uploadLink.classList.remove('btn-disabled');
    uploadLink.href = 'upload-dataset.html';
    return;
  }

  uploadLink.textContent = 'Upload Available For Students';
  uploadLink.setAttribute('aria-disabled', 'true');
  uploadLink.classList.add('btn-disabled');
  uploadLink.href = '#';
  uploadLink.addEventListener('click', (event) => {
    event.preventDefault();
    alert('Only active student accounts can upload datasets. Admin approves or rejects after review.');
  });
}

async function handleApprovalAction(event, tableBody) {
  if (!tableBody) return;

    const approveBtn = event.target.closest('[data-approve]');
    const rejectBtn = event.target.closest('[data-reject]');
    const currentUser = getCurrentUser();

    if ((approveBtn || rejectBtn) && !isStaffReviewer(currentUser) && !isAuthorizedAdminUser(currentUser)) {
      alert('Only active staff accounts can approve or reject student datasets.');
      return;
    }

    if (approveBtn) {
      const id = approveBtn.getAttribute('data-approve');
      const nextStatus = statusWithIcon('approved');

      try {
        await updateDatasetStatusRemote(id, nextStatus);
        renderAllDatasetViews();
        renderApprovalsTable();
        renderAdminDashboard();
        renderUserDashboard();
        renderProfile();
      } catch (error) {
        alert(error.message || 'Approval failed.');
      }

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

      const nextStatus = statusWithIcon('rejected', reason);

      try {
        await updateDatasetStatusRemote(id, nextStatus, reason);
        renderAllDatasetViews();
        renderApprovalsTable();
        renderAdminDashboard();
        renderUserDashboard();
        renderProfile();
      } catch (error) {
        alert(error.message || 'Rejection failed.');
      }
    }
}

function wireApprovalActions() {
  const approvalTables = ['dataset-approvals-body', 'staff-review-body']
    .map((id) => document.getElementById(id))
    .filter(Boolean);

  approvalTables.forEach((tableBody) => {
    tableBody.addEventListener('click', async (event) => {
      await handleApprovalAction(event, tableBody);
    });
  });
}

function renderAllDatasetViews() {
  renderDatasetsTable();
  renderProcessingTable();
  renderDatasetDetails();
  renderApprovalsTable();
  renderStaffPortalQueue();
  renderAdminDashboard();
}

async function initializeDynamicViews() {
  renderAllDatasetViews();
  renderUserDashboard();
  renderProfile();
  updateUploadAccessState();

  const users = await loadUsers();
  renderManageUsers(users);

  const reports = await loadReports();
  renderReports(reports);
}

async function initializeApp() {
  if (!enforceRoleAccess()) return;

  updateSigninMode();
  wireApprovalActions();
  wireManageUsersActions();
  wireProfileForm();
  wireLogoutLinks();

  try {
    await syncAppStateFromServer();
  } catch (error) {
    seedInitialDatasetsIfEmpty();
    try {
      await syncDatasetsFromServer();
    } catch (innerError) {
    }
  }

  await initializeDynamicViews();
}

initializeApp();
