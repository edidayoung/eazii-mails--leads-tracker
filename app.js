// Global Variables
let currentUser = null;
let leads = [];
let uploadedFiles = [];
let currentFilter = 'all';
let searchTerm = '';

// Initialize app on page load
window.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initializeEventListeners();
});

// Authentication Functions
async function checkAuth() {
    const userData = localStorage.getItem('current-user');
    if (userData) {
        currentUser = JSON.parse(userData);
        showDashboard();
        await loadUserData();
    } else {
        showLanding();
    }
}

function showLanding() {
    document.getElementById('landingPage').classList.remove('hidden');
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('signupPage').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('active');
}

function showLogin() {
    document.getElementById('landingPage').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('signupPage').classList.add('hidden');
}

function showSignup() {
    document.getElementById('landingPage').classList.add('hidden');
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('signupPage').classList.remove('hidden');
}

function showDashboard() {
    document.getElementById('landingPage').classList.add('hidden');
    document.getElementById('loginPage').classList.add('hidden');
    document.getElementById('signupPage').classList.add('hidden');
    document.getElementById('dashboard').classList.add('active');
    
    if (currentUser) {
        document.getElementById('userName').textContent = currentUser.name;
        document.getElementById('userAvatar').textContent = currentUser.name.charAt(0).toUpperCase();
    }
}

async function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;

    try {
        const userKey = `user-${email}`;
        const existingUser = localStorage.getItem(userKey);
        
        if (existingUser) {
            showToast('Account already exists. Please sign in.', 'fas fa-info-circle');
            return;
        }

        const user = { name, email, password, createdAt: new Date().toISOString() };
        localStorage.setItem(userKey, JSON.stringify(user));
        
        currentUser = user;
        localStorage.setItem('current-user', JSON.stringify(user));
        
        showToast('Account created successfully!', 'fas fa-check-circle');
        showDashboard();
    } catch (error) {
        showToast('Error creating account. Please try again.', 'fas fa-exclamation-circle');
        console.error('Signup error:', error);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const userKey = `user-${email}`;
        const existingUser = localStorage.getItem(userKey);
        
        if (!existingUser) {
            showToast('Account not found. Please sign up.', 'fas fa-info-circle');
            return;
        }

        const user = JSON.parse(existingUser);
        
        if (user.password !== password) {
            showToast('Incorrect password. Please try again.', 'fas fa-exclamation-circle');
            return;
        }

        currentUser = user;
        localStorage.setItem('current-user', JSON.stringify(user));
        
        showToast('Welcome back!', 'fas fa-check-circle');
        showDashboard();
        await loadUserData();
    } catch (error) {
        showToast('Login error. Please try again.', 'fas fa-exclamation-circle');
        console.error('Login error:', error);
    }
}

async function handleLogout() {
    localStorage.removeItem('current-user');
    currentUser = null;
    leads = [];
    uploadedFiles = [];
    showToast('Logged out successfully', 'fas fa-check-circle');
    showLanding();
}

// Data Management Functions
async function loadUserData() {
    if (!currentUser) return;

    const leadsKey = `leads-${currentUser.email}`;
    const leadsData = localStorage.getItem(leadsKey);
    if (leadsData) {
        leads = JSON.parse(leadsData);
    }

    const filesKey = `files-${currentUser.email}`;
    const filesData = localStorage.getItem(filesKey);
    if (filesData) {
        uploadedFiles = JSON.parse(filesData);
        renderUploadedFiles();
    }

    renderLeads();
}

async function saveUserData() {
    if (!currentUser) return;

    const leadsKey = `leads-${currentUser.email}`;
    localStorage.setItem(leadsKey, JSON.stringify(leads));

    const filesKey = `files-${currentUser.email}`;
    localStorage.setItem(filesKey, JSON.stringify(uploadedFiles));
}

// UI Helper Functions
function showToast(message, icon = 'fas fa-check-circle') {
    const toast = document.getElementById('toast');
    toast.innerHTML = `<i class="${icon}"></i> ${message}`;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function copyToClipboard(text, type) {
    navigator.clipboard.writeText(text).then(() => {
        showToast(`${type} copied!`);
    }).catch(() => {
        showToast('Failed to copy', 'fas fa-exclamation-circle');
    });
}

// Event Listeners
function initializeEventListeners() {
    document.getElementById('csvFile').addEventListener('change', handleFileUpload);

    document.getElementById('searchBox').addEventListener('input', (e) => {
        searchTerm = e.target.value.toLowerCase();
        renderLeads();
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            renderLeads();
        });
    });
}

