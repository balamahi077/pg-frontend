const API_BASE_URL = 'https://pg-backend-8fi9.onrender.com/api';

// --- Authentication Logic ---
const CARETAKER_PIN = "1234"; // Change this to your preferred PIN
const OWNER_PIN = "9999";     // Change this to the Owner's preferred PIN

function checkAuth() {
    // If we are already on the login page, do nothing
    if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        return; 
    }
    
    // Check if a session exists
    const userRole = sessionStorage.getItem('pg_role');
    
    if (!userRole) {
        // Kick them back to login if they try to bypass it
        window.location.href = 'index.html'; // FIXED: Now routes to index.html
    }

    // Restrict Caretakers from accessing the Owner Dashboard
    if (window.location.pathname.includes('owner.html') && userRole !== 'OWNER') {
        alert('Access Denied. Owner PIN required to manage building structure.');
        window.location.href = 'index.html';
    }
}

// Handle Login Submission
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const enteredPin = document.getElementById('pin-input').value;
        const errorMsg = document.getElementById('login-error');

        if (enteredPin === CARETAKER_PIN) {
            sessionStorage.setItem('pg_role', 'CARETAKER');
            window.location.href = 'caretaker.html'; // Send to Caretaker Dashboard
        } else if (enteredPin === OWNER_PIN) {
            sessionStorage.setItem('pg_role', 'OWNER');
            window.location.href = 'owner.html'; // Send to Owner Dashboard
        } else {
            errorMsg.classList.remove('hidden');
        }
    });
}

// Function to fetch and display rooms
async function loadRooms() {
    const roomListContainer = document.getElementById('room-list');
    
    try {
        // Call the Spring Boot backend
        const response = await fetch(`${API_BASE_URL}/rooms`);
        const rooms = await response.json();
        
        // Clear the "Loading..." text
        roomListContainer.innerHTML = '';
        
        // If no rooms exist yet
        if (rooms.length === 0) {
            roomListContainer.innerHTML = '<p class="text-gray-500">No rooms found. Add one via Postman to see it here.</p>';
            return;
        }

        // Generate HTML cards for each room
        rooms.forEach(room => {
            const roomCard = `
                <div class="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-xl font-bold text-gray-700">Room ${room.roomNumber}</h3>
                        <span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">₹${room.monthlyRent}/mo</span>
                    </div>
                    <p class="text-gray-600">Total Beds: <span class="font-semibold">${room.totalBeds}</span></p>
                </div>
            `;
            roomListContainer.innerHTML += roomCard;
        });

    } catch (error) {
        console.error('Error fetching rooms:', error);
        if (roomListContainer) {
            roomListContainer.innerHTML = '<p class="text-red-500">Failed to connect to the server. Is Spring Boot running?</p>';
        }
    }
}

