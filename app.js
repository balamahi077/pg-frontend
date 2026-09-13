const API_BASE_URL = 'https://pg-backend-8fi9.onrender.com/api';

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
        roomListContainer.innerHTML = '<p class="text-red-500">Failed to connect to the server. Is Spring Boot running?</p>';
    }
}

// Run the function when the page loads
document.addEventListener('DOMContentLoaded', loadRooms);

// --- Tenant Management Logic ---

async function loadTenants() {
    const tenantTableBody = document.getElementById('tenant-table-body');
    if (!tenantTableBody) return; // Only run if on the tenants.html page

    try {
        const response = await fetch(`${API_BASE_URL}/tenants/active`); 
        const tenants = await response.json();
        
        tenantTableBody.innerHTML = '';
        
        if (tenants.length === 0) {
            tenantTableBody.innerHTML = '<tr><td colspan="4" class="p-3 text-center text-gray-500">No active tenants.</td></tr>';
            return;
        }

        tenants.forEach(tenant => {
            const statusBadge = tenant.status === 'ON_NOTICE' 
                ? '<span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">On Notice</span>' 
                : '<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">Active</span>';

            const row = `
                <tr class="hover:bg-gray-50 border-b">
                    <td class="p-3">${tenant.fullName} ${statusBadge}</td>
                    <td class="p-3">Room ${tenant.roomId}</td>
                    <td class="p-3 text-right">
                        <button onclick="putOnNotice(${tenant.id})" class="text-yellow-600 hover:underline text-sm mr-2">Notice</button>
                        <button onclick="vacateTenant(${tenant.id})" class="text-red-600 hover:underline text-sm">Vacate</button>
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

// Run loadTenants when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    // loadRooms() might be called from previous steps; we can safely ignore errors if elements don't exist
    if (document.getElementById('room-list')) {
        loadRooms(); 
    }
    loadTenants();
});


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

// Update the DOMContentLoaded event listener at the very bottom of app.js to include loadPayments:
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('room-list')) loadRooms(); 
    if (document.getElementById('tenant-table-body')) loadTenants();
    if (document.getElementById('payment-table-body')) loadPayments();
});


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
async function loadRoomsByBlock() {
    const listContainer = document.getElementById('structured-room-list');
    if (!listContainer) return;
    
    const blockFilter = document.getElementById('filter-block').value;
    const endpoint = blockFilter === 'ALL' ? '/rooms' : `/rooms/block/${blockFilter}`;

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`);
        const rooms = await response.json();
        listContainer.innerHTML = '';
        
        rooms.forEach(room => {
            listContainer.innerHTML += `
                <div class="bg-gray-50 p-4 rounded border-l-4 border-purple-500">
                    <h3 class="font-bold">Block ${room.blockName} - Room ${room.roomNumber}</h3>
                    <p class="text-sm text-gray-600">Floor: ${room.floorNumber} | Type: ${room.sharingType}</p>
                    <p class="text-sm text-gray-600">Beds: ${room.totalBeds} | Rent: ₹${room.monthlyRent}</p>
                </div>
            `;
        });
    } catch (error) {
        listContainer.innerHTML = '<p class="text-red-500">Error loading rooms.</p>';
    }
}

// --- Caretaker Notice & Vacate Logic ---
// Add these functions so the HTML buttons can call them
async function putOnNotice(tenantId) {
    const noticeDate = prompt("Enter notice date (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
    if (!noticeDate) return;

    try {
        const response = await fetch(`${API_BASE_URL}/tenants/${tenantId}/notice?noticeDate=${noticeDate}`, { method: 'PUT' });
        if (response.ok) {
            alert('Tenant is now on notice period.');
            loadTenants(); // Refresh table
        }
    } catch (error) {
        console.error('Error putting on notice:', error);
    }
}

async function vacateTenant(tenantId) {
    const vacateDate = prompt("Enter official vacate date (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
    if (!vacateDate) return;

    try {
        const response = await fetch(`${API_BASE_URL}/tenants/${tenantId}/vacate?vacateDate=${vacateDate}`, { method: 'PUT' });
        if (response.ok) {
            alert('Tenant has officially vacated the room.');
            loadTenants(); // Refresh table to hide them
        }
    } catch (error) {
        console.error('Error vacating tenant:', error);
    }
}

// Make sure to call loadRoomsByBlock on page load if we are on owner.html
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('structured-room-list')) loadRoomsByBlock();
});