// File Upload Functions
async function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    for (const file of files) {
        const extension = file.name.split('.').pop().toLowerCase();
        const fileHash = await generateFileHash(file);
        
        const existingFile = uploadedFiles.find(f => f.hash === fileHash);
        if (existingFile) {
            showToast(`File "${file.name}" already uploaded`, 'fas fa-info-circle');
            continue;
        }

        if (extension === 'csv') {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    processData(results.data, file.name, fileHash);
                },
                error: (error) => {
                    showToast('Error reading CSV: ' + error.message, 'fas fa-exclamation-circle');
                }
            });
        } else if (extension === 'xlsx' || extension === 'xls') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(firstSheet);
                processData(jsonData, file.name, fileHash);
            };
            reader.readAsArrayBuffer(file);
        }
    }
    
    e.target.value = '';
}

async function generateFileHash(file) {
    const text = await file.text();
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString();
}

function processData(data, fileName, fileHash) {
    const newLeads = data
        .map((row) => {
            const firstName = row['First Name'] || row['first name'] || row['FIRST NAME'] || row['firstName'] || '';
            const lastName = row['Last Name'] || row['last name'] || row['LAST NAME'] || row['lastName'] || '';
            const fullName = `${firstName} ${lastName}`.trim() || row.Name || row.name || row.NAME || '';
            const email = row.Email || row.email || row.EMAIL || '';
            const company = row['Company Name'] || row['Company name'] || row['company name'] || 
                          row['COMPANY NAME'] || row.Company || row.company || row.COMPANY || '';

            return {
                name: fullName,
                email: email,
                company: company,
                status: 'todo',
                dateCompleted: null,
                fileName: fileName
            };
        })
        .filter(lead => lead.name || lead.email || lead.company);

    let duplicatesRemoved = 0;
    const existingEmails = new Set(leads.filter(l => l.email).map(l => l.email.toLowerCase()));
    
    const uniqueNewLeads = newLeads.filter(lead => {
        if (lead.email) {
            const emailLower = lead.email.toLowerCase();
            if (existingEmails.has(emailLower)) {
                duplicatesRemoved++;
                return false;
            }
            existingEmails.add(emailLower);
        }
        return true;
    });

    const existingFileData = uploadedFiles.find(f => f.hash === fileHash);
    if (existingFileData) {
        uniqueNewLeads.forEach(newLead => {
            const savedProgress = existingFileData.leadsProgress?.find(
                p => p.email && newLead.email && p.email.toLowerCase() === newLead.email.toLowerCase()
            );
            if (savedProgress) {
                newLead.status = savedProgress.status;
                newLead.dateCompleted = savedProgress.dateCompleted;
            }
        });
        showToast(`Progress restored for "${fileName}"`, 'fas fa-history');
    }

    const startId = leads.length;
    uniqueNewLeads.forEach((lead, index) => {
        leads.push({ ...lead, id: startId + index });
    });

    uploadedFiles.push({
        name: fileName,
        hash: fileHash,
        uploadedAt: new Date().toISOString(),
        leadCount: uniqueNewLeads.length
    });

    saveUserData();
    renderLeads();
    renderUploadedFiles();
    
    let message = `${uniqueNewLeads.length} leads imported from "${fileName}"`;
    if (duplicatesRemoved > 0) {
        message += ` (${duplicatesRemoved} duplicates removed)`;
    }
    showToast(message, 'fas fa-file-upload');
}

function renderUploadedFiles() {
    const container = document.getElementById('uploadedFiles');
    if (uploadedFiles.length === 0) {
        container.innerHTML = '';
        return;
    }

    const filesHTML = uploadedFiles.map((file, index) => `
        <span class="file-tag">
            <i class="fas fa-file-excel"></i>
            ${file.name}
            <span class="remove-file" onclick="removeFile(${index})">
                <i class="fas fa-times"></i>
            </span>
        </span>
    `).join('');

    container.innerHTML = filesHTML;
}

function removeFile(index) {
    const file = uploadedFiles[index];
    leads = leads.filter(lead => lead.fileName !== file.name);
    uploadedFiles.splice(index, 1);
    
    saveUserData();
    renderLeads();
    renderUploadedFiles();
    showToast(`File "${file.name}" removed`, 'fas fa-trash');
}

