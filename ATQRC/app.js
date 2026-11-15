let html5QrCode = null;

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
            // Yahan se direct onScanSuccess ko call kiya hai
            onScanSuccess(decodedText, decodedResult);
        },
        (errorMessage) => {
            // Scanning in progress errors (ignore)
        }
    ).catch(err => {
        console.error("Unable to start scanning.", err);
        alert("Camera start nahi ho saka! Make sure aap Live Server use kar rahe hain aur camera permission allowed hai.");
    });
}

// Jab QR code successfully scan ho jaye
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

    // Scanner ko rokhna aur hide karna (Correct variable name: html5QrCode)
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
    // Scanning errors ko ignore karne ke liye
}

// Manual button ke liye function
function saveAttendance() {
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

    processAttendance(studentFound.rollNo, studentFound.group);
    
    document.getElementById("rollNo").value = "";
    document.getElementById("groupSelect").selectedIndex = 0;
}

// Common function jo check karega ke aaj attendance lag chuki hai ya nahi
function processAttendance(rollNo, group) {
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

    // Check karein ke kya is student ki aaj ki date mein pehle se attendance lag chuki hai?
    var alreadyMarked = false;
    for (var j = 0; j < allAttendance.length; j++) {
        if (allAttendance[j].rollNo === rollNo && allAttendance[j].date === currentDate) {
            alreadyMarked = true;
            break;
        }
    }

    if (alreadyMarked) {
        alert("⚠️ Notice: " + studentFound.name + " (Roll No: " + rollNo + ") ki aaj ki attendance pehle hi lag chuki hai!");
        return;
    }

    // Agar aaj ki attendance nahi lagi, toh naya record save karein
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

    loadTodayAttendance();
    alert("✅ Success: " + studentFound.name + " ki aaj ki attendance lag gayi!");
}
// Aaj ki attendance ko screen par load aur show karna
function loadTodayAttendance() {
    var currentDate = new Date().toISOString().split('T')[0];
    var allAttendance = JSON.parse(localStorage.getItem("collegeAttendance")) || [];

    var groups = ["CS", "Bio", "Eng", "Arts", "Gen"];
    for (var g = 0; g < groups.length; g++) {
        var grp = groups[g].toLowerCase();
        document.getElementById(grp + "List").innerHTML = "";
        document.getElementById(grp + "Box").style.display = "none";
    }

    for (var i = 0; i < allAttendance.length; i++) {
        var record = allAttendance[i];
        if (record.date === currentDate) {
            var targetListId = record.group.toLowerCase() + "List";
            var targetBoxId = record.group.toLowerCase() + "Box";

            document.getElementById(targetBoxId).style.display = "block";

            var recordHTML = "<div class='student-item' onclick='showStudentDetails(" + record.rollNo + ", \"" + record.date + "\")'>" +
                             "<b>" + record.name + "</b> (Roll No: " + record.rollNo + ") - " +
                             "<small style='color:green;'>Present at " + record.time + "</small></div>";

            document.getElementById(targetListId).innerHTML += recordHTML;
        }
    }
}

// Student ki detail show karne ke liye naye page par bhejna
function showStudentDetails(rollNo, date) {
    window.location.href = "showStudentData.html?rollNo=" + rollNo + "&date=" + date;
}

// Page khulte hi aaj ki attendance load ho jayegi
window.onload = function() {
    loadTodayAttendance();
};