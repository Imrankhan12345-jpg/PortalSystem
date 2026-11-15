let currentStudent = null;

// Helper for Toastify Alerts
function showToast(message, isError = false) {
    Toastify({
        text: message,
        duration: 3000,
        gravity: "top",
        position: "right",
        style: { background: isError ? "#dc2626" : "#16a34a" }
    }).showToast();
}

// 1. Student Login Function with Firebase & Password Validation
async function studentLogin() {
    var rollNoInput = Number(document.getElementById("loginRollNo").value.trim());
    var groupInput = document.getElementById("loginGroup").value;
    var passInput = document.getElementById("loginPassword").value.trim();

    if (!rollNoInput || groupInput === "" || !passInput) {
        showToast("Please enter Roll Number, Group, and Password!", true);
        return;
    }

    var found = null;
    for (var i = 0; i < registeredStudents.length; i++) {
        if (registeredStudents[i].rollNo === rollNoInput && registeredStudents[i].group === groupInput) {
            found = registeredStudents[i];
            break;
        }
    }

    if (!found) {
        showToast("Error: Invalid Roll Number or Group!", true);
        return;
    }

    // Firebase Password Check / Registration
    if (window.firebaseDB) {
        const { db, ref, get, set } = window.firebaseDB;
        const studentRef = ref(db, `studentCredentials/${groupInput}_${rollNoInput}`);
        
        try {
            const snapshot = await get(studentRef);
            if (snapshot.exists()) {
                const data = snapshot.val();
                if (data.password !== passInput) {
                    showToast("Please enter valid password!", true);
                    return;
                }
            } else {
                // First time login: Save password in Firebase
                await set(studentRef, { password: passInput, rollNo: rollNoInput, name: found.name, group: groupInput });
                showToast("Password registered successfully!");
            }

            // Track Active Login Session in Firebase
            const activeRef = ref(db, `activeLogins/${groupInput}_${rollNoInput}`);
            await set(activeRef, {
                rollNo: rollNoInput,
                name: found.name,
                group: groupInput,
                loginTime: new Date().toLocaleTimeString()
            });

        } catch (error) {
            console.error("Firebase error:", error);
        }
    }

    currentStudent = found;

    document.getElementById("loginSection").style.display = "none";
    document.getElementById("dashboardSection").style.display = "block";

    document.getElementById("studentWelcomeName").innerText = "Welcome, " + currentStudent.name;
    document.getElementById("studentInfoText").innerText = "Roll No: " + currentStudent.rollNo + " | Department: " + currentStudent.group;

    loadStudentAttendanceSummary();
    loadStudentComplaints();
    showToast("Login Successful!");
}

// 2. Logout Function
async function studentLogout() {
    if (currentStudent && window.firebaseDB) {
        const { db, ref, set } = window.firebaseDB;
        const activeRef = ref(db, `activeLogins/${currentStudent.group}_${currentStudent.rollNo}`);
        await set(activeRef, null); // Remove from active sessions
    }

    currentStudent = null;
    document.getElementById("loginRollNo").value = "";
    document.getElementById("loginGroup").selectedIndex = 0;
    document.getElementById("loginPassword").value = "";
    
    document.getElementById("dashboardSection").style.display = "none";
    document.getElementById("loginSection").style.display = "block";
    showToast("Logged out successfully");
}