// --- Tenant Management Logic ---
// --- Tenant Management Logic (Fixed Room Names & Notice Status) ---
async function loadTenants() {
    const tenantTableBody = document.getElementById('tenant-table-body');
    if (!tenantTableBody) return;

    try {
        // Fetch ALL tenants and ALL rooms at the same time
        const [tenantsResponse, roomsResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/tenants`), 
            fetch(`${API_BASE_URL}/rooms`)
        ]);
        
        const allTenants = await tenantsResponse.json();
        const rooms = await roomsResponse.json();

        // Create a lookup dictionary: ID -> "Block A - 102"
        const roomMap = {};
        rooms.forEach(room => {
            roomMap[room.id] = `Block ${room.blockName} - ${room.roomNumber}`;
        });

        // Filter to show ONLY Active and On Notice tenants on this dashboard
        const currentTenants = allTenants.filter(t => t.status === 'ACTIVE' || t.status === 'ON_NOTICE');
        
        tenantTableBody.innerHTML = '';
        
        if (currentTenants.length === 0) {
            tenantTableBody.innerHTML = '<tr><td colspan="4" class="p-3 text-center text-gray-500">No active tenants.</td></tr>';
            return;
        }

        currentTenants.forEach(tenant => {
            const isNotice = tenant.status === 'ON_NOTICE';
            const statusBadge = isNotice 
                ? '<span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">On Notice</span>' 
                : '<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Active</span>';

            // Get the real room name using our dictionary
            const realRoomName = roomMap[tenant.roomId] || `Room ID ${tenant.roomId}`;

            // Hide the "Notice" button if they are already on notice
            const noticeBtn = !isNotice 
                ? `<button onclick="putOnNotice(${tenant.id})" class="text-yellow-600 hover:underline text-sm mr-2">Notice</button>` 
                : '';

                // Generate appropriate buttons based on status
                let actionButtons = '';
                if (isNotice) {
                    // If on notice, show Cancel Notice and Vacate
                    actionButtons = `
                        <button onclick="cancelNotice(${tenant.id})" class="text-blue-600 hover:underline text-sm mr-3 font-semibold">Cancel Notice</button>
                        <button onclick="vacateTenant(${tenant.id})" class="text-red-600 hover:underline text-sm font-semibold">Vacate</button>
                    `;
                } else {
                    // If active, show regular Notice and Vacate
                    actionButtons = `
                        <button onclick="putOnNotice(${tenant.id})" class="text-yellow-600 hover:underline text-sm mr-3 font-semibold">Notice</button>
                        <button onclick="vacateTenant(${tenant.id})" class="text-red-600 hover:underline text-sm font-semibold">Vacate</button>
                    `;
                }
    
                const row = `
                    <tr class="hover:bg-gray-50 border-b">
                        <td class="p-3">${tenant.fullName} ${statusBadge}</td>
                        <td class="p-3 font-semibold text-gray-700">${realRoomName}</td>
                        <td class="p-3 text-right">
                            ${actionButtons}
                        </td>
                    </tr>
                `;
            tenantTableBody.innerHTML += row;
        });

    } catch (error) {
        console.error('Error fetching tenants:', error);
        tenantTableBody.innerHTML = '<tr><td colspan="4" class="p-3 text-red-500">Failed to load tenants.</td></tr>';
    }
}

// Handle Tenant Form Submission
const addTenantForm = document.getElementById('add-tenant-form');
if (addTenantForm) {
    addTenantForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent page refresh

        const newTenant = {
            fullName: document.getElementById('t-name').value,
            phoneNumber: document.getElementById('t-phone').value,
            aadharNumber: document.getElementById('t-aadhar').value,
            dateOfJoining: document.getElementById('t-date').value,
            roomId: document.getElementById('t-room').value
        };

        try {
            const response = await fetch(`${API_BASE_URL}/tenants`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(newTenant)
            });

            if (response.ok) {
                alert('Tenant added successfully!');
                addTenantForm.reset(); // Clear the form
                loadTenants(); // Refresh the table
            } else {
                alert('Failed to add tenant. Check the Room ID.');
            }
        } catch (error) {
            console.error('Error saving tenant:', error);
            alert('Server error.');
        }
    });
}

// --- Payment Management Logic ---
async function loadPayments() {
    const paymentTableBody = document.getElementById('payment-table-body');
    if (!paymentTableBody) return; // Only run on payments.html

    try {
        const response = await fetch(`${API_BASE_URL}/payments`);
        const payments = await response.json();
        
        paymentTableBody.innerHTML = '';
        
        if (payments.length === 0) {
            paymentTableBody.innerHTML = '<tr><td colspan="5" class="p-3 text-center text-gray-500">No payments recorded yet.</td></tr>';
            return;
        }

        // Sort payments by date descending (newest first)
        payments.reverse().forEach(payment => {
            const dateStr = new Date(payment.paymentDate).toLocaleDateString();
            const modeStyle = payment.paymentMode === 'CASH' ? 'bg-green-100 text-green-800' : 'bg-purple-100 text-purple-800';
            
            const row = `
                <tr class="hover:bg-gray-50">
                    <td class="p-3 border-b text-gray-500">${dateStr}</td>
                    <td class="p-3 border-b font-bold">#${payment.tenantId}</td>
                    <td class="p-3 border-b">${payment.monthYear}</td>
                    <td class="p-3 border-b font-semibold text-green-600">₹${payment.amountPaid}</td>
                    <td class="p-3 border-b">
                        <span class="${modeStyle} text-xs px-2 py-1 rounded-full font-bold">${payment.paymentMode}</span>
                    </td>
                </tr>
            `;
            paymentTableBody.innerHTML += row;
        });

    } catch (error) {
        console.error('Error fetching payments:', error);
        paymentTableBody.innerHTML = '<tr><td colspan="5" class="p-3 text-red-500">Failed to load payments.</td></tr>';
    }
}

// Handle Payment Form Submission
const recordPaymentForm = document.getElementById('record-payment-form');
if (recordPaymentForm) {
    recordPaymentForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newPayment = {
            tenantId: document.getElementById('p-tenant').value,
            monthYear: document.getElementById('p-month').value,
            amountPaid: document.getElementById('p-amount').value,
            paymentMode: document.getElementById('p-mode').value,
            referenceNote: document.getElementById('p-ref').value
        };

        try {
            const response = await fetch(`${API_BASE_URL}/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newPayment)
            });

            if (response.ok) {
                alert('Payment verified and recorded!');
                recordPaymentForm.reset();
                loadPayments(); // Refresh table
            } else {
                alert('Failed to record payment.');
            }
        } catch (error) {
            console.error('Error saving payment:', error);
            alert('Server error.');
        }
    });
}

