let currentStudent = null;

async function syncStudentAttendanceFromFirebase() {
    if (!window.currentStudent || !window.firebaseDB) return [];

    const { db, ref, get } = window.firebaseDB;
    try {
        const groupSnapshot = await get(ref(db, `attendance/${window.currentStudent.group}`));
        if (!groupSnapshot.exists()) return [];

        const groupData = groupSnapshot.val() || {};
        const firebaseRecords = [];

        Object.keys(groupData).forEach(dateKey => {
            const dateData = groupData[dateKey] || {};
            Object.keys(dateData).forEach(rollKey => {
                const record = dateData[rollKey];
                if (Number(record.rollNo) === Number(window.currentStudent.rollNo)) {
                    firebaseRecords.push(record);
                }
            });
        });

        const localRecords = JSON.parse(localStorage.getItem("collegeAttendance") || "[]");
        const merged = [...localRecords];
        const seen = new Set(merged.map(rec => `${rec.rollNo}|${rec.date}|${rec.group}`));

        firebaseRecords.forEach(record => {
            const key = `${record.rollNo}|${record.date}|${record.group}`;
            if (!seen.has(key)) {
                merged.push(record);
                seen.add(key);
            }
        });

        localStorage.setItem("collegeAttendance", JSON.stringify(merged));
        return firebaseRecords;
    } catch (error) {
        console.error("Unable to load student attendance from Firebase:", error);
        return [];
    }
}

function showToast(message, isError = false) {
    Toastify({
        text: message,
        duration: 3000,
        gravity: "top",
        position: "right",
        style: { background: isError ? "#dc2626" : "#16a34a" }
    }).showToast();
}

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

    if (window.firebaseDB) {
        const { db, ref, get, set } = window.firebaseDB;
        const studentRef = ref(db, `studentCredentials/${groupInput}_${rollNoInput}`);

        try {
            const snapshot = await get(studentRef);
            if (!snapshot.exists()) {
                showToast("Account not found! Please Sign Up first.", true);
                setTimeout(function() {
                    window.location.href = "studentSignUp.html";
                }, 1500);
                return;
            }

            const data = snapshot.val();
            if (data.password !== passInput) {
                showToast("Please enter valid password!", true);
                return;
            }

            const activeRef = ref(db, `activeLogins/${groupInput}_${rollNoInput}`);
            await set(activeRef, {
                rollNo: rollNoInput,
                name: found.name,
                group: groupInput,
                loginTime: new Date().toLocaleTimeString()
            });

        } catch (error) {
            console.error("Firebase error:", error);
            showToast("Firebase error occurred!", true);
            return;
        }
    }

    currentStudent = found;
    localStorage.setItem("loggedInStudent", JSON.stringify(found));
    showToast("Login Successful!");

    setTimeout(function() {
        window.location.href = "../ComplaintPortal/studentPortal.html";
    }, 1000);
}

async function studentLogout() {
    if (currentStudent && window.firebaseDB) {
        const { db, ref, set } = window.firebaseDB;
        const activeRef = ref(db, `activeLogins/${currentStudent.group}_${currentStudent.rollNo}`);
        await set(activeRef, null);
    }

    currentStudent = null;
    localStorage.removeItem("loggedInStudent");
    document.getElementById("loginRollNo").value = "";
    document.getElementById("loginGroup").selectedIndex = 0;
    document.getElementById("loginPassword").value = "";
    document.getElementById("dashboardSection").style.display = "none";
    document.getElementById("loginSection").style.display = "block";
    showToast("Logged out successfully");
}

