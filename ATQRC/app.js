let html5QrCode = null;

function makeAttendanceKey(record) {
    return `${record.rollNo}|${record.date}|${record.group}`;
}

function mergeAttendanceRecords(localRecords, remoteRecords) {
    const merged = [...(localRecords || [])];
    const seen = new Set(merged.map(record => makeAttendanceKey(record)));

    for (const record of remoteRecords || []) {
        const key = makeAttendanceKey(record);
        if (!seen.has(key)) {
            merged.push(record);
            seen.add(key);
        }
    }

    return merged;
}

async function loadAttendanceFromFirebase() {
    if (!window.firebaseDB) return JSON.parse(localStorage.getItem("collegeAttendance") || "[]");

    const { db, ref, get } = window.firebaseDB;
    try {
        const snapshot = await get(ref(db, "attendance"));
        if (!snapshot.exists()) {
            return JSON.parse(localStorage.getItem("collegeAttendance") || "[]");
        }

        const attendanceData = snapshot.val();
        const remoteRecords = [];

        Object.keys(attendanceData || {}).forEach(groupKey => {
            const groupData = attendanceData[groupKey] || {};
            Object.keys(groupData).forEach(dateKey => {
                const dateData = groupData[dateKey] || {};
                Object.keys(dateData).forEach(rollKey => {
                    remoteRecords.push(dateData[rollKey]);
                });
            });
        });

        const merged = mergeAttendanceRecords(
            JSON.parse(localStorage.getItem("collegeAttendance") || "[]"),
            remoteRecords
        );

        localStorage.setItem("collegeAttendance", JSON.stringify(merged));
        return merged;
    } catch (error) {
        console.error("Unable to load attendance from Firebase:", error);
        return JSON.parse(localStorage.getItem("collegeAttendance") || "[]");
    }
}

async function saveAttendanceToFirebase(record) {
    if (!window.firebaseDB) return;

    const { db, ref, set } = window.firebaseDB;
    const attendanceRef = ref(db, `attendance/${record.group}/${record.date}/${record.rollNo}`);
    try {
        await set(attendanceRef, record);
    } catch (error) {
        console.error("Unable to save attendance to Firebase:", error);
    }
}

function startQRScanner() {
    const readerDiv = document.getElementById("reader");
    readerDiv.style.display = "block";

    if (!html5QrCode) {
        html5QrCode = new Html5Qrcode("reader");
    }

    const config = { fps: 10, qrbox: { width: 250, height: 250 } };

    html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText, decodedResult) => {
            onScanSuccess(decodedText, decodedResult);
        },
        () => {}
    ).catch(err => {
        console.error("Unable to start scanning.", err);
        alert("Camera start nahi ho saka! Make sure aap Live Server use kar rahe hain aur camera permission allowed hai.");
    });
}

function onScanSuccess(decodedText, decodedResult) {
    var scannedRollNo = Number(decodedText.trim());
    var studentFound = null;
    for (var i = 0; i < registeredStudents.length; i++) {
        if (registeredStudents[i].rollNo === scannedRollNo) {
            studentFound = registeredStudents[i];
            break;
        }
    }

    if (!studentFound) {
        alert("Error: Scanned Roll Number (" + decodedText + ") college record mein mojood nahi hai!");
        return;
    }

    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            document.getElementById("reader").style.display = "none";
        }).catch(error => {
            console.error("Failed to stop scanner.", error);
        });
    }

    processAttendance(studentFound.rollNo, studentFound.group);
}

function onScanFailure(error) {
}

async function saveAttendance() {
    var rollNoInput = Number(document.getElementById("rollNo").value.trim());
    var selectedGroup = document.getElementById("groupSelect").value;

    if (isNaN(rollNoInput) || rollNoInput === "" || selectedGroup === "") {
        alert("Bhai, theek Roll Number aur Group select karein!");
        return;
    }

    var studentFound = null;
    for (var i = 0; i < registeredStudents.length; i++) {
        if (registeredStudents[i].rollNo === rollNoInput && registeredStudents[i].group === selectedGroup) {
            studentFound = registeredStudents[i];
            break;
        }
    }

    if (studentFound === null) {
        alert("Error: Yeh Roll Number is group ke college record se match nahi karta!");
        return;
    }

    await processAttendance(studentFound.rollNo, studentFound.group);

    document.getElementById("rollNo").value = "";
    document.getElementById("groupSelect").selectedIndex = 0;
}

async function processAttendance(rollNo, group) {
    var studentFound = null;
    for (var i = 0; i < registeredStudents.length; i++) {
        if (registeredStudents[i].rollNo === rollNo) {
            studentFound = registeredStudents[i];
            break;
        }
    }

    if (!studentFound) return;

    var currentTime = new Date().toLocaleTimeString();
    var currentDate = new Date().toISOString().split('T')[0];

    var allAttendance = JSON.parse(localStorage.getItem("collegeAttendance")) || [];
    var alreadyMarked = false;
    for (var j = 0; j < allAttendance.length; j++) {
        if (allAttendance[j].rollNo === rollNo && allAttendance[j].date === currentDate && allAttendance[j].group === group) {
            alreadyMarked = true;
            break;
        }
    }

    if (alreadyMarked) {
        alert("⚠️ Notice: " + studentFound.name + " (Roll No: " + rollNo + ") ki aaj ki attendance pehle hi lag chuki hai!");
        return;
    }

    var attendanceRecord = {
        rollNo: studentFound.rollNo,
        name: studentFound.name,
        group: studentFound.group,
        time: currentTime,
        date: currentDate,
        description: "Attendance marked in " + studentFound.group + " department."
    };

    allAttendance.push(attendanceRecord);
    localStorage.setItem("collegeAttendance", JSON.stringify(allAttendance));
    await saveAttendanceToFirebase(attendanceRecord);

    await loadTodayAttendance();
    alert("✅ Success: " + studentFound.name + " ki aaj ki attendance lag gayi!");
}

async function loadTodayAttendance() {
    var currentDate = new Date().toISOString().split('T')[0];
    var allAttendance = await loadAttendanceFromFirebase();

    var groups = ["CS", "Bio", "Eng", "Arts", "Gen"];
    for (var g = 0; g < groups.length; g++) {
        var grp = groups[g].toLowerCase();
        var listElement = document.getElementById(grp + "List");
        var boxElement = document.getElementById(grp + "Box");
        if (listElement) listElement.innerHTML = "";
        if (boxElement) boxElement.style.display = "none";
    }

    for (var i = 0; i < allAttendance.length; i++) {
        var record = allAttendance[i];
        if (record.date === currentDate) {
            var targetListId = record.group.toLowerCase() + "List";
            var targetBoxId = record.group.toLowerCase() + "Box";
            var targetList = document.getElementById(targetListId);
            var targetBox = document.getElementById(targetBoxId);

            if (targetBox) targetBox.style.display = "block";

            if (targetList) {
                var recordHTML = "<div class='student-item' onclick='showStudentDetails(" + record.rollNo + ", \"" + record.date + "\")'>" +
                    "<b>" + record.name + "</b> (Roll No: " + record.rollNo + ") - " +
                    "<small style='color:green;'>Present at " + record.time + "</small></div>";
                targetList.innerHTML += recordHTML;
            }
        }
    }
}

function showStudentDetails(rollNo, date) {
    window.location.href = "showStudentData.html?rollNo=" + rollNo + "&date=" + date;
}

window.onload = function() {
    loadTodayAttendance();
};