// --- Owner Management (Rooms with Blocks/Floors) ---
const addRoomForm = document.getElementById('add-room-form');
if (addRoomForm) {
    addRoomForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newRoom = {
            blockName: document.getElementById('r-block').value,
            floorNumber: document.getElementById('r-floor').value,
            roomNumber: document.getElementById('r-number').value,
            sharingType: document.getElementById('r-type').value,
            totalBeds: document.getElementById('r-beds').value,
            monthlyRent: document.getElementById('r-rent').value
        };

        try {
            const response = await fetch(`${API_BASE_URL}/rooms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newRoom)
            });
            if (response.ok) {
                alert('Room added to building!');
                addRoomForm.reset();
                loadRoomsByBlock(); // Refresh view
            }
        } catch (error) {
            console.error('Error adding room:', error);
        }
    });
}

// Fetch Rooms by Block for Owner Dashboard
let currentOwnerRooms = []; // Stores the current list so we can edit them easily

// Fetch Rooms by Block for Owner Dashboard (Upgraded with Edit/Delete)
async function loadRoomsByBlock() {
    const listContainer = document.getElementById('structured-room-list');
    if (!listContainer) return;
    
    const blockFilter = document.getElementById('filter-block').value;
    const endpoint = blockFilter === 'ALL' ? '/rooms' : `/rooms/block/${blockFilter}`;

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        currentOwnerRooms = await response.json();
        listContainer.innerHTML = '';
        
        currentOwnerRooms.forEach(room => {
            listContainer.innerHTML += `
                <div class="bg-gray-50 p-4 rounded border-l-4 border-purple-500 relative flex flex-col justify-between">
                    <div>
                        <h3 class="font-bold text-lg text-gray-800">Block ${room.blockName} - Room ${room.roomNumber}</h3>
                        <p class="text-sm text-gray-600 mt-1">Floor: ${room.floorNumber} | Type: ${room.sharingType}</p>
                        <p class="text-sm text-gray-600 text-purple-700 font-semibold">Beds: ${room.totalBeds} | Rent: ₹${room.monthlyRent}</p>
                    </div>
                    <div class="mt-4 pt-3 border-t border-gray-200 flex justify-end space-x-4">
                        <button onclick="openEditModal(${room.id})" class="text-blue-600 hover:text-blue-800 text-sm font-bold">Edit</button>
                        <button onclick="deleteRoom(${room.id})" class="text-red-500 hover:text-red-700 text-sm font-bold">Delete</button>
                    </div>
                </div>
            `;
        });
    } catch (error) {
        listContainer.innerHTML = '<p class="text-red-500">Error loading rooms.</p>';
    }
}

// --- Owner CRUD Actions ---

async function deleteRoom(roomId) {
    if (!confirm("Are you sure you want to delete this room? This cannot be undone.")) return;

    try {
        const response = await fetch(`${API_BASE_URL}/rooms/${roomId}`, { method: 'DELETE' });
        if (response.ok) {
            alert('Room deleted successfully.');
            loadRoomsByBlock(); // Refresh the list
        } else {
            alert('Cannot delete room. Ensure no tenants (active or past) are assigned to it first.');
        }
    } catch (error) {
        console.error('Error deleting room:', error);
    }
}

function openEditModal(roomId) {
    // Find the specific room data from our current list
    const room = currentOwnerRooms.find(r => r.id === roomId);
    if (!room) return;

    // Fill the modal with the current data
    document.getElementById('edit-id').value = room.id;
    document.getElementById('edit-block').value = room.blockName;
    document.getElementById('edit-floor').value = room.floorNumber;
    document.getElementById('edit-number').value = room.roomNumber;
    document.getElementById('edit-type').value = room.sharingType;
    document.getElementById('edit-beds').value = room.totalBeds;
    document.getElementById('edit-rent').value = room.monthlyRent;

    // Show the modal
    document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

// Handle the Edit Form Submission
const editRoomForm = document.getElementById('edit-room-form');
if (editRoomForm) {
    editRoomForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const roomId = document.getElementById('edit-id').value;
        
        const updatedRoom = {
            blockName: document.getElementById('edit-block').value,
            floorNumber: document.getElementById('edit-floor').value,
            roomNumber: document.getElementById('edit-number').value,
            sharingType: document.getElementById('edit-type').value,
            totalBeds: document.getElementById('edit-beds').value,
            monthlyRent: document.getElementById('edit-rent').value
        };

        try {
            const response = await fetch(`${API_BASE_URL}/rooms/${roomId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedRoom)
            });
            if (response.ok) {
                alert('Room updated successfully!');
                closeEditModal();
                loadRoomsByBlock(); // Refresh view
            } else {
                alert('Error updating room.');
            }
        } catch (error) {
            console.error('Error updating room:', error);
        }
    });
}

