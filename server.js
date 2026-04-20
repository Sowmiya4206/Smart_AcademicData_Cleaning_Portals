const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const DATASETS_FILE = path.join(DATA_DIR, 'datasets.json');
const PRIMARY_ADMIN_EMAIL = 'admin@smartdataportal.edu';

const DEFAULT_USERS = [
  {
    id: 'user-admin-1',
    name: 'Admin User',
    email: 'admin@smartdataportal.edu',
    institution: 'Smart Data Portal',
    role: 'admin',
    passwordHash: hashPassword('admin123'),
    status: 'active',
    createdAt: '2026-04-08T18:00:00.000Z'
  },
  {
    id: 'user-demo-1',
    name: 'Alex Carter',
    email: 'alex.carter@university.edu',
    institution: 'Example University',
    role: 'staff',
    passwordHash: hashPassword('password123'),
    status: 'active',
    createdAt: '2026-04-08T18:05:00.000Z'
  }
];

const DEFAULT_DATASETS = [
  {
    id: 'seed-1',
    name: 'semester5_attendance.csv',
    uploadedAt: '2026-04-08T17:00:00.000Z',
    status: 'Processing \u23f3',
    uploadedBy: 'anika.s'
  },
  {
    id: 'seed-2',
    name: 'exam_results_batch2.xlsx',
    uploadedAt: '2026-04-07T17:00:00.000Z',
    status: 'Waiting for Admin Approval \ud83d\udfe1',
    uploadedBy: 'dean.office'
  },
  {
    id: 'seed-3',
    name: 'course_registration_jan.csv',
    uploadedAt: '2026-04-06T17:00:00.000Z',
    status: 'Approved \u2705',
    uploadedBy: 'registrar.team'
  },
  {
    id: 'seed-4',
    name: 'student_profile_dump.xlsx',
    uploadedAt: '2026-04-05T17:00:00.000Z',
    status: 'Rejected \u274c - Invalid headers',
    uploadedBy: 'staff.user'
  }
];

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8'
};

function ensureDataFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) writeJson(USERS_FILE, DEFAULT_USERS);
  if (!fs.existsSync(DATASETS_FILE)) writeJson(DATASETS_FILE, DEFAULT_DATASETS);

  const users = readJson(USERS_FILE);
  const datasets = readJson(DATASETS_FILE);

  if (!Array.isArray(users) || !users.length) {
    writeJson(USERS_FILE, DEFAULT_USERS);
  }

  if (!Array.isArray(datasets) || !datasets.length) {
    writeJson(DATASETS_FILE, DEFAULT_DATASETS);
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return [];
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n');
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8'
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Request body too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

function sanitizeUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function getUsers() {
  return readJson(USERS_FILE);
}

function saveUsers(users) {
  writeJson(USERS_FILE, users);
}

function getDatasets() {
  return readJson(DATASETS_FILE);
}

function saveDatasets(datasets) {
  writeJson(DATASETS_FILE, datasets);
}

function getSafeRole(role) {
  const normalized = String(role || 'staff').trim().toLowerCase();
  if (normalized === 'admin') return 'admin';
  if (normalized === 'student') return 'student';
  return 'staff';
}

function canAccessAdminDashboard(role) {
  const normalized = getSafeRole(role);
  return normalized === 'admin';
}

function isPrimaryAdminEmail(email) {
  return String(email || '').trim().toLowerCase() === PRIMARY_ADMIN_EMAIL;
}

function isAuthorizedAdminUser(user) {
  if (!user || typeof user !== 'object') return false;
  return canAccessAdminDashboard(user.role) && isPrimaryAdminEmail(user.email) && getSafeStatus(user.status) === 'active';
}

function isStudentUser(user) {
  if (!user || typeof user !== 'object') return false;
  return getSafeRole(user.role) === 'student' && getSafeStatus(user.status) === 'active';
}

function isStaffReviewer(user) {
  if (!user || typeof user !== 'object') return false;
  return getSafeRole(user.role) === 'staff' && getSafeStatus(user.status) === 'active';
}

function getRoleForEmail(email, requestedRole) {
  if (isPrimaryAdminEmail(email)) return 'admin';

  const safeRole = getSafeRole(requestedRole);
  return safeRole === 'admin' ? 'staff' : safeRole;
}

function getDashboardForRole(role) {
  return canAccessAdminDashboard(role) ? 'admin-portal.html' : 'user-portal.html';
}

function extractDecisionReason(status, explicitReason) {
  const directReason = String(explicitReason || '').trim();
  if (directReason) return directReason;

  const statusText = String(status || '');
  if (!statusText.includes('-')) return '';
  return statusText.split('-').slice(1).join('-').trim();
}

function getSafeStatus(status) {
  const normalized = String(status || 'active').trim().toLowerCase();
  return normalized === 'blocked' ? 'blocked' : 'active';
}

function isLowRiskDatasetForAutoApproval(dataset) {
  const fileName = String(dataset.fileName || '').trim().toLowerCase();
  const description = String(dataset.description || '').trim();
  const cleaningOptions = Array.isArray(dataset.cleaningOptions) ? dataset.cleaningOptions : [];
  const hasSupportedCsv = fileName.endsWith('.csv');
  const hasEnoughContext = description.length >= 15;
  const hasStandardChecks = cleaningOptions.length >= 2;
  return hasSupportedCsv && hasEnoughContext && hasStandardChecks;
}

function buildReports(users, datasets) {
  const uploadsByInstitution = {};
  const knownInstitutionByEmail = {};

  users.forEach((user) => {
    knownInstitutionByEmail[String(user.email).toLowerCase()] = user.institution || 'Unknown Institution';
  });

  datasets.forEach((dataset) => {
    const uploader = String(dataset.uploadedBy || '').toLowerCase();
    const institution = knownInstitutionByEmail[uploader] || 'Unknown Institution';
    uploadsByInstitution[institution] = (uploadsByInstitution[institution] || 0) + 1;
  });

  const institutionRows = Object.entries(uploadsByInstitution)
    .sort((a, b) => b[1] - a[1])
    .map(([institution, uploads]) => ({ institution, uploads }));

  const missingValues = datasets.filter((item) => String(item.status).toLowerCase().includes('rejected')).length * 3 + datasets.length * 2;
  const duplicates = datasets.filter((item) => String(item.status).toLowerCase().includes('waiting')).length * 2 + datasets.length;
  const invalidDateFormats = datasets.filter((item) => String(item.status).toLowerCase().includes('processing')).length + Math.max(1, Math.floor(datasets.length / 2));
  const inconsistentIds = Math.max(1, Math.floor(datasets.length / 2));

  const commonIssues = [
    { issueType: 'Missing values', count: missingValues },
    { issueType: 'Duplicate records', count: duplicates },
    { issueType: 'Invalid date formats', count: invalidDateFormats },
    { issueType: 'Inconsistent IDs', count: inconsistentIds }
  ].sort((a, b) => b.count - a.count);

  const totalUploads = datasets.length;
  const activeInstitutions = institutionRows.length;
  const totalIssues = commonIssues.reduce((sum, item) => sum + item.count, 0);
  const adminActions = datasets.filter((item) => {
    const status = String(item.status).toLowerCase();
    return status.includes('approved') || status.includes('rejected');
  }).length;

  const recentLogs = datasets.slice().sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()).slice(0, 6).map((dataset) => {
    const status = String(dataset.status).toLowerCase();
    let message = 'Upload accepted: ' + dataset.name;

    if (status.includes('approved')) {
      message = String(dataset.verifiedBy || '').toLowerCase() === 'system'
        ? 'Auto-approved dataset ' + dataset.name
        : 'Staff action: Approved dataset ' + dataset.name;
    }
    if (status.includes('rejected')) message = 'Staff action: Rejected dataset ' + dataset.name;
    if (status.includes('waiting')) message = 'Cleaning completed: waiting for staff approval for ' + dataset.name;
    if (status.includes('processing')) message = 'Cleaning engine started for ' + dataset.name;

    return {
      at: dataset.uploadedAt,
      message
    };
  });

  return {
    summary: {
      totalUploads,
      activeInstitutions,
      totalIssues,
      adminActions
    },
    uploadsByInstitution: institutionRows,
    commonIssues,
    recentLogs
  };
}

function buildId(prefix) {
  return prefix + '-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
}