function toggleLead(id) {
    const lead = leads.find(l => l.id === id);
    if (lead) {
        if (lead.status === 'todo') {
            lead.status = 'in-progress';
            lead.dateCompleted = null;
            showToast('In Progress', 'fas fa-clock');
        } else if (lead.status === 'in-progress') {
            lead.status = 'completed';
            lead.dateCompleted = new Date().toISOString();
            showToast('Completed', 'fas fa-check-circle');
        } else {
            lead.status = 'todo';
            lead.dateCompleted = null;
            showToast('To Do', 'fas fa-list');
        }
        
        const file = uploadedFiles.find(f => f.name === lead.fileName);
        if (file) {
            if (!file.leadsProgress) file.leadsProgress = [];
            const progressIndex = file.leadsProgress.findIndex(p => p.email === lead.email);
            if (progressIndex >= 0) {
                file.leadsProgress[progressIndex] = {
                    email: lead.email,
                    status: lead.status,
                    dateCompleted: lead.dateCompleted
                };
            } else {
                file.leadsProgress.push({
                    email: lead.email,
                    status: lead.status,
                    dateCompleted: lead.dateCompleted
                });
            }
        }
        
        saveUserData();
        renderLeads();
    }
}

function renderLeads() {
    const mainContainer = document.getElementById('leadsList');
    
    let filteredLeads = leads.filter(lead => {
        const matchesSearch = 
            lead.name.toLowerCase().includes(searchTerm) ||
            lead.email.toLowerCase().includes(searchTerm) ||
            lead.company.toLowerCase().includes(searchTerm);

        const matchesFilter = 
            currentFilter === 'all' ||
            (currentFilter === 'done' && lead.status === 'completed') ||
            (currentFilter === 'progress' && lead.status === 'in-progress') ||
            (currentFilter === 'todo' && lead.status === 'todo');

        return matchesSearch && matchesFilter;
    });

    const total = leads.length;
    const inProgress = leads.filter(l => l.status === 'in-progress').length;
    const completed = leads.filter(l => l.status === 'completed').length;
    const toGo = total - inProgress - completed;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    document.getElementById('totalLeads').textContent = total;
    document.getElementById('inProgressLeads').textContent = inProgress;
    document.getElementById('completedLeads').textContent = completed;
    document.getElementById('toGoLeads').textContent = toGo;
    document.getElementById('progressPercent').textContent = progress + '%';

    if (filteredLeads.length === 0) {
        const emptyMessage = leads.length === 0 
            ? '<div class="empty-state"><i class="fas fa-inbox"></i><h3>No Leads Yet</h3><p>Upload a CSV or Excel file to get started</p></div>'
            : '<div class="empty-state"><i class="fas fa-search"></i><h3>No Matches Found</h3><p>Try adjusting your search or filter</p></div>';
        
        mainContainer.innerHTML = emptyMessage;
        return;
    }

    const leadsHTML = filteredLeads.map(lead => {
        let statusClass = '';
        let checkboxClass = '';
        let checkIcon = '';
        
        if (lead.status === 'in-progress') {
            statusClass = 'in-progress';
            checkboxClass = 'in-progress';
            checkIcon = '<i class="fas fa-minus"></i>';
        } else if (lead.status === 'completed') {
            statusClass = 'completed';
            checkboxClass = 'checked';
            checkIcon = '<i class="fas fa-check"></i>';
        }
        
        return `
        <div class="lead-card ${statusClass}">
            <div class="lead-header">
                <div class="checkbox ${checkboxClass}" onclick="toggleLead(${lead.id})">
                    ${checkIcon}
                </div>
                <div class="lead-info">
                    <div class="lead-name">
                        <span>${lead.name || 'N/A'}</span>
                        ${lead.name ? `<button class="copy-btn" onclick="copyToClipboard('${lead.name}', 'Name')"><i class="fas fa-copy"></i></button>` : ''}
                    </div>
                    <div class="lead-detail">
                        <i class="fas fa-building"></i>
                        <span>${lead.company || 'N/A'}</span>
                    </div>
                    <div class="lead-detail">
                        <i class="fas fa-envelope"></i>
                        <span style="flex: 1;">${lead.email || 'N/A'}</span>
                        ${lead.email ? `<button class="copy-btn" onclick="copyToClipboard('${lead.email}', 'Email')"><i class="fas fa-copy"></i></button>` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    }).join('');

    mainContainer.innerHTML = leadsHTML;
}

function exportToCSV() {
    if (leads.length === 0) {
        showToast('No leads to export!', 'fas fa-exclamation-circle');
        return;
    }

    const csvData = leads.map(lead => ({
        Name: lead.name,
        Email: lead.email,
        Company: lead.company,
        Status: lead.status === 'completed' ? 'Completed' : lead.status === 'in-progress' ? 'In Progress' : 'To Do',
        'Date Completed': lead.dateCompleted ? new Date(lead.dateCompleted).toLocaleDateString() : '',
        'Source File': lead.fileName
    }));

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eazii_leads_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast('CSV exported successfully!', 'fas fa-download');
}