async function loadStudentAttendanceSummary() {
    var allAttendance = JSON.parse(localStorage.getItem("collegeAttendance")) || [];
    var historyContainer = document.getElementById("attendanceHistoryList");
    if (!historyContainer) return;
    historyContainer.innerHTML = "";

    if (!window.currentStudent) {
        var savedStudent = localStorage.getItem("loggedInStudent");
        if (savedStudent) {
            window.currentStudent = JSON.parse(savedStudent);
        } else {
            return;
        }
    }

    if (window.firebaseDB) {
        await syncStudentAttendanceFromFirebase();
        allAttendance = JSON.parse(localStorage.getItem("collegeAttendance")) || [];
    }

    var studentRecords = [];
    for (var i = 0; i < allAttendance.length; i++) {
        if (Number(allAttendance[i].rollNo) === Number(window.currentStudent.rollNo) &&
            allAttendance[i].group === window.currentStudent.group) {
            studentRecords.push(allAttendance[i]);
        }
    }

    var totalPresent = studentRecords.length;
    var presentCountElem = document.getElementById("totalPresentCount");
    var accuracyElem = document.getElementById("attendanceAccuracy");

    if (presentCountElem) presentCountElem.innerText = totalPresent + " Days";

    var totalWorkingDays = 25;
    var accuracy = totalPresent > 0 ? Math.min(100, Math.round((totalPresent / totalWorkingDays) * 100)) : 0;
    if (accuracyElem) accuracyElem.innerText = accuracy + "%";

    var monthsData = {};
    for (var j = 0; j < studentRecords.length; j++) {
        var rec = studentRecords[j];
        var ym = rec.date ? rec.date.substring(0, 7) : "2026-06";
        if (!monthsData[ym]) monthsData[ym] = [];
        monthsData[ym].push(rec);
    }

    var monthNames = {
        "01": "January", "02": "February", "03": "March", "04": "April",
        "05": "May", "06": "June", "07": "July", "08": "August",
        "09": "September", "10": "October", "11": "November", "12": "December"
    };

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
                        htmlContent += `
                            <div style="background: #fff; padding: 6px 10px; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 4px; display: flex; justify-content: space-between; font-size: 12px; color: #334155;">
                                <span><b>Date:</b> ${recordsList[r].date}</span>
                                <span style="color: #16a34a; font-weight: bold;">Present (${recordsList[r].time || 'N/A'})</span>
                            </div>
                        `;
                    }
                    innerContainer.innerHTML = htmlContent;
                }
            };
        })(ym, monthsData[ym]), 50);
    }
}

function toggleMonthDetails(ym) {
    var detailsDiv = document.getElementById("details-" + ym);
    if (detailsDiv) {
        detailsDiv.style.display = detailsDiv.style.display === "none" ? "block" : "none";
    }
}

function loadStudentComplaints() {
    var allComplaints = JSON.parse(localStorage.getItem("collegeComplaints")) || [];
    var listContainer = document.getElementById("myComplaintsList");
    if (!listContainer) return;
    listContainer.innerHTML = "";

    if (!window.currentStudent) {
        var savedStudent = localStorage.getItem("loggedInStudent");
        if (savedStudent) {
            window.currentStudent = JSON.parse(savedStudent);
        } else {
            return;
        }
    }

    var count = 0;
    for (var i = 0; i < allComplaints.length; i++) {
        var comp = allComplaints[i];

        if (Number(comp.rollNo) === Number(window.currentStudent.rollNo) && comp.group === window.currentStudent.group) {
            count++;
            var statusBadge = comp.status === "Resolved" ? 
                "<span style='color: #16a34a; font-weight: bold; font-size: 12px;'>[Resolved]</span>" : 
                "<span style='color: #d97706; font-weight: bold; font-size: 12px;'>[Pending]</span>";

            var complaintHTML = `
                <div class="complaint-card" style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 15px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" onclick="toggleComplaintDetail('${comp.id}')">
                        <div>
                            <span style="font-weight: 600; color: #0b2545; font-size: 14px;">📌 ${comp.title}</span>
                            <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Date: ${comp.date}</div>
                        </div>
                        <div>
                            ${statusBadge}
                            <span style="font-size: 12px; color: #2563eb; margin-left: 8px; font-weight: bold;">View ▼</span>
                        </div>
                    </div>

                    <div id="comp-detail-${comp.id}" style="display: none; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #cbd5e1; font-size: 13px; color: #475569;">
                        <p style="margin: 0 0 5px 0;"><b>Email:</b> ${comp.email}</p>
                        <p style="margin: 0 0 5px 0;"><b>Message:</b></p>
                        <p style="margin: 0; background: #fff; padding: 8px; border-radius: 4px; border: 1px solid #e2e8f0;">${comp.message}</p>
                    </div>
                </div>
            `;
            listContainer.innerHTML += complaintHTML;
        }
    }

    if (count === 0) {
        listContainer.innerHTML = "<p style='color:#64748b; font-size:13px;'>Aapne abhi tak koi complaint submit nahi ki.</p>";
    }
}

function toggleComplaintDetail(id) {
    var detailBox = document.getElementById("comp-detail-" + id);
    if (detailBox) {
        detailBox.style.display = detailBox.style.display === "block" ? "none" : "block";
    }
}