async function handleApi(req, res, url) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, service: 'smart-data-portal-backend' });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/users') {
    sendJson(res, 200, { users: getUsers().map(sanitizeUser) });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/reports') {
    sendJson(res, 200, { reports: buildReports(getUsers(), getDatasets()) });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/bootstrap') {
    const users = getUsers();
    const datasets = getDatasets();
    sendJson(res, 200, {
      users: users.map(sanitizeUser),
      datasets,
      reports: buildReports(users, datasets)
    });
    return true;
  }

  if (req.method === 'GET' && url.pathname === '/api/datasets') {
    sendJson(res, 200, { datasets: getDatasets() });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/signup') {
    const body = await parseBody(req);
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const institution = String(body.institution || '').trim();
    const role = String(body.role || 'staff').trim().toLowerCase();
    const password = String(body.password || '');

    if (!name || !email || !institution || !password) {
      sendJson(res, 400, { error: 'Name, email, institution, and password are required.' });
      return true;
    }

    const users = getUsers();
    if (users.some((user) => String(user.email).toLowerCase() === email)) {
      sendJson(res, 409, { error: 'An account with this email already exists.' });
      return true;
    }

    const user = {
      id: buildId('user'),
      name,
      email,
      institution,
      role: getRoleForEmail(email, role),
      passwordHash: hashPassword(password),
      status: 'active',
      createdAt: new Date().toISOString()
    };

    users.push(user);
    saveUsers(users);
    sendJson(res, 201, { message: 'Account created.', user: sanitizeUser(user) });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/signin') {
    const body = await parseBody(req);
    const identifierRaw = String(body.identifier || body.email || body.name || '').trim();
    const identifier = identifierRaw.toLowerCase();
    const password = String(body.password || '');
    const adminOnly = Boolean(body.adminOnly);
    const users = getUsers();

    if (!identifier) {
      sendJson(res, 400, { error: 'Email or name is required.' });
      return true;
    }

    const user = users.find((entry) => {
      const entryEmail = String(entry.email || '').toLowerCase();
      const entryName = String(entry.name || '').trim().toLowerCase();
      return entryEmail === identifier || entryName === identifier;
    });

    if (!user || user.passwordHash !== hashPassword(password)) {
      sendJson(res, 401, { error: 'Invalid email/name or password.' });
      return true;
    }

    if (adminOnly && !isAuthorizedAdminUser(user)) {
      sendJson(res, 403, { error: 'Admin login requires an admin email account.' });
      return true;
    }

    sendJson(res, 200, {
      message: 'Signed in.',
      user: sanitizeUser(user),
      destination: getDashboardForRole(user.role)
    });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/reset-password') {
    const body = await parseBody(req);
    const identifierRaw = String(body.identifier || body.email || body.name || '').trim();
    const identifier = identifierRaw.toLowerCase();
    const password = String(body.password || '');
    const users = getUsers();
    const index = users.findIndex((entry) => {
      const entryEmail = String(entry.email || '').toLowerCase();
      const entryName = String(entry.name || '').trim().toLowerCase();
      return entryEmail === identifier || entryName === identifier;
    });

    if (!identifier || !password) {
      sendJson(res, 400, { error: 'Email/name and new password are required.' });
      return true;
    }

    if (index === -1) {
      sendJson(res, 404, { error: 'No account found for this email or name.' });
      return true;
    }

    users[index] = {
      ...users[index],
      passwordHash: hashPassword(password),
      updatedAt: new Date().toISOString()
    };

    saveUsers(users);
    sendJson(res, 200, { message: 'Password reset successfully.', user: sanitizeUser(users[index]) });
    return true;
  }

  if (req.method === 'PATCH' && /^\/api\/users\/[^/]+$/.test(url.pathname)) {
    const userId = decodeURIComponent(url.pathname.split('/')[3] || '');
    const body = await parseBody(req);
    const users = getUsers();
    const index = users.findIndex((user) => String(user.id) === userId);

    if (index === -1) {
      sendJson(res, 404, { error: 'User not found.' });
      return true;
    }

    const current = users[index];
    const nextEmail = body.email ? String(body.email).trim().toLowerCase() : current.email;
    const duplicate = users.find((user, userIndex) => userIndex !== index && String(user.email).toLowerCase() === nextEmail);
    if (duplicate) {
      sendJson(res, 409, { error: 'Another user already has this email.' });
      return true;
    }

    users[index] = {
      ...current,
      name: body.name ? String(body.name).trim() : current.name,
      email: nextEmail,
      institution: body.institution ? String(body.institution).trim() : current.institution,
      role: getRoleForEmail(nextEmail, body.role ? body.role : current.role),
      status: body.status ? getSafeStatus(body.status) : current.status,
      passwordHash: body.password ? hashPassword(body.password) : current.passwordHash,
      updatedAt: new Date().toISOString()
    };

    saveUsers(users);
    sendJson(res, 200, { message: 'User updated.', user: sanitizeUser(users[index]), users: users.map(sanitizeUser) });
    return true;
  }

  if (req.method === 'DELETE' && /^\/api\/users\/[^/]+$/.test(url.pathname)) {
    const userId = decodeURIComponent(url.pathname.split('/')[3] || '');
    const users = getUsers();
    const index = users.findIndex((user) => String(user.id) === userId);

    if (index === -1) {
      sendJson(res, 404, { error: 'User not found.' });
      return true;
    }

    const removed = users.splice(index, 1)[0];
    saveUsers(users);
    sendJson(res, 200, { message: 'User deleted.', user: sanitizeUser(removed), users: users.map(sanitizeUser) });
    return true;
  }

  if (req.method === 'POST' && url.pathname === '/api/datasets') {
    const body = await parseBody(req);
    const name = String(body.name || '').trim();
    const uploadedBy = String(body.uploadedBy || 'user.portal').trim();
    const description = String(body.description || '').trim();
    const fileName = String(body.fileName || '').trim();
    const cleaningOptions = Array.isArray(body.cleaningOptions) ? body.cleaningOptions.map(String) : [];
    const uploader = body.uploader && typeof body.uploader === 'object' ? body.uploader : null;
    const autoApproveRequested = Boolean(body.autoApproveRequested);

    if (!name) {
      sendJson(res, 400, { error: 'Dataset name is required.' });
      return true;
    }

    if (!uploader || !isStudentUser(uploader)) {
      sendJson(res, 403, { error: 'Only active student accounts can upload datasets.' });
      return true;
    }

    const datasets = getDatasets();
    const dataset = {
      id: buildId('ds'),
      name,
      uploadedAt: new Date().toISOString(),
      status: 'Waiting for Admin Approval \ud83d\udfe1',
      uploadedBy: uploader.email || uploadedBy,
      description,
      fileName,
      cleaningOptions,
      autoApproveRequested
    };

    if (autoApproveRequested && isLowRiskDatasetForAutoApproval(dataset)) {
      dataset.status = 'Approved \u2705';
      dataset.verifiedAt = new Date().toISOString();
      dataset.verifiedBy = 'system';
      dataset.verifiedByName = 'Auto Approval Rule';
      dataset.decisionReason = 'Auto-approved low-risk student dataset.';
    }

    datasets.unshift(dataset);
    saveDatasets(datasets);
    sendJson(res, 201, { message: 'Dataset created.', dataset, datasets });
    return true;
  }

  if (req.method === 'PATCH' && /^\/api\/datasets\/[^/]+\/status$/.test(url.pathname)) {
    const datasetId = decodeURIComponent(url.pathname.split('/')[3] || '');
    const body = await parseBody(req);
    const nextStatus = String(body.status || '').trim();
    const verifier = body.verifier && typeof body.verifier === 'object' ? body.verifier : null;
    const decisionReason = extractDecisionReason(nextStatus, body.reason);

    if (!nextStatus) {
      sendJson(res, 400, { error: 'Next status is required.' });
      return true;
    }

    if (!verifier || (!isStaffReviewer(verifier) && !isAuthorizedAdminUser(verifier))) {
      sendJson(res, 403, { error: 'Only active staff accounts can approve or reject student datasets.' });
      return true;
    }

    const datasets = getDatasets();
    const index = datasets.findIndex((item) => String(item.id) === datasetId);
    if (index === -1) {
      sendJson(res, 404, { error: 'Dataset not found.' });
      return true;
    }

    datasets[index] = {
      ...datasets[index],
      status: nextStatus,
      verifiedAt: new Date().toISOString(),
      verifiedBy: verifier.email || verifier.name || verifier.id || 'staff',
      verifiedByName: verifier.name || 'Staff Reviewer',
      decisionReason
    };
    saveDatasets(datasets);
    sendJson(res, 200, { message: 'Dataset updated.', dataset: datasets[index], datasets });
    return true;
  }

  return false;
}

function resolveStaticFile(urlPath) {
  const cleanPath = urlPath === '/' ? '/index.html' : urlPath;
  const normalized = path.normalize(cleanPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(ROOT, normalized);

  if (!filePath.startsWith(ROOT)) return null;
  if (!fs.existsSync(filePath)) return null;
  if (fs.statSync(filePath).isDirectory()) return null;
  return filePath;
}

ensureDataFiles();

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (await handleApi(req, res, url)) return;

    const filePath = resolveStaticFile(url.pathname);
    if (filePath) {
      sendFile(res, filePath);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Unexpected server error.' });
  }
});

server.listen(PORT, () => {
  console.log(`Smart Data Portal backend running at http://localhost:${PORT}`);
});