// --- Caretaker Notice & Vacate Logic ---
async function putOnNotice(tenantId) {
    const noticeDate = prompt("Enter notice date (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
    if (!noticeDate) return;

    try {
        const response = await fetch(`${API_BASE_URL}/tenants/${tenantId}/notice?noticeDate=${noticeDate}`, { method: 'PUT' });
        if (response.ok) {
            alert('Tenant is now on notice period.');
            loadTenants(); // Refresh active list
            if (document.getElementById('history-table-body')) loadHistory(); // Refresh history if visible
        } else {
            alert('Error updating notice status.');
        }
    } catch (error) {
        console.error('Error putting on notice:', error);
    }
}

async function cancelNotice(tenantId) {
    if (!confirm("Are you sure you want to cancel the notice? This will make the tenant fully active again.")) return;

    try {
        const response = await fetch(`${API_BASE_URL}/tenants/${tenantId}/cancel-notice`, { method: 'PUT' });
        if (response.ok) {
            alert('Notice cancelled successfully.');
            loadTenants(); // Refresh active list
        } else {
            alert('Error canceling notice.');
        }
    } catch (error) {
        console.error('Error canceling notice:', error);
    }
}

async function vacateTenant(tenantId) {
    const vacateDate = prompt("Enter official vacate date (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
    if (!vacateDate) return;

    try {
        const response = await fetch(`${API_BASE_URL}/tenants/${tenantId}/vacate?vacateDate=${vacateDate}`, { method: 'PUT' });
        if (response.ok) {
            alert('Tenant has officially vacated the room.');
            loadTenants(); // Hides them from the Active list
            if (document.getElementById('history-table-body')) loadHistory(); // Refreshes the History page
        } else {
            alert('Failed to vacate tenant. Please check server connection.');
        }
    } catch (error) {
        console.error('Error vacating tenant:', error);
    }
}

// --- Unified Page Load Logic (CLEANED) ---
document.addEventListener('DOMContentLoaded', () => {
    // Auth guard check
    checkAuth();
    loadNavbar(); // NEW: Injects the navigation bar

    // Load data based on which page we are currently on
    if (document.getElementById('room-list')) loadRooms(); 
    if (document.getElementById('tenant-table-body')) loadTenants();
    if (document.getElementById('payment-table-body')) loadPayments();
    if (document.getElementById('structured-room-list')) loadRoomsByBlock();

    // NEW: Load the room dropdown options if the field exists
    if (document.getElementById('t-room')) populateRoomDropdown();
    // NEW: Load the history table if it exists on the page
    if (document.getElementById('history-table-body')) loadHistory();
    // NEW: Load the active tenants into the payment form dropdown
    if (document.getElementById('p-tenant')) populateTenantDropdown();
});


// --- Tenant Search Logic ---
const tenantSearchInput = document.getElementById('tenant-search');

if (tenantSearchInput) {
    tenantSearchInput.addEventListener('keyup', function() {
        const query = this.value.toLowerCase();
        const rows = document.querySelectorAll('#tenant-table-body tr');

        rows.forEach(row => {
            // Ignore the "Loading..." or "No active tenants" empty state rows
            if (row.cells.length < 3) return; 

            // Get text from Name column and Room column
            const nameText = row.cells[0].textContent.toLowerCase();
            const roomText = row.cells[1].textContent.toLowerCase();

            // If the query matches the name or the room, show the row. Otherwise, hide it.
            if (nameText.includes(query) || roomText.includes(query)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
}

// --- Populate Room Dropdown (Fixed Double Booking) ---
async function populateRoomDropdown() {
    const roomSelect = document.getElementById('t-room');
    if (!roomSelect) return;

    try {
        const [roomsResponse, tenantsResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/rooms`),
            fetch(`${API_BASE_URL}/tenants`) // Fetch ALL to see who is on notice
        ]);

        const rooms = await roomsResponse.json();
        const allTenants = await tenantsResponse.json();
        
        roomSelect.innerHTML = '<option value="" disabled selected>Select an Available Room...</option>';
        
        rooms.forEach(room => {
            // Count tenants who are physically in the room (Active OR On Notice)
            const physicalOccupants = allTenants.filter(t => t.roomId === room.id && (t.status === 'ACTIVE' || t.status === 'ON_NOTICE'));
            const availableBeds = room.totalBeds - physicalOccupants.length;

            if (availableBeds > 0) {
                const optionText = `Block ${room.blockName} - Room ${room.roomNumber} (${availableBeds} bed(s) available)`;
                roomSelect.innerHTML += `<option value="${room.id}">${optionText}</option>`;
            } else {
                // See if the room is full, but someone is leaving soon
                const hasNotice = physicalOccupants.some(t => t.status === 'ON_NOTICE');
                const fullText = hasNotice 
                    ? `Block ${room.blockName} - Room ${room.roomNumber} (Full - Vacating Soon)` 
                    : `Block ${room.blockName} - Room ${room.roomNumber} (FULL)`;
                
                roomSelect.innerHTML += `<option value="${room.id}" disabled class="text-red-400 bg-gray-50">${fullText}</option>`;
            }
        });
    } catch (error) {
        console.error('Error fetching rooms for dropdown:', error);
        roomSelect.innerHTML = '<option value="" disabled>Error loading rooms</option>';
    }
}


// --- Tenant History Logic ---
async function loadHistory() {
    const historyTableBody = document.getElementById('history-table-body');
    if (!historyTableBody) return;

    try {
        // Fetch ALL tenants from the database
        const response = await fetch(`${API_BASE_URL}/tenants`);
        const allTenants = await response.json();
        
        // Filter out the ACTIVE tenants so we only see Notice and Vacated
        const pastTenants = allTenants.filter(tenant => tenant.status !== 'ACTIVE');
        
        historyTableBody.innerHTML = '';
        
        if (pastTenants.length === 0) {
            historyTableBody.innerHTML = '<tr><td colspan="5" class="p-3 text-center text-gray-500">No past or notice tenants found.</td></tr>';
            return;
        }

        // Sort so the newest changes appear at the top
        pastTenants.reverse().forEach(tenant => {
            const isNotice = tenant.status === 'ON_NOTICE';
            
            const statusBadge = isNotice
                ? '<span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded font-bold">ON NOTICE</span>' 
                : '<span class="bg-gray-200 text-gray-800 text-xs px-2 py-1 rounded font-bold">VACATED</span>';

            // Display the relevant date based on their status
            const dateInfo = isNotice 
                ? `<span class="text-yellow-600">Notice Given: ${tenant.noticeDate}</span>` 
                : `<span class="text-red-500">Left on: ${tenant.vacateDate}</span>`;

            const row = `
                <tr class="hover:bg-gray-50 border-b">
                    <td class="p-3 font-medium">${tenant.fullName}</td>
                    <td class="p-3 text-gray-600">${tenant.phoneNumber}</td>
                    <td class="p-3 font-semibold text-blue-600">Room ${tenant.roomId}</td>
                    <td class="p-3">${statusBadge}</td>
                    <td class="p-3 text-sm font-medium">${dateInfo}</td>
                </tr>
            `;
            historyTableBody.innerHTML += row;
        });

    } catch (error) {
        console.error('Error fetching history:', error);
        historyTableBody.innerHTML = '<tr><td colspan="5" class="p-3 text-red-500">Failed to load history.</td></tr>';
    }
}

// --- Dynamic Navbar & Logout ---
function loadNavbar() {
    const navbarPlaceholder = document.getElementById('navbar-placeholder');
    if (!navbarPlaceholder) return; // Skip if on the login page

    const currentPage = window.location.pathname.split('/').pop();
    const role = sessionStorage.getItem('pg_role');

    // Helper function to underline the active page
    const active = (page) => currentPage === page ? "font-bold underline" : "hover:text-blue-200";

    let links = '';
    
    if (currentPage === 'owner.html') {
        // Owner Specific Navbar
        links = `
            <li><a href="owner.html" class="font-bold underline">Manage Building</a></li>
            <li><a href="caretaker.html" class="hover:text-purple-200">Caretaker View</a></li>
            <li><button onclick="logout()" class="text-red-300 hover:text-white ml-4">Logout</button></li>
        `;
    } else {
        // Caretaker Navbar (Includes a button to go back to Owner View if the Owner is logged in)
        links = `
            <li><a href="caretaker.html" class="${active('caretaker.html')}">Dashboard</a></li>
            <li><a href="tenants.html" class="${active('tenants.html')}">Tenants</a></li>
            <li><a href="payments.html" class="${active('payments.html')}">Payments</a></li>
            <li><a href="history.html" class="${active('history.html')}">History</a></li>
            ${role === 'OWNER' ? '<li><a href="owner.html" class="text-purple-300 hover:text-purple-100 ml-4 font-bold border-l pl-4">Owner View</a></li>' : ''}
            <li><button onclick="logout()" class="text-red-300 hover:text-white ml-4 border-l pl-4 border-gray-400">Logout</button></li>
        `;
    }

    const navColor = currentPage === 'owner.html' ? 'bg-purple-700' : 'bg-blue-600';

    navbarPlaceholder.innerHTML = `
        <nav class="${navColor} text-white p-4 shadow-md">
            <div class="container mx-auto flex justify-between items-center">
                <h1 class="text-xl font-bold">PG Manager</h1>
                <ul class="flex space-x-4 items-center">
                    ${links}
                </ul>
            </div>
        </nav>
    `;
}

function logout() {
    sessionStorage.removeItem('pg_role');
    window.location.href = 'index.html';
}




// --- Populate Tenant Dropdown in Payment Form ---
async function populateTenantDropdown() {
    const tenantSelect = document.getElementById('p-tenant');
    // Only run this if we are on the payments page and the element is a dropdown
    if (!tenantSelect || tenantSelect.tagName !== 'SELECT') return;

    try {
        const response = await fetch(`${API_BASE_URL}/tenants/active`);
        const tenants = await response.json();
        
        tenantSelect.innerHTML = '<option value="" disabled selected>Select a Tenant...</option>';
        
        tenants.forEach(tenant => {
            // Displays: Rahul Sharma - Room 101 (9876543210)
            const optionText = `${tenant.fullName} - Room ${tenant.roomId} (${tenant.phoneNumber})`;
            tenantSelect.innerHTML += `<option value="${tenant.id}">${optionText}</option>`;
        });
    } catch (error) {
        console.error('Error fetching tenants for dropdown:', error);
        tenantSelect.innerHTML = '<option value="" disabled>Error loading tenants</option>';
    }
}