// 3. Attendance Summary & Percentage
function loadStudentAttendanceSummary() {
    var allAttendance = JSON.parse(localStorage.getItem("collegeAttendance")) || [];
    var historyContainer = document.getElementById("attendanceHistoryList");
    historyContainer.innerHTML = "";

    var studentRecords = [];
    for (var i = 0; i < allAttendance.length; i++) {
        if (allAttendance[i].rollNo === currentStudent.rollNo && allAttendance[i].group === currentStudent.group) {
            studentRecords.push(allAttendance[i]);
        }
    }

    var totalPresent = studentRecords.length;
    document.getElementById("totalPresentCount").innerText = totalPresent + " Days";
    var accuracy = totalPresent > 0 ? Math.min(100, Math.round((totalPresent / 25) * 100)) : 0; 
    document.getElementById("attendanceAccuracy").innerText = accuracy + "%";

    var monthsData = {};
    for (var j = 0; j < studentRecords.length; j++) {
        var rec = studentRecords[j];
        var ym = rec.date.substring(0, 7); 
        if (!monthsData[ym]) monthsData[ym] = [];
        monthsData[ym].push(rec);
    }

    var monthNames = { "01": "January", "02": "February", "03": "March", "04": "April", "05": "May", "06": "June", "07": "July", "08": "August", "09": "September", "10": "October", "11": "November", "12": "December" };
    var keys = Object.keys(monthsData);
    
    if (keys.length === 0) {
        historyContainer.innerHTML = "<p style='color:#64748b; font-size:14px;'>Abhi tak aapka koi attendance record mojood nahi hai.</p>";
        return;
    }

    for (var k = 0; k < keys.length; k++) {
        var ym = keys[k];
        var parts = ym.split("-");
        var monthTitle = (monthNames[parts[1]] || parts[1]) + " " + parts[0];
        var presentInMonth = monthsData[ym].length;

        var monthCardHTML = `
            <div class="month-card" style="border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 6px; padding: 15px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="toggleMonthDetails('${ym}')">
                    <div>
                        <h4 style="margin: 0; color: #0b2545; font-size: 16px;">📅 ${monthTitle}</h4>
                        <p style="margin: 5px 0 0 0; font-size: 13px; color: #475569;">
                            <span style="color: #16a34a; font-weight: bold;">Present: ${presentInMonth} Days</span>
                        </p>
                    </div>
                    <span style="font-size: 14px; color: #2563eb; font-weight: bold;">View Details ▼</span>
                </div>
                <div id="details-${ym}" style="display: none; margin-top: 12px; border-top: 1px dashed #cbd5e1; padding-top: 10px;">
                    <div id="list-${ym}"></div>
                </div>
            </div>
        `;
        historyContainer.innerHTML += monthCardHTML;

        setTimeout((function(ymKey, recordsList) {
            return function() {
                var innerContainer = document.getElementById("list-" + ymKey);
                if (innerContainer) {
                    var htmlContent = "";
                    for (var r = 0; r < recordsList.length; r++) {
                        htmlContent += `<div style="background: #fff; padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 4px; display: flex; justify-content: space-between; font-size: 13px;"><span><b>Date:</b> ${recordsList[r].date}</span><span style="color: #16a34a; font-weight: bold;">Present (${recordsList[r].time})</span></div>`;
                    }
                    innerContainer.innerHTML = htmlContent;
                }
            };
        })(ym, monthsData[ym]), 50);
    }
}

function toggleMonthDetails(ym) {
    var detailsDiv = document.getElementById("details-" + ym);
    detailsDiv.style.display = detailsDiv.style.display === "none" ? "block" : "none";
}

// 4. Submit Complaint
function submitNewComplaint() {
    var email = document.getElementById("complaintEmail").value.trim();
    var title = document.getElementById("complaintTitle").value.trim();
    var message = document.getElementById("complaintText").value.trim();

    if (!email || !title || !message) {
        showToast("Please fill in all fields!", true);
        return;
    }

    var complaintRecord = {
        id: Date.now(),
        rollNo: currentStudent.rollNo,
        name: currentStudent.name,
        group: currentStudent.group,
        email: email,
        title: title,
        message: message,
        status: "Pending",
        date: new Date().toISOString().split('T')[0],
        time: new Date().toLocaleTimeString()
    };

    var allComplaints = JSON.parse(localStorage.getItem("collegeComplaints")) || [];
    allComplaints.push(complaintRecord);
    localStorage.setItem("collegeComplaints", JSON.stringify(allComplaints));

    document.getElementById("complaintEmail").value = "";
    document.getElementById("complaintTitle").value = "";
    document.getElementById("complaintText").value = "";

    showToast("Complaint submitted successfully!");
    loadStudentComplaints();
}

function loadStudentComplaints() {
    var allComplaints = JSON.parse(localStorage.getItem("collegeComplaints")) || [];
    var listContainer = document.getElementById("myComplaintsList");
    listContainer.innerHTML = "";

    var count = 0;
    for (var i = 0; i < allComplaints.length; i++) {
        var comp = allComplaints[i];
        if (comp.rollNo === currentStudent.rollNo && comp.group === currentStudent.group) {
            count++;
            listContainer.innerHTML += `
                <div class="complaint-card" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 15px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="toggleComplaintDetail(${comp.id})">
                        <span style="font-weight: 600; color: #0b2545; font-size: 14px;">📌 ${comp.title}</span>
                        <span style="font-size: 12px; color: #2563eb; font-weight: bold;">View ▼</span>
                    </div>
                    <div id="comp-detail-${comp.id}" style="display: none; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #cbd5e1; font-size: 13px; color: #475569;">
                        <p style="margin: 0 0 5px 0;"><b>Message:</b> ${comp.message}</p>
                    </div>
                </div>
            `;
        }
    }
    if (count === 0) listContainer.innerHTML = "<p style='color:#64748b; font-size:13px;'>No complaints submitted yet.</p>";
}

function toggleComplaintDetail(id) {
    var box = document.getElementById("comp-detail-" + id);
    box.style.display = box.style.display === "block" ? "none" : "block";
}